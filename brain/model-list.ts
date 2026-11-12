// L11: whitelist of cheap models + GET /v1/model/list catalogue (dynamic prices, USD per token = amount / 10^scale).
// Verified on 2026-11-10 on https://cloud-api.near.ai/v1/model/list (real response: { models:[{ modelId, inputCostPerToken:{amount,scale,currency},
// outputCostPerToken, metadata:{ attestationSupported, verifiable, supportedFeatures, contextLength, architecture } }] }).
import type { ModelInfo } from "../shared/index.ts";
import type { ParsedModels } from "./pricing.ts";

/** No model above this input price (USD/M) is allowed, even if it appears in the catalogue. */
export const MAX_INPUT_USD_PER_MTOK = 1;

export interface WhitelistEntry {
  id: string;
  /** Fallback prices (USD/M tokens), recorded on 2026-11-10; catalogue prices take precedence. */
  usdPerMTokIn: number;
  usdPerMTokOut: number;
  /** attestationSupported in the catalogue as of 2026-11-10 (TEE). */
  tee: boolean;
  /**
   * Model-specific request parameters to limit reasoning (billed as output tokens and which empties `max_tokens`).
   * Tested with a real call on 2026-11-10: "OK" answer with 2 to 10 tokens instead of 200 reasoning tokens.
   */
  extraBody?: Record<string, unknown>;
}

/** Extra request parameters of a whitelisted model (empty otherwise). */
export function extraBodyFor(id: string): Record<string, unknown> {
  return MODEL_WHITELIST.find((m) => m.id === id)?.extraBody ?? {};
}

export const WHITELIST_SNAPSHOT_DATE = "2026-11-10";
/**
 * Models allowed as the "model" gene. A tiny real call was made on each (`npm run ai:probe`); those that fail
 * are removed and listed in WHITELIST_REMOVED.
 */
export const MODEL_WHITELIST: WhitelistEntry[] = [
  { id: "Qwen/Qwen3.8-27B", usdPerMTokIn: 0.04, usdPerMTokOut: 1.35, tee: true, extraBody: { chat_template_kwargs: { enable_thinking: false } } },
  { id: "z-ai/glm-5.3-flash", usdPerMTokIn: 0.08, usdPerMTokOut: 0.5, tee: true, extraBody: { reasoning_effort: "low" } },
  { id: "openai/gpt-5-nano", usdPerMTokIn: 0.05, usdPerMTokOut: 0.4, tee: false, extraBody: { reasoning_effort: "minimal" } },
  { id: "anthropic/claude-haiku-5-5", usdPerMTokIn: 0.1, usdPerMTokOut: 0.5, tee: false },
  { id: "google/gemini-2.5-flash-lite", usdPerMTokIn: 0.1, usdPerMTokOut: 0.4, tee: false },
  { id: "Qwen/Qwen3.6-35B-A3B-FP8", usdPerMTokIn: 0.17, usdPerMTokOut: 1.1, tee: true, extraBody: { chat_template_kwargs: { enable_thinking: false } } },
  { id: "deepseek-ai/DeepSeek-V4.1-Flash-1017", usdPerMTokIn: 0.3, usdPerMTokOut: 1.2, tee: true },
];
/** Models removed after a failed call test (id -> reason). */
export const WHITELIST_REMOVED: Record<string, string> = {};

export function whitelistFallbackModels(list: readonly WhitelistEntry[] = MODEL_WHITELIST): ModelInfo[] {
  return list.map((m) => ({ id: m.id, usdPerMTokIn: m.usdPerMTokIn, usdPerMTokOut: m.usdPerMTokOut, verified: false }));
}

const toNum = (x: unknown): number => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);

const costPerM = (c: unknown): number | undefined => {
  const o = c as { amount?: unknown; scale?: unknown } | undefined;
  const a = toNum(o?.amount);
  const s = toNum(o?.scale);
  if (!Number.isFinite(a) || !Number.isFinite(s) || a < 0 || s < 0) return undefined;
  // Rounded to 1e-9 to erase floating-point noise (0.09999999999999999 -> 0.1).
  return Math.round((a / 10 ** s) * 1e6 * 1e9) / 1e9;
};

export interface ParsedModelList extends ParsedModels {
  /** Ids for which the catalogue announces attestationSupported (verifiable TEE). */
  attestation: Set<string>;
}

/** Parses GET /v1/model/list and keeps only the whitelist (and never a model > 1 USD/M input). */
export function parseModelList(body: unknown, allow: readonly string[] = MODEL_WHITELIST.map((m) => m.id)): ParsedModelList {
  const out: ParsedModelList = { models: [], skipped: [], reasoning: new Set(), attestation: new Set() };
  const data = (body as { models?: unknown })?.models;
  if (!Array.isArray(data)) throw new Error("unexpected /model/list response: models field missing");
  const allowed = new Set(allow);
  for (const raw of data) {
    const m = raw as Record<string, any>;
    const id = typeof m?.modelId === "string" ? m.modelId : undefined;
    if (!id || !allowed.has(id)) continue;
    const inM = costPerM(m.inputCostPerToken);
    const outM = costPerM(m.outputCostPerToken);
    if (inM === undefined || outM === undefined || outM <= 0) { out.skipped.push({ id, reason: "prix absent ou invalide" }); continue; }
    if (inM > MAX_INPUT_USD_PER_MTOK) { out.skipped.push({ id, reason: `input price > ${MAX_INPUT_USD_PER_MTOK} USD/M` }); continue; }
    const mods: unknown = m.metadata?.architecture?.outputModalities;
    if (Array.isArray(mods) && !mods.includes("text")) { out.skipped.push({ id, reason: "sortie non textuelle" }); continue; }
    if (Array.isArray(m.metadata?.supportedFeatures) && m.metadata.supportedFeatures.includes("reasoning")) out.reasoning.add(id);
    if (m.metadata?.attestationSupported === true) out.attestation.add(id);
    const ctx = toNum(m.metadata?.contextLength);
    out.models.push({ id, usdPerMTokIn: inM, usdPerMTokOut: outM, contextLength: Number.isFinite(ctx) ? ctx : undefined, verified: true });
  }
  return out;
}
