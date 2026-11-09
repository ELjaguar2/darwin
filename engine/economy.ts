// Économie des agents : débits (métabolisme, coût IA), règlement groupé, synchronisation avec la chaîne.
//
// Solde logique = solde on-chain - dettes en attente. Le solde on-chain est relu à chaque tick : le gaz payé par
// les sous-comptes (NearChain) y est donc déjà inclus. `minVital` doit rester > gaz du balayage de mort (voir README).
import { costUsd, costYocto, formatNear, type Agent, type BrainResponse, type ModelInfo, type TxReceipt } from "../shared/index.ts";
import { bal, type Ctx } from "./context.ts";

export function warnOnce(ctx: Ctx, code: string, message: string) {
  if (ctx.warned.has(code + message)) return;
  ctx.warned.add(code + message);
  ctx.deps.journal.emit({ type: "system.warning", data: { code, message } });
}

export function emitTx(ctx: Ctx, r: TxReceipt, from?: string, to?: string, amount?: bigint) {
  if (!ctx.emitChainTx) return;
  ctx.deps.journal.emit({
    type: "chain.tx",
    data: { kind: r.kind, from, to, amount: amount?.toString(), hash: r.hash, explorerUrl: r.explorerUrl },
  });
}

const masterId = (ctx: Ctx) => ctx.deps.chain.info().masterId;

/** Débite `amount` (plafonné au solde logique) vers le compte maître. Renvoie le montant réellement débité. */
export async function debit(ctx: Ctx, a: Agent, amount: bigint, reason: string): Promise<{ charged: bigint; tx?: string }> {
  const charged = amount < bal(a) ? amount : bal(a);
  if (charged <= 0n) return { charged: 0n };
  let tx: string | undefined;
  if (ctx.deps.config.sim.settleEveryTicks <= 1) {
    const r = await ctx.deps.chain.transfer({ from: a.accountId, to: masterId(ctx), amount: charged.toString(), memo: reason });
    tx = r.hash;
    emitTx(ctx, r, a.accountId, masterId(ctx), charged);
  } else {
    ctx.pending.set(a.id, (ctx.pending.get(a.id) ?? 0n) + charged);
  }
  a.balance = (bal(a) - charged).toString();
  ctx.deps.journal.emit({ type: "balance.changed", data: { agentId: a.id, balance: a.balance, delta: (-charged).toString(), reason } });
  return { charged, tx };
}

/** Règle les dettes en attente d'un agent (transfert groupé). */
export async function flushAgent(ctx: Ctx, a: Agent): Promise<void> {
  const p = ctx.pending.get(a.id) ?? 0n;
  if (p <= 0n) return;
  const onChain = BigInt(await ctx.deps.chain.getBalance(a.accountId));
  const amount = p < onChain ? p : onChain;
  ctx.pending.set(a.id, 0n);
  if (amount <= 0n) return;
  const r = await ctx.deps.chain.transfer({ from: a.accountId, to: masterId(ctx), amount: amount.toString(), memo: "settle" });
  emitTx(ctx, r, a.accountId, masterId(ctx), amount);
}

export async function flushAll(ctx: Ctx, force = false): Promise<void> {
  const every = ctx.deps.config.sim.settleEveryTicks;
  if (!force && ctx.tick % every !== 0) return;
  for (const a of ctx.agents.values()) if (a.status === "alive") await flushAgent(ctx, a);
}

/** Relit les soldes on-chain ; tout écart non causé par le moteur (paiement de tâche, gaz) est journalisé. */
export async function syncBalances(ctx: Ctx): Promise<void> {
  for (const a of ctx.agents.values()) {
    if (a.status !== "alive") continue;
    const onChain = BigInt(await ctx.deps.chain.getBalance(a.accountId));
    const logical = onChain - (ctx.pending.get(a.id) ?? 0n);
    const delta = logical - bal(a);
    if (delta === 0n) continue;
    a.balance = logical.toString();
    ctx.deps.journal.emit({
      type: "balance.changed",
      data: { agentId: a.id, balance: a.balance, delta: delta.toString(), reason: delta > 0n ? "task" : "chain_fee" },
    });
  }
}

/** Prix du modèle ; modèle inconnu ou non vérifié : repli sur le modèle par défaut vérifié (jamais de coût nul). */
export function resolveModel(ctx: Ctx, a: Agent): ModelInfo {
  const m = ctx.models.find((x) => x.id === a.genome.model && x.verified);
  if (m) return m;
  warnOnce(ctx, "UNKNOWN_MODEL", `Modèle ${a.genome.model} non vérifié : repli sur ${ctx.defaultModel}`);
  const d = ctx.models.find((x) => x.id === ctx.defaultModel);
  if (!d) throw new Error("aucun modèle vérifié disponible");
  return d;
}

/** Débite le coût d'un appel IA et journalise `brain.charged`. */
export async function chargeBrain(ctx: Ctx, a: Agent, purpose: string, resp: BrainResponse, price: ModelInfo): Promise<bigint> {
  const rate = ctx.deps.config.sim.nearUsdRate;
  const cost = costYocto(resp.usage, price, rate);
  const { charged, tx } = await debit(ctx, a, cost, "brain");
  a.spentBrain = (BigInt(a.spentBrain) + charged).toString();
  ctx.deps.journal.emit({
    type: "brain.charged",
    data: {
      agentId: a.id, purpose, model: resp.model,
      promptTokens: resp.usage.promptTokens, completionTokens: resp.usage.completionTokens, reasoningTokens: resp.usage.reasoningTokens,
      cost: charged.toString(), costUsd: costUsd(resp.usage, price), nearUsdRate: rate,
      priceSource: ctx.deps.brain.kind === "mock" ? "mock" : "models", mock: resp.mock, tx,
    },
  });
  return charged;
}

export const fmt = (y: bigint | string) => formatNear(y, 4);
