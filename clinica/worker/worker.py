"""EyeMap GPU worker — polls Vercel claim API, runs MedGemma via Ollama, callbacks.

Environment variables (see worker.env.example):
  CLINICA_API_BASE       e.g. https://clinica.eyemap.ai
  WORKER_SHARED_SECRET   must match Vercel env
  OLLAMA_HOST            default http://127.0.0.1:11434
  OLLAMA_MODEL           default medgemma-27b-vision:latest
  POLL_INTERVAL_SEC      default 3
  MAX_IDLE_BACKOFF_SEC   default 30
  NUM_PREDICT            max narrative tokens (default 512)
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("eyemap-worker")

CLINICA_API_BASE = os.environ.get("CLINICA_API_BASE", "http://127.0.0.1:3000").rstrip("/")
WORKER_SHARED_SECRET = os.environ.get("WORKER_SHARED_SECRET", "")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "medgemma-27b-vision:latest")
POLL_INTERVAL_SEC = float(os.environ.get("POLL_INTERVAL_SEC", "3"))
MAX_IDLE_BACKOFF_SEC = float(os.environ.get("MAX_IDLE_BACKOFF_SEC", "30"))
NUM_PREDICT = int(os.environ.get("NUM_PREDICT", "512"))
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "600"))

CLASSES = ["normal", "diabetic_retinopathy", "amd", "glaucoma"]

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
        "options": {
            "temperature": 0,
        },
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
    # Normalize aliases
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


def run_inference(image_path: Path) -> dict[str, Any]:
    image_b64 = _encode_image(image_path)
    schema = {
        "type": "object",
        "properties": {c: {"type": "number"} for c in CLASSES},
        "required": CLASSES,
    }

    log.info("Running confidence scoring with %s", OLLAMA_MODEL)
    raw_scores = ollama_generate(CONFIDENCE_PROMPT, image_b64, format_schema=schema)
    confidences = parse_confidences(raw_scores)

    log.info("Running narrative summary (num_predict=%s)", NUM_PREDICT)
    narrative = ollama_generate(
        NARRATIVE_PROMPT,
        image_b64,
        num_predict=NUM_PREDICT,
    ).strip()

    return {
        "confidences": confidences,
        "narrative": narrative,
        "model": OLLAMA_MODEL,
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def process_task(task: dict[str, Any]) -> None:
    task_id = task["task_id"]
    image_url = task["image_url"]
    log.info("Claimed task %s", task_id)

    with tempfile.TemporaryDirectory(prefix="eyemap-") as tmp:
        dest = Path(tmp) / "fundus.jpg"
        try:
            download_image(image_url, dest)
            result = run_inference(dest)
            callback(task_id, "done", result=result)
            log.info("Task %s completed", task_id)
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
    log.info("API=%s model=%s ollama=%s", CLINICA_API_BASE, OLLAMA_MODEL, OLLAMA_HOST)

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
