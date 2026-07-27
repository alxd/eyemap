"""EyeMap GPU worker — multi-model inference for Clinica.

Polls Vercel claim API, runs selected models, posts combined callback.

Models:
  medgemma            — Ollama vision (confidences + narrative)
  eyemap-retinopathy  — compare_llms EyeMap DR specialist
  eyemap-amd          — compare_llms EyeMap AMD specialist
  medsiglip           — compare_llms MedSigLIP zero-shot
  eyemap-top          — OpenAI GPT vision structured report
"""

from __future__ import annotations

import base64
import json
import logging
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import requests

# Load worker.env from the same directory if present (so OPENAI_API_KEY is picked up)
_WORKER_DIR = Path(__file__).resolve().parent
_ENV_FILE = _WORKER_DIR / "worker.env"
if _ENV_FILE.is_file():
    with _ENV_FILE.open() as _fh:
        for _line in _fh:
            _line = _line.strip()
            if not _line or _line.startswith("#") or "=" not in _line:
                continue
            _k, _v = _line.split("=", 1)
            _k, _v = _k.strip(), _v.strip().strip('"').strip("'")
            # Do not override already-exported shell env
            if _k and _k not in os.environ:
                os.environ[_k] = _v

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("eyemap-worker")

CLINICA_API_BASE = os.environ.get("CLINICA_API_BASE", "http://127.0.0.1:3000").rstrip("/")
WORKER_SHARED_SECRET = os.environ.get("WORKER_SHARED_SECRET", "")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
# MG = MedGemma 1.5 4B vision (name not shown in dashboard)
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "medgemma-1.5-4b-vision:latest")
POLL_INTERVAL_SEC = float(os.environ.get("POLL_INTERVAL_SEC", "3"))
MAX_IDLE_BACKOFF_SEC = float(os.environ.get("MAX_IDLE_BACKOFF_SEC", "30"))
NUM_PREDICT = int(os.environ.get("NUM_PREDICT", "512"))
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "600"))

COMPARE_LLMS_DIR = os.environ.get(
    "COMPARE_LLMS_DIR",
    "/media/alex/9c367132-3c4d-42d6-9642-bc832fff61ab/compare_llms",
)

# Accept common aliases (OPEN_API_KEY typo / OPENAI_KEY)
OPENAI_API_KEY = (
    os.environ.get("OPENAI_API_KEY")
    or os.environ.get("OPEN_API_KEY")
    or os.environ.get("OPENAI_KEY")
    or ""
)
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.5")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

# MedSigLIP weights (dato_ssd) — same as compare_llms expects via MEDSIGLIP_WEIGHTS
_DEFAULT_MEDSIGLIP = "/media/alex/dato_ssd/ollama_models/MedSigLIP.safetensors"
if not os.path.isfile(_DEFAULT_MEDSIGLIP):
    _DEFAULT_MEDSIGLIP = (
        "/media/alex/9c367132-3c4d-42d6-9642-bc832fff61ab/ollama_models/MedSigLIP.safetensors"
    )
MEDSIGLIP_WEIGHTS = os.environ.get("MEDSIGLIP_WEIGHTS", _DEFAULT_MEDSIGLIP)
os.environ.setdefault("MEDSIGLIP_WEIGHTS", MEDSIGLIP_WEIGHTS)

# EyeMap specialist weights root (override if old Windows path is missing)
if os.environ.get("EYEMAP_MODELS_DIR"):
    pass  # user-provided
else:
    for candidate in (
        "/media/alex/dato_ssd/eyemap_models",
        "/media/alex/9c367132-3c4d-42d6-9642-bc832fff61ab/eyemap_models",
        os.path.expanduser("~/eyemap_models"),
    ):
        if os.path.isdir(candidate):
            os.environ["EYEMAP_MODELS_DIR"] = candidate
            break

CLASSES = ["normal", "diabetic_retinopathy", "amd", "glaucoma"]
DEFAULT_MODELS = ["medgemma"]

CONFIDENCE_PROMPT = (
    "You are an expert ophthalmologist examining a colour fundus photograph of the retina. "
    f"Estimate the probability (0 to 1) that the image belongs to each of the "
    f"following categories: {', '.join(CLASSES)}. "
    "Return only a JSON object mapping each category name to its probability, "
    "with the probabilities summing to 1."
)

