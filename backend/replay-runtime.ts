// Façade « Runtime » du mode replay (L17) : même forme que le runtime live pour que createApp (routes, sécurité, SSE, statique)
// serve le rejeu sans duplication. Rien ici ne touche une chaîne ou une IA : moteur, marché, chaîne et cerveau sont des
// vues en lecture seule de ReplayState ; toute écriture lève une erreur (et les routes d'écriture refusent avant).
import type { Brain, Chain, Config, Engine, EventCatalog, MarketEvent, SimState } from "../shared/index.ts";
import { MarketError, type TaskMarket } from "../market/index.ts";
import { readVersion, type Runtime } from "./runtime.ts";
import type { Replay } from "./replay.ts";

export const REPLAY_READ_ONLY_MESSAGE = "mode rejeu : lecture seule, aucune tâche ne peut être publiée (rejeu d'un run réel enregistré)";

/** Config publique du rejeu : jamais de clé (le mode « replay » ne lit aucun secret). */
export function replayConfig(base: Config, replay: Replay): Config {
  const rec = replay.meta.recorded;
  return {
    ...base,
    mode: "replay" as unknown as Config["mode"],
    chain: (rec.chain === "near" ? "near" : "mock") as Config["chain"],
    brain: (rec.brain === "nearai" ? "nearai" : "mock") as Config["brain"],
    near: { ...base.near, masterPrivateKey: undefined },
    nearai: { ...base.nearai, apiKey: undefined },
    ai: { ...base.ai, fallback: undefined },
    intents: { ...base.intents, enabled: false, jwt: undefined },
  };
}

export function createReplayRuntime(config: Config, replay: Replay): Runtime {
  const cfg = replayConfig(config, replay);
  const rec = replay.meta.recorded;
  const chainKind = cfg.chain === "near" ? "near" : "mock";
  const masterOf = () => {
    const a = [...replay.state.agents.values()][0];
    return a?.accountId.includes(".") ? a.accountId.split(".").slice(1).join(".") : "";
  };
  const info = () => ({ kind: chainKind as "mock" | "near", masterId: masterOf(), contractId: undefined as string | undefined });
  const simInfo = (): Pick<SimState, "mode" | "chain" | "brain"> => ({
    mode: "replay" as unknown as SimState["mode"],
    chain: info(),
    brain: { kind: cfg.brain === "nearai" ? "nearai" : "mock" },
  });
  const ro = (): never => {
    throw new Error(REPLAY_READ_ONLY_MESSAGE);
  };

  const engine = {
    start: ro, tick: ro, stop: ro, pause: ro, resume: ro,
    getState: () => replay.state.snapshot(simInfo()),
    getAgent: (id: string) => {
      const a = replay.state.agents.get(id);
      return a ? structuredClone(a) : undefined;
    },
    getLetter: (id: string) => {
      const l = replay.state.letters.get(id);
      return l ? structuredClone(l) : undefined;
    },
  } as unknown as Engine;

  const market = {
    listTasks: () => [...replay.state.tasks.values()].map((t) => structuredClone(t)),
    getTask: (id: string) => {
      const t = replay.state.tasks.get(id);
      return t ? structuredClone(t) : undefined;
    },
    getEscrow: (id: string) => {
      const e = replay.state.escrows.get(id);
      return e ? structuredClone(e) : undefined;
    },
    getDeliverable: (id: string) => replay.state.deliverables.get(id),
    listDeliverables: () => [...replay.state.deliverables.values()],
    openTasks: () => [],
    visitorSpentLastHour: () => 0n,
    visitorHourlyCap: () => 0n,
    postVisitorTask: async () => {
      throw new MarketError("INVALID_INPUT", REPLAY_READ_ONLY_MESSAGE);
    },
  } as unknown as TaskMarket;

  return {
    config: cfg,
    get journal() {
      return replay.journal;
    },
    chain: { info } as unknown as Chain,
    brain: { kind: cfg.brain === "nearai" ? "nearai" : "mock" } as unknown as Brain,
    market,
    engine,
    version: readVersion(),
    startedAt: replay.meta.startedAt,
    replay,
    bidsOf: (id) => structuredClone(replay.state.bids.get(id) ?? []),
    activeMarketEvents: (): MarketEvent[] => [...replay.state.marketEvents.values()].filter((e) => e.startTick <= replay.state.tick && replay.state.tick < e.endTick),
    lastPopulation: (): EventCatalog["population.snapshot"] | undefined => (replay.state.population ? structuredClone(replay.state.population) : undefined),
    escrowMode: () => (rec.chain === "near" ? "contract" : "operator-account"),
    checkReady: async () => {},
    startSim: async () => {
      replay.start();
    },
    shutdown: async () => {
      replay.stop();
    },
  } as Runtime;
}
