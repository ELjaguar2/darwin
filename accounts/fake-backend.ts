// Faux backend NEAR en mémoire pour les tests : comptes, clés, et une simulation fidèle des règles du contrat
// `contracts/darwin` (L3) : hash du génome vérifié, refund rejected|expired, réputation sous conditions, callback différé.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChainError } from "../shared/chain.ts";
import { sha256Hex } from "../shared/hash.ts";
import { mapChainError, type NearBackend, type NearSigner } from "./near-backend.ts";

const STORAGE = 10n ** 21n; // 0.001 NEAR immobilisé par compte (valeur de test)

export class FakeNearBackend implements NearBackend {
  accounts = new Map<string, { total: bigint; keys: string[] }>();
  txCount = 0;
  agents = new Map<string, Record<string, any>>();
  escrows = new Map<string, Record<string, any>>();
  reservations = new Map<string, string>();
  reputation = new Map<string, number>();
  applied = new Set<string>();
  fcKeys: Array<{ accountId: string; publicKey: string; contractId: string; methodNames: string[]; allowance: bigint }> = [];
  /** true : release/refund restent `releasing`/`refunding` jusqu'à settle(). */
  deferCallbacks = false;
  failDelete = false;
  /** Fait échouer les prochains transferts signés par ce compte (nombre de fois). */
  failTransfersFrom: { accountId: string; times: number } | null = null;
  onTransfer?: (from: string, to: string, amount: bigint) => void;
  calls: Array<{ method: string; args: Record<string, unknown>; deposit: bigint; signer: string }> = [];

  constructor(public operator: string, public contractId = "darwin.test.testnet") {
    this.accounts.set(operator, { total: 1_000n * 10n ** 24n, keys: [] });
    this.accounts.set(contractId, { total: 0n, keys: [] });
  }

  private hash() {
    return `H${++this.txCount}`;
  }
  private acc(id: string) {
    const a = this.accounts.get(id);
    if (!a) throw new ChainError("UNKNOWN_ACCOUNT", `no account ${id}`);
    return a;
  }
  async status() {
    return { chainId: "testnet" };
  }
  async getState(id: string) {
    const a = this.accounts.get(id);
    return a ? { total: a.total, available: a.total > STORAGE ? a.total - STORAGE : 0n } : null;
  }
  async createSubAccount(signer: NearSigner, label: string, publicKey: string, fund: bigint) {
    const id = `${label}.${signer.accountId}`;
    if (this.accounts.has(id)) throw new ChainError("RPC_ERROR", "AccountAlreadyExists");
    this.pay(signer.accountId, fund);
    this.accounts.set(id, { total: fund, keys: [publicKey] });
    return this.hash();
  }
  private pay(from: string, amount: bigint) {
    const a = this.acc(from);
    if (a.total < amount) throw mapChainError("NotEnoughBalance");
    a.total -= amount;
  }
  async transfer(signer: NearSigner, to: string, amount: bigint) {
    this.onTransfer?.(signer.accountId, to, amount);
    const f = this.failTransfersFrom;
    if (f && f.accountId === signer.accountId && f.times > 0) {
      f.times--;
      throw new ChainError("RPC_ERROR", "transfer failed");
    }
    this.acc(to);
    this.pay(signer.accountId, amount);
    this.acc(to).total += amount;
    return this.hash();
  }
  async deleteAccount(signer: NearSigner, beneficiary: string) {
    if (this.failDelete) throw new ChainError("RPC_ERROR", "delete failed");
    const a = this.acc(signer.accountId);
    this.acc(beneficiary).total += a.total;
    this.accounts.delete(signer.accountId);
    return this.hash();
  }
  async addFunctionCallKey(signer: NearSigner, publicKey: string, o: { contractId: string; methodNames: string[]; allowance: bigint }) {
    this.fcKeys.push({ accountId: signer.accountId, publicKey, ...o });
    return this.hash();
  }

  settle() {
    for (const e of this.escrows.values()) {
      if (e.status === "releasing") {
        this.acc(e.payee).total += e.amount;
        e.status = "released";
      } else if (e.status === "refunding") {
        this.acc(e.payer).total += e.amount;
        e.status = "refunded";
      }
    }
  }

  private panic(m: string): never {
    throw mapChainError(m);
  }

