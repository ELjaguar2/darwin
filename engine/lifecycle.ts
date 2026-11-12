// Life cycle: birth, reproduction (mutation + letter), death. Everything goes through the injected Chain, Brain and journal.
import { formatNear, hashObject, type Agent, type CauseOfDeath, type Genome, type Letter } from "../shared/index.ts";
import { bal, type Ctx } from "./context.ts";
import { reserve } from "./policy.ts";
import { chargeBrain, emitTx, flushAgent, resolveModel, warnOnce } from "./economy.ts";
import { createFounderGenome, mutateGenome } from "./genome.ts";
import { ENGLISH_RULE } from "../brain/prompts.ts";

const NAMES = ["Ada", "Blaise", "Clara", "Darwin", "Emma", "Faraday", "Gaia", "Hugo", "Iris", "Jules", "Kepler", "Lina", "Mendel", "Nora", "Orion", "Pasteur"];
const pad = (n: number) => String(n).padStart(4, "0");

async function bear(ctx: Ctx, genome: Genome, capital: bigint, parent?: Agent): Promise<Agent | null> {
  const { chain, journal, now } = ctx.deps;
  const seq = ++ctx.nextAgent;
  const id = `a-${pad(seq)}`;
  const { accountId, tx } = await chain.createAccount({ label: id, initialFunding: capital.toString(), fundFrom: parent?.accountId });
  const generation = parent ? parent.generation + 1 : 1;
  const agent: Agent = {
    id, name: `${NAMES[(seq - 1) % NAMES.length]}-${seq}`, accountId, generation, parentId: parent?.id ?? null, childrenIds: [],
    genome, status: "alive", birthTick: ctx.tick, bornAt: now().toISOString(), birthCapital: capital.toString(),
    balance: capital.toString(), earned: "0", spentBrain: "0", reputation: 0, tasksDone: 0, birthTx: tx.hash,
  };
  let reg;
  try {
    reg = await chain.registerAgent({
      agentId: id, accountId, parentId: agent.parentId, generation, genomeHash: hashObject(genome), genome, birthTick: ctx.tick,
    });
  } catch (e) {
    // Birth cancelled: the funds of the orphan account are returned to whoever gave them.
    const funder = parent?.accountId ?? chain.info().masterId;
    let recovered = false;
    try {
      await chain.closeAccount({ accountId, beneficiary: funder });
      recovered = true;
    } catch (e2) {
      journal.emit({ type: "system.error", data: { code: "BIRTH_ORPHAN_ACCOUNT", message: `orphan account ${accountId} not recovered: ${(e2 as Error).message}` } });
    }
    journal.emit({ type: "system.warning", data: { code: "BIRTH_ABORTED", message: `birth of ${id} cancelled (registry: ${(e as Error).message}); funds ${recovered ? "recovered" : "NOT recovered"}` } });
    return null;
  }
  ctx.agents.set(id, agent);
  if (parent) parent.childrenIds.push(id);
  emitTx(ctx, tx, parent?.accountId ?? chain.info().masterId, accountId, capital);
  emitTx(ctx, reg);
  journal.emit({ type: "agent.born", data: { agent: structuredClone(agent), parentId: agent.parentId, birthTx: tx.hash } });
  if (!parent) {
    journal.emit({ type: "funding.received", data: { to: accountId, amount: capital.toString(), source: "master", tx: tx.hash } });
  }
  journal.emit({ type: "balance.changed", data: { agentId: id, balance: agent.balance, delta: capital.toString(), reason: "birth" } });
  return agent;
}

/** Generation 1: `founders` agents funded by the master account. */
export async function createFounders(ctx: Ctx): Promise<void> {
  const ids = ctx.models.map((m) => m.id);
  for (let i = 0; i < ctx.deps.config.sim.founders; i++) {
    await bear(ctx, createFounderGenome(ctx.deps.rng, i, ids), ctx.deps.config.sim.birthCapital); // null = cancelled (warning emitted)
  }
}

/** Child's capital: birthCapital + generosity x surplus (above the threshold), bounded so the parent keeps 2 x minVital. */
export function childCapital(ctx: Ctx, p: Agent): bigint | null {
  const { birthCapital: B, minVital } = ctx.deps.config.sim;
  const threshold = (B * BigInt(Math.round(p.genome.reproThreshold * 1000))) / 1000n;
  if (bal(p) < threshold) return null;
  const surplus = bal(p) - threshold;
  let capital = B + (surplus * BigInt(Math.round(p.genome.generosity * 1000))) / 1000n;
  const maxGive = bal(p) - 2n * minVital;
  if (capital > maxGive) capital = maxGive;
  return capital >= B ? capital : null;
}

export function canReproduce(ctx: Ctx, p: Agent): boolean {
  const { maxPopulation, reproCooldownTicks } = ctx.deps.config.sim;
  if (p.status !== "alive") return false;
  const alive = [...ctx.agents.values()].filter((a) => a.status === "alive").length;
  if (alive >= maxPopulation) return false;
  const last = ctx.lastRepro.get(p.id);
  if (last !== undefined && ctx.tick - last < reproCooldownTicks) return false;
  if (last === undefined && ctx.tick - p.birthTick < reproCooldownTicks) return false;
  return childCapital(ctx, p) !== null;
}

