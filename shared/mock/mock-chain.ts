// MockChain: in-memory simulation of accounts + registry + escrow + reputation. No network, no key.
// Tested invariant: the sum (accounts + escrows) stays constant (no NEAR created or destroyed).
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
  masterBalance?: bigint; // default: 1,000,000 fictitious NEAR
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
  /** Mock transaction journal (useful to tests and /api/state). */
  readonly txs: TxReceipt[] = [];

  constructor(opts: MockChainOptions = {}) {
    this.masterId = opts.masterId ?? "darwin.mock.testnet";
    this.now = opts.now ?? (() => new Date());
    this.accounts.set(this.masterId, { balance: opts.masterBalance ?? 1_000_000n * 10n ** 24n, deleted: false });
  }

  info(): ChainInfo {
    return { kind: "mock", network: "mock", masterId: this.masterId, contractId: `contract.${this.masterId}` };
  }

  /** Sum of everything the chain holds (accounts + escrows): constant. */
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
    if (a.deleted) throw new ChainError("ACCOUNT_DELETED", `Account deleted: ${id}`);
    return a;
  }

  private move(from: string, to: string, amount: bigint) {
    if (amount < 0n) throw new ChainError("RPC_ERROR", "Negative amount");
    const a = this.acc(from);
    const b = this.acc(to);
    if (a.balance < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Insufficient balance on ${from}`);
    a.balance -= amount;
    b.balance += amount;
  }

  async createAccount(args: { label: string; initialFunding: Yocto; fundFrom?: string }) {
    const accountId = `${args.label}.${this.masterId}`;
    if (this.accounts.has(accountId)) throw new ChainError("RPC_ERROR", `Account already exists: ${accountId}`);
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
    if (this.records.has(record.agentId)) throw new ChainError("ALREADY_REGISTERED", `Already registered: ${record.agentId}`);
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
    if (this.escrows.has(args.taskId)) throw new ChainError("ESCROW_EXISTS", `Escrow already created: ${args.taskId}`);
    const amount = BigInt(args.amount);
    const payer = this.acc(args.payer);
    if (payer.balance < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Insufficient balance on ${args.payer}`);
    payer.balance -= amount;
    this.escrows.set(args.taskId, { taskId: args.taskId, payer: args.payer, amount, status: "locked" });
    return this.tx("escrow_lock", `${args.taskId}|${args.payer}|${args.amount}`);
  }

  async releaseEscrow(args: { taskId: string; payee: string; proof: ReleaseProof }) {
    if (!args.proof || args.proof.verdict !== "accepted" || !args.proof.resultHash || !args.proof.validator) {
      throw new ChainError("PROOF_REQUIRED", "Release refused: validation proof missing or not accepted");
    }
    const e = this.escrows.get(args.taskId);
    if (!e) throw new ChainError("ESCROW_UNKNOWN", `Unknown escrow: ${args.taskId}`);
    if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Escrow already ${e.status}: ${args.taskId}`);
    this.acc(args.payee).balance += e.amount;
    e.status = "released";
    e.payee = args.payee;
    e.resultHash = args.proof.resultHash;
    return this.tx("escrow_release", `${args.taskId}|${args.payee}|${args.proof.resultHash}`);
  }

  /** Like the contract: only the `rejected` and `expired` reasons are accepted. */
  async refundEscrow(args: { taskId: string; reason: string }) {
    if (args.reason !== "rejected" && args.reason !== "expired") {
      throw new ChainError("RPC_ERROR", `Invalid refund reason: ${String(args.reason)} (rejected | expired)`);
    }
    const e = this.escrows.get(args.taskId);
    if (!e) throw new ChainError("ESCROW_UNKNOWN", `Unknown escrow: ${args.taskId}`);
    if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Escrow already ${e.status}: ${args.taskId}`);
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
    * Same rules as the contract: non-zero integer delta, |delta| <= 100; credit (delta > 0) only if the escrow
    * is released to THAT agent's account with `proofHash` = the proof's `resultHash`; penalty (delta < 0) only
    * after a `rejected` or `expired` refund; one write per (task, agent).
   */
  async addReputation(args: { agentId: string; taskId: string; delta: number; proofHash: string }) {
    if (!args.proofHash) throw new ChainError("PROOF_REQUIRED", "Reputation without proof refused");
    if (!Number.isInteger(args.delta) || args.delta === 0 || Math.abs(args.delta) > 100) {
      throw new ChainError("RPC_ERROR", `invalid delta: ${args.delta} (non-zero integer, |delta| <= 100)`);
    }
    const rec = this.records.get(args.agentId);
    if (!rec) throw new ChainError("UNKNOWN_AGENT", `Agent inconnu : ${args.agentId}`);
    const e = this.escrows.get(args.taskId);
    if (!e) throw new ChainError("ESCROW_UNKNOWN", `Unknown escrow: ${args.taskId}`);
    if (args.delta > 0) {
      if (e.status !== "released") throw new ChainError("PROOF_REQUIRED", `Credit refused: escrow ${e.status}, it must be released (${args.taskId})`);
      if (e.payee !== rec.accountId) throw new ChainError("PROOF_REQUIRED", `Credit refused: escrow released to ${e.payee}, not to ${rec.accountId}`);
      if (e.resultHash !== args.proofHash) throw new ChainError("PROOF_REQUIRED", "Credit refused: proofHash differs from the proof's resultHash");
    } else if (e.status !== "refunded") {
      throw new ChainError("PROOF_REQUIRED", `Penalty refused: escrow ${e.status}, it must be refunded (rejected or expired) (${args.taskId})`);
    }
    const key = `${args.taskId}|${args.agentId}`;
    if (this.repWrites.has(key)) throw new ChainError("REPUTATION_EXISTS", `Reputation already written for ${args.taskId} / ${args.agentId}`);
    this.repWrites.add(key);
    const total = (this.reputation.get(args.agentId) ?? 0) + args.delta;
    this.reputation.set(args.agentId, total);
    return { total, tx: this.tx("add_reputation", `${args.agentId}|${args.taskId}|${args.delta}`) };
  }

  async getReputation(agentId: string) {
    return this.reputation.get(agentId) ?? 0;
  }
}
