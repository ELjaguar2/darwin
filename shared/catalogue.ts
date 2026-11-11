// Catalogue « Freelance réel » (lot L16) : 6 métiers, prix de référence, grilles de notation et consignes de production.
// Source unique pour : market/ (prix minimum, juges, client simulé), brain/prompts.ts (consignes), frontend (libellés).
import type { MarketEvent } from "./deliverable.ts";
import { parseNear, type Yocto } from "./money.ts";
import type { Profession } from "./types.ts";

/**
 * Facteur UNIQUE USD -> NEAR de test : nearPrice = refUsd x 0,0003 (décision du chef de projet, prix sourcés dans docs/CATALOGUE_FREELANCE.md). Ce n'est pas un cours :
 * sur testnet le NEAR n'a pas de valeur, on garde les RAPPORTS de prix entre métiers (budgets 0,012 à 0,06 NEAR). Voir D-037.
 */
export const NEAR_PER_REF_USD = 0.0003;

export interface RubricCriterion {
  id: string;
  description: string;
  /** Poids dans la note ; la somme des poids d'une grille vaut 1. */
  weight: number;
}

export interface ProfessionSpec {
  profession: Profession;
  label: string;
  /** Prix de référence (USD) d'un livrable standard d'un freelance humain. Valeurs sourcées : docs/CATALOGUE_FREELANCE.md. */
  refUsd: number;
  /** Budget minimum (prix plancher) de la tâche, en yocto = refUsd x NEAR_PER_REF_USD. */
  nearPrice: bigint;
  /** Description du livrable attendu (affichée dans le formulaire et dans le prompt du juge). */
  deliverable: string;
  /** Noms de fichiers produits (voir market/deliverable.ts). */
  files: string[];
  rubric: RubricCriterion[];
  /** Note pondérée minimale (0..1) pour que le juge accepte (les contrôles déterministes doivent aussi passer). */
  acceptScore: number;
  /** Consignes de production injectées dans le message `system` de l'agent (format de sortie extractible). */
  instructions: string;
  /** Plafond de tokens de sortie conseillé pour produire ce livrable (le moteur peut l'utiliser à la place de maxTokensPerCall). */
  maxOutputTokens: number;
  /** Poids de base de la demande (popularité du métier chez le client simulé). */
  baseDemand: number;
}

export const LEGAL_DISCLAIMER = "Ceci n'est pas un avis juridique.";

/** Marques à ne jamais reprendre dans un logo (liste non exhaustive : contrôle de mots, pas une recherche d'antériorité). */
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

const MD_RULES = "Réponds en Markdown, sans préambule ni conclusion hors sujet, en français sauf demande contraire.";

