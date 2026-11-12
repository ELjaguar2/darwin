// Journal event catalogue. Source of truth: docs/ARCHITECTURE.md §8.
// The journal is append-only (JSONL), replayed over SSE; the UI is rebuilt only from it + /api/state.
import type { Yocto } from "./money.ts";
import type { Agent, Bid, Genome, Letter, Profession, Task, Validation, CauseOfDeath } from "./types.ts";
import type { DeliverableJournalFile, MarketEvent } from "./deliverable.ts";

/** type -> payload (`data`). Adding a type = adding it here AND in ARCHITECTURE.md §8. */
export interface EventCatalog {
  // simulation
  "sim.started": { mode: "mock" | "testnet"; preset: string; seed: number; chain: string; brain: string };
  "sim.paused": Record<string, never>;
  "sim.resumed": Record<string, never>;
  "sim.stopped": { reason: "extinction" | "manual" | "max_ticks" | "error"; generations: number };
  "sim.tick": { alive: number; tasksOpen: number; totalBalance: Yocto };
  // life cycle
  "agent.born": { agent: Agent; parentId: string | null; birthTx?: string };
  "agent.reproduced": { parentId: string; childId: string; transferred: Yocto; mutations: Record<string, [unknown, unknown]> };
  "agent.died": { agentId: string; cause: CauseOfDeath; finalBalance: Yocto; swept: Yocto; sweptTo?: string; tx?: string };
  "letter.written": { letter: Letter };
  // L25: the parent's letter is really handed to the child (advice in every AI call of the child). status "empty": nothing transmitted.
  "letter.received": { childId: string; parentId: string; letterId?: string; length: number; excerpt: string; status: "received" | "empty"; fallback?: boolean };
  // market
  "task.posted": { task: Task };
  "bid.placed": { bid: Bid };
  "task.awarded": { taskId: string; bidId: string; winnerId: string; price: Yocto; bids: number };
  "task.expired": { taskId: string; reason: "no_bids" | "deadline" | "unfunded" | "winner_dead" };
  "escrow.locked": { taskId: string; payer: string; amount: Yocto; tx: string };
  "task.submitted": { taskId: string; agentId: string; resultHash: string };
  "task.validated": { taskId: string; validation: Validation };
  "escrow.released": { taskId: string; payee: string; amount: Yocto; tx: string };
  "escrow.refunded": { taskId: string; payer: string; amount: Yocto; tx: string };
  "subcontract.created": { parentTaskId: string; childTaskId: string; byAgentId: string; profession?: Profession; budget?: Yocto; parentPrice?: Yocto; commission?: Yocto; deadline?: number };
  // L21: real subcontracting (all optional-compatible: journals before L21 have neither of these two events)
  "subcontract.integrated": { parentTaskId: string; childTaskId: string; childAgentId: string; childProfession: Profession; childPrice: Yocto; parentPrice: Yocto; commission: Yocto };
  "subcontract.fallback": { parentTaskId: string; childTaskId?: string; reason: "no_bids" | "rejected" | "deadline" | "failed"; commission: Yocto };
  "reputation.updated": { agentId: string; delta: number; total: number; taskId: string; tx?: string };
  // real freelance (L16)
  "deliverable.produced": { taskId: string; profession: Profession; agentId: string; files: DeliverableJournalFile[]; productionCostUsd: number; judgeCostUsd: number; resultHash: string };
  "market.event": { event: MarketEvent };
  // economy / AI
  "brain.charged": { agentId: string; purpose: string; model: string; promptTokens: number; completionTokens: number; reasoningTokens: number; cost: Yocto; costUsd: number; nearUsdRate: number; priceSource: "models" | "mock"; mock: boolean; tx?: string };
  "balance.changed": { agentId: string; balance: Yocto; delta: Yocto; reason: string };
  "funding.received": { to: string; amount: Yocto; source: "master" | "faucet" | "demo"; tx: string };
  // chain / intents / technical
  "chain.tx": { kind: string; from?: string; to?: string; amount?: Yocto; hash: string; explorerUrl?: string };
  "intents.quote": { dry: true; originAsset: string; destinationAsset: string; amountIn: string; amountOut?: string; note?: string };
  "system.warning": { code: string; message: string };
  "system.error": { code: string; message: string };
  // --- L16 engine: specialisation indicators ---
  "population.snapshot": { tick: number; byProfession: Record<Profession, number>; byGeneration: Record<string, Record<Profession, number>> };
}

export type EventType = keyof EventCatalog;

export const EVENT_TYPES = [
  "sim.started", "sim.paused", "sim.resumed", "sim.stopped", "sim.tick",
  "agent.born", "agent.reproduced", "agent.died", "letter.written", "letter.received",
  "task.posted", "bid.placed", "task.awarded", "task.expired", "escrow.locked", "task.submitted",
  "task.validated", "escrow.released", "escrow.refunded", "subcontract.created", "subcontract.integrated", "subcontract.fallback", "reputation.updated",
  "deliverable.produced", "market.event",
  "brain.charged", "balance.changed", "funding.received",
  "chain.tx", "intents.quote", "system.warning", "system.error",
  "population.snapshot", // L16
] as const satisfies readonly EventType[];

export type DarwinEvent<T extends EventType = EventType> = {
  [K in T]: {
    seq: number; // increasing number with no gap, serves as the SSE Last-Event-ID
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
