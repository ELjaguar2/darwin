// SIMULATED client: posts varied tasks at a Poisson rate. Always `requester.kind = "simulated"`,
// label always prefixed "Simulated client" (never presented as a real client). Funded by the master account.
import { PROFESSIONS, scaledPrice, type Deps, type Market, type Profession, type Task } from "../shared/index.ts";
import { createMarketEvents, type MarketEvents } from "./events.ts";
import { simTemplate } from "./templates.ts";

/** Display prefix of the simulated client's label (L19: English). Purely displayed; the protocol value is `requester.kind = "simulated"`. */
export const SIMULATED_LABEL_PREFIX = "Simulated client";
/** Prefix written by versions before L19 (French journals, e.g. docs/preuves): still recognised as already labelled. */
export const LEGACY_SIMULATED_LABEL_PREFIX = "Client simulé";

/** Poisson draw (Knuth), capped to avoid bursts. */
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
  /** Posts this tick's tasks and returns them (also advances the market events). */
  tick(tick: number): Promise<Task[]>;
  /** Market events that weight the choice of profession (to display in the interface). */
  readonly events: MarketEvents;
}

/** Weighted choice of a profession: weight = base demand x multipliers of the active events. */
export function pickWeightedProfession(weights: Record<Profession, number>, u: number): Profession {
  const total = PROFESSIONS.reduce((a, p) => a + Math.max(0, weights[p]), 0);
  let x = u * total;
  for (const p of PROFESSIONS) {
    x -= Math.max(0, weights[p]);
    if (x < 0) return p;
  }
  return PROFESSIONS[PROFESSIONS.length - 1]!;
}

/** Simulated client budget: floor price of the profession x random factor in [1, 1.5] (never below the floor). */
export function simBudget(profession: Profession, u: number, scale = 1): bigint {
  const floor = scaledPrice(profession, scale);
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
            profession, title: tpl.title, prompt: tpl.prompt, budget: simBudget(profession, rng.next(), config.sim.priceScale).toString(),
          }),
        );
      }
      return posted;
    },
  };
}