export async function reproduce(ctx: Ctx, parent: Agent): Promise<Agent | null> {
  const { sim } = ctx.deps.config;
  const capital = childCapital(ctx, parent);
  if (capital === null) return null;
  const { genome, mutations } = mutateGenome(parent.genome, ctx.deps.rng, sim.mutationRate, sim.mutationSd, ctx.models.map((m) => m.id));
  const child = await bear(ctx, genome, capital, parent);
  ctx.lastRepro.set(parent.id, ctx.tick); // even after a failure: no immediate retry
  if (!child) return null;
  parent.balance = (bal(parent) - capital).toString();
  ctx.deps.journal.emit({ type: "balance.changed", data: { agentId: parent.id, balance: parent.balance, delta: (-capital).toString(), reason: "birth" } });
  ctx.deps.journal.emit({ type: "agent.reproduced", data: { parentId: parent.id, childId: child.id, transferred: capital.toString(), mutations } });
  await writeLetter(ctx, parent, child, mutations);
  return child;
}

/** Messages of the letter request (exported so that brain/tools/english-validation.ts replays the exact production prompt). */
export function letterRequestMessages(parent: Agent, child: Agent, mutations: Record<string, [unknown, unknown]>) {
  const changed = Object.keys(mutations).join(", ") || "none";
  const user =
    `You are ${parent.name}, generation ${parent.generation}. Your child ${child.name} is born with ${formatNear(child.birthCapital, 2)} NEAR. ` +
    `You have completed ${parent.tasksDone} tasks. Genes changed in your child: ${changed}. Write a short "letter to my child" with your survival advice. ${ENGLISH_RULE}`;
  return [{ role: "system" as const, content: `${parent.genome.personality}\n${ENGLISH_RULE}` }, { role: "user" as const, content: user }];
}

/** Dedicated token cap of a letter (independent of sim.maxTokensPerCall, like deliverables): a short cap gave empty letters on a real model. */
export const LETTER_MAX_TOKENS = 900;

/** Parent -> child letter, written by the parent's brain (cost of every attempt debited from the parent). Always in English.
 *  Empty answer: ONE retry; still empty: empty letter, `LETTER_EMPTY` warning, the child gets no advice. Brain failure: labelled fallback. */
async function writeLetter(ctx: Ctx, parent: Agent, child: Agent, mutations: Record<string, [unknown, unknown]>) {
  const { brain, journal, now } = ctx.deps;
  const messages = letterRequestMessages(parent, child, mutations);
  let text = "";
  let model = parent.genome.model;
  let mock = true;
  let fallback = false;
  try {
    const price = resolveModel(ctx, parent);
    model = price.id;
    for (let attempt = 0; attempt < 2 && !text.trim(); attempt++) {
      if (attempt > 0 && bal(parent) < reserve(ctx, parent)) break; // the retry never dips into the parent's reserve
      const resp = await brain.complete({ agentId: parent.id, purpose: "letter", model, maxTokens: LETTER_MAX_TOKENS, messages });
      await chargeBrain(ctx, parent, "letter", resp, price);
      text = resp.text;
      mock = resp.mock;
      model = resp.model;
    }
    if (!text.trim()) {
      text = "";
      warnOnce(ctx, "LETTER_EMPTY", `Empty letter from ${parent.id} to ${child.id} after a retry: the child receives no advice`);
    }
  } catch (e) {
    warnOnce(ctx, "LETTER_FALLBACK", `Fallback letter (brain unavailable): ${(e as Error).message}`);
    text = `[fallback] Dear ${child.name}, work hard, spend little, and only reproduce when you have some margin.`;
    fallback = true;
  }
  const letter: Letter = {
    id: `l-${pad(++ctx.nextLetter)}`, fromAgentId: parent.id, toAgentId: child.id, generation: child.generation,
    text, model, mock, tick: ctx.tick, createdAt: now().toISOString(),
  };
  ctx.letters.set(letter.id, letter);
  child.letterId = letter.id;
  journal.emit({ type: "letter.written", data: { letter: structuredClone(letter) } });
  const clean = text.trim();
  journal.emit({
    type: "letter.received",
    data: { childId: child.id, parentId: parent.id, letterId: letter.id, length: clean.length, excerpt: clean.slice(0, 160), status: clean ? "received" : "empty", ...(fallback ? { fallback: true } : {}) },
  });
}

/** Death: logical balance below minVital. Settles debts, marks the registry, sweeps the remaining balance to the master. */
export async function die(ctx: Ctx, a: Agent, cause: CauseOfDeath): Promise<void> {
  const { chain, journal, now } = ctx.deps;
  const finalBalance = bal(a);
  await flushAgent(ctx, a);
  const master = chain.info().masterId;
  await chain.markAgentDead({ agentId: a.id, deathTick: ctx.tick, cause });
  const { swept, tx } = await chain.closeAccount({ accountId: a.accountId, beneficiary: master });
  emitTx(ctx, tx, a.accountId, master, BigInt(swept));
  a.status = "dead";
  a.deathTick = ctx.tick;
  a.diedAt = now().toISOString();
  a.causeOfDeath = cause;
  a.balance = "0";
  journal.emit({ type: "agent.died", data: { agentId: a.id, cause, finalBalance: finalBalance.toString(), swept, sweptTo: master, tx: tx.hash } });
  journal.emit({ type: "balance.changed", data: { agentId: a.id, balance: "0", delta: (-finalBalance).toString(), reason: "death" } });
}
