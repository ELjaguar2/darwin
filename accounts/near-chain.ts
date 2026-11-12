// NearChain: testnet implementation of `Chain` (accounts, registry, escrow, reputation).
// Never touches near-api-js directly: everything goes through `NearBackend` (near-backend.ts, dynamic import).
//
// Two modes for registry / escrow / reputation:
//  - "contract"  (contractId provided): calls to the `contracts/darwin` contract (lot L3), with its documented differences:
//      * register_agent receives `genome_json` (canonical JSON) + `genome_hash`;
//      * refund_escrow only accepts `rejected` or `expired`;
//      * add_reputation requires a released escrow (or refunded, rejected or expired, for a penalty) with an identical proof;
//      * lock_escrow requires the id to be reserved by the operator (`reserve_task`, chained inside lockEscrow);
//      * transient statuses `releasing`/`refunding`: we wait for the callback, otherwise they are seen as "locked";
//      * lock_escrow debits the signing account: we sign with the payer's key.
//  - "degraded"  (no contract, D-016/D-022): escrow = `escrow.<master>` sub-account driven by the engine
//    (real testnet transfers), registry and reputation in `LocalLedger`. Never to be presented as "on-chain".
import {
  ChainError,
  type AgentRecord,
  type Chain,
  type ChainInfo,
  type ReleaseProof,
  type TxReceipt,
} from "../shared/chain.ts";
import { canonicalJson, sha256Hex } from "../shared/hash.ts";
import type { Yocto } from "../shared/money.ts";
import type { CauseOfDeath, Genome } from "../shared/types.ts";
import { MemoryArchive, type AccountArchive } from "./archive.ts";
import { generateKey, MemoryKeyStore, type KeyStore, type Secret } from "./keys.ts";
import { LocalLedger, type EscrowRow } from "./ledger.ts";
import type { NearBackend, NearSigner } from "./near-backend.ts";
import { SpendPolicy } from "./policy.ts";

const NEAR = 10n ** 24n;
/** Attached gas (unused gas is refunded; it is however pre-purchased, hence required from the signer's balance). */
export const GAS_CALL = 30_000_000_000_000n; // 30 Tgas (near-api-js default)
export const GAS_SETTLE = 60_000_000_000_000n; // release/refund : transfert + callback
/** Reserve kept if account deletion fails ("frozen" sweep). */
export const GAS_RESERVE = NEAR / 1000n; // 0.001 NEAR
/** Minimum funding of an escrow sub-account in degraded mode. */
const ESCROW_ACCOUNT_FUNDING = NEAR / 10n; // 0.1 NEAR

export interface NearChainOptions {
  masterId: string;
  masterKey: Secret;
  backend: NearBackend;
  contractId?: string;
  explorerBase?: string;
  keystore?: KeyStore;
  archive?: AccountArchive;
  policy?: SpendPolicy;
  ledger?: LocalLedger;
  /** Methods allowed to each agent's function call key (never empty: empty = all methods in NEAR). */
  fcMethods?: string[];
  /** Gas allowance of the function call key (yocto). Bounds this key's gas spend. */
  fcAllowance?: bigint;
  /** Notification (`chain.tx` journal). Never receives a key. */
  onTx?: (r: TxReceipt, d: { from?: string; to?: string; amount?: string }) => void;
  /** Non-fatal alert (e.g. function call key not added). No secret. */
  onWarning?: (code: string, message: string) => void;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  settlePolls?: number;
  settlePollMs?: number;
}

type ContractEscrowStatus = "locked" | "releasing" | "released" | "refunding" | "refunded";
interface ContractEscrow {
  task_id: string;
  payer: string;
  amount: string;
  status: ContractEscrowStatus;
  payee?: string | null;
  proof?: { result_hash: string; verdict: string; validator: string } | null;
  refund_reason?: "rejected" | "expired" | null;
}
interface ContractAgent {
  agent_id: string;
  account_id: string;
  parent_id: string | null;
  generation: number;
  genome_hash: string;
  genome_json: string;
  birth_tick: number;
  alive: boolean;
  death_tick?: number | null;
  cause?: CauseOfDeath | null;
}

