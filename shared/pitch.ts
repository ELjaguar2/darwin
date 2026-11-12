// Auction pitch (L18): one public sales sentence from the agent, recorded in `bid.placed` (optional `pitch` field).
// Pure functions, no dependency outside shared/: sanitising, language detection, deterministic mock pitch.
// Decision L19: pitches are ALWAYS in English, whatever the language of the task.
import { sha256Hex } from "./hash.ts";
import type { Genome, Profession } from "./types.ts";

export const MAX_PITCH_CHARS = 240;

/**
 * Cleans a pitch coming from a model: a single line, no markup (HTML, Markdown, prompt delimiters), cleanly truncated
 * (at a word boundary, with "…") to `max` characters. Idempotent. Returns "" if nothing is left.
 */
export function sanitizePitch(raw: unknown, max = MAX_PITCH_CHARS): string {
  if (typeof raw !== "string") return "";
  let s = raw.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ");
  for (let prev = ""; prev !== s; ) { // loop until stable: removing a delimiter must not rebuild another one
    prev = s;
    s = s.replace(/<[^>]*>/g, " ").replace(/<<<|>>>|<|>/g, " ");
  }
  s = s
    .replace(/`+/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // Markdown links: keep the label
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/(\*\*|__|\*|~~)/g, "")
    .replace(/^\s*(?:[-+]\s+|\d+[.)]\s+)/, "")
    .replace(/^["«“'\s]+|["»”'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  const base = sp >= Math.floor(max * 0.5) ? cut.slice(0, sp) : cut;
  return base.replace(/[\s,;:.!?-]+$/, "") + "…";
}

const STOP: Record<"en" | "fr", string[]> = {
  en: ["the", "and", "of", "to", "is", "in", "your", "you", "for", "will", "with", "that", "be", "are", "our", "this", "it", "on", "i", "can", "my"],
  fr: ["le", "la", "les", "de", "des", "du", "et", "est", "un", "une", "votre", "vous", "pour", "que", "dans", "sur", "en", "nos", "ce", "je", "mon", "ma"],
};

/** Language of a text between English and French (share of stop words), `undefined` if undecidable. */
export function detectLanguage(text: string): "en" | "fr" | undefined {
  const words = String(text).toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
  if (words.length < 4) return undefined;
  const share = (l: "en" | "fr") => { const set = new Set(STOP[l]); return words.filter((w) => set.has(w)).length / words.length; };
  const en = share("en"), fr = share("fr");
  if (Math.max(en, fr) < 0.08 || Math.abs(en - fr) < 0.04) return undefined;
  return en > fr ? "en" : "fr";
}

/**
 * A pitch is accepted if it is not empty and not detectably French: the target language is ALWAYS English (L19), even when the
 * task text (e.g. from a visitor) is written in French. `taskText` is kept for signature stability and no longer drives the language.
 */
export function pitchLanguageOk(pitch: string, _taskText?: string): boolean {
  if (!pitch) return false;
  return detectLanguage(pitch) !== "fr";
}

const EN: Record<Profession, string[]> = {
  logo: ["I design clean, memorable logos: three SVG options that still read at small sizes.", "A simple logo with bold shapes and two colors, ready to use and free of gimmicks.", "Three distinct logo directions, delivered as clean SVG."],
  finance: ["I read your numbers line by line and report only what can be computed, nothing invented.", "A sober analysis: verifiable totals, three findings and one clearly named risk.", "Exact calculations and an honest reading, even when the numbers are bad."],
  architecture: ["A short architecture document and a Mermaid diagram you can read at a glance.", "I split the problem into simple components and their exchanges, without over-engineering.", "A clear, justified architecture you can paste straight into your repository."],
  marketing: ["A warm hook that speaks to your customers, not to your competitors.", "Simple words, the right tone and a sharp call to action: that is my whole craft.", "I write short and lively, in the exact voice of your brand."],
  translation: ["A faithful, natural translation: meaning first, wording second, proofread before delivery.", "I translate the way people actually speak, with no calques or mistranslations.", "A careful translation that keeps the tone of the original."],
  legal: ["A clear legal checklist, point by point, with its limits stated honestly.", "I list what to verify, item by item, without pretending to be a lawyer's opinion.", "Structured, cautious legal notices adapted to your case."],
};
const TAIL = {
  careful: ["I take few risks: what I promise, I deliver.", "I would rather do it right than fast.", "Careful delivery, proofread before sending."],
  bold: ["Fast delivery, I take the risk for you.", "I aim fast and true.", "Tight price, clean result."],
};

/**
 * Mock pitch: deterministic (genome + task), varied (profession sentence picked from the genome hash, tone depends on risk and
 * cooperation), always written in English (L19). No AI call.
 */
export function mockPitch(
  genome: Pick<Genome, "profession" | "personality" | "risk" | "cooperation" | "askRatio">,
  task: { id?: string; title: string; prompt: string },
): string {
  const h = sha256Hex(`${genome.profession}|${genome.personality}|${genome.risk.toFixed(3)}|${genome.askRatio.toFixed(3)}|${task.id ?? task.title}`);
  const pick = (n: number, off: number) => parseInt(h.slice(off, off + 4), 16) % n;
  const pool = EN[genome.profession] ?? EN.marketing;
  const tails = TAIL[genome.risk < 0.5 ? "careful" : "bold"];
  const trait = genome.cooperation > 0.6 ? "I work well with other agents." : "";
  return sanitizePitch([pool[pick(pool.length, 0)]!, tails[pick(tails.length, 4)]!, pick(2, 8) === 0 ? trait : ""].filter(Boolean).join(" "));
}
