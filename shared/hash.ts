import { createHash } from "node:crypto";

/** Canonical JSON (sorted keys) for stable hashes. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

export const sha256Hex = (s: string): string => createHash("sha256").update(s).digest("hex");
export const hashObject = (v: unknown): string => sha256Hex(canonicalJson(v));