const LABEL_RE = /^[a-z0-9]+([_-][a-z0-9]+)*$/;

/** Normalises the refund reason to the contract's enumeration. */
export function refundReasonOf(reason: string): "rejected" | "expired" {
  const r = reason.trim().toLowerCase();
  if (r === "rejected" || r === "expired") return r;
  throw new ChainError("RPC_ERROR", `refundEscrow: reason "${reason}" refused (only rejected and expired are accepted)`);
}

export class NearChain implements Chain {
  readonly mode: "contract" | "degraded";
  readonly keystore: KeyStore;
  readonly archive: AccountArchive;
  readonly policy: SpendPolicy;
  readonly ledger: LocalLedger;
  private o: NearChainOptions;
  private master: NearSigner;
  private explorer: string;
  private now: () => Date;
  private counter = 0;
  private escrowAccount: string;

  constructor(opts: NearChainOptions) {
    this.o = opts;
    this.mode = opts.contractId ? "contract" : "degraded";
    this.master = { accountId: opts.masterId, secretKey: opts.masterKey };
    this.keystore = opts.keystore ?? new MemoryKeyStore();
    this.archive = opts.archive ?? new MemoryArchive();
    this.policy = opts.policy ?? new SpendPolicy({ defaultLimit: null, exempt: [opts.masterId] });
    this.ledger = opts.ledger ?? new LocalLedger();
    this.explorer = (opts.explorerBase ?? "https://testnet.nearblocks.io").replace(/\/$/, "");
    this.now = opts.now ?? (() => new Date());
    this.escrowAccount = `escrow.${opts.masterId}`;
  }

  info(): ChainInfo {
    return { kind: "near", network: "testnet", masterId: this.o.masterId, contractId: this.o.contractId, explorerBase: this.explorer };
  }

  /** Checks RPC (testnet network) and the master account's existence. To call at startup. */
  async checkReady(): Promise<{ masterBalance: Yocto }> {
    await this.ledger.load();
    await this.recover();
    const st = await this.o.backend.status();
    if (st.chainId !== "testnet") throw new ChainError("RPC_ERROR", `Unexpected network: ${st.chainId} (testnet expected; mainnet is forbidden)`);
    const m = await this.o.backend.getState(this.o.masterId);
    if (!m) throw new ChainError("UNKNOWN_ACCOUNT", `Master account not found on testnet: ${this.o.masterId}`);
    return { masterBalance: m.total.toString() };
  }

  // ------------------------------------------------------------------ utilitaires

  private receipt(kind: string, hash: string, d: { from?: string; to?: string; amount?: string } = {}): TxReceipt {
    const r: TxReceipt = { hash, kind, ok: true, at: this.now().toISOString() };
    if (!hash.startsWith("local_")) r.explorerUrl = `${this.explorer}/txns/${hash}`;
    this.o.onTx?.(r, d);
    return r;
  }

  private localReceipt(kind: string, payload: string): TxReceipt {
    return this.receipt(kind, `local_${sha256Hex(`${++this.counter}|${kind}|${payload}`).slice(0, 40)}`);
  }

  private async signerFor(accountId: string): Promise<NearSigner> {
    if (accountId === this.master.accountId) return this.master;
    const k = await this.keystore.get(accountId, "full");
    if (!k) throw new ChainError("UNKNOWN_ACCOUNT", `No signing key for ${accountId} (account not created by this process?)`);
    return { accountId, secretKey: k.secretKey };
  }

  private async requireState(accountId: string) {
    const st = await this.o.backend.getState(accountId);
    if (!st) throw new ChainError("UNKNOWN_ACCOUNT", `Compte inconnu : ${accountId}`);
    return st;
  }

  private sleep(ms: number): Promise<void> {
    return this.o.sleep ? this.o.sleep(ms) : new Promise((r) => setTimeout(r, ms));
  }

  // ------------------------------------------------------------------ comptes

