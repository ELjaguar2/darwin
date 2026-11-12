// Validation de ce qui vient d'un journal de rejeu ou d'un livrable avant de le servir (docs/SECURITE.md, constat 5).
/** Types servis tels quels. Les métiers produisent image/svg+xml, text/markdown et text/vnd.mermaid ; text/plain et application/json en repli/ouverture. */
export const ALLOWED_MIMES = ["text/plain", "text/markdown", "image/svg+xml", "text/vnd.mermaid", "application/json"] as const;
const MIME_SET = new Set<string>(ALLOWED_MIMES);

/** Nom de fichier de livrable : ni séparateur, ni espace, 1 à 64 caractères. */
export const FILE_NAME_RE = /^[a-z0-9._-]{1,64}$/;

export const isSafeFileName = (n: unknown): n is string => typeof n === "string" && FILE_NAME_RE.test(n) && n !== "." && n !== "..";

/** Liste blanche de types ; tout le reste (text/html, etc.) retombe sur text/plain. */
export function safeMime(m: unknown): string {
  const t = typeof m === "string" ? m.trim().toLowerCase().split(";")[0]!.trim() : "";
  return MIME_SET.has(t) ? t : "text/plain";
}
