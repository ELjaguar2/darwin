// Client SIMULÉ : poste des tâches variées à un rythme de Poisson. Toujours `requester.kind = "simulated"`,
// libellé toujours préfixé « Client simulé » (jamais présenté comme un vrai client). Financé par le compte maître.
import { CATALOGUE, PROFESSIONS, type Deps, type Market, type Profession, type Task } from "../shared/index.ts";
import { createMarketEvents, type MarketEvents } from "./events.ts";
import { simTemplate } from "./templates.ts";

export const SIMULATED_LABEL_PREFIX = "Client simulé";

/** Tirage de Poisson (Knuth), borné pour éviter les rafales. */
export function poisson(rate: number, next: () => number, cap = 6): number {
  if (!(rate > 0)) return 0;
  const limit = Math.exp(-rate);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= next();
  } while (p > limit && k <= cap);
  return Math.min(k - 1, cap);
}

export interface SimulatedClient {
  /** Poste les tâches de ce tick et les renvoie (fait aussi avancer les événements de marché). */
  tick(tick: number): Promise<Task[]>;
  /** Événements de marché qui pondèrent le choix du métier (à afficher dans l'interface). */
  readonly events: MarketEvents;
}

/** Choix pondéré d'un métier : poids = demande de base x multiplicateurs des événements actifs. */
export function pickWeightedProfession(weights: Record<Profession, number>, u: number): Profession {
  const total = PROFESSIONS.reduce((a, p) => a + Math.max(0, weights[p]), 0);
  let x = u * total;
  for (const p of PROFESSIONS) {
    x -= Math.max(0, weights[p]);
    if (x < 0) return p;
  }
  return PROFESSIONS[PROFESSIONS.length - 1]!;
}

/** Budget du client simulé : prix plancher du métier x facteur aléatoire dans [1, 1,5] (jamais sous le plancher). */
export function simBudget(profession: Profession, u: number): bigint {
  const floor = CATALOGUE[profession].nearPrice;
  return floor + (floor * BigInt(Math.floor(Math.min(0.999999, Math.max(0, u)) * 500_000))) / 1_000_000n;
}

export function createSimulatedClient(deps: Deps, market: Market, events: MarketEvents = createMarketEvents(deps)): SimulatedClient {
  const { rng, config } = deps;
  let tickNo = 0;
  return {
    events,
    async tick(tick = tickNo + 1) {
      tickNo = tick;
      events.tick(tick);
      const n = poisson(config.sim.simClientRatePerTick, () => rng.next());
      const posted: Task[] = [];
      for (let i = 0; i < n; i++) {
        const profession = pickWeightedProfession(events.weights(tick), rng.next());
        const tpl = simTemplate(profession, rng);
        posted.push(
          await market.postTask({
            requester: { kind: "simulated", label: `${SIMULATED_LABEL_PREFIX} #${rng.int(1, 9)}` },
            profession, title: tpl.title, prompt: tpl.prompt, budget: simBudget(profession, rng.next()).toString(),
          }),
        );
      }
      return posted;
    },
  };
}
