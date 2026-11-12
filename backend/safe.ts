// Validation of what comes from a replay journal or a deliverable before serving it (docs/SECURITE.md, finding 5).
/** Types served as is. Professions produce image/svg+xml, text/markdown and text/vnd.mermaid; text/plain and application/json as fallback/opening. */
export const ALLOWED_MIMES = ["text/plain", "text/markdown", "image/svg+xml", "text/vnd.mermaid", "application/json"] as const;
const MIME_SET = new Set<string>(ALLOWED_MIMES);

/** Deliverable file name: no separator, no space, 1 to 64 characters. */
export const FILE_NAME_RE = /^[a-z0-9._-]{1,64}$/;

export const isSafeFileName = (n: unknown): n is string => typeof n === "string" && FILE_NAME_RE.test(n) && n !== "." && n !== "..";

/** Type allow-list; everything else (text/html, etc.) falls back to text/plain. */
export function safeMime(m: unknown): string {
  const t = typeof m === "string" ? m.trim().toLowerCase().split(";")[0]!.trim() : "";
  return MIME_SET.has(t) ? t : "text/plain";
}