export const CATALOGUE: Record<Profession, ProfessionSpec> = {
  logo: {
    profession: "logo", label: "Logo", refUsd: 150, nearPrice: np("0.045"), baseDemand: 1.2, acceptScore: 0.6, maxOutputTokens: 3000,
    deliverable: "3 propositions de logo originales, chacune en SVG autonome (viewBox 0 0 256 256).",
    files: ["logo-1.svg", "logo-2.svg", "logo-3.svg"],
    rubric: rub(
      ["originalite", "Les logos sont originaux et ne rappellent aucune marque existante.", 0.3],
      ["pertinence", "Les logos correspondent au nom et au secteur de l'entreprise donnés.", 0.3],
      ["lisibilite", "Formes simples, lisibles à petite taille, palette cohérente.", 0.2],
      ["variete", "Les trois propositions sont réellement différentes les unes des autres.", 0.2],
    ),
    instructions:
      "Tu es un graphiste. Produis EXACTEMENT 3 propositions de logo, chacune dans son propre bloc de code ```svg (3 blocs, ni plus ni moins). " +
      'Chaque SVG est autonome : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"> ... </svg>, formes vectorielles simples (rect, circle, path, polygon, text). ' +
      "INTERDIT : <script>, <foreignObject>, attributs on*, <image>, href ou url() externes, polices externes. " +
      "Le logo est ORIGINAL : ne reprends jamais le nom, le symbole ou le style reconnaissable d'une marque existante. " +
      "Tu peux écrire le nom de l'entreprise fournie dans un <text>. Entre les blocs, au plus une phrase par logo (idée du logo).",
  },
  finance: {
    profession: "finance", label: "Analyse financière", refUsd: 120, nearPrice: np("0.036"), baseDemand: 1, acceptScore: 0.6, maxOutputTokens: 1800,
    deliverable: "Analyse financière en Markdown à partir des chiffres fournis dans la commande, calculs montrés, limites indiquées.",
    files: ["analyse.md"],
    rubric: rub(
      ["fidelite", "Seuls les chiffres fournis sont utilisés ; aucun chiffre inventé.", 0.35],
      ["calculs", "Les calculs sont montrés et exacts (totaux, marges, variations).", 0.3],
      ["conclusions", "Les conclusions découlent des chiffres et sont utiles à la décision.", 0.2],
      ["limites", "Les limites de l'analyse (données partielles, hypothèses) sont indiquées.", 0.15],
    ),
    instructions:
      `${MD_RULES} Tu es analyste financier. Travaille UNIQUEMENT à partir des chiffres FOURNIS dans la commande : n'invente aucun chiffre, aucun benchmark, aucun cours. ` +
      "Structure : 1) Données reprises (tableau), 2) Calculs (montre chaque opération), 3) Lecture des résultats, 4) Limites. " +
      "N'annonce un total que s'il est la somme exacte de chiffres fournis, sur une ligne « Total <libellé> = <nombre> ». Indique les unités.",
  },
  architecture: {
    profession: "architecture", label: "Architecture logicielle", refUsd: 200, nearPrice: np("0.06"), baseDemand: 0.8, acceptScore: 0.6, maxOutputTokens: 2000,
    deliverable: "Document d'architecture en Markdown avec un schéma Mermaid (flowchart ou C4 simplifié).",
    files: ["architecture.md", "schema.mmd"],
    rubric: rub(
      ["adequation", "L'architecture répond au besoin décrit (composants, flux, contraintes).", 0.3],
      ["schema", "Le schéma Mermaid est lisible et cohérent avec le texte.", 0.25],
      ["justification", "Les choix techniques sont justifiés, avec compromis et risques.", 0.25],
      ["realisme", "Le dimensionnement et les technologies sont réalistes pour le contexte.", 0.2],
    ),
    instructions:
      `${MD_RULES} Tu es architecte logiciel. Produis un document Markdown : contexte, composants, flux de données, choix et compromis, risques. ` +
      "Inclus EXACTEMENT UN schéma dans un bloc ```mermaid commençant par « flowchart TD » (ou « C4Context » simplifié), syntaxe Mermaid valide, noms de nœuds sans caractères spéciaux.",
  },
  marketing: {
    profession: "marketing", label: "Rédaction marketing", refUsd: 80, nearPrice: np("0.024"), baseDemand: 1.1, acceptScore: 0.6, maxOutputTokens: 900,
    deliverable: "Texte marketing en Markdown prêt à publier (accroche, corps, appel à l'action).",
    files: ["texte.md"],
    rubric: rub(
      ["adequation", "Le texte répond à la commande (produit, cible, ton, format demandés).", 0.35],
      ["accroche", "Accroche percutante et appel à l'action clair.", 0.25],
      ["style", "Français correct, ton cohérent, sans cliché creux.", 0.25],
      ["honnetete", "Aucune promesse chiffrée ou affirmation invérifiable inventée.", 0.15],
    ),
    instructions:
      `${MD_RULES} Tu es rédacteur marketing. Livre uniquement le texte final (accroche, corps, appel à l'action) dans le ton et le format demandés. ` +
      "N'invente ni statistique, ni témoignage, ni promesse chiffrée.",
  },
  translation: {
    profession: "translation", label: "Traduction", refUsd: 40, nearPrice: np("0.012"), baseDemand: 1.3, acceptScore: 0.6, maxOutputTokens: 900,
    deliverable: "Traduction fidèle du texte source dans la langue demandée, suivie d'une courte note.",
    files: ["traduction.md"],
    rubric: rub(
      ["fidelite", "Le sens du texte source est intégralement conservé, sans ajout ni omission.", 0.4],
      ["langue", "La langue cible est correcte, naturelle, avec la bonne terminologie.", 0.35],
      ["ton", "Le registre et le ton du texte source sont respectés.", 0.15],
      ["note", "La note signale les choix ou ambiguïtés, brièvement.", 0.1],
    ),
    instructions:
      "Tu es traducteur. Réponds par la TRADUCTION SEULE du texte source dans la langue demandée (pas de recopie du texte source), " +
      "puis une ligne de séparation « --- » et une ligne « Note : » (une ou deux phrases sur les choix ou ambiguïtés).",
  },
  legal: {
    profession: "legal", label: "Checklist juridique", refUsd: 150, nearPrice: np("0.045"), baseDemand: 0.9, acceptScore: 0.6, maxOutputTokens: 1500,
    deliverable: `Checklist juridique simple en Markdown, encadrée par l'avertissement « ${LEGAL_DISCLAIMER} »`,
    files: ["checklist.md"],
    rubric: rub(
      ["couverture", "La checklist couvre les points essentiels de l'activité décrite.", 0.35],
      ["actionnable", "Chaque point est une action vérifiable (case à cocher).", 0.25],
      ["prudence", "Aucune affirmation péremptoire ; renvoi à un professionnel pour les cas complexes.", 0.25],
      ["clarte", "Structure claire, vocabulaire accessible.", 0.15],
    ),
    instructions:
      `${MD_RULES} Tu es assistant juridique. Produis une checklist en cases à cocher (- [ ] ...) regroupées par thème, adaptée à l'activité décrite et au droit français sauf indication contraire. ` +
      `La toute première ligne de ta réponse est EXACTEMENT « ${LEGAL_DISCLAIMER} » et la toute dernière ligne aussi. ` +
      "Ne cite aucun article de loi dont tu n'es pas certain ; n'invente aucune jurisprudence.",
  },
};