NARRATIVE_PROMPT = (
    "You are an expert ophthalmologist performing a screening review of a colour "
    "fundus photograph. Write a concise clinical screening summary (short paragraphs) "
    "covering: image quality, optic disc and cup, macula, vessels, and any signs "
    "suggestive of diabetic retinopathy, AMD, or glaucoma. "
    "End with a clear screening impression and recommended follow-up urgency. "
    "Do not invent patient identifiers. This is a screening aid, not a final diagnosis."
)

EYEMAP_TOP_SYSTEM = (
    "You are an expert ophthalmologist. You give comprehensive fundus diagnoses "
    "the same way you would in a clinical chat consultation: open differential, "
    "weigh the most likely disease first, then fill a structured report.\n\n"
    "Critical differential — do NOT default to diabetic retinopathy:\n"
    "- A large central white/yellow irregular macular lesion with hard exudates, "
    "subretinal/fibrovascular tissue, disciform scarring, RPE remodeling, and "
    "relatively preserved peripheral vessels without widespread microaneurysms, "
    "venous beading, or neovascularization elsewhere → prefer advanced neovascular "
    "(wet) AMD with fibrotic/disciform scar (late AMD), not diabetic macular edema.\n"
    "- Diabetic retinopathy usually shows more diffuse microvascular signs "
    "(microaneurysms, dot/blot hemorrhages, venous beading, IRMA, possible NVE/NVD) "
    "beyond a single macular scar.\n"
    "- Hard lipid exudates alone do NOT equal diabetic retinopathy; in a disciform "
    "macular complex they often come from chronic CNV leakage.\n"
    "- If uncertain between wet AMD and DR, state the leading diagnosis and briefly "
    "note the main alternative — but most_likely_diagnosis, pathology, stage, and "
    "visual_prognosis MUST describe the SAME leading disease.\n\n"
    "Output language: Romanian (concise clinical Romanian) for all string fields.\n"
    "confidence is a number 0–1 for the leading diagnosis.\n"
    "For absent/non-applicable items use „Absent” or „Nu se aplică”.\n"
    "This is a screening aid, not a final diagnosis. Do not invent patient IDs."
)

EYEMAP_TOP_PROMPT = (
    "Examine this colour fundus photograph and provide a comprehensive ophthalmic "
    "assessment, then return ONLY a JSON object with these exact keys:\n"
    "- confidence (number 0-1)\n"
    "- image_quality\n"
    "- optic_disc\n"
    "- retinal_vessels\n"
    "- macula\n"
    "- drusen\n"
    "- geographic_atrophy\n"
    "- hemorrhage\n"
    "- fluid\n"
    "- most_likely_diagnosis  (leading diagnosis after open differential)\n"
    "- pathology  (lesions/mechanism of THAT same diagnosis)\n"
    "- stage  (stage/grade of THAT same diagnosis, e.g. late neovascular AMD with "
    "disciform scar; or NPDR/PDR with/without DME — only if DR is truly leading)\n"
    "- fibrosis\n"
    "- cnv_scar\n"
    "- active_exudation\n"
    "- visual_prognosis\n\n"
    "Write all string values in Romanian. Keep fields consistent with one disease."
)

EYEMAP_TOP_KEYS = [
    "confidence",
    "image_quality",
    "optic_disc",
    "retinal_vessels",
    "macula",
    "drusen",
    "geographic_atrophy",
    "hemorrhage",
    "fluid",
    "most_likely_diagnosis",
    "pathology",
    "stage",
    "fibrosis",
    "cnv_scar",
    "active_exudation",
    "visual_prognosis",
]


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SHARED_SECRET,
        "x-worker-prefer-internal": "true",
    }


def claim_task() -> dict[str, Any] | None:
    url = f"{CLINICA_API_BASE}/api/worker/claim"
    resp = requests.post(url, headers=_headers(), timeout=60)
    if resp.status_code == 204:
        return None
    if resp.status_code == 401:
        raise RuntimeError("Worker secret rejected by API")
    resp.raise_for_status()
    data = resp.json()
    return data.get("task")


def callback(task_id: str, status: str, result: dict | None = None, error: str | None = None) -> None:
    url = f"{CLINICA_API_BASE}/api/worker/callback"
    payload: dict[str, Any] = {"task_id": task_id, "status": status}
    if result is not None:
        payload["result"] = result
    if error is not None:
        payload["error"] = error
    resp = requests.post(url, headers=_headers(), json=payload, timeout=60)
    resp.raise_for_status()