  async createAccount(args: { label: string; initialFunding: Yocto; fundFrom?: string }) {
    if (!LABEL_RE.test(args.label) || args.label.length > 32) throw new ChainError("RPC_ERROR", `Invalid account label: ${args.label}`);
    const accountId = `${args.label}.${this.o.masterId}`;
    const fund = BigInt(args.initialFunding);
    const from = args.fundFrom ?? this.o.masterId;
    if (await this.o.backend.getState(accountId)) throw new ChainError("RPC_ERROR", `Account already exists: ${accountId}`);

    // The parent of a NEAR sub-account is always the master: if the money comes from another account
    // (e.g. an agent's parent), we first bring it back to the master, with a spending cap.
    let reimbursed = false;
    if (from !== this.o.masterId) {
      await this.transfer({ from, to: this.o.masterId, amount: fund.toString(), memo: `fund ${accountId}` });
      reimbursed = true;
    }
    // The key is stored BEFORE the transaction: a crash must never leave an account without a key.
    const key = generateKey();
    await this.keystore.put(accountId, "full", key);
    // Limited-rights function call key (Darwin contract only, listed methods, bounded gas, no deposit possible),
    // added in the same transaction as the account creation: the agent is born with both keys.
    let fc: ReturnType<typeof generateKey> | undefined;
    if (this.o.contractId) {
      fc = generateKey();
      await this.keystore.put(accountId, "fc", fc);
    }
    let hash: string;
    try {
      hash = await this.o.backend.createSubAccount(
        this.master,
        args.label,
        key.publicKey,
        fund,
        fc && this.o.contractId
          ? {
              publicKey: fc.publicKey,
              contractId: this.o.contractId,
              methodNames: this.o.fcMethods?.length ? this.o.fcMethods : ["lock_escrow"],
              allowance: this.o.fcAllowance ?? NEAR / 20n, // 0.05 NEAR of gas at most
            }
          : undefined,
      );
    } catch (e) {
      await this.keystore.remove(accountId);
      if (reimbursed) await this.transfer({ from: this.o.masterId, to: from, amount: fund.toString(), memo: "rollback" }).catch(() => undefined);
      throw e;
    }
    const tx = this.receipt("create_account", hash, { from: this.o.masterId, to: accountId, amount: fund.toString() });
    return { accountId, tx };
  }

  async getBalance(accountId: string): Promise<Yocto> {
    return (await this.requireState(accountId)).total.toString();
  }

