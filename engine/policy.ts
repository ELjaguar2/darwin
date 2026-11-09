// Politique de décision d'un agent : enchérir (prix, risque), sous-traiter. Pure, déterministe, sans effet de bord.
import { costYocto, type Agent, type Task } from "../shared/index.ts";
import { bal, type Ctx } from "./context.ts";
import { resolveModel } from "./economy.ts";

/** Coût IA estimé d'une exécution (prompt + moitié du plafond de sortie), au prix du modèle du gène. */
export function estimateCost(ctx: Ctx, a: Agent, task: Task): bigint {
  const price = resolveModel(ctx, a);
  const promptTokens = Math.ceil((a.genome.personality.length + task.prompt.length) / 4) + 20;
  const completionTokens = Math.ceil(ctx.deps.config.sim.maxTokensPerCall / 2);
  const usage = { promptTokens, completionTokens, reasoningTokens: 0, totalTokens: promptTokens + completionTokens };
  return costYocto(usage, price, ctx.deps.config.sim.nearUsdRate);
}

/** Réserve que l'agent refuse d'entamer : minVital x (1 + 2 x (1 - risque)). Un preneur de risque s'expose davantage. */
export function reserve(ctx: Ctx, a: Agent): bigint {
  const k = BigInt(Math.round((1 + 2 * (1 - a.genome.risk)) * 1000));
  return (ctx.deps.config.sim.minVital * k) / 1000n;
}

/** Offre de l'agent sur une tâche, ou null. Prix = askRatio x budget, plancher = coût IA estimé x 1,1, plafond = budget. */
export function decideBid(ctx: Ctx, a: Agent, task: Task): { price: bigint; etaTicks: number } | null {
  if (task.profession !== a.genome.profession) return null;
  if (task.requester.kind === "agent" && task.requester.agentId === a.id) return null;
  const cost = estimateCost(ctx, a, task);
  if (bal(a) - cost < reserve(ctx, a)) return null;
  const budget = BigInt(task.budget);
  let price = (budget * BigInt(Math.round(a.genome.askRatio * 1000))) / 1000n;
  const floor = (cost * 11n) / 10n;
  if (price < floor) price = floor;
  if (price > budget) return null; // tâche non rentable pour cet agent
  return { price, etaTicks: 1 };
}

/** Sous-traite avec probabilité cooperation/2 si l'agent peut se le permettre. Budget = 25 % du prix gagné. */
export function decideSubcontract(ctx: Ctx, a: Agent, price: bigint): bigint | null {
  if (ctx.deps.rng.next() >= a.genome.cooperation / 2) return null;
  const budget = price / 4n;
  if (budget <= 0n || bal(a) - budget < reserve(ctx, a)) return null;
  return budget;
}
