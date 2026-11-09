// Masquage de secrets dans les textes qui sortent du backend (journal, fichiers, journaux de console, erreurs HTTP).
// Défense en profondeur : les modules ne doivent déjà jamais mettre de clé dans un message (docs/SECURITE.md).
const PATTERNS: [RegExp, string][] = [
  [/\b(ed25519|secp256k1):[A-Za-z0-9+/=_-]{16,}/g, "$1:[masqué]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [masqué]"],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "[clé masquée]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[jwt masqué]"],
];

export function redactText(s: string): string {
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

/** Message d'erreur sûr pour un log : texte masqué et borné. */
export function safeErrorMessage(e: unknown, max = 300): string {
  const m = e instanceof Error ? e.message : String(e);
  return redactText(m).slice(0, max);
}
