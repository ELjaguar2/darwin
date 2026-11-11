// Livrable réellement produit pour une tâche (lot L16). Contrat partagé par market/, backend/ et frontend/.
import type { Profession } from "./types.ts";

export interface DeliverableFile {
  /** Nom de fichier sûr : [a-z0-9._-]{1,64}, ex. "logo-1.svg", "architecture.md", "schema.mmd". */
  name: string;
  /** "image/svg+xml" | "text/markdown" | "text/plain" | "text/vnd.mermaid" */
  mime: string;
  content: string;
}

export interface Deliverable {
  taskId: string;
  profession: Profession;
  agentId: string;
  files: DeliverableFile[];
  /** Texte brut renvoyé par l'agent (preuve : sha256 = resultHash de la validation). */
  rawText: string;
  resultHash: string;
  /** Coût IA de production (agent) en USD, journal `brain.charged` ; le coût du juge est à part. */
  productionCostUsd: number;
  judgeCostUsd: number;
  createdAt: string;
  /** Renseigné après validation. */
  verdict?: "accepted" | "rejected";
  score?: number;
}

/** Un événement de marché fait varier la demande d'un métier pendant `durationTicks` ticks. */
export interface MarketEvent {
  id: string; // "e-0001"
  title: string; // « Salon des startups : tout le monde veut un logo »
  profession: Profession;
  /** Multiplicateur de la demande (>1 hausse, <1 baisse), appliqué au taux du client simulé. */
  demandMultiplier: number;
  startTick: number;
  endTick: number;
}
