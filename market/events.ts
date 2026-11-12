// Market events (L16), deterministic (injected rng): every N ticks one profession goes into strong demand (x3) for 8 to 15 ticks
// and another into a slump (x0.3). They weight the simulated client's choice of profession; each is journaled (`market.event`).
// L19: titles are English display text.
import { PROFESSIONS, demandWeight, type Deps, type MarketEvent, type Profession } from "../shared/index.ts";

export interface MarketEventsOptions {
  /** Period between two waves of events (ticks). Default 20. */
  everyTicks?: number;
  minDuration?: number;
  maxDuration?: number;
  highMultiplier?: number;
  lowMultiplier?: number;
}

export interface MarketEvents {
  /** Called once per tick: creates (and journals) the new events, returns those of this tick. */
  tick(tick: number): MarketEvent[];
  /** Events active at this tick. */
  active(tick: number): MarketEvent[];
  /** All created events (creation order; most-recent-first is not guaranteed). */
  all(): MarketEvent[];
  /** Choice weight of each profession at this tick (base x multipliers). */
  weights(tick: number): Record<Profession, number>;
}

const HIGH_TITLES: Record<Profession, string> = {
  logo: "Startup fair: everybody wants a logo",
  finance: "Year end: the financial statements pile up",
  architecture: "Fundraising round: teams are redoing their architecture",
  marketing: "Winter sales: campaigns are multiplying",
  translation: "Going global: websites are switching to English",
  legal: "New regulation: everyone is checking compliance",
};
const LOW_TITLES: Record<Profession, string> = {
  logo: "Visual identities are up to date: few logo requests",
  finance: "Quiet period: few financial analyses requested",
  architecture: "Projects on hold: few architecture requests",
  marketing: "Advertising budgets frozen: little marketing copywriting",
  translation: "Machine translation is trendy: few requests",
  legal: "Few legal checklist requests this month",
};

export function createMarketEvents(deps: Pick<Deps, "journal" | "rng">, opts: MarketEventsOptions = {}): MarketEvents {
  const every = Math.max(1, opts.everyTicks ?? 20);
  const minD = opts.minDuration ?? 8;
  const maxD = Math.max(minD, opts.maxDuration ?? 15);
  const high = opts.highMultiplier ?? 3;
  const low = opts.lowMultiplier ?? 0.3;
  const events: MarketEvent[] = [];
  let seq = 0;
  let lastTick = -1;

  const active = (tick: number) => events.filter((e) => tick >= e.startTick && tick < e.endTick);

  function create(profession: Profession, mult: number, title: string, tick: number): MarketEvent {
    const e: MarketEvent = {
      id: `e-${String(++seq).padStart(4, "0")}`, title, profession, demandMultiplier: mult,
      startTick: tick, endTick: tick + deps.rng.int(minD, maxD),
    };
    events.push(e);
    deps.journal.emit({ type: "market.event", tick, data: { event: structuredClone(e) } });
    return e;
  }

  return {
    tick(tick) {
      if (tick <= lastTick) return []; // idempotent if the same tick is replayed
      lastTick = tick;
      if (tick <= 0 || tick % every !== 0) return [];
      const busy = new Set(active(tick).map((e) => e.profession));
      const free = PROFESSIONS.filter((p) => !busy.has(p));
      if (free.length < 2) return [];
      const hot = deps.rng.pick(free);
      const cold = deps.rng.pick(free.filter((p) => p !== hot));
      return [create(hot, high, HIGH_TITLES[hot], tick), create(cold, low, LOW_TITLES[cold], tick)];
    },
    active,
    all: () => events.map((e) => ({ ...e })),
    weights(tick) {
      const act = active(tick);
      return Object.fromEntries(PROFESSIONS.map((p) => [p, demandWeight(p, tick, act)])) as Record<Profession, number>;
    },
  };
}
