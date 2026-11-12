// "Real freelance" catalogue (lot L16): 6 professions, reference prices, scoring rubrics and production instructions.
// Single source for: market/ (minimum price, judges, simulated client), brain/prompts.ts (instructions), frontend (labels).
// Everything the market generates or displays is in English (decision L19); stable protocol codes are kept as they are.
import type { MarketEvent } from "./deliverable.ts";
import { parseNear, type Yocto } from "./money.ts";
import type { Profession } from "./types.ts";

/**
 * SINGLE test USD -> NEAR factor: nearPrice = refUsd x 0.0003 (project lead decision, sourced prices in docs/CATALOGUE_FREELANCE.md).
 * This is not an exchange rate: on testnet NEAR has no value, we only keep the price RATIOS between professions
 * (budgets 0.012 to 0.06 NEAR). See D-037.
 */
export const NEAR_PER_REF_USD = 0.0003;

export interface RubricCriterion {
  id: string;
  description: string;
  /** Weight in the score; the weights of a rubric sum to 1. */
  weight: number;
}

export interface ProfessionSpec {
  profession: Profession;
  label: string;
  /** Reference price (USD) of a standard deliverable from a human freelancer. Sourced values: docs/CATALOGUE_FREELANCE.md. */
  refUsd: number;
  /** Minimum task budget (floor price), in yocto = refUsd x NEAR_PER_REF_USD. */
  nearPrice: bigint;
  /** Description of the expected deliverable (shown in the form and in the judge prompt). */
  deliverable: string;
  /** Produced file names (see market/deliverable.ts). Stable protocol identifiers: kept as they are. */
  files: string[];
  rubric: RubricCriterion[];
  /** Minimum weighted score (0..1) for the judge to accept (the deterministic checks must also pass). */
  acceptScore: number;
  /** Production instructions injected into the agent's `system` message (extractable output format). Always ends with ENGLISH_ONLY. */
  instructions: string;
  /** Recommended output token cap to produce this deliverable (the engine may use it instead of maxTokensPerCall). */
  maxOutputTokens: number;
  /** Base demand weight (popularity of the profession with the simulated client). */
  baseDemand: number;
}

export const LEGAL_DISCLAIMER = "This is not legal advice.";

/** Mandatory sentence in every production and judge prompt (decision L19: the whole project speaks English). */
export const ENGLISH_ONLY = "Always answer in English.";

/** Brands never to reuse in a logo (non-exhaustive list: a word check, not a prior-art search). */
export const BRANDS_TO_AVOID: readonly string[] = [
  "google", "apple", "microsoft", "amazon", "facebook", "instagram", "whatsapp", "twitter", "tiktok", "youtube", "netflix",
  "spotify", "tesla", "nike", "adidas", "puma", "reebok", "coca-cola", "coca cola", "pepsi", "mcdonald", "starbucks", "burger king",
  "ikea", "samsung", "sony", "intel", "nvidia", "ibm", "paypal", "mastercard", "uber", "airbnb", "ferrari", "bmw",
  "mercedes", "audi", "toyota", "volkswagen", "renault", "peugeot", "citroen", "chanel", "gucci", "louis vuitton", "hermes", "lacoste",
  "danone", "nestle", "carrefour", "decathlon", "sncf", "disney", "lego", "nintendo", "playstation", "xbox", "openai",
  "anthropic", "linkedin", "slack", "dropbox", "github", "gitlab", "binance", "coinbase", "bitcoin", "ethereum",
];

const np = (near: string): bigint => parseNear(near);
const rub = (...c: [string, string, number][]): RubricCriterion[] => c.map(([id, description, weight]) => ({ id, description, weight }));

const MD_RULES = `Answer in Markdown, with no preamble or off-topic conclusion. ${ENGLISH_ONLY}`;

