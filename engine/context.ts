// Internal context shared by the engine modules (in-memory state + injected dependencies).
import type { Agent, Deps, Letter, Market, ModelInfo } from "../shared/index.ts";

export interface EngineOptions {
  /** Starts the timed loop (config.sim.tickMs) on start(). Default true; false for tests (manual tick()). */
  autoRun?: boolean;
  /** Emits `chain.tx` for engine transfers. Default: true only with a mock chain (NearChain journals by itself). */
  emitChainTx?: boolean;
  /** Starting number of agent identifiers (a-XXXX). Default 0. Useful on testnet: accounts and the contract registry persist between two runs. */
  agentSeqStart?: number;
  /** Simulated market client (templates, market events, budgets at the profession price). Absent: simple local client (tests). */
  simulatedClient?: { tick(tick: number): Promise<unknown> };
}

export interface Ctx {
  deps: Deps;
  market: Market;
  agents: Map<string, Agent>;
  letters: Map<string, Letter>;
  models: ModelInfo[];
  defaultModel: string;
  emitChainTx: boolean;
  tick: number;
  nextAgent: number;
  nextLetter: number;
  /** Last reproduction tick per parent (minimum delay between two children). */
  lastRepro: Map<string, number>;
  /** Debts (metabolism, AI cost) not yet settled on-chain when settleEveryTicks > 1. */
  pending: Map<string, bigint>;
  /** Tasks whose execution has already been attempted (no retry: the market deadline decides). */
  attempted: Set<string>;
  warned: Set<string>;
}

export const bal = (a: Agent): bigint => BigInt(a.balance);
