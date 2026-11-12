// Decision policy of an agent: bid (price, risk), subcontract. Pure, deterministic, no side effects.
import { costYocto, type Agent, type Task } from "../shared/index.ts";
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

/** Subcontracts with probability cooperation/2 if the agent can afford it. Budget = 25% of the price earned. */
export function decideSubcontract(ctx: Ctx, a: Agent, price: bigint): bigint | null {
  if (ctx.deps.rng.next() >= a.genome.cooperation / 2) return null;
  const budget = price / 4n;
  if (budget <= 0n || bal(a) - budget < reserve(ctx, a)) return null;
  return budget;
}