def download_image(image_url: str, dest: Path) -> None:
    with requests.get(image_url, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        with dest.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=1024 * 256):
                if chunk:
                    fh.write(chunk)


def _encode_image(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")


def ollama_generate(
    prompt: str,
    image_b64: str,
    *,
    format_schema: dict | None = None,
    num_predict: int | None = None,
) -> str:
    payload: dict[str, Any] = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "images": [image_b64],
        "stream": False,
        "options": {"temperature": 0},
        "keep_alive": "30m",
    }
    if format_schema is not None:
        payload["format"] = format_schema
    if num_predict is not None:
        payload["options"]["num_predict"] = num_predict

    resp = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json=payload,
        timeout=OLLAMA_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("response", "") or ""


def parse_confidences(raw: str) -> dict[str, float]:
    data = None
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        import re

        match = re.search(r"\{.*\}", raw or "", re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except ValueError:
                data = None

    if not isinstance(data, dict):
        return {c: 1.0 / len(CLASSES) for c in CLASSES}

    lower = {str(k).strip().lower().replace(" ", "_"): v for k, v in data.items()}
    aliases = {
        "dr": "diabetic_retinopathy",
        "diabetic retinopathy": "diabetic_retinopathy",
        "age-related macular degeneration": "amd",
        "macular_degeneration": "amd",
    }
    for alias, canon in aliases.items():
        if alias in lower and canon not in lower:
            lower[canon] = lower[alias]

    scores: dict[str, float] = {}
    for c in CLASSES:
        try:
            scores[c] = max(float(lower.get(c, 0.0)), 0.0)
        except (TypeError, ValueError):
            scores[c] = 0.0

    total = sum(scores.values())
    if total <= 0:
        return {c: 1.0 / len(CLASSES) for c in CLASSES}
    return {c: v / total for c, v in scores.items()}


def run_medgemma(image_path: Path) -> dict[str, Any]:
    image_b64 = _encode_image(image_path)
    schema = {
        "type": "object",
        "properties": {c: {"type": "number"} for c in CLASSES},
        "required": CLASSES,
    }
    log.info("MG confidence scoring")
    raw_scores = ollama_generate(CONFIDENCE_PROMPT, image_b64, format_schema=schema)
    confidences = parse_confidences(raw_scores)
    log.info("MG narrative (num_predict=%s)", NUM_PREDICT)
    narrative = ollama_generate(
        NARRATIVE_PROMPT, image_b64, num_predict=NUM_PREDICT
    ).strip()
    return {
        "confidences": confidences,
        "narrative": narrative,
        "model": "MG",
    }


def _ensure_compare_llms_path() -> None:
    if COMPARE_LLMS_DIR not in sys.path:
        sys.path.insert(0, COMPARE_LLMS_DIR)


def run_eyemap_specialist(image_path: Path, model_id: str) -> dict[str, Any]:
    _ensure_compare_llms_path()
    import eyemap_bridge  # type: ignore
    import config as cl_config  # type: ignore

    weights = (
        cl_config.EYEMAP_RETINOPATHY_WEIGHTS
        if model_id == cl_config.EYEMAP_RETINOPATHY_MODEL_NAME
        else cl_config.EYEMAP_AMD_WEIGHTS
    )
    if not os.path.isfile(weights):
        raise RuntimeError(
            f"{model_id}: weights not found at {weights}. "
            "Set EYEMAP_MODELS_DIR (or EYEMAP_AMD_WEIGHTS / EYEMAP_RETINOPATHY_WEIGHTS) "
            "in worker.env to the folder that contains amd/ and retinopathy/."
        )

    classes = (
        ["diabetic_retinopathy", "normal"]
        if model_id == cl_config.EYEMAP_RETINOPATHY_MODEL_NAME
        else ["amd", "normal"]
    )
    scores = eyemap_bridge.score_images(
        [str(image_path)],
        classes=classes,
        model_id=model_id,
        crop_enabled=False,
    )
    vec = scores.get(str(image_path)) or scores.get(image_path.as_posix())
    if not vec:
        for v in scores.values():
            vec = v
            break
    if not vec:
        raise RuntimeError(f"{model_id}: empty scores")

    meta = eyemap_bridge.EYEMAP_MODELS[model_id]
    if isinstance(vec, list):
        disease_p = float(vec[0])
        raw = [float(x) for x in vec]
    else:
        disease_p = float(vec)
        raw = [disease_p]

    return {
        "disease_probability": float(min(max(disease_p, 0.0), 1.0)),
        "raw_scores": raw,
        "label": meta.get("label", model_id),
    }


def run_medsiglip(image_path: Path) -> dict[str, Any]:
    """MedSigLIP via compare_llms bridge. Uses EyeCLIP *venv* only (not EyeCLIP model).

    Weights: MEDSIGLIP_WEIGHTS (default dato_ssd/ollama_models/MedSigLIP.safetensors).
    Runs on CPU by default so Ollama can keep the GPU (avoids CUDA OOM).
    """
    _ensure_compare_llms_path()
    if not os.path.isfile(MEDSIGLIP_WEIGHTS):
        raise RuntimeError(
            f"MedSigLIP weights missing: {MEDSIGLIP_WEIGHTS}. "
            "Set MEDSIGLIP_WEIGHTS in worker.env"
        )
    os.environ["MEDSIGLIP_WEIGHTS"] = MEDSIGLIP_WEIGHTS

    import config as cl_config  # type: ignore
    import medsiglip_bridge  # type: ignore

    # config may already be imported by another runner — force the correct path
    cl_config.MEDSIGLIP_WEIGHTS = MEDSIGLIP_WEIGHTS

    class_names = ["Diabetes", "AMD", "Glaucoma", "Normal"]
    key_map = {
        "Diabetes": "diabetic_retinopathy",
        "AMD": "amd",
        "Glaucoma": "glaucoma",
        "Normal": "normal",
    }

    # Force CPU for the subprocess workers (inherited env)
    prev_cuda = os.environ.get("CUDA_VISIBLE_DEVICES")
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    try:
        scores = medsiglip_bridge.score_images(
            [str(image_path)],
            classes=class_names,
            crop_enabled=False,
        )
    finally:
        if prev_cuda is None:
            os.environ.pop("CUDA_VISIBLE_DEVICES", None)
        else:
            os.environ["CUDA_VISIBLE_DEVICES"] = prev_cuda

    vec = None
    for v in scores.values():
        vec = v
        break
    if not vec or len(vec) != len(class_names):
        raise RuntimeError("medsiglip: unexpected score vector")

    confidences = {
        key_map[name]: float(vec[i]) for i, name in enumerate(class_names)
    }
    return {"confidences": confidences}


def run_eyemap_top(image_path: Path) -> dict[str, Any]:
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set in worker.env "
            "(also accepted: OPEN_API_KEY / OPENAI_KEY)"
        )

    # Prefer Responses / Chat Completions with vision
    b64 = _encode_image(image_path)
    suffix = image_path.suffix.lower().lstrip(".") or "jpeg"
    if suffix == "jpg":
        suffix = "jpeg"
    data_url = f"data:image/{suffix};base64,{b64}"

    schema_props = {
        "confidence": {"type": "number"},
        **{k: {"type": "string"} for k in EYEMAP_TOP_KEYS if k != "confidence"},
    }

    # Match chat-style: system persona + user request with image
    max_tokens = int(os.environ.get("OPENAI_MAX_COMPLETION_TOKENS", "2400"))
    user_content: list[dict[str, Any]] = [
        {"type": "text", "text": EYEMAP_TOP_PROMPT},
        {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
    ]
    payload: dict[str, Any] = {
        "model": OPENAI_MODEL,
        "max_completion_tokens": max_tokens,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "eyemap_top_report",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": schema_props,
                    "required": EYEMAP_TOP_KEYS,
                    "additionalProperties": False,
                },
            },
        },
        "messages": [
            {"role": "system", "content": EYEMAP_TOP_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    }
    temp_raw = os.environ.get("OPENAI_TEMPERATURE")
    if temp_raw is not None and temp_raw != "":
        payload["temperature"] = float(temp_raw)

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    resp = requests.post(
        f"{OPENAI_BASE_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=300,
    )
    if resp.status_code >= 400:
        err_body = (resp.text or "")[:800]
        log.warning(
            "eyemap-top OpenAI %s: %s — retrying without json_schema",
            resp.status_code,
            err_body,
        )
        # Fallback without strict json_schema (some models)
        payload.pop("response_format", None)
        payload["messages"][1]["content"][0]["text"] = (
            EYEMAP_TOP_PROMPT + "\nRăspunde doar cu JSON brut."
        )
        resp = requests.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=300,
        )
    if resp.status_code >= 400:
        raise RuntimeError(
            f"OpenAI {resp.status_code}: {(resp.text or '')[:1500]}"
        )
    content = resp.json()["choices"][0]["message"]["content"] or "{}"
    try:
        data = json.loads(content)
    except ValueError:
        import re

        match = re.search(r"\{.*\}", content, re.DOTALL)
        data = json.loads(match.group(0)) if match else {}

    out = {k: data.get(k, "") for k in EYEMAP_TOP_KEYS}
    try:
        out["confidence"] = float(out["confidence"])
    except (TypeError, ValueError):
        out["confidence"] = 0.0
    # Do not expose underlying LLM name in the dashboard payload
    return out


