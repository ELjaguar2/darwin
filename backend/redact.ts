// Masking of secrets in text leaving the backend (journal, files, console logs, HTTP errors).
// Defence in depth: modules must already never put a key in a message (docs/SECURITE.md).
const PATTERNS: [RegExp, string][] = [
  [/\b(ed25519|secp256k1):[A-Za-z0-9+/=_-]{16,}/g, "$1:[masked]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [masked]"],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "[key masked]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[jwt masked]"],
];

// Bare NEAR ed25519 private key: 64 bytes in base58 = 87 or 88 characters. False positives ruled out: needs an uppercase letter, a lowercase letter and a numeral.
const BARE_B58_KEY = /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{86,90}(?![1-9A-HJ-NP-Za-km-z])/g;
const looksLikeKey = (m: string) => /[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m);

export function redactText(s: string): string {
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out.replace(BARE_B58_KEY, (m) => (looksLikeKey(m) ? "[key masked]" : m));
}

/** Masks in place the free text of an event before any subscriber (SSE stream, /api/events) and before persistence: messages, deliverable files, pitches, task text. */
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

/** Safe error message for a log: masked and bounded text. */
export function safeErrorMessage(e: unknown, max = 300): string {
  const m = e instanceof Error ? e.message : String(e);
  return redactText(m).slice(0, max);
}
