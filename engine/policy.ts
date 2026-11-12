// Decision policy of an agent: bid (price, risk), subcontract. Pure, deterministic, no side effects.
import { costYocto, type Agent, type Profession, type Task } from "../shared/index.ts";
import { scaledPrice } from "../shared/catalogue.ts";
import { bal, type Ctx } from "./context.ts";
import { resolveModel } from "./economy.ts";
import { INTEGRATION_MARGIN_TICKS, SUBCONTRACT_PLAN } from "./subcontract-plan.ts";

/** Estimated AI cost of one execution (prompt + half the output cap), at the price of the gene's model. */
export function estimateCost(ctx: Ctx, a: Agent, task: Task, completionCap?: number): bigint {
  const price = resolveModel(ctx, a);
  const promptTokens = Math.ceil((a.genome.personality.length + task.prompt.length) / 4) + 20;
  const completionTokens = Math.ceil((completionCap ?? ctx.deps.config.sim.maxTokensPerCall) / 2);
  const usage = { promptTokens, completionTokens, reasoningTokens: 0, totalTokens: promptTokens + completionTokens };
  return costYocto(usage, price, ctx.deps.config.sim.nearUsdRate);
}

/** Reserve the agent refuses to dip into: minVital x (1 + 2 x (1 - risk)). A risk-taker exposes itself more. */
export function reserve(ctx: Ctx, a: Agent): bigint {
  const k = BigInt(Math.round((1 + 2 * (1 - a.genome.risk)) * 1000));
  return (ctx.deps.config.sim.minVital * k) / 1000n;
}

/** The agent's bid on a task, or null. Price = askRatio x budget, floor = estimated AI cost x 1.1, ceiling = budget. */
export function decideBid(ctx: Ctx, a: Agent, task: Task, committed = 0n): { price: bigint; etaTicks: number } | null {
  if (task.profession !== a.genome.profession) return null;
  if (task.requester.kind === "agent" && task.requester.agentId === a.id) return null;
  const cost = estimateCost(ctx, a, task);
  if (bal(a) - committed - cost < reserve(ctx, a)) return null;
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

/** Default minimum share of the price won that the agent keeps (overridable by `sim.subcontract.minCommission`). */
export const MIN_KEEP_BP = 1500n;
/** Delegated share of the earned price, in basis points: 30% (cooperation 0) to 80% (cooperation 1). More cooperative = delegates more, keeps a smaller commission. */
export function delegatedShareBp(cooperation: number): bigint {
  const c = Math.min(1, Math.max(0, cooperation));
  return BigInt(3000 + Math.round(c * 5000));
}

/** Probability of subcontracting a won mission: baseProb + coopProb x cooperation (default 0 + 0.5 x cooperation), within [0, 1]. */
export function subcontractProbability(ctx: Ctx, cooperation: number): number {
  const cfg = ctx.deps.config.sim.subcontract ?? { baseProb: 0, coopProb: 0.5, minCommission: 0.15 };
  return Math.min(1, Math.max(0, cfg.baseProb + cfg.coopProb * cooperation));
}

export interface SubcontractDecision {
  profession: Profession;
  budget: bigint;
  parentPrice: bigint;
  /** Planned commission = price won - budget of the sub-task (the real one uses the winning bid of the child). */
  commission: bigint;
  /** Absolute deadline of the sub-task: strictly before the mission's, with an integration margin. */
  deadlineTick: number;
}

/**
 * Real subcontracting (L21). Only a mission of depth 0 (simulated client or visitor) can be subcontracted; the child never subcontracts.
 * The child profession comes from the splitting table (engine/subcontract-plan.ts). Budget = max(share x price, floor of the child profession),
 * capped so that the agent keeps at least minCommission of the price won, strictly below it. The deadline leaves the parent
 * INTEGRATION_MARGIN_TICKS ticks after the end of the sub-task and at least one tick after the child's bidding window.
 * Otherwise (not feasible, or the agent would dip under its reserve): no subcontracting.
 */
export function decideSubcontract(ctx: Ctx, a: Agent, task: Task, price: bigint, committed = 0n): SubcontractDecision | null {
  if (task.requester.kind === "agent" || task.parentTaskId) return null;
  if (ctx.deps.rng.next() >= subcontractProbability(ctx, a.genome.cooperation)) return null;
  const sim = ctx.deps.config.sim;
  const row = SUBCONTRACT_PLAN[a.genome.profession];
  const keepBp = BigInt(Math.round((sim.subcontract?.minCommission ?? 0.15) * 10000));
  const maxBudget = (price * (10000n - keepBp)) / 10000n;
  const floor = scaledPrice(row.child, sim.priceScale);
  if (floor > maxBudget) return null;
  let budget = (price * delegatedShareBp(a.genome.cooperation)) / 10000n;
  if (budget < floor) budget = floor;
  if (budget > maxBudget) budget = maxBudget;
  if (budget <= 0n || budget >= price || bal(a) - committed - budget < reserve(ctx, a)) return null; // budgets already promised by running jobs are not spendable
  const biddingEnds = ctx.tick + sim.bidWindowTicks;
  const deadlineTick = Math.min(task.deadlineTick - INTEGRATION_MARGIN_TICKS, biddingEnds + sim.taskDeadlineTicks);
  if (deadlineTick < biddingEnds + 1) return null; // no time left for the child to be awarded, deliver and be paid
  return { profession: row.child, budget, parentPrice: price, commission: price - budget, deadlineTick };
}
