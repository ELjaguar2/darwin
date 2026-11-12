// Composition root (D-010): chain + brain + market + engine + journal in a single process.
// No business rule here: we wire the modules, the journal, persistence and the caps.
import { readFileSync } from "node:fs";
import { NearChain, createChain, type CreateChainExtras } from "../accounts/index.ts";
import { createBrain, type Guardrails } from "../brain/index.ts";
import { createEngine } from "../engine/index.ts";
import { createMarket, type TaskMarket } from "../market/index.ts";
import { createSimulatedClient } from "../market/simulated-client.ts";
import {
  createJournal, createRng,
  type Bid, type Brain, type Chain, type Config, type DarwinEvent, type Deps, type Engine, type EventCatalog, type Journal, type MarketEvent,
} from "../shared/index.ts";
import { redactEvent, redactText, safeErrorMessage } from "./redact.ts";
import type { Replay } from "./replay.ts";
import type { Store } from "./store.ts";

export interface RuntimeOptions {
  /** data/ persistence (absent from most tests). */
  store?: Store;
  now?: () => Date;
  /** false: the engine has no clock (tests: `engine.tick()` by hand). */
  autoRun?: boolean;
  /** Tests : faux backend NEAR, etc. */
  chainExtra?: CreateChainExtras;
  brain?: Brain;
  log?: (msg: string) => void;
  /** Period for writing the state snapshot (ms). */
  snapshotEveryMs?: number;
}

export interface Runtime {
  config: Config;
  journal: Journal;
  chain: Chain;
  brain: Brain;
  market: TaskMarket;
  engine: Engine;
  version: string;
  startedAt: string;
  /** Bids of a task, rebuilt from the journal (the market does not expose `getBid`). */
  bidsOf(taskId: string): Bid[];
  /** Market events active at the current tick (derived from the `market.event` journal). */
  activeMarketEvents(): MarketEvent[];
  /** Last engine `population.snapshot`, undefined before the first tick. */
  lastPopulation(): EventCatalog["population.snapshot"] | undefined;
  /** `chain.mode` of NearChain, otherwise `mock`. */
  escrowMode(): "contract" | "operator-account";
  /** Present only in replay mode (L17): journal reader; the market, engine and chain are then read-only facades. */
  replay?: Replay;
  /** Startup checks (testnet: RPC and master account). Throws a clear error otherwise. */
  checkReady(): Promise<void>;
  /** Starts the simulation (founders then loop). */
  startSim(): Promise<void>;
  /** Graceful shutdown: engine, last snapshot. */
  shutdown(): Promise<void>;
}

