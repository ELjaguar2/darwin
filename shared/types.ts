// Shared data schemas. Source of truth: docs/ARCHITECTURE.md §6.
// Rule: everything crossing a module, the API or the journal is JSON-serialisable (amounts = Yocto as strings).
import { z } from "zod";
import type { Yocto } from "./money.ts";

/**
  * "Real freelance" catalogue (lot L16): 6 professions whose deliverables are actually produced.
  * logo = 3 original SVG proposals; finance = analysis from supplied figures; architecture = document + Mermaid diagram;
  * marketing = copywriting text; translation = translation; legal = simple legal checklist (with a "not legal advice" disclaimer).
  * Details (reference prices, grids, judges): shared/catalogue.ts and docs/CATALOGUE_FREELANCE.md.
 */
export const PROFESSIONS = ["logo", "finance", "architecture", "marketing", "translation", "legal"] as const;
export type Profession = (typeof PROFESSIONS)[number];

/** Bounds of each gene (used by mutation and validation). */
export const GENOME_BOUNDS = {
  askRatio: { min: 0.3, max: 1.0 }, // share of the budget requested in the bid ("price" gene)
  risk: { min: 0, max: 1 },
  reproThreshold: { min: 1.2, max: 4 }, // multiple of the birth capital required to reproduce
  generosity: { min: 0, max: 0.6 }, // extra share of the parent's capital given to the child
  cooperation: { min: 0, max: 1 }, // propensity to subcontract / accept subcontracting
} as const;

export const GenomeSchema = z.object({
  profession: z.enum(PROFESSIONS),
  model: z.string().min(1), // NEAR AI Cloud (or mock) model id, checked via GET /v1/models
  askRatio: z.number().min(GENOME_BOUNDS.askRatio.min).max(GENOME_BOUNDS.askRatio.max),
  risk: z.number().min(0).max(1),
  reproThreshold: z.number().min(GENOME_BOUNDS.reproThreshold.min).max(GENOME_BOUNDS.reproThreshold.max),
  generosity: z.number().min(0).max(GENOME_BOUNDS.generosity.max),
  cooperation: z.number().min(0).max(1),
  personality: z.string().min(1).max(2000), // system prompt
});
export type Genome = z.infer<typeof GenomeSchema>;

export type AgentStatus = "alive" | "dead";
export type CauseOfDeath = "starvation" | "manual" | "reset";

export interface Agent {
  id: string; // ex. "a-0007"
  name: string;
  accountId: string; // NEAR sub-account (real or mock)
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
  balance: Yocto; // on-chain balance cache, refreshed on each change
  earned: Yocto; // total earned (tasks)
  spentBrain: Yocto; // total paid to the AI
  reputation: number;
  tasksDone: number;
  letterId?: string; // letter received from the parent
  birthTx?: string;
}

export type TaskStatus =
  | "posted" // published, bidding open
  | "awarded" // winner chosen, escrow locked
  | "submitted" // result handed in, awaiting validation
  | "settled" // validated, payment released
  | "rejected" // validation refused, escrow refunded
  | "expired"; // no bid or deadline exceeded, escrow refunded

export type Requester =
  | { kind: "visitor"; label: string; accountId?: string }
  | { kind: "simulated"; label: string } // simulated client: ALWAYS labelled in the UI
  | { kind: "agent"; agentId: string }; // subcontracting

export interface Task {
  id: string; // "t-0042"
  requester: Requester;
  parentTaskId?: string; // subcontracting
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
  id: string; // = taskId (one escrow per task)
  taskId: string;
  payer: string; // accountId
  payee?: string;
  amount: Yocto;
  status: EscrowStatus;
  lockTx?: string;
  settleTx?: string;
  /** Proof required to release: never a credit without a verified proof. */
  proof?: { resultHash: string; verdict: "accepted"; validator: string };
}

export interface Letter {
  id: string; // "l-0003"
  fromAgentId: string;
  toAgentId: string;
  generation: number; // child's generation
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
  budgetNear: z.string().regex(/^\d+(\.\d{1,6})?$/), // in NEAR; bounds checked against the config
  requesterLabel: z.string().min(1).max(60).default("visiteur"),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;
