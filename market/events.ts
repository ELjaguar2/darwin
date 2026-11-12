// Événements de marché (L16), déterministes (rng injecté) : tous les N ticks un métier passe en demande forte (x3) pendant 8 à 15 ticks
// et un autre en baisse (x0,3). Ils pondèrent le choix de métier du client simulé ; chacun est journalisé (`market.event`).
import { PROFESSIONS, demandWeight, type Deps, type MarketEvent, type Profession } from "../shared/index.ts";

export interface MarketEventsOptions {
  /** Période entre deux vagues d'événements (ticks). Défaut 20. */
  everyTicks?: number;
  minDuration?: number;
  maxDuration?: number;
  highMultiplier?: number;
  lowMultiplier?: number;
}

export interface MarketEvents {
  /** Appelé une fois par tick : crée (et journalise) les nouveaux événements, renvoie ceux de ce tick. */
  tick(tick: number): MarketEvent[];
  /** Événements actifs à ce tick. */
  active(tick: number): MarketEvent[];
  /** Tous les événements créés (récents d'abord n'est pas garanti : ordre de création). */
  all(): MarketEvent[];
  /** Poids de choix de chaque métier à ce tick (base x multiplicateurs). */
  weights(tick: number): Record<Profession, number>;
}

const HIGH_TITLES: Record<Profession, string> = {
  logo: "Salon des startups : tout le monde veut un logo",
  finance: "Fin d'exercice : les bilans s'accumulent",
  architecture: "Levée de fonds : les équipes refont leur architecture",
  marketing: "Soldes d'hiver : les campagnes se multiplient",
  translation: "Export : les sites se mettent à l'anglais",
  legal: "Nouvelle réglementation : on vérifie la conformité",
};
const LOW_TITLES: Record<Profession, string> = {
  logo: "Les identités visuelles sont à jour : peu de demandes de logo",
  finance: "Période calme : peu d'analyses financières demandées",
  architecture: "Gel des projets : peu de demandes d'architecture",
  marketing: "Budgets publicitaires gelés : peu de rédaction marketing",
  translation: "Traductions automatiques à la mode : peu de demandes",
  legal: "Peu de demandes de checklists juridiques ce mois-ci",
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
      if (tick <= lastTick) return []; // idempotent si le même tick est rejoué
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