RUNNERS = {
    "medgemma": run_medgemma,
    "eyemap-retinopathy": lambda p: run_eyemap_specialist(p, "eyemap-retinopathy"),
    "eyemap-amd": lambda p: run_eyemap_specialist(p, "eyemap-amd"),
    "medsiglip": run_medsiglip,
    "eyemap-top": run_eyemap_top,
}


def run_inference(image_path: Path, models: list[str]) -> dict[str, Any]:
    selected = [m for m in models if m in RUNNERS] or list(DEFAULT_MODELS)
    result: dict[str, Any] = {
        "models_run": [],
        "errors": {},
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    for model_id in selected:
        log.info("Running model: %s", model_id)
        try:
            out = RUNNERS[model_id](image_path)
            result[model_id] = out
            result["models_run"].append(model_id)
            # Legacy top-level fields for older UI
            if model_id == "medgemma":
                result["confidences"] = out.get("confidences", {})
                result["narrative"] = out.get("narrative", "")
                # Keep technical model name out of the dashboard-facing payload
                result["model"] = "MG"
                if isinstance(result.get("medgemma"), dict):
                    result["medgemma"] = {
                        "confidences": out.get("confidences", {}),
                        "narrative": out.get("narrative", ""),
                        "model": "MG",
                    }
        except Exception as exc:
            log.exception("Model %s failed", model_id)
            result["errors"][model_id] = str(exc)[:1500]

    if not result["models_run"] and result["errors"]:
        raise RuntimeError(
            "All models failed: " + "; ".join(f"{k}: {v}" for k, v in result["errors"].items())
        )
    return result


def process_task(task: dict[str, Any]) -> None:
    task_id = task["task_id"]
    image_url = task["image_url"]
    models = task.get("models") or DEFAULT_MODELS
    log.info("Claimed task %s models=%s", task_id, models)

    with tempfile.TemporaryDirectory(prefix="eyemap-") as tmp:
        dest = Path(tmp) / "fundus.jpg"
        try:
            download_image(image_url, dest)
            result = run_inference(dest, models)
            callback(task_id, "done", result=result)
            log.info("Task %s completed (%s)", task_id, result.get("models_run"))
        except Exception as exc:
            log.exception("Task %s failed: %s", task_id, exc)
            try:
                callback(task_id, "failed", error=str(exc)[:2000])
            except Exception:
                log.exception("Failed to report failure for %s", task_id)


def main() -> None:
    if not WORKER_SHARED_SECRET:
        log.error("WORKER_SHARED_SECRET is required")
        sys.exit(1)

    log.info("EyeMap GPU worker starting")
    log.info(
        "API=%s ollama_model=%s compare_llms=%s openai_model=%s",
        CLINICA_API_BASE,
        OLLAMA_MODEL,
        COMPARE_LLMS_DIR,
        OPENAI_MODEL,
    )

    idle_backoff = POLL_INTERVAL_SEC
    while True:
        try:
            task = claim_task()
            if task:
                idle_backoff = POLL_INTERVAL_SEC
                process_task(task)
            else:
                time.sleep(idle_backoff)
                idle_backoff = min(idle_backoff * 1.5, MAX_IDLE_BACKOFF_SEC)
        except KeyboardInterrupt:
            log.info("Shutting down")
            break
        except Exception:
            log.exception("Poll loop error")
            time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    main()