  async transfer(args: { from: string; to: string; amount: Yocto; memo?: string }) {
    const amount = BigInt(args.amount);
    if (amount < 0n) throw new ChainError("RPC_ERROR", "Negative amount");
    this.policy.check(args.from, amount);
    const st = await this.requireState(args.from);
    if (st.available < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Insufficient available balance on ${args.from}`);
    const hash = await this.o.backend.transfer(await this.signerFor(args.from), args.to, amount);
    this.policy.record(args.from, amount);
    return this.receipt("transfer", hash, { from: args.from, to: args.to, amount: amount.toString() });
  }

  async closeAccount(args: { accountId: string; beneficiary: string }) {
    if (args.accountId === this.o.masterId) throw new ChainError("RPC_ERROR", "The master account cannot be closed");
    // Deleting toward a non-existent account would destroy the funds: we check the beneficiary first.
    await this.requireState(args.beneficiary);
    const st = await this.requireState(args.accountId);
    const signer = await this.signerFor(args.accountId);
    const pubs = (await this.keystore.list()).filter((k) => k.accountId === args.accountId).map((k) => k.publicKey);
    let hash: string;
    let swept = st.total; // upper bound: the deletion gas is taken from this balance
    let disposition: "deleted" | "frozen" = "deleted";
    try {
      hash = await this.o.backend.deleteAccount(signer, args.beneficiary);
    } catch (e) {
      // Fallback: sweep what can be swept while keeping a gas reserve, the account stays "frozen" (keys removed).
      const spendable = st.available - GAS_RESERVE;
      if (spendable <= 0n) throw e;
      hash = await this.o.backend.transfer(signer, args.beneficiary, spendable);
      swept = spendable;
      disposition = "frozen";
    }
    await this.keystore.remove(args.accountId);
    if (!this.ledger.closedAccounts.includes(args.accountId)) this.ledger.closedAccounts.push(args.accountId);
    await this.ledger.save();
    const tx = this.receipt("close_account", hash, { from: args.accountId, to: args.beneficiary, amount: swept.toString() });
    await this.archive.add({
      accountId: args.accountId,
      beneficiary: args.beneficiary,
      swept: swept.toString(),
      closedAt: this.now().toISOString(),
      tx: hash,
      disposition,
      retiredPublicKeys: pubs,
    });
    return { swept: swept.toString(), tx };
  }

  // ------------------------------------------------------------------ registre

  async registerAgent(record: Omit<AgentRecord, "alive" | "deathTick" | "cause">) {
    const genomeJson = canonicalJson(record.genome);
    if (sha256Hex(genomeJson) !== record.genomeHash.toLowerCase()) {
      throw new ChainError("RPC_ERROR", "genomeHash does not match the sha256 of the genome's canonical JSON");
    }
    if (this.mode === "degraded") {
      if (this.ledger.records[record.agentId]) throw new ChainError("ALREADY_REGISTERED", `Already registered: ${record.agentId}`);
      this.ledger.records[record.agentId] = { ...record, alive: true };
      await this.ledger.save();
      return this.localReceipt("register_agent", record.agentId + record.genomeHash);
    }
    const hash = await this.o.backend.call(this.master, this.o.contractId!, "register_agent", {
      record: {
        agent_id: record.agentId,
        account_id: record.accountId,
        parent_id: record.parentId,
        generation: record.generation,
        genome_hash: record.genomeHash.toLowerCase(),
        genome_json: genomeJson,
        birth_tick: record.birthTick,
      },
    });
    return this.receipt("register_agent", hash);
  }

  async markAgentDead(args: { agentId: string; deathTick: number; cause: CauseOfDeath }) {
    if (this.mode === "degraded") {
      const r = this.ledger.records[args.agentId];
      if (!r) throw new ChainError("UNKNOWN_AGENT", `Agent inconnu : ${args.agentId}`);
      r.alive = false;
      r.deathTick = args.deathTick;
      r.cause = args.cause;
      await this.ledger.save();
      return this.localReceipt("mark_dead", `${args.agentId}|${args.cause}`);
    }
    const hash = await this.o.backend.call(this.master, this.o.contractId!, "mark_dead", {
      agent_id: args.agentId,
      death_tick: args.deathTick,
      cause: args.cause,
    });
    return this.receipt("mark_dead", hash);
  }

  private fromContract(a: ContractAgent): AgentRecord {
    const out: AgentRecord = {
      agentId: a.agent_id,
      accountId: a.account_id,
      parentId: a.parent_id ?? null,
      generation: a.generation,
      genomeHash: a.genome_hash,
      genome: JSON.parse(a.genome_json) as Genome,
      birthTick: a.birth_tick,
      alive: a.alive,
    };
    if (a.death_tick != null) out.deathTick = a.death_tick;
    if (a.cause) out.cause = a.cause;
    return out;
  }

  async getAgentRecord(agentId: string) {
    if (this.mode === "degraded") {
      const r = this.ledger.records[agentId];
      return r ? structuredClone(r) : null;
    }
    const a = (await this.o.backend.view(this.o.contractId!, "get_agent", { agent_id: agentId })) as ContractAgent | null;
    return a ? this.fromContract(a) : null;
  }

  async listAgentRecords() {
    if (this.mode === "degraded") return Object.values(this.ledger.records).map((r) => structuredClone(r));
    const out: AgentRecord[] = [];
    for (let from = 0; ; from += 100) {
      const page = (await this.o.backend.view(this.o.contractId!, "list_agents", { from, limit: 100 })) as ContractAgent[];
      out.push(...page.map((a) => this.fromContract(a)));
      if (page.length < 100) return out;
    }
  }

  // ------------------------------------------------------------------ escrow

  async lockEscrow(args: { taskId: string; payer: string; amount: Yocto }) {
    const amount = BigInt(args.amount);
    if (amount <= 0n) throw new ChainError("RPC_ERROR", "Zero escrow amount");
    this.policy.check(args.payer, amount);
    if (this.mode === "degraded") {
      if (this.ledger.escrows[args.taskId]) throw new ChainError("ESCROW_EXISTS", `Escrow already created: ${args.taskId}`);
      // Same rule as the contract: operator reservation of the id for this payer, consumed on lock.
      const res = this.ledger.reservations[args.taskId];
      if (res === undefined) this.ledger.reservations[args.taskId] = args.payer;
      else if (res !== args.payer) throw new ChainError("ESCROW_EXISTS", `Task id already reserved for another payer: ${args.taskId}`);
      await this.ensureEscrowAccount();
      const st = await this.requireState(args.payer);
      if (st.available < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Insufficient available balance on ${args.payer}`);
      const hash = await this.o.backend.transfer(await this.signerFor(args.payer), this.escrowAccount, amount);
      delete this.ledger.reservations[args.taskId];
      this.ledger.escrows[args.taskId] = { taskId: args.taskId, payer: args.payer, amount: amount.toString(), status: "locked" };
      await this.ledger.save();
      this.policy.record(args.payer, amount);
      return this.receipt("escrow_lock", hash, { from: args.payer, to: this.escrowAccount, amount: amount.toString() });
    }
    const st = await this.requireState(args.payer);
    if (st.available < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Insufficient available balance on ${args.payer}`);
    // Anti-squat (contract L3): the operator first reserves the id for this payer (internal call, outside the Chain interface).
    // If an identical reservation already exists (previous failure after reserving), we do not redo it.
    const reserved = (await this.o.backend.view(this.o.contractId!, "get_reservation", { task_id: args.taskId })) as string | null;
    if (reserved === null || reserved === undefined) {
      await this.o.backend.call(this.master, this.o.contractId!, "reserve_task", { task_id: args.taskId, payer: args.payer }, { gas: GAS_CALL });
    } else if (reserved !== args.payer) {
      throw new ChainError("ESCROW_EXISTS", `Task id already reserved for another payer: ${args.taskId}`);
    }
    // The deposit is taken from the signing account: we sign with the payer's key.
    const hash = await this.o.backend.call(
      await this.signerFor(args.payer),
      this.o.contractId!,
      "lock_escrow",
      { task_id: args.taskId, payer: args.payer },
      { deposit: amount, gas: GAS_CALL },
    );
    this.policy.record(args.payer, amount);
    return this.receipt("escrow_lock", hash, { from: args.payer, to: this.o.contractId, amount: amount.toString() });
  }

  private async ensureEscrowAccount(): Promise<void> {
    if (await this.o.backend.getState(this.escrowAccount)) return;
    await this.createAccount({ label: "escrow", initialFunding: ESCROW_ACCOUNT_FUNDING.toString() });
  }

  private async contractEscrow(taskId: string): Promise<ContractEscrow | null> {
    return (await this.o.backend.view(this.o.contractId!, "get_escrow", { task_id: taskId })) as ContractEscrow | null;
  }

  // --- degraded mode: safe settlement (transient status written before the transfer, lock per taskId) ---
  private locks = new Map<string, Promise<unknown>>();

  /** Serialises operations on the same taskId (two concurrent calls never pay twice). */
  private withLock<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(taskId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => undefined);
    this.locks.set(taskId, tail);
    void tail.then(() => {
      if (this.locks.get(taskId) === tail) this.locks.delete(taskId);
    });
    return run;
  }

  /** Moves to `releasing`/`refunding` and persists BEFORE the transfer; on failure, back to `locked`. */
  private async settleLocal(e: EscrowRow, transient: "releasing" | "refunding", to: string, prepare: () => void): Promise<string> {
    const signer = await this.signerFor(this.escrowAccount);
    const before = (await this.requireState(this.escrowAccount)).total;
    prepare();
    e.status = transient;
    e.escrowBefore = before.toString();
    await this.ledger.save();
    try {
      return await this.o.backend.transfer(signer, to, BigInt(e.amount));
    } catch (err) {
      e.status = "locked";
      delete e.payee;
      delete e.proofHash;
      delete e.reason;
      delete e.escrowBefore;
      await this.ledger.save();
      throw err;
    }
  }

  /**
    * Recovery after a crash (degraded mode): for each escrow left `releasing`/`refunding`, compares the balance
    * of the escrow account with the one noted before the transfer. Balance dropped by at least the amount: the transfer happened
    * (final state); otherwise back to `locked`. Assumption: the escrow account is only used for these settlements. Returns the recovered taskIds.
   */
  async recover(): Promise<string[]> {
    if (this.mode !== "degraded") return [];
    const out: string[] = [];
    for (const e of Object.values(this.ledger.escrows)) {
      if (e.status !== "releasing" && e.status !== "refunding") continue;
      await this.withLock(e.taskId, async () => {
        if (e.status !== "releasing" && e.status !== "refunding") return;
        const now = (await this.requireState(this.escrowAccount)).total;
        const paid = e.escrowBefore !== undefined && now <= BigInt(e.escrowBefore) - BigInt(e.amount);
        if (paid) e.status = e.status === "releasing" ? "released" : "refunded";
        else {
          e.status = "locked";
          delete e.payee;
          delete e.proofHash;
          delete e.reason;
        }
        delete e.escrowBefore;
        await this.ledger.save();
        out.push(e.taskId);
      });
    }
    return out;
  }

  /** Waits for the callback to finish (releasing/refunding -> final state). Returns the observed final state. */
  private async awaitFinal(taskId: string): Promise<ContractEscrow> {
    const polls = this.o.settlePolls ?? 10;
    let e: ContractEscrow | null = null;
    for (let i = 0; i < polls; i++) {
      e = await this.contractEscrow(taskId);
      if (!e) throw new ChainError("ESCROW_UNKNOWN", `Unknown escrow: ${taskId}`);
      if (e.status !== "releasing" && e.status !== "refunding") return e;
      await this.sleep(this.o.settlePollMs ?? 1000);
    }
    throw new ChainError("RPC_ERROR", `Escrow ${taskId} still being settled (${e?.status}): try again later`);
  }

  async releaseEscrow(args: { taskId: string; payee: string; proof: ReleaseProof }) {
    const p = args.proof;
    if (!p || p.verdict !== "accepted" || !p.resultHash || !p.validator) {
      throw new ChainError("PROOF_REQUIRED", "Release refused: validation proof missing or not accepted");
    }
    if (this.mode === "degraded") {
      return this.withLock(args.taskId, async () => {
        const e = this.ledger.escrows[args.taskId];
        if (!e) throw new ChainError("ESCROW_UNKNOWN", `Unknown escrow: ${args.taskId}`);
        if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Escrow already ${e.status}: ${args.taskId}`);
        const hash = await this.settleLocal(e, "releasing", args.payee, () => {
          e.payee = args.payee;
          e.proofHash = p.resultHash;
        });
        e.status = "released";
        await this.ledger.save();
        return this.receipt("escrow_release", hash, { from: this.escrowAccount, to: args.payee, amount: e.amount });
      });
    }
    const hash = await this.o.backend.call(
      this.master,
      this.o.contractId!,
      "release_escrow",
      { task_id: args.taskId, payee: args.payee, proof: { result_hash: p.resultHash, verdict: "accepted", validator: p.validator } },
      { gas: GAS_SETTLE },
    );
    const fin = await this.awaitFinal(args.taskId);
    if (fin.status !== "released") throw new ChainError("RPC_ERROR", `Release not confirmed for ${args.taskId} (state ${fin.status}): the transfer failed`);
    return this.receipt("escrow_release", hash, { from: this.o.contractId, to: args.payee, amount: fin.amount });
  }

  async refundEscrow(args: { taskId: string; reason: string }) {
    const reason = refundReasonOf(args.reason);
    if (this.mode === "degraded") {
      return this.withLock(args.taskId, async () => {
        const e = this.ledger.escrows[args.taskId];
        if (!e) throw new ChainError("ESCROW_UNKNOWN", `Unknown escrow: ${args.taskId}`);
        if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Escrow already ${e.status}: ${args.taskId}`);
        const hash = await this.settleLocal(e, "refunding", e.payer, () => {
          e.reason = reason;
        });
        e.status = "refunded";
        await this.ledger.save();
        return this.receipt("escrow_refund", hash, { from: this.escrowAccount, to: e.payer, amount: e.amount });
      });
    }
    const hash = await this.o.backend.call(this.master, this.o.contractId!, "refund_escrow", { task_id: args.taskId, reason }, { gas: GAS_SETTLE });
    const fin = await this.awaitFinal(args.taskId);
    if (fin.status !== "refunded") throw new ChainError("RPC_ERROR", `Refund not confirmed for ${args.taskId} (state ${fin.status})`);
    return this.receipt("escrow_refund", hash, { from: this.o.contractId, to: fin.payer, amount: fin.amount });
  }

  async getEscrow(taskId: string) {
    if (this.mode === "degraded") {
      const e = this.ledger.escrows[taskId];
      if (!e) return null;
      const status = e.status === "released" ? "released" : e.status === "refunded" ? "refunded" : "locked"; // in progress = locked
      return { taskId: e.taskId, payer: e.payer, amount: e.amount, status } as const;
    }
    const e = await this.contractEscrow(taskId);
    if (!e) return null;
    // `releasing`/`refunding` = in progress: seen as "locked" (the money has not yet reached its recipient).
    const status = e.status === "released" ? "released" : e.status === "refunded" ? "refunded" : "locked";
    return { taskId: e.task_id, payer: e.payer, amount: String(e.amount), status } as const;
  }

  // ------------------------------------------------------------------ reputation

  async addReputation(args: { agentId: string; taskId: string; delta: number; proofHash: string }) {
    if (!args.proofHash) throw new ChainError("PROOF_REQUIRED", "Reputation without proof refused");
    if (!Number.isInteger(args.delta) || args.delta === 0 || Math.abs(args.delta) > 100) {
      throw new ChainError("RPC_ERROR", "reputation delta: non-zero integer, |delta| <= 100");
    }
    if (this.mode === "degraded") {
      const e = this.ledger.escrows[args.taskId];
      const rec = this.ledger.records[args.agentId];
      if (!rec) throw new ChainError("UNKNOWN_AGENT", `Agent inconnu : ${args.agentId}`);
      if (!e) throw new ChainError("ESCROW_UNKNOWN", `Unknown escrow: ${args.taskId}`);
      if (args.delta > 0) {
        if (e.status !== "released" || e.payee !== rec.accountId || e.proofHash !== args.proofHash) {
          throw new ChainError("PROOF_REQUIRED", "Credit refused: escrow not released to this agent with this proof");
        }
      } else if (e.status !== "refunded") {
        throw new ChainError("PROOF_REQUIRED", "Penalty refused: escrow not refunded (rejected or expired)");
      }
      const key = `${args.agentId}|${args.taskId}`;
      if (this.ledger.reputationProofs.includes(key)) throw new ChainError("RPC_ERROR", "Reputation already written for this task");
      this.ledger.reputationProofs.push(key);
      const total = (this.ledger.reputation[args.agentId] ?? 0) + args.delta;
      this.ledger.reputation[args.agentId] = total;
      await this.ledger.save();
      return { total, tx: this.localReceipt("add_reputation", `${key}|${args.delta}`) };
    }
    // The contract requires the escrow in its final state: we wait for the callback if needed.
    await this.awaitFinal(args.taskId);
    const hash = await this.o.backend.call(this.master, this.o.contractId!, "add_reputation", {
      agent_id: args.agentId,
      task_id: args.taskId,
      delta: args.delta,
      proof_hash: args.proofHash,
    });
    return { total: await this.getReputation(args.agentId), tx: this.receipt("add_reputation", hash) };
  }

  async getReputation(agentId: string) {
    if (this.mode === "degraded") return this.ledger.reputation[agentId] ?? 0;
    return Number(await this.o.backend.view(this.o.contractId!, "get_reputation", { agent_id: agentId }));
  }
}