export function readVersion(): string {
  try {
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const v = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof v === "string" ? v : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
  * Starting offset for agent and task numbers. On a real chain, sub-accounts and the contract registry
  * persist from one run to the next: restarting at 1 would cause "Account already exists" or ESCROW_EXISTS. Without an
  * explicit variable, we start from a number that grows with the clock (seconds since 2026-11-01 x `perSecond`): two runs
  * a few minutes apart do not overlap, with no registry read. Mock: 0 (readable ids, stable tests).
 */
export function idOffset(envName: string, chainKind: string, perSecond: number, now: () => Date, env: NodeJS.ProcessEnv = process.env): number {
  const explicit = env[envName];
  if (explicit !== undefined && explicit !== "") return Math.max(0, Math.floor(Number(explicit)) || 0);
  if (chainKind === "mock") return 0;
  const seconds = Math.max(0, (now().getTime() - Date.UTC(2026, 10, 1)) / 1000);
  return Math.floor(seconds * perSecond);
}

export function createRuntime(config: Config, opts: RuntimeOptions = {}): Runtime {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const store = opts.store;

  // Journal: JSONL persistence + masking of error messages before any subscriber (SSE included).
  const journal = createJournal({
    now,
    onAppend: (ev: DarwinEvent) => {
      redactEvent(ev);
      store?.appendEvent(ev);
    },
  });
  const warn = (code: string, message: string) => {
    journal.emit({ type: "system.warning", data: { code, message: redactText(message).slice(0, 300) } });
  };

  // Chain: in testnet NearChain emits chain.tx via onTx; in mock it is the engine (emitChainTx, D-027), hence no duplicate onTx.
  const chain = createChain(config, {
    ...opts.chainExtra,
    onTx: (r, d) => {
      journal.emit({ type: "chain.tx", data: { kind: r.kind, from: d.from, to: d.to, amount: d.amount, hash: r.hash, explorerUrl: r.explorerUrl } });
    },
    onWarning: (code, message) => warn(code, message),
  });
  const emitChainTx = chain.info().kind === "mock";

  // Brain: global USD caps (platform key = real credit). Only defined values are passed (brain defaults otherwise).
  const guardrails: Partial<Guardrails> = {};
  if (config.nearai.maxUsdPerRun !== undefined) guardrails.maxUsdPerRun = config.nearai.maxUsdPerRun;
  if (config.nearai.maxUsdPerHour !== undefined) guardrails.maxUsdPerHour = config.nearai.maxUsdPerHour;
  if (config.mode === "testnet" && config.brain === "mock" && !config.nearai.apiKey) {
    warn("BRAIN_NO_KEY", "NEARAI_API_KEY missing: mock brain (simulated AI, calls labelled mock)");
  }
  // Global AI budget reached: graceful simulation stop (the engine finishes its tick, settles debts, emits sim.stopped).
  let stopEngine: (() => void) | undefined;
  const brain = opts.brain ?? createBrain(config, {
    onWarning: (w) => warn(w.code, w.message), guardrails,
    onBudgetExhausted: (i) => {
      warn("BRAIN_BUDGET_STOP", `AI budget reached (${i.spentEur.toFixed(2)} EUR, stop at ${i.stopEur} EUR): graceful simulation stop`);
      setImmediate(() => stopEngine?.());
    },
  });

  const deps: Deps = { config, chain, brain, journal, rng: createRng(config.seed), now };
  const market = createMarket(deps, { taskSeqStart: idOffset("DARWIN_TASK_SEQ_START", chain.info().kind, 10, now), fundingMargin: chain.info().kind === "mock" ? 0n : 200_000_000_000_000_000_000_000n });
  const simulatedClient = createSimulatedClient(deps, market);
  const engine = createEngine(deps, market, { simulatedClient, emitChainTx, autoRun: opts.autoRun ?? true, agentSeqStart: idOffset("DARWIN_AGENT_SEQ_START", chain.info().kind, 0.25, now) });
  stopEngine = () => { void engine.stop().catch(() => {}); };

  // Bid index (the journal is authoritative for history).
  const bids = new Map<string, Bid[]>();
  let dirty = false;
  const marketEvents: MarketEvent[] = [];
  let population: EventCatalog["population.snapshot"] | undefined;
  journal.subscribe((e) => {
    dirty = true;
    if (e.type === "market.event") marketEvents.push(e.data.event);
    if (e.type === "population.snapshot") population = e.data;
    if (e.type === "deliverable.produced") {
      const d = market.getDeliverable(e.data.taskId);
      if (d) store?.saveDeliverable(d);
    }
    if (e.type === "bid.placed") {
      const list = bids.get(e.data.bid.taskId) ?? [];
      list.push(e.data.bid);
      bids.set(e.data.bid.taskId, list);
    }
  });

  const snapshot = () => {
    if (!store || !dirty) return;
    dirty = false;
    store.writeSnapshot(engine.getState());
  };
  const timer = store ? setInterval(snapshot, opts.snapshotEveryMs ?? 2000) : undefined;
  timer?.unref();

  const startedAt = now().toISOString();
  let down = false;
  return {
    config, journal, chain, brain, market, engine, startedAt, version: readVersion(),
    activeMarketEvents: () => {
      const tick = engine.getState().tick;
      return marketEvents.filter((ev) => tick >= ev.startTick && tick < ev.endTick).map((ev) => structuredClone(ev));
    },
    lastPopulation: () => (population ? structuredClone(population) : undefined),
    bidsOf: (taskId) => bids.get(taskId) ?? [],
    escrowMode: () => (chain instanceof NearChain && chain.mode === "contract" ? "contract" : "operator-account"),
    async checkReady() {
      if (chain instanceof NearChain) {
        try {
          await chain.checkReady();
        } catch (e) {
          throw new Error(`Testnet startup impossible: ${safeErrorMessage(e)}`);
        }
      }
    },
    async startSim() {
      await engine.start();
    },
    async shutdown() {
      if (down) return;
      down = true;
      if (timer) clearInterval(timer);
      try {
        if (engine.getState().running) await engine.stop();
      } catch (e) {
        log(`engine shutdown: ${safeErrorMessage(e)}`);
      }
      dirty = true;
      snapshot();
    },
  };
}
