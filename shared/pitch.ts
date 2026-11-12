// Pitch d'enchère (L18) : une phrase de vente de l'agent, publique, enregistrée dans `bid.placed` (champ optionnel `pitch`).
// Fonctions pures, sans dépendance hors shared/ : assainissement, détection de langue, pitch mock déterministe.
import { sha256Hex } from "./hash.ts";
import type { Genome, Profession } from "./types.ts";

export const MAX_PITCH_CHARS = 240;

/**
 * Nettoie un pitch venu d'un modèle : une seule ligne, sans balisage (HTML, Markdown, délimiteurs de prompt), tronqué
 * proprement (à la limite d'un mot, avec « … ») à `max` caractères. Idempotent. Renvoie "" s'il ne reste rien.
 */
export function sanitizePitch(raw: unknown, max = MAX_PITCH_CHARS): string {
  if (typeof raw !== "string") return "";
  let s = raw.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ");
  for (let prev = ""; prev !== s; ) { // boucle jusqu'à stabilité : retirer un délimiteur ne doit pas en recomposer un
    prev = s;
    s = s.replace(/<[^>]*>/g, " ").replace(/<<<|>>>|<|>/g, " ");
  }
  s = s
    .replace(/`+/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // liens Markdown : on garde le libellé
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

/** Langue d'un texte parmi français et anglais (part de mots vides), `undefined` si indécidable. */
export function detectLanguage(text: string): "en" | "fr" | undefined {
  const words = String(text).toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
  if (words.length < 4) return undefined;
  const share = (l: "en" | "fr") => { const set = new Set(STOP[l]); return words.filter((w) => set.has(w)).length / words.length; };
  const en = share("en"), fr = share("fr");
  if (Math.max(en, fr) < 0.08 || Math.abs(en - fr) < 0.04) return undefined;
  return en > fr ? "en" : "fr";
}

/** Un pitch est accepté s'il n'est pas vide et, quand les deux langues sont décelables, écrit dans la langue de la tâche. */
export function pitchLanguageOk(pitch: string, taskText: string): boolean {
  if (!pitch) return false;
  const want = detectLanguage(taskText);
  const got = detectLanguage(pitch);
  return !(want && got && want !== got);
}

const FR: Record<Profession, string[]> = {
  logo: ["Je dessine des logos nets et mémorables, trois pistes livrées en SVG propre.", "Un logo simple qui tient en petit format : formes franches, deux couleurs, aucun gadget.", "Trois propositions de logo distinctes, prêtes à l'emploi, sans fioriture."],
  finance: ["Je lis vos chiffres ligne par ligne et je ne retiens que ce qui est calculable, sans rien inventer.", "Analyse chiffrée sobre : totaux vérifiables, trois constats, un risque clairement nommé.", "Des calculs exacts et une lecture honnête, y compris quand les chiffres sont mauvais."],
  architecture: ["Un document d'architecture court et un schéma Mermaid lisible dès la première lecture.", "Je découpe le problème en composants simples, avec leurs échanges, sans sur-ingénierie.", "Architecture claire et justifiée, un schéma que vous pouvez coller tel quel dans votre dépôt."],
  marketing: ["Une accroche chaleureuse qui parle à vos clients, pas à vos concurrents.", "Des mots simples, un ton juste et un appel à l'action net : c'est tout mon métier.", "Je rédige court et vivant, avec le ton exact de votre marque."],
  translation: ["Traduction fidèle et naturelle : le sens d'abord, la lettre ensuite, relue avant envoi.", "Je traduis comme on parlerait vraiment, sans calque ni contresens.", "Une traduction soignée qui garde le ton de l'original."],
  legal: ["Une checklist juridique claire, point par point, avec les limites annoncées honnêtement.", "Je liste ce qu'il faut vérifier, article par article, sans promettre un avis d'avocat.", "Des mentions légales structurées et prudentes, adaptées à votre cas."],
};
const EN: Record<Profession, string[]> = {
  logo: ["I design clean, memorable logos: three SVG options that still read at small sizes.", "A simple logo with bold shapes and two colors, ready to use and free of gimmicks.", "Three distinct logo directions, delivered as clean SVG."],
  finance: ["I read your numbers line by line and report only what can be computed, nothing invented.", "A sober analysis: verifiable totals, three findings and one clearly named risk.", "Exact calculations and an honest reading, even when the numbers are bad."],
  architecture: ["A short architecture document and a Mermaid diagram you can read at a glance.", "I split the problem into simple components and their exchanges, without over-engineering.", "A clear, justified architecture you can paste straight into your repository."],
  marketing: ["A warm hook that speaks to your customers, not to your competitors.", "Simple words, the right tone and a sharp call to action: that is my whole craft.", "I write short and lively, in the exact voice of your brand."],
  translation: ["A faithful, natural translation: meaning first, wording second, proofread before delivery.", "I translate the way people actually speak, with no calques or mistranslations.", "A careful translation that keeps the tone of the original."],
  legal: ["A clear legal checklist, point by point, with its limits stated honestly.", "I list what to verify, item by item, without pretending to be a lawyer's opinion.", "Structured, cautious legal notices adapted to your case."],
};
const TAIL = {
  fr: { careful: ["Je prends peu de risques : ce que je promets, je le livre.", "Je préfère bien faire que vite faire.", "Livraison soignée, relue avant envoi."], bold: ["Livraison rapide, je prends le risque pour vous.", "Je vise vite et juste.", "Prix serré, résultat net."] },
  en: { careful: ["I take few risks: what I promise, I deliver.", "I would rather do it right than fast.", "Careful delivery, proofread before sending."], bold: ["Fast delivery, I take the risk for you.", "I aim fast and true.", "Tight price, clean result."] },
};

/**
 * Pitch mock : déterministe (génome + tâche), varié (phrase de métier choisie par empreinte du génome, ton selon le risque et la
 * coopération), écrit en anglais si la tâche l'est, en français sinon. Aucun appel IA.
 */
export function mockPitch(
  genome: Pick<Genome, "profession" | "personality" | "risk" | "cooperation" | "askRatio">,
  task: { id?: string; title: string; prompt: string },
): string {
  const lang = detectLanguage(`${task.title}. ${task.prompt}`) ?? "fr";
  const h = sha256Hex(`${genome.profession}|${genome.personality}|${genome.risk.toFixed(3)}|${genome.askRatio.toFixed(3)}|${task.id ?? task.title}`);
  const pick = (n: number, off: number) => parseInt(h.slice(off, off + 4), 16) % n;
  const pools = lang === "en" ? EN : FR;
  const pool = pools[genome.profession] ?? pools.marketing;
  const tails = TAIL[lang][genome.risk < 0.5 ? "careful" : "bold"];
  const trait = genome.cooperation > 0.6 ? (lang === "en" ? "I work well with other agents." : "Je travaille volontiers avec d'autres agents.") : "";
  return sanitizePitch([pool[pick(pool.length, 0)]!, tails[pick(tails.length, 4)]!, pick(2, 8) === 0 ? trait : ""].filter(Boolean).join(" "));
}
