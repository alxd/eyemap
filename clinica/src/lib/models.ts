/** Model IDs available for clinic screening. */
export const AVAILABLE_MODELS = [
  {
    id: "medgemma",
    label: "MedGemma",
    description: "Analiză multimodală (confidențe + narativ) via Ollama",
  },
  {
    id: "eyemap-retinopathy",
    label: "EyeMap Retinopatie diabetică",
    description: "Model specializat EyeMap pentru retinopatie diabetică",
  },
  {
    id: "eyemap-amd",
    label: "EyeMap DMAE (AMD)",
    description: "Model specializat EyeMap pentru degenerare maculară",
  },
  {
    id: "medsiglip",
    label: "MedSigLIP",
    description: "Clasificare zero-shot pe fotografie de fund de ochi",
  },
  {
    id: "eyemap-top",
    label: "EyeMap Top (GPT)",
    description: "Raport structurat clinic via OpenAI (GPT-5.5)",
  },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_ENABLED_MODELS: ModelId[] = ["medgemma"];

export function normalizeModelIds(raw: unknown): ModelId[] {
  const allowed = new Set(AVAILABLE_MODELS.map((m) => m.id));
  if (!Array.isArray(raw)) return [...DEFAULT_ENABLED_MODELS];
  const ids = raw.filter((x): x is ModelId => typeof x === "string" && allowed.has(x as ModelId));
  return ids.length ? ids : [...DEFAULT_ENABLED_MODELS];
}
