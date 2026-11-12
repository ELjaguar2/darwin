// Amounts: always integers in yoctoNEAR (1 NEAR = 10^24), serialised as strings in the JSON.
export type Yocto = string;

const YOCTO = 10n ** 24n;

/** "1.5" (NEAR) -> yocto bigint. Accepts up to 24 decimals. */
export function parseNear(near: string | number): bigint {
  const s = String(near).trim();
  if (!/^\d+(\.\d{1,24})?$/.test(s)) throw new Error(`Invalid NEAR amount: ${s}`);
  const [int, frac = ""] = s.split(".");
  return BigInt(int!) * YOCTO + BigInt(frac.padEnd(24, "0"));
}

/** yocto -> readable NEAR string (up to `digits` decimals, trailing zeros removed). */
export function formatNear(yocto: bigint | Yocto, digits = 4): string {
  const v = BigInt(yocto);
  const neg = v < 0n;
  const a = neg ? -v : v;
  const int = a / YOCTO;
  const frac = (a % YOCTO).toString().padStart(24, "0").slice(0, digits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? "." + frac : ""}`;
}

export const toYocto = (v: bigint): Yocto => v.toString();

/** Usage returned by NEAR AI Cloud (OpenAI-compatible format). */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  /** completion_tokens_details.reasoning_tokens (or the deprecated alias reasoning_tokens). */
  reasoningTokens: number;
  totalTokens: number;
}

export interface ModelPrice {
  /** USD per million input / output tokens (read from GET /v1/models). */
  usdPerMTokIn: number;
  usdPerMTokOut: number;
}

/**
  * Billable output tokens (R1): max(completion, total - prompt, reasoning, 0).
  * Reasoning tokens are counted whether or not they are included in completion_tokens
  * (may slightly overestimate the cost). A missing or non-finite field counts as 0.
 */
export function billableCompletionTokens(u: Usage): number {
  const n = (x: number | undefined): number => (Number.isFinite(x) ? (x as number) : 0);
  return Math.max(n(u.completionTokens), n(u.totalTokens) - n(u.promptTokens), n(u.reasoningTokens), 0);
}

/** An unknown or invalid price is never treated as 0: explicit error. */
export function assertValidPrice(p: ModelPrice | undefined | null): asserts p is ModelPrice {
  if (!p || !Number.isFinite(p.usdPerMTokIn) || !Number.isFinite(p.usdPerMTokOut) || p.usdPerMTokIn < 0 || p.usdPerMTokOut < 0) {
    throw new Error("model price unknown or invalid: no silent zero cost");
  }
}

export function costUsd(u: Usage, p: ModelPrice): number {
  assertValidPrice(p);
  return (u.promptTokens * p.usdPerMTokIn + billableCompletionTokens(u) * p.usdPerMTokOut) / 1e6;
}

/** AI cost converted to yocto at the `nearUsdRate` rate (USD for 1 NEAR, config parameter). */
export function costYocto(u: Usage, p: ModelPrice, nearUsdRate: number): bigint {
  if (!(nearUsdRate > 0)) throw new Error("nearUsdRate must be > 0");
  const nanoUsd = BigInt(Math.ceil(costUsd(u, p) * 1e9));
  const rateMilli = BigInt(Math.max(1, Math.round(nearUsdRate * 1000)));
  // yocto = nanoUsd * 1e-9 / rate * 1e24 = nanoUsd * 1e18 / rateMilli (rounded up)
  return (nanoUsd * 10n ** 18n + rateMilli - 1n) / rateMilli;
}
