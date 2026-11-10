// NearChain : implémentation testnet de `Chain` (comptes, registre, séquestre, réputation).
// Ne touche jamais near-api-js directement : tout passe par `NearBackend` (near-backend.ts, import dynamique).
//
// Deux modes pour registre / séquestre / réputation :
//  - "contract"  (contractId fourni) : appels au contrat `contracts/darwin` (lot L3), avec ses écarts documentés :
//      * register_agent reçoit `genome_json` (JSON canonique) + `genome_hash` ;
//      * refund_escrow n'accepte que `rejected` ou `expired` ;
//      * add_reputation exige un séquestre libéré (ou remboursé, rejected ou expired, pour un malus) avec preuve identique ;
//      * lock_escrow exige une réservation de l'id par l'opérateur (`reserve_task`, enchaîné dans lockEscrow) ;
//      * statuts transitoires `releasing`/`refunding` : on attend le callback, sinon on les voit comme « locked » ;
//      * lock_escrow débite le compte qui signe : on signe avec la clé du payeur.
//  - "degraded"  (pas de contrat, D-016/D-022) : séquestre = sous-compte `escrow.<maître>` piloté par le moteur
//    (vrais transferts testnet), registre et réputation dans `LocalLedger`. Jamais à présenter comme « on-chain ».
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
/** Gaz attaché (le gaz non consommé est remboursé ; il est toutefois pré-acheté, donc exigé du solde du signataire). */
export const GAS_CALL = 30_000_000_000_000n; // 30 Tgas (défaut near-api-js)
export const GAS_SETTLE = 60_000_000_000_000n; // release/refund : transfert + callback
/** Réserve conservée si la suppression du compte échoue (balayage « gelé »). */
export const GAS_RESERVE = NEAR / 1000n; // 0.001 NEAR
/** Financement minimal d'un sous-compte d'escrow en mode dégradé. */
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
  /** Méthodes autorisées à la clé function call de chaque agent (jamais vide : vide = toutes les méthodes en NEAR). */
  fcMethods?: string[];
  /** Allocation de gaz de la clé function call (yocto). Borne la dépense de gaz de cette clé. */
  fcAllowance?: bigint;
  /** Notification (journal `chain.tx`). Ne reçoit jamais de clé. */
  onTx?: (r: TxReceipt, d: { from?: string; to?: string; amount?: string }) => void;
  /** Alerte non fatale (ex. clé function call non ajoutée). Sans secret. */
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

