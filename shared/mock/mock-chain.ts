// MockChain : simulation en mémoire de comptes + registre + séquestre + réputation. Sans réseau, sans clé.
// Invariant testé : la somme (comptes + séquestres) reste constante (aucun NEAR créé ni détruit).
import { ChainError, type AgentRecord, type Chain, type ChainInfo, type ReleaseProof, type TxReceipt } from "../chain.ts";
import { sha256Hex } from "../hash.ts";
import type { CauseOfDeath } from "../types.ts";
import type { Yocto } from "../money.ts";

interface Account { balance: bigint; deleted: boolean }
interface EscrowRow {
  taskId: string; payer: string; amount: bigint; status: "locked" | "released" | "refunded";
  payee?: string; resultHash?: string; refundReason?: "rejected" | "expired";
}

export interface MockChainOptions {
  masterId?: string;
  masterBalance?: bigint; // défaut : 1 000 000 NEAR fictifs
  now?: () => Date;
}

export class MockChain implements Chain {
  readonly masterId: string;
  private accounts = new Map<string, Account>();
  private escrows = new Map<string, EscrowRow>();
  private records = new Map<string, AgentRecord>();
  private reputation = new Map<string, number>();
  private repWrites = new Set<string>();
  private counter = 0;
  private now: () => Date;
  /** Journal des transactions mock (utile aux tests et à /api/state). */
  readonly txs: TxReceipt[] = [];

  constructor(opts: MockChainOptions = {}) {
    this.masterId = opts.masterId ?? "darwin.mock.testnet";
    this.now = opts.now ?? (() => new Date());
    this.accounts.set(this.masterId, { balance: opts.masterBalance ?? 1_000_000n * 10n ** 24n, deleted: false });
  }

  info(): ChainInfo {
    return { kind: "mock", network: "mock", masterId: this.masterId, contractId: `contract.${this.masterId}` };
  }

  /** Somme de tout ce que la chaîne détient (comptes + séquestres) : constante. */
  totalSupply(): bigint {
    let t = 0n;
    for (const a of this.accounts.values()) t += a.balance;
    for (const e of this.escrows.values()) if (e.status === "locked") t += e.amount;
    return t;
  }

  private tx(kind: string, payload: string): TxReceipt {
    const hash = sha256Hex(`${++this.counter}|${kind}|${payload}`).slice(0, 44);
    const r: TxReceipt = { hash: `mock_${hash}`, kind, ok: true, at: this.now().toISOString() };
    this.txs.push(r);
    return r;
  }

  private acc(id: string): Account {
    const a = this.accounts.get(id);
    if (!a) throw new ChainError("UNKNOWN_ACCOUNT", `Compte inconnu : ${id}`);
    if (a.deleted) throw new ChainError("ACCOUNT_DELETED", `Compte supprimé : ${id}`);
    return a;
  }

  private move(from: string, to: string, amount: bigint) {
    if (amount < 0n) throw new ChainError("RPC_ERROR", "Montant négatif");
    const a = this.acc(from);
    const b = this.acc(to);
    if (a.balance < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Solde insuffisant sur ${from}`);
    a.balance -= amount;
    b.balance += amount;
  }

  async createAccount(args: { label: string; initialFunding: Yocto; fundFrom?: string }) {
    const accountId = `${args.label}.${this.masterId}`;
    if (this.accounts.has(accountId)) throw new ChainError("RPC_ERROR", `Compte déjà existant : ${accountId}`);
    this.accounts.set(accountId, { balance: 0n, deleted: false });
    try {
      this.move(args.fundFrom ?? this.masterId, accountId, BigInt(args.initialFunding));
    } catch (e) {
      this.accounts.delete(accountId);
      throw e;
    }
    return { accountId, tx: this.tx("create_account", `${accountId}|${args.initialFunding}`) };
  }

  async getBalance(accountId: string): Promise<Yocto> {
    return this.acc(accountId).balance.toString();
  }

  async transfer(args: { from: string; to: string; amount: Yocto; memo?: string }) {
    this.move(args.from, args.to, BigInt(args.amount));
    return this.tx("transfer", `${args.from}>${args.to}|${args.amount}|${args.memo ?? ""}`);
  }

  async closeAccount(args: { accountId: string; beneficiary: string }) {
    const a = this.acc(args.accountId);
    this.acc(args.beneficiary);
    const swept = a.balance;
    this.move(args.accountId, args.beneficiary, swept);
    a.deleted = true;
    return { swept: swept.toString(), tx: this.tx("close_account", `${args.accountId}>${args.beneficiary}|${swept}`) };
  }

  async registerAgent(record: Omit<AgentRecord, "alive" | "deathTick" | "cause">) {
    if (this.records.has(record.agentId)) throw new ChainError("ALREADY_REGISTERED", `Déjà enregistré : ${record.agentId}`);
    this.records.set(record.agentId, { ...record, alive: true });
    return this.tx("register_agent", record.agentId + record.genomeHash);
  }

  async markAgentDead(args: { agentId: string; deathTick: number; cause: CauseOfDeath }) {
    const r = this.records.get(args.agentId);
    if (!r) throw new ChainError("UNKNOWN_AGENT", `Agent inconnu : ${args.agentId}`);
    r.alive = false;
    r.deathTick = args.deathTick;
    r.cause = args.cause;
    return this.tx("mark_dead", `${args.agentId}|${args.cause}`);
  }

  async getAgentRecord(agentId: string) {
    const r = this.records.get(agentId);
    return r ? structuredClone(r) : null;
  }

  async listAgentRecords() {
    return [...this.records.values()].map((r) => structuredClone(r));
  }

  async lockEscrow(args: { taskId: string; payer: string; amount: Yocto }) {
    if (this.escrows.has(args.taskId)) throw new ChainError("ESCROW_EXISTS", `Séquestre déjà créé : ${args.taskId}`);
    const amount = BigInt(args.amount);
    const payer = this.acc(args.payer);
    if (payer.balance < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Solde insuffisant sur ${args.payer}`);
    payer.balance -= amount;
    this.escrows.set(args.taskId, { taskId: args.taskId, payer: args.payer, amount, status: "locked" });
    return this.tx("escrow_lock", `${args.taskId}|${args.payer}|${args.amount}`);
  }

