// Montants : toujours des entiers en yoctoNEAR (1 NEAR = 10^24), sérialisés en chaîne dans le JSON.
export type Yocto = string;

const YOCTO = 10n ** 24n;

/** "1.5" (NEAR) -> yocto bigint. Accepte jusqu'à 24 décimales. */
export function parseNear(near: string | number): bigint {
  const s = String(near).trim();
  if (!/^\d+(\.\d{1,24})?$/.test(s)) throw new Error(`Montant NEAR invalide : ${s}`);
  const [int, frac = ""] = s.split(".");
  return BigInt(int!) * YOCTO + BigInt(frac.padEnd(24, "0"));
}

/** yocto -> chaîne NEAR lisible (jusqu'à `digits` décimales, zéros de fin retirés). */
export function formatNear(yocto: bigint | Yocto, digits = 4): string {
  const v = BigInt(yocto);
  const neg = v < 0n;
  const a = neg ? -v : v;
  const int = a / YOCTO;
  const frac = (a % YOCTO).toString().padStart(24, "0").slice(0, digits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? "." + frac : ""}`;
}

export const toYocto = (v: bigint): Yocto => v.toString();

/** Usage renvoyé par NEAR AI Cloud (format OpenAI-compatible). */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  /** completion_tokens_details.reasoning_tokens (ou alias déprécié reasoning_tokens). */
  reasoningTokens: number;
  totalTokens: number;
}

export interface ModelPrice {
  /** USD par million de tokens d'entrée / de sortie (lus depuis GET /v1/models). */
  usdPerMTokIn: number;
  usdPerMTokOut: number;
}

/**
 * Tokens de sortie facturables (R1) : max(completion, total - prompt, reasoning, 0).
 * Les tokens de raisonnement sont comptés qu'ils soient inclus ou non dans completion_tokens
 * (peut légèrement surestimer le coût). Un champ absent ou non fini vaut 0.
 */
export function billableCompletionTokens(u: Usage): number {
  const n = (x: number | undefined): number => (Number.isFinite(x) ? (x as number) : 0);
  return Math.max(n(u.completionTokens), n(u.totalTokens) - n(u.promptTokens), n(u.reasoningTokens), 0);
}

/** Un prix inconnu ou invalide n'est jamais traité comme 0 : erreur explicite. */
export function assertValidPrice(p: ModelPrice | undefined | null): asserts p is ModelPrice {
  if (!p || !Number.isFinite(p.usdPerMTokIn) || !Number.isFinite(p.usdPerMTokOut) || p.usdPerMTokIn < 0 || p.usdPerMTokOut < 0) {
    throw new Error("prix du modèle inconnu ou invalide : pas de coût nul silencieux");
  }
}

export function costUsd(u: Usage, p: ModelPrice): number {
  assertValidPrice(p);
  return (u.promptTokens * p.usdPerMTokIn + billableCompletionTokens(u) * p.usdPerMTokOut) / 1e6;
}

/** Coût IA converti en yocto au taux `nearUsdRate` (USD pour 1 NEAR, paramètre de config). */
export function costYocto(u: Usage, p: ModelPrice, nearUsdRate: number): bigint {
  if (!(nearUsdRate > 0)) throw new Error("nearUsdRate doit être > 0");
  const nanoUsd = BigInt(Math.ceil(costUsd(u, p) * 1e9));
  const rateMilli = BigInt(Math.max(1, Math.round(nearUsdRate * 1000)));
  // yocto = nanoUsd * 1e-9 / rate * 1e24 = nanoUsd * 1e18 / rateMilli (arrondi au supérieur)
  return (nanoUsd * 10n ** 18n + rateMilli - 1n) / rateMilli;
}