  async call(signer: NearSigner, _contractId: string, method: string, args: Record<string, any>, o?: { deposit?: bigint; gas?: bigint }) {
    const deposit = o?.deposit ?? 0n;
    this.calls.push({ method, args, deposit, signer: signer.accountId });
    const isOp = signer.accountId === this.operator;
    const op = () => {
      if (!isOp) this.panic("Reserve a l operateur");
    };
    switch (method) {
      case "register_agent": {
        op();
        const r = args.record;
        if (this.agents.has(r.agent_id)) this.panic("ALREADY_REGISTERED");
        if (sha256Hex(r.genome_json) !== r.genome_hash) this.panic("genome_hash ne correspond pas au genome");
        this.agents.set(r.agent_id, { ...r, alive: true, death_tick: null, cause: null });
        break;
      }
      case "mark_dead": {
        op();
        const a = this.agents.get(args.agent_id) ?? this.panic("UNKNOWN_AGENT");
        a.alive = false;
        a.death_tick = args.death_tick;
        a.cause = args.cause;
        break;
      }
      case "reserve_task": {
        op();
        if (this.escrows.has(args.task_id)) this.panic("ESCROW_EXISTS");
        if (this.reservations.has(args.task_id)) this.panic("TASK_ALREADY_RESERVED");
        this.reservations.set(args.task_id, args.payer);
        break;
      }
      case "lock_escrow": {
        if (!isOp && signer.accountId !== args.payer) this.panic("Reserve a l operateur ou au payeur");
        if (this.reservations.get(args.task_id) !== args.payer) this.panic("TASK_NOT_RESERVED : id non reserve pour ce payeur");
        this.reservations.delete(args.task_id);
        if (deposit <= 0n) this.panic("Depot attache requis");
        if (this.escrows.has(args.task_id)) this.panic("ESCROW_EXISTS");
        this.pay(signer.accountId, deposit); // le signataire paie
        this.escrows.set(args.task_id, { task_id: args.task_id, payer: args.payer, amount: deposit, status: "locked", payee: null, proof: null, refund_reason: null });
        break;
      }
      case "release_escrow": {
        op();
        const p = args.proof;
        if (p.verdict !== "accepted" || !p.result_hash || !p.validator) this.panic("PROOF_REQUIRED");
        const e = this.escrows.get(args.task_id) ?? this.panic("ESCROW_UNKNOWN");
        if (e.status !== "locked") this.panic("ESCROW_SETTLED");
        e.status = "releasing";
        e.payee = args.payee;
        e.proof = p;
        if (!this.deferCallbacks) this.settle();
        break;
      }
      case "refund_escrow": {
        op();
        if (args.reason !== "rejected" && args.reason !== "expired") this.panic("unknown variant reason");
        const e = this.escrows.get(args.task_id) ?? this.panic("ESCROW_UNKNOWN");
        if (e.status !== "locked") this.panic("ESCROW_SETTLED");
        e.status = "refunding";
        e.refund_reason = args.reason;
        if (!this.deferCallbacks) this.settle();
        break;
      }
      case "add_reputation": {
        op();
        const e = this.escrows.get(args.task_id) ?? this.panic("ESCROW_UNKNOWN");
        const a = this.agents.get(args.agent_id) ?? this.panic("UNKNOWN_AGENT");
        if (args.delta > 0) {
          if (e.status !== "released") this.panic("PROOF_REQUIRED : sequestre non libere");
          if (e.payee !== a.account_id || e.proof.result_hash !== args.proof_hash) this.panic("PROOF_REQUIRED : proof_hash");
        } else if (e.status !== "refunded") this.panic("malus seulement apres remboursement rejected ou expired");
        const k = `${args.task_id}|${args.agent_id}`;
        if (this.applied.has(k)) this.panic("reputation deja ecrite");
        this.applied.add(k);
        this.reputation.set(args.agent_id, (this.reputation.get(args.agent_id) ?? 0) + args.delta);
        break;
      }
      default:
        this.panic(`method ${method}`);
    }
    return this.hash();
  }

  async view(_c: string, method: string, args: Record<string, any>) {
    switch (method) {
      case "get_agent": {
        const a = this.agents.get(args.agent_id);
        return a ? structuredClone(a) : null;
      }
      case "list_agents": {
        const from = args.from ?? 0;
        return [...this.agents.values()].slice(from, from + Math.min(args.limit ?? 100, 100)).map((x) => structuredClone(x));
      }
      case "get_escrow": {
        const e = this.escrows.get(args.task_id);
        return e ? { ...structuredClone({ ...e, amount: "0" }), amount: e.amount.toString() } : null;
      }
      case "get_reservation":
        return this.reservations.get(args.task_id) ?? null;
      case "get_reputation":
        return this.reputation.get(args.agent_id) ?? 0;
    }
    throw new Error(`view ${method}`);
  }
}