export const CATALOGUE: Record<Profession, ProfessionSpec> = {
  logo: {
    profession: "logo", label: "Logo", refUsd: 150, nearPrice: np("0.045"), baseDemand: 1.2, acceptScore: 0.6, maxOutputTokens: 3000,
    deliverable: "3 original logo proposals, each as a standalone SVG (viewBox 0 0 256 256).",
    files: ["logo-1.svg", "logo-2.svg", "logo-3.svg"],
    rubric: rub(
      ["originality", "The logos are original and do not resemble any existing brand.", 0.3],
      ["relevance", "The logos match the given company name and sector.", 0.3],
      ["legibility", "Simple shapes, readable at small size, coherent palette.", 0.2],
      ["variety", "The three proposals are really different from one another.", 0.2],
    ),
    instructions:
      "You are a graphic designer. Produce EXACTLY 3 logo proposals, each in its own ```svg code block (3 blocks, no more, no less). " +
      'Each SVG is standalone: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"> ... </svg>, simple vector shapes (rect, circle, path, polygon, text). ' +
      "FORBIDDEN: <script>, <foreignObject>, on* attributes, <image>, external href or url(), external fonts. " +
      "The logo is ORIGINAL: never reuse the name, symbol or recognisable style of an existing brand. " +
      `You may write the given company name in a <text>. Between the blocks, at most one sentence per logo (the idea behind it). ${ENGLISH_ONLY}`,
  },
  finance: {
    profession: "finance", label: "Financial analysis", refUsd: 120, nearPrice: np("0.036"), baseDemand: 1, acceptScore: 0.6, maxOutputTokens: 1800,
    deliverable: "Financial analysis in Markdown based on the figures provided in the order, calculations shown, limits stated.",
    files: ["analyse.md"],
    rubric: rub(
      ["fidelity", "Only the provided figures are used; no invented figure.", 0.35],
      ["calculations", "The calculations are shown and correct (totals, margins, variations).", 0.3],
      ["conclusions", "The conclusions follow from the figures and are useful for the decision.", 0.2],
      ["limits", "The limits of the analysis (partial data, assumptions) are stated.", 0.15],
    ),
    instructions:
      `${MD_RULES} You are a financial analyst. Work ONLY from the figures PROVIDED in the order: invent no figure, no benchmark, no market price. ` +
      "Structure: 1) Data restated (table), 2) Calculations (show every operation), 3) Reading of the results, 4) Limits. " +
      'Only announce a total if it is the exact sum of provided figures, on a line "Total <label> = <number>". State the units.',
  },
  architecture: {
    profession: "architecture", label: "Software architecture", refUsd: 200, nearPrice: np("0.06"), baseDemand: 0.8, acceptScore: 0.6, maxOutputTokens: 2000,
    deliverable: "Architecture document in Markdown with a Mermaid diagram (flowchart or simplified C4).",
    files: ["architecture.md", "schema.mmd"],
    rubric: rub(
      ["fit", "The architecture answers the described need (components, flows, constraints).", 0.3],
      ["diagram", "The Mermaid diagram is readable and consistent with the text.", 0.25],
      ["justification", "The technical choices are justified, with trade-offs and risks.", 0.25],
      ["realism", "The sizing and technologies are realistic for the context.", 0.2],
    ),
    instructions:
      `${MD_RULES} You are a software architect. Produce a Markdown document: context, components, data flows, choices and trade-offs, risks. ` +
      'Include EXACTLY ONE diagram in a ```mermaid block starting with "flowchart TD" (or a simplified "C4Context"), valid Mermaid syntax, node names without special characters.',
  },
  marketing: {
    profession: "marketing", label: "Marketing copywriting", refUsd: 80, nearPrice: np("0.024"), baseDemand: 1.1, acceptScore: 0.6, maxOutputTokens: 900,
    deliverable: "Ready-to-publish marketing copy in Markdown (hook, body, call to action).",
    files: ["texte.md"],
    rubric: rub(
      ["fit", "The text answers the order (requested product, target, tone, format).", 0.35],
      ["hook", "Punchy hook and clear call to action.", 0.25],
      ["style", "Correct English, consistent tone, no empty cliche.", 0.25],
      ["honesty", "No invented figure or unverifiable claim.", 0.15],
    ),
    instructions:
      `${MD_RULES} You are a marketing copywriter. Deliver only the final text (hook, body, call to action) in the requested tone and format. ` +
      "Invent no statistic, testimonial or numeric promise.",
  },
  translation: {
    profession: "translation", label: "Translation", refUsd: 40, nearPrice: np("0.012"), baseDemand: 1.3, acceptScore: 0.6, maxOutputTokens: 900,
    deliverable: "Faithful translation of the source text into the requested language (English by default), followed by a short note.",
    files: ["traduction.md"],
    rubric: rub(
      ["fidelity", "The meaning of the source text is fully preserved, with no addition or omission.", 0.4],
      ["language", "The target language is correct and natural, with the right terminology.", 0.35],
      ["tone", "The register and tone of the source text are respected.", 0.15],
      ["note", "The note briefly flags choices or ambiguities.", 0.1],
    ),
    instructions:
      `You are a translator. ${ENGLISH_ONLY} Reply with the TRANSLATION ONLY of the source text into the requested target language, English by default (do not copy the source text), ` +
      'then a separator line "---" and a line "Note:" (one or two sentences, in English, about choices or ambiguities).',
  },
  legal: {
    profession: "legal", label: "Legal checklist", refUsd: 150, nearPrice: np("0.045"), baseDemand: 0.9, acceptScore: 0.6, maxOutputTokens: 1500,
    deliverable: `Simple legal checklist in Markdown, framed by the disclaimer "${LEGAL_DISCLAIMER}"`,
    files: ["checklist.md"],
    rubric: rub(
      ["coverage", "The checklist covers the essential points of the described activity.", 0.35],
      ["actionable", "Each item is a verifiable action (checkbox).", 0.25],
      ["caution", "No categorical claim; refers to a professional for complex cases.", 0.25],
      ["clarity", "Clear structure, accessible vocabulary.", 0.15],
    ),
    instructions:
      `${MD_RULES} You are a legal assistant. Produce a checklist of checkboxes (- [ ] ...) grouped by theme, adapted to the described activity and to French law unless stated otherwise. ` +
      `The very first line of your answer is EXACTLY "${LEGAL_DISCLAIMER}" and the very last line is too. ` +
      "Cite no law article you are not sure about; invent no case law.",
  },
};

