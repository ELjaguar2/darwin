// Decision policy of an agent: bid (price, risk), subcontract. Pure, deterministic, no side effects.
import { costYocto, PROFESSIONS, type Agent, type Profession, type Task } from "../shared/index.ts";
import { scaledPrice } from "../shared/catalogue.ts";
import { bal, type Ctx } from "./context.ts";
import { resolveModel } from "./economy.ts";

/** Estimated AI cost of one execution (prompt + half the output cap), at the price of the gene's model. */
export function estimateCost(ctx: Ctx, a: Agent, task: Task): bigint {
  const price = resolveModel(ctx, a);
  const promptTokens = Math.ceil((a.genome.personality.length + task.prompt.length) / 4) + 20;
  const completionTokens = Math.ceil(ctx.deps.config.sim.maxTokensPerCall / 2);
  const usage = { promptTokens, completionTokens, reasoningTokens: 0, totalTokens: promptTokens + completionTokens };
  return costYocto(usage, price, ctx.deps.config.sim.nearUsdRate);
}

/** Reserve the agent refuses to dip into: minVital x (1 + 2 x (1 - risk)). A risk-taker exposes itself more. */
export function reserve(ctx: Ctx, a: Agent): bigint {
  const k = BigInt(Math.round((1 + 2 * (1 - a.genome.risk)) * 1000));
  return (ctx.deps.config.sim.minVital * k) / 1000n;
}

/** The agent's bid on a task, or null. Price = askRatio x budget, floor = estimated AI cost x 1.1, ceiling = budget. */
export function decideBid(ctx: Ctx, a: Agent, task: Task): { price: bigint; etaTicks: number } | null {
  if (task.profession !== a.genome.profession) return null;
  if (task.requester.kind === "agent" && task.requester.agentId === a.id) return null;
  const cost = estimateCost(ctx, a, task);
  if (bal(a) - cost < reserve(ctx, a)) return null;
  const budget = BigInt(task.budget);
  let price = (budget * BigInt(Math.round(a.genome.askRatio * 1000))) / 1000n;
  const floor = (cost * 11n) / 10n;
  if (price < floor) price = floor;
  // Profession price floor (catalogue): a freelancer does not undercut the reference rate of its profession.
  const professionFloor = scaledPrice(a.genome.profession, ctx.deps.config.sim.priceScale);
  if (price < professionFloor) price = professionFloor;
  if (price > budget) return null; // task not profitable for this agent
  return { price, etaTicks: 1 };
}

/** The agent always keeps at least 15% of the price it won (basis points of the price). */
export const MIN_KEEP_BP = 1500n;
/** Delegated share of the earned price, in basis points: 30% (cooperation 0) to 80% (cooperation 1). More cooperative = delegates more, keeps a smaller commission. */
export function delegatedShareBp(cooperation: number): bigint {
  const c = Math.min(1, Math.max(0, cooperation));
  return BigInt(3000 + Math.round(c * 5000));
}

export interface SubcontractDecision { profession: Profession; budget: bigint; parentPrice: bigint; commission: bigint }

/**
 * Subcontracts with probability cooperation/2. The child profession differs from the agent's own and its price floor
 * (catalogue x priceScale) must leave the agent at least 15% of the price won; budget = max(share x price, floor of the
 * child profession), strictly below the price won. Otherwise (or if the agent would dip under its reserve): no subcontracting.
 */
export function decideSubcontract(ctx: Ctx, a: Agent, price: bigint): SubcontractDecision | null {
  if (ctx.deps.rng.next() >= a.genome.cooperation / 2) return null;
  const maxBudget = (price * (10000n - MIN_KEEP_BP)) / 10000n;
  const scale = ctx.deps.config.sim.priceScale;
  const candidates = PROFESSIONS.filter((p) => p !== a.genome.profession && scaledPrice(p, scale) <= maxBudget);
  if (!candidates.length) return null;
  const profession = ctx.deps.rng.pick(candidates);
  let budget = (price * delegatedShareBp(a.genome.cooperation)) / 10000n;
  const floor = scaledPrice(profession, scale);
  if (budget < floor) budget = floor;
  if (budget > maxBudget) budget = maxBudget;
  if (budget <= 0n || budget >= price || bal(a) - budget < reserve(ctx, a)) return null;
  return { profession, budget, parentPrice: price, commission: price - budget };
}
