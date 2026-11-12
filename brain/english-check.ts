// Test helper (L19): simple heuristics to check that a generated text is English and not French.
const EN_WORDS = new Set(["the", "and", "of", "to", "is", "in", "your", "you", "for", "will", "with", "that", "be", "are", "this", "it", "on", "i", "can", "my", "do", "not", "than", "what"]);
export const FR_WORDS = ["le", "la", "les", "des", "du", "une", "est", "pour", "avec", "sur", "dans", "ton", "tes", "enfant", "tu", "je", "vous", "votre", "mais", "cher", "travaille", "dépense", "gagnes"];
export const words = (t: string) => t.toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];

/** English function words present, no common French word, no French accented letter. */
export function looksEnglish(text: string): boolean {
  const w = words(text);
  const en = w.filter((x) => EN_WORDS.has(x)).length;
  const fr = w.filter((x) => FR_WORDS.includes(x)).length;
  return en >= 2 && fr === 0 && !/[éèàêôùç]/i.test(text);
}

/** Report used by brain/tools/english-validation.ts and its replay test: English function words found, French words found, verdict. */
export function languageReport(text: string): { englishWords: string[]; frenchWords: string[]; accents: boolean; english: boolean } {
  const w = words(text);
  return {
    englishWords: [...new Set(w.filter((x) => EN_WORDS.has(x)))],
    frenchWords: [...new Set(w.filter((x) => FR_WORDS.includes(x)))],
    accents: /[éèàêôùç]/i.test(text),
    english: looksEnglish(text),
  };
}

/** Verdict for an output. `short` (one-sentence pitch, <= 30 words) only needs 1 English function word instead of 2, still with zero French words and no accent. */
export function englishVerdict(text: string, short = false): boolean {
  const r = languageReport(text);
  return short ? r.englishWords.length >= 1 && r.frenchWords.length === 0 && !r.accents : r.english;
}
