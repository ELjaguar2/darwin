// Lecture des prix NEAR AI Cloud : GET {baseUrl}/models (public, sans clé), repli documenté.
// Format réel observé le 2026-11-09 (https://cloud-api.near.ai/v1/models) :
//   { object:"list", data:[{ id, context_length, max_output_length, is_ready?, supported_features:[..],
//     output_modalities:["text"], pricing:{ input:<USD/M tok>, output:<USD/M tok>, prompt:"<USD/tok>", completion:"<USD/tok>", input_cache_read } }] }
// `pricing.input/output` sont en USD par million de tokens ; `prompt/completion` en USD par token (chaînes).
// La doc officielle (docs.near.ai/cloud/models.md) ne donne pas les noms de champs : le format ci-dessus vient de la réponse réelle.
import { assertValidPrice, type ModelInfo } from "../shared/index.ts";

export interface ParsedModels {
  models: ModelInfo[];
  /** Ids ignorés avec la raison (prix absent/invalide/nul, non textuel, non prêt). */
  skipped: { id: string; reason: string }[];
  /** Ids qui acceptent le raisonnement (leurs tokens de raisonnement sont facturés, R1). */
  reasoning: Set<string>;
}

const num = (x: unknown): number | undefined => {
  const n = typeof x === "string" && x.trim() !== "" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function parseModelsResponse(body: unknown): ParsedModels {
  const out: ParsedModels = { models: [], skipped: [], reasoning: new Set() };
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new Error("réponse /models inattendue : champ data absent");
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
    if (price.usdPerMTokIn === 0 && price.usdPerMTokOut === 0) { out.skipped.push({ id, reason: "prix nul (jamais de coût nul silencieux)" }); continue; }
    if (price.usdPerMTokOut === 0) { out.skipped.push({ id, reason: "prix de sortie nul : pas un modèle de chat" }); continue; }
    if (m.is_ready === false) { out.skipped.push({ id, reason: "is_ready=false" }); continue; }
    const feats: unknown = m.supported_features;
    if (Array.isArray(feats) && feats.includes("reasoning")) out.reasoning.add(id);
    out.models.push({ id, ...price, contextLength: num(m.context_length), verified: true });
  }
  return out;
}

/**
 * REPLI (utilisé seulement si GET /models échoue) : instantané du 2026-11-09 tiré de https://cloud-api.near.ai/v1/models.
 * Les modèles du repli sont `verified:false` et chaque usage émet un system.warning ; les prix peuvent être périmés.
 */
export const FALLBACK_SNAPSHOT_DATE = "2026-11-09";
export const FALLBACK_MODELS: ModelInfo[] = [
  { id: "z-ai/glm-5.3-flash", usdPerMTokIn: 0.08, usdPerMTokOut: 0.5, contextLength: 1048576, verified: false },
  { id: "Qwen/Qwen3.8-27B", usdPerMTokIn: 0.04, usdPerMTokOut: 1.35, contextLength: 262144, verified: false },
  { id: "deepseek/deepseek-v4.1-flash", usdPerMTokIn: 0.3, usdPerMTokOut: 1.2, contextLength: 1048576, verified: false },
  { id: "anthropic/claude-sonnet-5-5", usdPerMTokIn: 2, usdPerMTokOut: 10, contextLength: 1000000, verified: false },
];