export const nearPriceOf = (p: Profession, scale = 1): Yocto => scaledPrice(p, scale).toString();
/** Prix du catalogue x échelle de la config (`sim.priceScale`). */
export const scaledPrice = (p: Profession, scale = 1): bigint => (CATALOGUE[p].nearPrice * BigInt(Math.round(scale * 1000))) / 1000n;

/** Contrôle de cohérence (utilisé par les tests) : somme des poids = 1, prix = refUsd x facteur. */
export function checkCatalogue(): string[] {
  const errs: string[] = [];
  for (const spec of Object.values(CATALOGUE)) {
    const sum = spec.rubric.reduce((a, c) => a + c.weight, 0);
    if (Math.abs(sum - 1) > 1e-9) errs.push(`${spec.profession}: somme des poids ${sum}`);
    if (spec.nearPrice !== parseNear((spec.refUsd * NEAR_PER_REF_USD).toFixed(6))) errs.push(`${spec.profession}: nearPrice != refUsd x facteur`);
  }
  return errs;
}

/** Note pondérée d'une grille à partir de scores 0..1 par critère (critère manquant = 0). */
export function weightedScore(p: Profession, scores: Record<string, number>): number {
  let total = 0;
  for (const c of CATALOGUE[p].rubric) {
    const v = Number(scores[c.id]);
    total += c.weight * (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  }
  return Math.round(total * 1000) / 1000;
}

/** Poids de demande d'un métier à un tick : poids de base x multiplicateurs des événements actifs. */
export function demandWeight(p: Profession, tick: number, events: readonly MarketEvent[] = []): number {
  let w = CATALOGUE[p].baseDemand;
  for (const e of events) if (e.profession === p && tick >= e.startTick && tick < e.endTick) w *= e.demandMultiplier;
  return w;
}
