// Genome: creation of the founders and mutation at reproduction. All draws go through the injected Rng.
import { GENOME_BOUNDS, GenomeSchema, PROFESSIONS, type Genome, type Profession, type Rng } from "../shared/index.ts";

const BASE_PERSONALITY: Record<Profession, string> = {
  logo: "You are a freelance graphic designer. You deliver three original SVG logo concepts, simple and readable at small sizes.",
  finance: "You are a freelance financial analyst. You work only from the figures provided, you quote them and you flag the limits.",
  architecture: "You are a freelance software architect. You deliver a short document and a clear Mermaid diagram.",
  marketing: "You are a freelance marketing copywriter. You write punchy copy, tailored to the target audience, with no filler.",
  translation: "You are a freelance translator. You stay faithful to the meaning and tone, and you translate without commenting.",
  legal: "You are a freelance legal assistant. You deliver a simple, precise checklist, with the disclaimer \"this is not legal advice\".",
};

/** Traits that mutation can graft onto the personality (system prompt). */
export const TRAITS = [
  "You are thrifty: you spend few tokens.",
  "You are a perfectionist: you proofread before answering.",
  "You are bold: you propose original angles.",
  "You are careful: you verify before asserting.",
  "You are cooperative: you delegate what others do better.",
  "You are quick: you answer by going straight to the point.",
] as const;

const TRAIT_MARK = " Trait: ";

export const basePersonality = (p: Profession): string => BASE_PERSONALITY[p];

/** Freelance personality of the profession, with an optional trait (grafted by mutation). */
export const personalityWith = (p: Profession, trait?: string): string => BASE_PERSONALITY[p] + (trait ? TRAIT_MARK + trait : "");

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const uniform = (rng: Rng, min: number, max: number) => round3(min + rng.next() * (max - min));

/** Founder genome: professions assigned round-robin, numeric genes drawn in a reasonable range. */
export function createFounderGenome(rng: Rng, index: number, modelIds: readonly string[]): Genome {
  const profession = PROFESSIONS[index % PROFESSIONS.length]!;
  return GenomeSchema.parse({
    profession,
    model: rng.pick(modelIds),
    askRatio: uniform(rng, 0.45, 0.9),
    risk: uniform(rng, 0, 1),
    reproThreshold: uniform(rng, 1.3, 2.5),
    generosity: uniform(rng, 0.05, 0.4),
    cooperation: uniform(rng, 0, 1),
    personality: personalityWith(profession, rng.pick(TRAITS)),
  });
}

const NUMERIC = ["askRatio", "risk", "reproThreshold", "generosity", "cooperation"] as const;

export interface MutationResult {
  genome: Genome;
  /** gene -> [before, after], only for the genes that changed. */
  mutations: Record<string, [unknown, unknown]>;
}

/**
 * Mutation: each numeric gene mutates with probability `rate` (Gaussian noise of standard deviation `sd` x gene range, bounded);
 * the profession mutates rarely (rate/4), the model sometimes (rate/2), the personality changes trait with probability `rate`.
 * The number of draws is fixed: the Rng stream does not depend on the outcome.
 */
export function mutateGenome(parent: Genome, rng: Rng, rate: number, sd: number, modelIds: readonly string[]): MutationResult {
  const g: Genome = { ...parent };
  const mutations: Record<string, [unknown, unknown]> = {};
  const note = (gene: string, before: unknown, after: unknown) => {
    if (before !== after) mutations[gene] = [before, after];
  };

  for (const gene of NUMERIC) {
    const b = GENOME_BOUNDS[gene];
    const hit = rng.next() < rate;
    const noise = rng.gauss(0, sd * (b.max - b.min));
    if (hit) {
      g[gene] = round3(clamp(parent[gene] + noise, b.min, b.max));
      note(gene, parent[gene], g[gene]);
    }
  }

  const profHit = rng.next() < rate / 4;
  const profPick = rng.pick(PROFESSIONS);
  if (profHit && profPick !== parent.profession) {
    g.profession = profPick;
    note("profession", parent.profession, g.profession);
  }

  const modelHit = rng.next() < rate / 2;
  const modelPick = rng.pick(modelIds);
  if (modelHit && modelIds.length > 0 && modelPick !== parent.model) {
    g.model = modelPick;
    note("model", parent.model, g.model);
  }

  const traitHit = rng.next() < rate;
  const traitPick = rng.pick(TRAITS);
  if (traitHit || g.profession !== parent.profession) {
    const oldTrait = parent.personality.includes(TRAIT_MARK) ? parent.personality.split(TRAIT_MARK)[1] : undefined;
    const trait = traitHit ? traitPick : oldTrait;
    g.personality = personalityWith(g.profession, trait);
    note("personality", parent.personality, g.personality);
  }

  return { genome: GenomeSchema.parse(g), mutations };
}
