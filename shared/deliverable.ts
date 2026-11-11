// Livrable réellement produit pour une tâche (lot L16). Contrat partagé par market/, backend/ et frontend/.
import type { Profession } from "./types.ts";

export interface DeliverableFile {
  /** Nom de fichier sûr : [a-z0-9._-]{1,64}, ex. "logo-1.svg", "architecture.md", "schema.mmd". */
  name: string;
  /** "image/svg+xml" | "text/markdown" | "text/plain" | "text/vnd.mermaid" */
  mime: string;
  content: string;
  /** Vrai si le contenu a été coupé (bornes du journal, voir `journalFiles`). Absent = complet. */
  truncated?: boolean;
}

/** Fichier tel qu'écrit dans `deliverable.produced` (journal, flux SSE). `content` et `truncated` sont optionnels : anciens journaux = nom/mime/taille seuls. */
export interface DeliverableJournalFile {
  name: string;
  mime: string;
  /** Taille réelle en octets UTF-8 du fichier complet (même si `content` est tronqué). */
  bytes: number;
  /** Contenu PUBLIC (texte, SVG déjà assaini, Markdown), borné. */
  content?: string;
  truncated?: boolean;
}

/** Bornes du contenu embarqué dans le journal : par fichier, puis par livrable (somme des fichiers). */
export const JOURNAL_MAX_FILE_CHARS = 24_000;
export const JOURNAL_MAX_DELIVERABLE_CHARS = 64_000;

const utf8 = (s: string) => new TextEncoder().encode(s).length;

/** Fichiers d'un livrable pour le journal : taille réelle + contenu borné (`truncated: true` si coupé). Ne coupe jamais une paire de substitution. */
export function journalFiles(files: readonly { name: string; mime: string; content: string }[]): DeliverableJournalFile[] {
  let left = JOURNAL_MAX_DELIVERABLE_CHARS;
  return files.map((f) => {
    const room = Math.max(0, Math.min(JOURNAL_MAX_FILE_CHARS, left));
    let content = f.content;
    let truncated = false;
    if (content.length > room) {
      let end = room;
      const c = end > 0 ? content.charCodeAt(end - 1) : 0;
      if (c >= 0xd800 && c <= 0xdbff) end--;
      content = content.slice(0, end);
      truncated = true;
    }
    left -= content.length;
    return { name: f.name, mime: f.mime, bytes: utf8(f.content), content, ...(truncated ? { truncated: true } : {}) };
  });
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
