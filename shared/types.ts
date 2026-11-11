// Schémas de données partagés. Source de vérité : docs/ARCHITECTURE.md §6.
// Règle : tout ce qui traverse un module, l'API ou le journal est sérialisable en JSON (montants = Yocto en chaîne).
import { z } from "zod";
import type { Yocto } from "./money.ts";

/**
 * Catalogue « Freelance réel » (lot L16) : 6 métiers dont les livrables sont réellement produits.
 * logo = 3 propositions SVG originales ; finance = analyse à partir de chiffres fournis ; architecture = document + schéma Mermaid ;
 * marketing = texte de rédaction ; translation = traduction ; legal = checklist juridique simple (avec avertissement « pas un avis juridique »).
 * Détail (prix de référence, grilles, juges) : shared/catalogue.ts et docs/CATALOGUE_FREELANCE.md.
 */
export const PROFESSIONS = ["logo", "finance", "architecture", "marketing", "translation", "legal"] as const;
export type Profession = (typeof PROFESSIONS)[number];

/** Bornes de chaque gène (utilisées par la mutation et la validation). */
export const GENOME_BOUNDS = {
  askRatio: { min: 0.3, max: 1.0 }, // part du budget demandée dans l'enchère (gène « prix »)
  risk: { min: 0, max: 1 },
  reproThreshold: { min: 1.2, max: 4 }, // multiple du capital de naissance exigé pour se reproduire
  generosity: { min: 0, max: 0.6 }, // part supplémentaire du capital du parent donnée à l'enfant
  cooperation: { min: 0, max: 1 }, // propension à sous-traiter / accepter la sous-traitance
} as const;

export const GenomeSchema = z.object({
  profession: z.enum(PROFESSIONS),
  model: z.string().min(1), // id de modèle NEAR AI Cloud (ou mock), vérifié via GET /v1/models
  askRatio: z.number().min(GENOME_BOUNDS.askRatio.min).max(GENOME_BOUNDS.askRatio.max),
  risk: z.number().min(0).max(1),
  reproThreshold: z.number().min(GENOME_BOUNDS.reproThreshold.min).max(GENOME_BOUNDS.reproThreshold.max),
  generosity: z.number().min(0).max(GENOME_BOUNDS.generosity.max),
  cooperation: z.number().min(0).max(1),
  personality: z.string().min(1).max(2000), // prompt système
});
export type Genome = z.infer<typeof GenomeSchema>;

export type AgentStatus = "alive" | "dead";
export type CauseOfDeath = "starvation" | "manual" | "reset";

export interface Agent {
  id: string; // ex. "a-0007"
  name: string;
  accountId: string; // sous-compte NEAR (réel ou mock)
  generation: number; // 1 = fondateurs
  parentId: string | null;
  childrenIds: string[];
  genome: Genome;
  status: AgentStatus;
  birthTick: number;
  deathTick?: number;
  bornAt: string; // ISO
  diedAt?: string;
  causeOfDeath?: CauseOfDeath;
  birthCapital: Yocto;
  balance: Yocto; // cache du solde on-chain, rafraîchi à chaque changement
  earned: Yocto; // total gagné (tâches)
  spentBrain: Yocto; // total payé à l'IA
  reputation: number;
  tasksDone: number;
  letterId?: string; // lettre reçue du parent
  birthTx?: string;
}

export type TaskStatus =
  | "posted" // publiée, enchères ouvertes
  | "awarded" // gagnant choisi, séquestre verrouillé
  | "submitted" // résultat remis, en attente de validation
  | "settled" // validée, paiement libéré
  | "rejected" // validation refusée, séquestre remboursé
  | "expired"; // aucune offre ou délai dépassé, séquestre remboursé

export type Requester =
  | { kind: "visitor"; label: string; accountId?: string }
  | { kind: "simulated"; label: string } // client simulé : TOUJOURS étiqueté dans l'UI
  | { kind: "agent"; agentId: string }; // sous-traitance

export interface Task {
  id: string; // "t-0042"
  requester: Requester;
  parentTaskId?: string; // sous-traitance
  profession: Profession;
  title: string;
  prompt: string;
  budget: Yocto;
  status: TaskStatus;
  createdTick: number;
  biddingEndsTick: number;
  deadlineTick: number;
  winnerId?: string;
  winningBidId?: string;
  bidIds: string[];
  escrowId?: string;
  result?: { text: string; resultHash: string; submittedTick: number };
  validation?: Validation;
}

export interface Bid {
  id: string;
  taskId: string;
  agentId: string;
  price: Yocto;
  etaTicks: number;
  pitch?: string;
  tick: number;
  won?: boolean;
}

export interface Validation {
  verdict: "accepted" | "rejected";
  score: number; // 0..1
  validator: string; // "brain:<model>" | "rule:<nom>" | "visitor"
  reason: string;
  resultHash: string;
  tick: number;
}

export type EscrowStatus = "locked" | "released" | "refunded";

export interface Escrow {
  id: string; // = taskId (un séquestre par tâche)
  taskId: string;
  payer: string; // accountId
  payee?: string;
  amount: Yocto;
  status: EscrowStatus;
  lockTx?: string;
  settleTx?: string;
  /** Preuve exigée pour libérer : jamais de crédit sans preuve vérifiée. */
  proof?: { resultHash: string; verdict: "accepted"; validator: string };
}

export interface Letter {
  id: string; // "l-0003"
  fromAgentId: string;
  toAgentId: string;
  generation: number; // génération de l'enfant
  text: string;
  model: string;
  mock: boolean;
  tick: number;
  createdAt: string;
}

export const TaskInputSchema = z.object({
  title: z.string().min(3).max(120),
  prompt: z.string().min(10).max(4000),
  profession: z.enum(PROFESSIONS).default("logo"),
  budgetNear: z.string().regex(/^\d+(\.\d{1,6})?$/), // en NEAR ; bornes vérifiées avec la config
  requesterLabel: z.string().min(1).max(60).default("visiteur"),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;
