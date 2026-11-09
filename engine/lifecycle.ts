// Cycle de vie : naissance, reproduction (mutation + lettre), mort. Tout passe par Chain, Brain et le journal injectés.
import { formatNear, hashObject, type Agent, type CauseOfDeath, type Genome, type Letter } from "../shared/index.ts";
import { bal, type Ctx } from "./context.ts";
import { chargeBrain, emitTx, flushAgent, resolveModel, warnOnce } from "./economy.ts";
import { createFounderGenome, mutateGenome } from "./genome.ts";

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
    // Naissance annulée : on rapatrie les fonds du compte orphelin vers celui qui les a donnés.
    const funder = parent?.accountId ?? chain.info().masterId;
    let recovered = false;
    try {
      await chain.closeAccount({ accountId, beneficiary: funder });
      recovered = true;
    } catch (e2) {
      journal.emit({ type: "system.error", data: { code: "BIRTH_ORPHAN_ACCOUNT", message: `compte orphelin ${accountId} non rapatrié : ${(e2 as Error).message}` } });
    }
    journal.emit({ type: "system.warning", data: { code: "BIRTH_ABORTED", message: `naissance de ${id} annulée (registre : ${(e as Error).message}) ; fonds ${recovered ? "rapatriés" : "NON rapatriés"}` } });
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

/** Génération 1 : `founders` agents financés par le compte maître. */
export async function createFounders(ctx: Ctx): Promise<void> {
  const ids = ctx.models.map((m) => m.id);
  for (let i = 0; i < ctx.deps.config.sim.founders; i++) {
    await bear(ctx, createFounderGenome(ctx.deps.rng, i, ids), ctx.deps.config.sim.birthCapital); // null = annulée (warning émis)
  }
}

/** Capital de l'enfant : birthCapital + generosity x surplus (au-dessus du seuil), borné pour que le parent garde 2 x minVital. */
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
  ctx.lastRepro.set(parent.id, ctx.tick); // même après échec : pas de nouvel essai immédiat
  if (!child) return null;
  parent.balance = (bal(parent) - capital).toString();
  ctx.deps.journal.emit({ type: "balance.changed", data: { agentId: parent.id, balance: parent.balance, delta: (-capital).toString(), reason: "birth" } });
  ctx.deps.journal.emit({ type: "agent.reproduced", data: { parentId: parent.id, childId: child.id, transferred: capital.toString(), mutations } });
  await writeLetter(ctx, parent, child, mutations);
  return child;
}

/** Lettre parent -> enfant, écrite par le cerveau du parent (coût débité au parent). Repli étiqueté mock si le cerveau échoue. */
async function writeLetter(ctx: Ctx, parent: Agent, child: Agent, mutations: Record<string, [unknown, unknown]>) {
  const { brain, journal, now, config } = ctx.deps;
  const changed = Object.keys(mutations).join(", ") || "aucun";
  const user =
    `Tu es ${parent.name}, génération ${parent.generation}. Ton enfant ${child.name} naît avec ${formatNear(child.birthCapital, 2)} NEAR. ` +
    `Tu as accompli ${parent.tasksDone} tâches. Gènes modifiés chez lui : ${changed}. Écris-lui une courte « lettre à mon enfant » : tes conseils pour survivre.`;
  let text: string;
  let model = parent.genome.model;
  let mock = true;
  try {
    const price = resolveModel(ctx, parent);
    model = price.id;
    const resp = await brain.complete({
      agentId: parent.id, purpose: "letter", model, maxTokens: config.sim.maxTokensPerCall,
      messages: [{ role: "system", content: parent.genome.personality }, { role: "user", content: user }],
    });
    await chargeBrain(ctx, parent, "letter", resp, price);
    text = resp.text;
    mock = resp.mock;
    model = resp.model;
  } catch (e) {
    warnOnce(ctx, "LETTER_FALLBACK", `Lettre de repli (cerveau indisponible) : ${(e as Error).message}`);
    text = `[repli] Cher ${child.name}, travaille, dépense peu, et reproduis-toi seulement quand tu as de la marge.`;
  }
  const letter: Letter = {
    id: `l-${pad(++ctx.nextLetter)}`, fromAgentId: parent.id, toAgentId: child.id, generation: child.generation,
    text, model, mock, tick: ctx.tick, createdAt: now().toISOString(),
  };
  ctx.letters.set(letter.id, letter);
  child.letterId = letter.id;
  journal.emit({ type: "letter.written", data: { letter: structuredClone(letter) } });
}

/** Mort : solde logique sous minVital. Règle les dettes, marque le registre, balaie le solde restant vers le maître. */
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
