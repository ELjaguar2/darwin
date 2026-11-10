// L11 : liste blanche de modèles bon marché + catalogue GET /v1/model/list (prix dynamiques, USD par token = amount / 10^scale).
// Vérifié le 2026-11-10 sur https://cloud-api.near.ai/v1/model/list (réponse réelle : { models:[{ modelId, inputCostPerToken:{amount,scale,currency},
// outputCostPerToken, metadata:{ attestationSupported, verifiable, supportedFeatures, contextLength, architecture } }] }).
import type { ModelInfo } from "../shared/index.ts";
import type { ParsedModels } from "./pricing.ts";

/** Aucun modèle au-dessus de ce prix d'entrée (USD/M) n'est autorisé, même s'il figure dans le catalogue. */
export const MAX_INPUT_USD_PER_MTOK = 1;

export interface WhitelistEntry {
  id: string;
  /** Prix de repli (USD/M tokens), relevés le 2026-11-10 ; les prix du catalogue priment. */
  usdPerMTokIn: number;
  usdPerMTokOut: number;
  /** attestationSupported dans le catalogue au 2026-11-10 (TEE). */
  tee: boolean;
  /**
   * Paramètres de requête propres au modèle pour limiter le raisonnement (facturé en tokens de sortie et qui vide `max_tokens`).
   * Testés par un vrai appel le 2026-11-10 : réponse "OK" avec 2 à 10 tokens au lieu de 200 tokens de raisonnement.
   */
  extraBody?: Record<string, unknown>;
}

/** Paramètres de requête supplémentaires d'un modèle de la liste blanche (vide sinon). */
export function extraBodyFor(id: string): Record<string, unknown> {
  return MODEL_WHITELIST.find((m) => m.id === id)?.extraBody ?? {};
}

export const WHITELIST_SNAPSHOT_DATE = "2026-11-10";
/**
 * Modèles autorisés comme gène « modèle ». Un vrai appel minuscule a été fait sur chacun (`npm run ai:probe`) ; ceux qui échouent
 * sont retirés et listés dans WHITELIST_REMOVED.
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
/** Modèles retirés après échec du test d'appel (id -> raison). */
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
  // Arrondi à 1e-9 pour effacer le bruit flottant (0.09999999999999999 -> 0.1).
  return Math.round((a / 10 ** s) * 1e6 * 1e9) / 1e9;
};

export interface ParsedModelList extends ParsedModels {
  /** Ids dont le catalogue annonce attestationSupported (TEE vérifiable). */
  attestation: Set<string>;
}

/** Analyse GET /v1/model/list et ne garde que la liste blanche (et jamais un modèle > 1 USD/M en entrée). */
export function parseModelList(body: unknown, allow: readonly string[] = MODEL_WHITELIST.map((m) => m.id)): ParsedModelList {
  const out: ParsedModelList = { models: [], skipped: [], reasoning: new Set(), attestation: new Set() };
  const data = (body as { models?: unknown })?.models;
  if (!Array.isArray(data)) throw new Error("réponse /model/list inattendue : champ models absent");
  const allowed = new Set(allow);
  for (const raw of data) {
    const m = raw as Record<string, any>;
    const id = typeof m?.modelId === "string" ? m.modelId : undefined;
    if (!id || !allowed.has(id)) continue;
    const inM = costPerM(m.inputCostPerToken);
    const outM = costPerM(m.outputCostPerToken);
    if (inM === undefined || outM === undefined || outM <= 0) { out.skipped.push({ id, reason: "prix absent ou invalide" }); continue; }
    if (inM > MAX_INPUT_USD_PER_MTOK) { out.skipped.push({ id, reason: `prix d'entrée > ${MAX_INPUT_USD_PER_MTOK} USD/M` }); continue; }
    const mods: unknown = m.metadata?.architecture?.outputModalities;
    if (Array.isArray(mods) && !mods.includes("text")) { out.skipped.push({ id, reason: "sortie non textuelle" }); continue; }
    if (Array.isArray(m.metadata?.supportedFeatures) && m.metadata.supportedFeatures.includes("reasoning")) out.reasoning.add(id);
    if (m.metadata?.attestationSupported === true) out.attestation.add(id);
    const ctx = toNum(m.metadata?.contextLength);
    out.models.push({ id, usdPerMTokIn: inM, usdPerMTokOut: outM, contextLength: Number.isFinite(ctx) ? ctx : undefined, verified: true });
  }
  return out;
}
