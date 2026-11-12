// Chain interface: every interaction with NEAR goes through here. Two implementations:
//  - MockChain  (shared/mock/mock-chain.ts): in-memory, deterministic, no network or key.
//  - NearChain  (accounts/near-chain.ts, lot L2 + contracts L3): real testnet via near-api-js.
// Business modules (engine, market, backend) NEVER depend on near-api-js, only on this file.
import type { Yocto } from "./money.ts";
import type { Genome, CauseOfDeath } from "./types.ts";

export interface ChainInfo {
  kind: "mock" | "near";
  network: "mock" | "testnet";
  masterId: string; // master account (parent of the agent sub-accounts)
  contractId?: string; // Darwin contract (registry + escrow + reputation)
  explorerBase?: string; // e.g. https://testnet.nearblocks.io (to be checked by dev-comptes)
}

export interface TxReceipt {
  hash: string;
  kind: string; // "create_account" | "transfer" | "register_agent" | "escrow_lock" ...
  ok: true; // a failure throws a ChainError
  explorerUrl?: string;
  at: string; // ISO
}

export class ChainError extends Error {
  constructor(
    public code:
      | "INSUFFICIENT_FUNDS" | "UNKNOWN_ACCOUNT" | "ACCOUNT_DELETED" | "ESCROW_EXISTS" | "ESCROW_UNKNOWN"
      | "ESCROW_SETTLED" | "PROOF_REQUIRED" | "ALREADY_REGISTERED" | "UNKNOWN_AGENT" | "REPUTATION_EXISTS"
      // Spending cap (NearChain SpendPolicy) exceeded: this is NOT a lack of funds, must never kill an agent.
      | "SPEND_CAP_EXCEEDED" | "RPC_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "ChainError";
  }
}

/** On-chain registry record (lineage kept even after death). */
export interface AgentRecord {
  agentId: string;
  accountId: string; // paying account (costs, escrow) AND beneficiary (payments) of the agent: the market uses it as is
  parentId: string | null;
  generation: number;
  genomeHash: string; // sha256 hex of the canonical genome JSON
  genome: Genome; // stored as is (small) so the lineage is readable on-chain
  birthTick: number;
  alive: boolean;
  deathTick?: number;
  cause?: CauseOfDeath;
}

/** Validation proof required to release an escrow. */
export interface ReleaseProof {
  resultHash: string;
  verdict: "accepted";
  validator: string;
}

export interface Chain {
  info(): ChainInfo;

  // --- comptes ---
  /** Creates a master sub-account and funds it from `fundFrom` (default: master). `label` -> `${label}.${masterId}`. */
  createAccount(args: { label: string; initialFunding: Yocto; fundFrom?: string }): Promise<{ accountId: string; tx: TxReceipt }>;
  getBalance(accountId: string): Promise<Yocto>;
  transfer(args: { from: string; to: string; amount: Yocto; memo?: string }): Promise<TxReceipt>;
  /** Death: transfers the remaining balance to the beneficiary then deletes/freezes the account. Returns the recovered amount. */
  closeAccount(args: { accountId: string; beneficiary: string }): Promise<{ swept: Yocto; tx: TxReceipt }>;

  // --- registre ---
  registerAgent(record: Omit<AgentRecord, "alive" | "deathTick" | "cause">): Promise<TxReceipt>;
  markAgentDead(args: { agentId: string; deathTick: number; cause: CauseOfDeath }): Promise<TxReceipt>;
  getAgentRecord(agentId: string): Promise<AgentRecord | null>;
  listAgentRecords(): Promise<AgentRecord[]>;

  // --- escrow (one per task, id = taskId) ---
  lockEscrow(args: { taskId: string; payer: string; amount: Yocto }): Promise<TxReceipt>;
  /** Requires an `accepted` proof; otherwise ChainError PROOF_REQUIRED. */
  releaseEscrow(args: { taskId: string; payee: string; proof: ReleaseProof }): Promise<TxReceipt>;
  refundEscrow(args: { taskId: string; reason: string }): Promise<TxReceipt>;
  /** Returns the amount and the payer: enough for the market to refund/re-read without its own state. */
  getEscrow(taskId: string): Promise<{ taskId: string; payer: string; amount: Yocto; status: "locked" | "released" | "refunded" } | null>;

  // --- reputation ---
  addReputation(args: { agentId: string; taskId: string; delta: number; proofHash: string }): Promise<{ total: number; tx: TxReceipt }>;
  getReputation(agentId: string): Promise<number>;
}
