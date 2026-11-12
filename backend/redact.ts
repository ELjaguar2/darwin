// Masquage de secrets dans les textes qui sortent du backend (journal, fichiers, journaux de console, erreurs HTTP).
// Défense en profondeur : les modules ne doivent déjà jamais mettre de clé dans un message (docs/SECURITE.md).
const PATTERNS: [RegExp, string][] = [
  [/\b(ed25519|secp256k1):[A-Za-z0-9+/=_-]{16,}/g, "$1:[masqué]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [masqué]"],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "[clé masquée]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[jwt masqué]"],
];

// Clé privée ed25519 NEAR nue : 64 octets en base58 = 87 ou 88 caractères. Faux positifs écartés : il faut majuscule, minuscule et chiffre.
const BARE_B58_KEY = /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{86,90}(?![1-9A-HJ-NP-Za-km-z])/g;
const looksLikeKey = (m: string) => /[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m);

export function redactText(s: string): string {
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out.replace(BARE_B58_KEY, (m) => (looksLikeKey(m) ? "[clé masquée]" : m));
}

/** Masque en place le texte libre d'un événement avant tout abonné (flux SSE, /api/events) et avant la persistance : messages, fichiers de livrable, pitchs, texte des tâches. */
export function redactEvent(ev: { type: string; data: any }): void {
  const d = ev.data;
  if (!d || typeof d !== "object") return;
  const r = (o: any, k: string) => {
    if (o && typeof o[k] === "string") o[k] = redactText(o[k]);
  };
  switch (ev.type) {
    case "system.warning":
    case "system.error": r(d, "message"); break;
    case "deliverable.produced": if (Array.isArray(d.files)) for (const f of d.files) r(f, "content"); break;
    case "bid.placed": r(d.bid, "pitch"); break;
    case "task.posted": r(d.task, "title"); r(d.task, "prompt"); break;
    default: break;
  }
}

/** Message d'erreur sûr pour un log : texte masqué et borné. */
export function safeErrorMessage(e: unknown, max = 300): string {
  const m = e instanceof Error ? e.message : String(e);
  return redactText(m).slice(0, max);
}