  async releaseEscrow(args: { taskId: string; payee: string; proof: ReleaseProof }) {
    if (!args.proof || args.proof.verdict !== "accepted" || !args.proof.resultHash || !args.proof.validator) {
      throw new ChainError("PROOF_REQUIRED", "Libération refusée : preuve de validation absente ou non acceptée");
    }
    const e = this.escrows.get(args.taskId);
    if (!e) throw new ChainError("ESCROW_UNKNOWN", `Séquestre inconnu : ${args.taskId}`);
    if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Séquestre déjà ${e.status} : ${args.taskId}`);
    this.acc(args.payee).balance += e.amount;
    e.status = "released";
    e.payee = args.payee;
    e.resultHash = args.proof.resultHash;
    return this.tx("escrow_release", `${args.taskId}|${args.payee}|${args.proof.resultHash}`);
  }

  /** Comme le contrat : seuls les motifs `rejected` et `expired` sont admis. */
  async refundEscrow(args: { taskId: string; reason: string }) {
    if (args.reason !== "rejected" && args.reason !== "expired") {
      throw new ChainError("RPC_ERROR", `Motif de remboursement invalide : ${String(args.reason)} (rejected | expired)`);
    }
    const e = this.escrows.get(args.taskId);
    if (!e) throw new ChainError("ESCROW_UNKNOWN", `Séquestre inconnu : ${args.taskId}`);
    if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Séquestre déjà ${e.status} : ${args.taskId}`);
    this.acc(e.payer).balance += e.amount;
    e.status = "refunded";
    e.refundReason = args.reason;
    return this.tx("escrow_refund", `${args.taskId}|${args.reason}`);
  }

  async getEscrow(taskId: string) {
    const e = this.escrows.get(taskId);
    return e ? { taskId: e.taskId, payer: e.payer, amount: e.amount.toString(), status: e.status } : null;
  }

  /**
   * Mêmes règles que le contrat : delta entier non nul, |delta| <= 100 ; crédit (delta > 0) seulement si le séquestre
   * est libéré vers le compte de CET agent avec `proofHash` = `resultHash` de la preuve ; malus (delta < 0) seulement
   * après un remboursement `rejected` ou `expired` ; une écriture par (tâche, agent).
   */
  async addReputation(args: { agentId: string; taskId: string; delta: number; proofHash: string }) {
    if (!args.proofHash) throw new ChainError("PROOF_REQUIRED", "Réputation sans preuve refusée");
    if (!Number.isInteger(args.delta) || args.delta === 0 || Math.abs(args.delta) > 100) {
      throw new ChainError("RPC_ERROR", `delta invalide : ${args.delta} (entier non nul, |delta| <= 100)`);
    }
    const rec = this.records.get(args.agentId);
    if (!rec) throw new ChainError("UNKNOWN_AGENT", `Agent inconnu : ${args.agentId}`);
    const e = this.escrows.get(args.taskId);
    if (!e) throw new ChainError("ESCROW_UNKNOWN", `Séquestre inconnu : ${args.taskId}`);
    if (args.delta > 0) {
      if (e.status !== "released") throw new ChainError("PROOF_REQUIRED", `Crédit refusé : séquestre ${e.status}, il doit être libéré (${args.taskId})`);
      if (e.payee !== rec.accountId) throw new ChainError("PROOF_REQUIRED", `Crédit refusé : séquestre libéré vers ${e.payee}, pas vers ${rec.accountId}`);
      if (e.resultHash !== args.proofHash) throw new ChainError("PROOF_REQUIRED", "Crédit refusé : proofHash différent du resultHash de la preuve");
    } else if (e.status !== "refunded") {
      throw new ChainError("PROOF_REQUIRED", `Malus refusé : séquestre ${e.status}, il doit être remboursé (rejected ou expired) (${args.taskId})`);
    }
    const key = `${args.taskId}|${args.agentId}`;
    if (this.repWrites.has(key)) throw new ChainError("REPUTATION_EXISTS", `Réputation déjà écrite pour ${args.taskId} / ${args.agentId}`);
    this.repWrites.add(key);
    const total = (this.reputation.get(args.agentId) ?? 0) + args.delta;
    this.reputation.set(args.agentId, total);
    return { total, tx: this.tx("add_reputation", `${args.agentId}|${args.taskId}|${args.delta}`) };
  }

  async getReputation(agentId: string) {
    return this.reputation.get(agentId) ?? 0;
  }
}
