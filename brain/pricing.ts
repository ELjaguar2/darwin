// Reading NEAR AI Cloud prices: GET {baseUrl}/models (public, no key), documented fallback.
// Real format observed on 2026-11-09 (https://cloud-api.near.ai/v1/models) :
//   { object:"list", data:[{ id, context_length, max_output_length, is_ready?, supported_features:[..],
//     output_modalities:["text"], pricing:{ input:<USD/M tok>, output:<USD/M tok>, prompt:"<USD/tok>", completion:"<USD/tok>", input_cache_read } }] }
// `pricing.input/output` are in USD per million tokens; `prompt/completion` in USD per token (strings).
// The official doc (docs.near.ai/cloud/models.md) does not give the field names: the format above comes from the real response.
import { assertValidPrice, type ModelInfo } from "../shared/index.ts";

export interface ParsedModels {
  models: ModelInfo[];
  /** Ids ignored with the reason (missing/invalid/zero price, non-text, not ready). */
  skipped: { id: string; reason: string }[];
  /** Ids that accept reasoning (their reasoning tokens are billed, R1). */
  reasoning: Set<string>;
}

const num = (x: unknown): number | undefined => {
  const n = typeof x === "string" && x.trim() !== "" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function parseModelsResponse(body: unknown): ParsedModels {
  const out: ParsedModels = { models: [], skipped: [], reasoning: new Set() };
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new Error("unexpected /models response: data field missing");
  for (const raw of data) {
    const m = raw as Record<string, any>;
    const id = typeof m?.id === "string" ? m.id : undefined;
    if (!id) continue;
    const p = m.pricing ?? {};
    const inM = num(p.input) ?? (num(p.prompt) !== undefined ? num(p.prompt)! * 1e6 : undefined);
    const outM = num(p.output) ?? (num(p.completion) !== undefined ? num(p.completion)! * 1e6 : undefined);
    const price = { usdPerMTokIn: inM as number, usdPerMTokOut: outM as number };
    try {
      assertValidPrice(price);
    } catch {
      out.skipped.push({ id, reason: "prix absent ou invalide" });
      continue;
    }
    const mods: unknown = m.output_modalities ?? m.architecture?.outputModalities;
    if (Array.isArray(mods) && !mods.includes("text")) { out.skipped.push({ id, reason: "sortie non textuelle" }); continue; }
    if (price.usdPerMTokIn === 0 && price.usdPerMTokOut === 0) { out.skipped.push({ id, reason: "zero price (never a silent zero cost)" }); continue; }
    if (price.usdPerMTokOut === 0) { out.skipped.push({ id, reason: "zero output price: not a chat model" }); continue; }
    if (m.is_ready === false) { out.skipped.push({ id, reason: "is_ready=false" }); continue; }
    const feats: unknown = m.supported_features;
    if (Array.isArray(feats) && feats.includes("reasoning")) out.reasoning.add(id);
    out.models.push({ id, ...price, contextLength: num(m.context_length), verified: true });
  }
  return out;
}

/**
 * FALLBACK (used only if GET /models fails): snapshot of 2026-11-09 taken from https://cloud-api.near.ai/v1/models.
 * Fallback models are `verified:false` and each use emits a system.warning; prices may be stale.
 */
export const FALLBACK_SNAPSHOT_DATE = "2026-11-09";
export const FALLBACK_MODELS: ModelInfo[] = [
  { id: "z-ai/glm-5.3-flash", usdPerMTokIn: 0.08, usdPerMTokOut: 0.5, contextLength: 1048576, verified: false },
  { id: "Qwen/Qwen3.8-27B", usdPerMTokIn: 0.04, usdPerMTokOut: 1.35, contextLength: 262144, verified: false },
  { id: "deepseek/deepseek-v4.1-flash", usdPerMTokIn: 0.3, usdPerMTokOut: 1.2, contextLength: 1048576, verified: false },
  { id: "anthropic/claude-sonnet-5-5", usdPerMTokIn: 2, usdPerMTokOut: 10, contextLength: 1000000, verified: false },
];
