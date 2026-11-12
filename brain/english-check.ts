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
