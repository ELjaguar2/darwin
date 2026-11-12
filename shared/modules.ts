// Contracts between modules (besides Chain/Brain). Each module exports a `createX(deps)` factory that returns these interfaces.
// Boundaries: engine -> market -> chain; engine -> brain; backend composes everything. See docs/ARCHITECTURE.md §4.
import type { Journal } from "./bus.ts";
import type { Brain } from "./brain.ts";
import type { Chain } from "./chain.ts";
import type { Config } from "./config.ts";
import type { Yocto } from "./money.ts";
import type { Rng } from "./rng.ts";
import type { Deliverable } from "./deliverable.ts";
import type { Agent, Bid, Letter, Profession, Requester, Task, Validation } from "./types.ts";

/** Dependencies injected everywhere (no module builds Chain, Brain or Journal itself nor reads process.env). */
export interface Deps {
  config: Config;
  chain: Chain;
  brain: Brain;
  journal: Journal;
  rng: Rng;
  now: () => Date;
}

/** Task market (dev-marche, market/ folder). Only it talks to escrow and reputation. */
export interface Market {
  /** Publishes a task and opens bidding. The payer's funds are locked at award time (lockEscrow). */
  postTask(input: { requester: Requester; profession: Profession; title: string; prompt: string; budget: Yocto; parentTaskId?: string }): Promise<Task>;
  placeBid(input: { taskId: string; agentId: string; price: Yocto; etaTicks: number; pitch?: string }): Promise<Bid>;
  /** Advances the market by one tick: closes bidding (awards to the best price/reputation), locks escrow, expires. */
  step(tick: number): Promise<void>;
  /** Hands in the winner's result; triggers validation then release (with proof) or refund. */
  submitResult(input: { taskId: string; agentId: string; text: string }): Promise<{ task: Task; validation: Validation }>;
  getTask(id: string): Task | undefined;
  listTasks(filter?: { status?: Task["status"]; profession?: Profession }): Task[];
  /** Tasks open to bids for a profession. */
  openTasks(profession?: Profession): Task[];
  /** Deliverable extracted from the handed-in result (L16), in memory; undefined if the task has no (yet) valid deliverable. */
  getDeliverable(taskId: string): Deliverable | undefined;
  listDeliverables(): Deliverable[];
}

/** Full snapshot served by GET /api/state (the UI initialises from it then follows the SSE stream). */
export interface SimState {
  running: boolean;
  paused: boolean;
  tick: number;
  startedAt?: string;
  mode: "mock" | "testnet";
  chain: { kind: "mock" | "near"; masterId: string; contractId?: string };
  brain: { kind: "mock" | "nearai" };
  generations: number; // highest generation reached
  agents: Agent[]; // alive and dead
  tasks: Task[]; // the last N
  letters: Letter[];
  lastSeq: number; // last event taken into account (to resume SSE with no gap)
  totals: { alive: number; dead: number; born: number; tasksSettled: number; totalBalance: Yocto };
}

/** Engine options (D-027). In mock, `emitChainTx: true`: the engine itself emits `chain.tx` for its transfers (MockChain has no journal); with NearChain (accounts/ already emits), leave false. */
export interface EngineOptions {
  emitChainTx?: boolean;
  agentSeqStart?: number;
}

/** Evolution engine (dev-moteur-evolution, engine/ folder): tick loop, life cycle, agent economy. */
export interface Engine {
  start(): Promise<void>; // creates the founders then starts the loop (period config.sim.tickMs)
  pause(): void;
  resume(): void;
  stop(reason?: "manual"): Promise<void>;
  /** Runs exactly one tick (used by tests: simulation without a clock). */
  tick(): Promise<void>;
  getState(): SimState;
  getAgent(id: string): Agent | undefined;
  getLetter(id: string): Letter | undefined;
}

/** Intents module (dev-intents, intents/ folder). V2: never a `dry:false` call without a written green light. */
export interface Intents {
  readonly enabled: boolean;
  /** The only call allowed by default: `dry:true` quote, no spending. */
  quoteDry(input: { originAsset: string; destinationAsset: string; amountIn: string }): Promise<{ amountOut?: string; raw: unknown }>;
}