/** Normalise le motif de remboursement vers l'énumération du contrat. */
export function refundReasonOf(reason: string): "rejected" | "expired" {
  const r = reason.trim().toLowerCase();
  if (r === "rejected" || r === "expired") return r;
  throw new ChainError("RPC_ERROR", `refundEscrow : motif « ${reason} » refusé (seuls rejected et expired sont admis)`);
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

  /** Vérifie RPC (réseau testnet) et existence du compte maître. À appeler au démarrage. */
  async checkReady(): Promise<{ masterBalance: Yocto }> {
    await this.ledger.load();
    await this.recover();
    const st = await this.o.backend.status();
    if (st.chainId !== "testnet") throw new ChainError("RPC_ERROR", `Réseau inattendu : ${st.chainId} (testnet attendu ; le mainnet est interdit)`);
    const m = await this.o.backend.getState(this.o.masterId);
    if (!m) throw new ChainError("UNKNOWN_ACCOUNT", `Compte maître introuvable sur testnet : ${this.o.masterId}`);
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
    if (!k) throw new ChainError("UNKNOWN_ACCOUNT", `Aucune clé de signature pour ${accountId} (compte non créé par ce processus ?)`);
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
    if (!LABEL_RE.test(args.label) || args.label.length > 32) throw new ChainError("RPC_ERROR", `Libellé de compte invalide : ${args.label}`);
    const accountId = `${args.label}.${this.o.masterId}`;
    const fund = BigInt(args.initialFunding);
    const from = args.fundFrom ?? this.o.masterId;
    if (await this.o.backend.getState(accountId)) throw new ChainError("RPC_ERROR", `Compte déjà existant : ${accountId}`);

    // Le parent d'un sous-compte NEAR est toujours le maître : si l'argent vient d'un autre compte
    // (ex. le parent d'un agent), on le rapatrie d'abord au maître, avec plafond de dépense.
    let reimbursed = false;
    if (from !== this.o.masterId) {
      await this.transfer({ from, to: this.o.masterId, amount: fund.toString(), memo: `fund ${accountId}` });
      reimbursed = true;
    }
    // La clé est enregistrée AVANT la transaction : un crash ne doit jamais laisser un compte sans clé.
    const key = generateKey();
    await this.keystore.put(accountId, "full", key);
    // Clé function call à droits limités (contrat Darwin seulement, méthodes listées, gaz borné, aucun dépôt possible),
    // ajoutée dans la même transaction que la création du compte : l'agent naît avec ses deux clés.
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
              allowance: this.o.fcAllowance ?? NEAR / 20n, // 0.05 NEAR de gaz au plus
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
    if (amount < 0n) throw new ChainError("RPC_ERROR", "Montant négatif");
    this.policy.check(args.from, amount);
    const st = await this.requireState(args.from);
    if (st.available < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Solde disponible insuffisant sur ${args.from}`);
    const hash = await this.o.backend.transfer(await this.signerFor(args.from), args.to, amount);
    this.policy.record(args.from, amount);
    return this.receipt("transfer", hash, { from: args.from, to: args.to, amount: amount.toString() });
  }

  async closeAccount(args: { accountId: string; beneficiary: string }) {
    if (args.accountId === this.o.masterId) throw new ChainError("RPC_ERROR", "Le compte maître ne se ferme pas");
    // Supprimer vers un compte inexistant détruirait les fonds : on vérifie le bénéficiaire d'abord.
    await this.requireState(args.beneficiary);
    const st = await this.requireState(args.accountId);
    const signer = await this.signerFor(args.accountId);
    const pubs = (await this.keystore.list()).filter((k) => k.accountId === args.accountId).map((k) => k.publicKey);
    let hash: string;
    let swept = st.total; // borne haute : le gaz de la suppression est prélevé sur ce solde
    let disposition: "deleted" | "frozen" = "deleted";
    try {
      hash = await this.o.backend.deleteAccount(signer, args.beneficiary);
    } catch (e) {
      // Repli : balayer ce qui peut l'être en gardant une réserve de gaz, le compte reste « gelé » (clés retirées).
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
      throw new ChainError("RPC_ERROR", "genomeHash ne correspond pas au sha256 du JSON canonique du génome");
    }
    if (this.mode === "degraded") {
      if (this.ledger.records[record.agentId]) throw new ChainError("ALREADY_REGISTERED", `Déjà enregistré : ${record.agentId}`);
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

  // ------------------------------------------------------------------ séquestre

  async lockEscrow(args: { taskId: string; payer: string; amount: Yocto }) {
    const amount = BigInt(args.amount);
    if (amount <= 0n) throw new ChainError("RPC_ERROR", "Montant de séquestre nul");
    this.policy.check(args.payer, amount);
    if (this.mode === "degraded") {
      if (this.ledger.escrows[args.taskId]) throw new ChainError("ESCROW_EXISTS", `Séquestre déjà créé : ${args.taskId}`);
      // Même règle que le contrat : réservation opérateur de l'id pour ce payeur, consommée au verrouillage.
      const res = this.ledger.reservations[args.taskId];
      if (res === undefined) this.ledger.reservations[args.taskId] = args.payer;
      else if (res !== args.payer) throw new ChainError("ESCROW_EXISTS", `Identifiant de tâche déjà réservé pour un autre payeur : ${args.taskId}`);
      await this.ensureEscrowAccount();
      const st = await this.requireState(args.payer);
      if (st.available < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Solde disponible insuffisant sur ${args.payer}`);
      const hash = await this.o.backend.transfer(await this.signerFor(args.payer), this.escrowAccount, amount);
      delete this.ledger.reservations[args.taskId];
      this.ledger.escrows[args.taskId] = { taskId: args.taskId, payer: args.payer, amount: amount.toString(), status: "locked" };
      await this.ledger.save();
      this.policy.record(args.payer, amount);
      return this.receipt("escrow_lock", hash, { from: args.payer, to: this.escrowAccount, amount: amount.toString() });
    }
    const st = await this.requireState(args.payer);
    if (st.available < amount) throw new ChainError("INSUFFICIENT_FUNDS", `Solde disponible insuffisant sur ${args.payer}`);
    // Anti-squat (contrat L3) : l'opérateur réserve d'abord l'id pour ce payeur (appel interne, hors interface Chain).
    // Si une réservation identique existe déjà (échec précédent après réservation), on ne la refait pas.
    const reserved = (await this.o.backend.view(this.o.contractId!, "get_reservation", { task_id: args.taskId })) as string | null;
    if (reserved === null || reserved === undefined) {
      await this.o.backend.call(this.master, this.o.contractId!, "reserve_task", { task_id: args.taskId, payer: args.payer }, { gas: GAS_CALL });
    } else if (reserved !== args.payer) {
      throw new ChainError("ESCROW_EXISTS", `Identifiant de tâche déjà réservé pour un autre payeur : ${args.taskId}`);
    }
    // Le dépôt est prélevé sur le compte qui signe : on signe avec la clé du payeur.
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

  // --- mode dégradé : règlement sûr (statut transitoire écrit avant le transfert, verrou par taskId) ---
  private locks = new Map<string, Promise<unknown>>();

  /** Sérialise les opérations sur un même taskId (deux appels concurrents ne paient jamais deux fois). */
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

  /** Passe en `releasing`/`refunding` et persiste AVANT le transfert ; en cas d'échec, retour à `locked`. */
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
   * Reprise après plantage (mode dégradé) : pour chaque séquestre resté `releasing`/`refunding`, compare le solde
   * du compte escrow à celui noté avant le transfert. Solde baissé d'au moins le montant : le transfert a eu lieu
   * (état final) ; sinon retour à `locked`. Hypothèse : le compte escrow ne sert qu'à ces règlements. Renvoie les taskId repris.
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

  /** Attend la fin du callback (releasing/refunding -> état final). Rend l'état final observé. */
  private async awaitFinal(taskId: string): Promise<ContractEscrow> {
    const polls = this.o.settlePolls ?? 10;
    let e: ContractEscrow | null = null;
    for (let i = 0; i < polls; i++) {
      e = await this.contractEscrow(taskId);
      if (!e) throw new ChainError("ESCROW_UNKNOWN", `Séquestre inconnu : ${taskId}`);
      if (e.status !== "releasing" && e.status !== "refunding") return e;
      await this.sleep(this.o.settlePollMs ?? 1000);
    }
    throw new ChainError("RPC_ERROR", `Séquestre ${taskId} encore en cours de règlement (${e?.status}) : réessayer plus tard`);
  }

  async releaseEscrow(args: { taskId: string; payee: string; proof: ReleaseProof }) {
    const p = args.proof;
    if (!p || p.verdict !== "accepted" || !p.resultHash || !p.validator) {
      throw new ChainError("PROOF_REQUIRED", "Libération refusée : preuve de validation absente ou non acceptée");
    }
    if (this.mode === "degraded") {
      return this.withLock(args.taskId, async () => {
        const e = this.ledger.escrows[args.taskId];
        if (!e) throw new ChainError("ESCROW_UNKNOWN", `Séquestre inconnu : ${args.taskId}`);
        if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Séquestre déjà ${e.status} : ${args.taskId}`);
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
    if (fin.status !== "released") throw new ChainError("RPC_ERROR", `Libération non confirmée pour ${args.taskId} (état ${fin.status}) : le transfert a échoué`);
    return this.receipt("escrow_release", hash, { from: this.o.contractId, to: args.payee, amount: fin.amount });
  }

  async refundEscrow(args: { taskId: string; reason: string }) {
    const reason = refundReasonOf(args.reason);
    if (this.mode === "degraded") {
      return this.withLock(args.taskId, async () => {
        const e = this.ledger.escrows[args.taskId];
        if (!e) throw new ChainError("ESCROW_UNKNOWN", `Séquestre inconnu : ${args.taskId}`);
        if (e.status !== "locked") throw new ChainError("ESCROW_SETTLED", `Séquestre déjà ${e.status} : ${args.taskId}`);
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
    if (fin.status !== "refunded") throw new ChainError("RPC_ERROR", `Remboursement non confirmé pour ${args.taskId} (état ${fin.status})`);
    return this.receipt("escrow_refund", hash, { from: this.o.contractId, to: fin.payer, amount: fin.amount });
  }

  async getEscrow(taskId: string) {
    if (this.mode === "degraded") {
      const e = this.ledger.escrows[taskId];
      if (!e) return null;
      const status = e.status === "released" ? "released" : e.status === "refunded" ? "refunded" : "locked"; // en cours = locked
      return { taskId: e.taskId, payer: e.payer, amount: e.amount, status } as const;
    }
    const e = await this.contractEscrow(taskId);
    if (!e) return null;
    // `releasing`/`refunding` = en cours : vu comme « locked » (l'argent n'a pas encore atteint son destinataire).
    const status = e.status === "released" ? "released" : e.status === "refunded" ? "refunded" : "locked";
    return { taskId: e.task_id, payer: e.payer, amount: String(e.amount), status } as const;
  }

  // ------------------------------------------------------------------ réputation

  async addReputation(args: { agentId: string; taskId: string; delta: number; proofHash: string }) {
    if (!args.proofHash) throw new ChainError("PROOF_REQUIRED", "Réputation sans preuve refusée");
    if (!Number.isInteger(args.delta) || args.delta === 0 || Math.abs(args.delta) > 100) {
      throw new ChainError("RPC_ERROR", "delta de réputation : entier non nul, |delta| <= 100");
    }
    if (this.mode === "degraded") {
      const e = this.ledger.escrows[args.taskId];
      const rec = this.ledger.records[args.agentId];
      if (!rec) throw new ChainError("UNKNOWN_AGENT", `Agent inconnu : ${args.agentId}`);
      if (!e) throw new ChainError("ESCROW_UNKNOWN", `Séquestre inconnu : ${args.taskId}`);
      if (args.delta > 0) {
        if (e.status !== "released" || e.payee !== rec.accountId || e.proofHash !== args.proofHash) {
          throw new ChainError("PROOF_REQUIRED", "Crédit refusé : séquestre non libéré vers cet agent avec cette preuve");
        }
      } else if (e.status !== "refunded") {
        throw new ChainError("PROOF_REQUIRED", "Malus refusé : séquestre non remboursé (rejected ou expired)");
      }
      const key = `${args.agentId}|${args.taskId}`;
      if (this.ledger.reputationProofs.includes(key)) throw new ChainError("RPC_ERROR", "Réputation déjà écrite pour cette tâche");
      this.ledger.reputationProofs.push(key);
      const total = (this.ledger.reputation[args.agentId] ?? 0) + args.delta;
      this.ledger.reputation[args.agentId] = total;
      await this.ledger.save();
      return { total, tx: this.localReceipt("add_reputation", `${key}|${args.delta}`) };
    }
    // Le contrat exige le séquestre dans son état final : on attend le callback au besoin.
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
