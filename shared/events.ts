// Catalogue des événements du journal. Source de vérité : docs/ARCHITECTURE.md §8.
// Le journal est append-only (JSONL), rejoué par SSE ; l'UI se reconstruit uniquement à partir de lui + /api/state.
import type { Yocto } from "./money.ts";
import type { Agent, Bid, Genome, Letter, Task, Validation, CauseOfDeath } from "./types.ts";

/** type -> charge utile (`data`). Ajouter un type = l'ajouter ici ET dans ARCHITECTURE.md §8. */
export interface EventCatalog {
  // simulation
  "sim.started": { mode: "mock" | "testnet"; preset: string; seed: number; chain: string; brain: string };
  "sim.paused": Record<string, never>;
  "sim.resumed": Record<string, never>;
  "sim.stopped": { reason: "extinction" | "manual" | "max_ticks" | "error"; generations: number };
  "sim.tick": { alive: number; tasksOpen: number; totalBalance: Yocto };
  // cycle de vie
  "agent.born": { agent: Agent; parentId: string | null; birthTx?: string };
  "agent.reproduced": { parentId: string; childId: string; transferred: Yocto; mutations: Record<string, [unknown, unknown]> };
  "agent.died": { agentId: string; cause: CauseOfDeath; finalBalance: Yocto; swept: Yocto; sweptTo?: string; tx?: string };
  "letter.written": { letter: Letter };
  // marché
  "task.posted": { task: Task };
  "bid.placed": { bid: Bid };
  "task.awarded": { taskId: string; bidId: string; winnerId: string; price: Yocto; bids: number };
  "task.expired": { taskId: string; reason: "no_bids" | "deadline" | "unfunded" | "winner_dead" };
  "escrow.locked": { taskId: string; payer: string; amount: Yocto; tx: string };
  "task.submitted": { taskId: string; agentId: string; resultHash: string };
  "task.validated": { taskId: string; validation: Validation };
  "escrow.released": { taskId: string; payee: string; amount: Yocto; tx: string };
  "escrow.refunded": { taskId: string; payer: string; amount: Yocto; tx: string };
  "subcontract.created": { parentTaskId: string; childTaskId: string; byAgentId: string };
  "reputation.updated": { agentId: string; delta: number; total: number; taskId: string; tx?: string };
  // économie / IA
  "brain.charged": { agentId: string; purpose: string; model: string; promptTokens: number; completionTokens: number; reasoningTokens: number; cost: Yocto; costUsd: number; nearUsdRate: number; priceSource: "models" | "mock"; mock: boolean; tx?: string };
  "balance.changed": { agentId: string; balance: Yocto; delta: Yocto; reason: string };
  "funding.received": { to: string; amount: Yocto; source: "master" | "faucet" | "demo"; tx: string };
  // chaîne / intents / technique
  "chain.tx": { kind: string; from?: string; to?: string; amount?: Yocto; hash: string; explorerUrl?: string };
  "intents.quote": { dry: true; originAsset: string; destinationAsset: string; amountIn: string; amountOut?: string; note?: string };
  "system.warning": { code: string; message: string };
  "system.error": { code: string; message: string };
}

export type EventType = keyof EventCatalog;

export const EVENT_TYPES = [
  "sim.started", "sim.paused", "sim.resumed", "sim.stopped", "sim.tick",
  "agent.born", "agent.reproduced", "agent.died", "letter.written",
  "task.posted", "bid.placed", "task.awarded", "task.expired", "escrow.locked", "task.submitted",
  "task.validated", "escrow.released", "escrow.refunded", "subcontract.created", "reputation.updated",
  "brain.charged", "balance.changed", "funding.received",
  "chain.tx", "intents.quote", "system.warning", "system.error",
] as const satisfies readonly EventType[];

export type DarwinEvent<T extends EventType = EventType> = {
  [K in T]: {
    seq: number; // numéro croissant sans trou, sert de Last-Event-ID SSE
    ts: string; // ISO UTC
    tick: number;
    type: K;
    data: EventCatalog[K];
  };
}[T];

export type EventInput<T extends EventType = EventType> = {
  [K in T]: { type: K; data: EventCatalog[K]; tick?: number };
}[T];

export type { Genome };