export const nearPriceOf = (p: Profession, scale = 1): Yocto => scaledPrice(p, scale).toString();
/** Catalogue price x config scale (`sim.priceScale`). */
export const scaledPrice = (p: Profession, scale = 1): bigint => (CATALOGUE[p].nearPrice * BigInt(Math.round(scale * 1000))) / 1000n;

/** Consistency check (used by tests): weights sum to 1, price = refUsd x factor, every instruction carries ENGLISH_ONLY. */
export function checkCatalogue(): string[] {
  const errs: string[] = [];
  for (const spec of Object.values(CATALOGUE)) {
    const sum = spec.rubric.reduce((a, c) => a + c.weight, 0);
    if (Math.abs(sum - 1) > 1e-9) errs.push(`${spec.profession}: weights sum to ${sum}`);
    if (spec.nearPrice !== parseNear((spec.refUsd * NEAR_PER_REF_USD).toFixed(6))) errs.push(`${spec.profession}: nearPrice != refUsd x factor`);
    if (!spec.instructions.includes(ENGLISH_ONLY)) errs.push(`${spec.profession}: instructions lack "${ENGLISH_ONLY}"`);
  }
  return errs;
}

/** Weighted score of a rubric from 0..1 scores per criterion (missing criterion = 0). */
export function weightedScore(p: Profession, scores: Record<string, number>): number {
  let total = 0;
  for (const c of CATALOGUE[p].rubric) {
    const v = Number(scores[c.id]);
    total += c.weight * (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  }
  return Math.round(total * 1000) / 1000;
}

/** Demand weight of a profession at a tick: base weight x multipliers of the active events. */
export function demandWeight(p: Profession, tick: number, events: readonly MarketEvent[] = []): number {
  let w = CATALOGUE[p].baseDemand;
  for (const e of events) if (e.profession === p && tick >= e.startTick && tick < e.endTick) w *= e.demandMultiplier;
  return w;
}
