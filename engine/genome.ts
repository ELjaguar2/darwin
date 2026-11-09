// Génome : création des fondateurs et mutation à la reproduction. Tous les tirages passent par le Rng injecté.
import { GENOME_BOUNDS, GenomeSchema, PROFESSIONS, type Genome, type Profession, type Rng } from "../shared/index.ts";

const BASE_PERSONALITY: Record<Profession, string> = {
  writer: "Tu es un rédacteur concis et clair. Tu livres un texte propre, sans remplissage.",
  translator: "Tu es un traducteur fidèle au sens et au ton. Tu ne commentes pas, tu traduis.",
  summarizer: "Tu es un synthétiseur : l'essentiel en peu de mots, sans rien inventer.",
  analyst: "Tu es un analyste rigoureux : tu structures, tu chiffres, tu signales les limites.",
  coder: "Tu es un développeur pragmatique : du code simple, testé, expliqué en une phrase.",
};

/** Traits que la mutation peut greffer à la personnalité (prompt système). */
export const TRAITS = [
  "Tu es économe : tu dépenses peu de tokens.",
  "Tu es perfectionniste : tu relis avant de répondre.",
  "Tu es audacieux : tu proposes des angles originaux.",
  "Tu es prudent : tu vérifies avant d'affirmer.",
  "Tu es coopératif : tu délègues ce que d'autres font mieux.",
  "Tu es rapide : tu réponds en allant droit au but.",
] as const;

const TRAIT_MARK = " Trait : ";

export const basePersonality = (p: Profession): string => BASE_PERSONALITY[p];

const personalityWith = (p: Profession, trait?: string): string => BASE_PERSONALITY[p] + (trait ? TRAIT_MARK + trait : "");

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const uniform = (rng: Rng, min: number, max: number) => round3(min + rng.next() * (max - min));

/** Génome d'un fondateur : professions réparties à tour de rôle, gènes numériques tirés dans une plage raisonnable. */
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
  /** gène -> [avant, après], uniquement pour les gènes qui ont changé. */
  mutations: Record<string, [unknown, unknown]>;
}

/**
 * Mutation : chaque gène numérique mute avec probabilité `rate` (bruit gaussien d'écart-type `sd` x plage du gène, borné) ;
 * le métier mute rarement (rate/4), le modèle parfois (rate/2), la personnalité change de trait avec probabilité `rate`.
 * Le nombre de tirages est fixe : le flux du Rng ne dépend pas du résultat.
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
