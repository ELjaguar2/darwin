// Interface Chain : toute interaction avec NEAR passe par ici. Deux implémentations :
//  - MockChain  (shared/mock/mock-chain.ts) : en mémoire, déterministe, sans réseau ni clé.
//  - NearChain  (accounts/near-chain.ts, lot L2 + contrats L3) : testnet réel via near-api-js.
// Les modules métier (engine, market, backend) ne dépendent JAMAIS de near-api-js, uniquement de ce fichier.
import type { Yocto } from "./money.ts";
import type { Genome, CauseOfDeath } from "./types.ts";

export interface ChainInfo {
  kind: "mock" | "near";
  network: "mock" | "testnet";
  masterId: string; // compte maître (parent des sous-comptes agents)
  contractId?: string; // contrat Darwin (registre + séquestre + réputation)
  explorerBase?: string; // ex. https://testnet.nearblocks.io (à vérifier par dev-comptes)
}

export interface TxReceipt {
  hash: string;
  kind: string; // "create_account" | "transfer" | "register_agent" | "escrow_lock" ...
  ok: true; // un échec lève une ChainError
  explorerUrl?: string;
  at: string; // ISO
}

export class ChainError extends Error {
  constructor(
    public code:
      | "INSUFFICIENT_FUNDS" | "UNKNOWN_ACCOUNT" | "ACCOUNT_DELETED" | "ESCROW_EXISTS" | "ESCROW_UNKNOWN"
      | "ESCROW_SETTLED" | "PROOF_REQUIRED" | "ALREADY_REGISTERED" | "UNKNOWN_AGENT" | "RPC_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "ChainError";
  }
}

/** Enregistrement du registre on-chain (lignée conservée même après la mort). */
export interface AgentRecord {
  agentId: string;
  accountId: string;
  parentId: string | null;
  generation: number;
  genomeHash: string; // sha256 hex du génome JSON canonique
  genome: Genome; // stocké tel quel (petit) pour que la lignée soit lisible on-chain
  birthTick: number;
  alive: boolean;
  deathTick?: number;
  cause?: CauseOfDeath;
}

/** Preuve de validation exigée pour libérer un séquestre. */
export interface ReleaseProof {
  resultHash: string;
  verdict: "accepted";
  validator: string;
}

export interface Chain {
  info(): ChainInfo;

  // --- comptes ---
  /** Crée un sous-compte du maître et le finance depuis `fundFrom` (défaut : maître). `label` -> `${label}.${masterId}`. */
  createAccount(args: { label: string; initialFunding: Yocto; fundFrom?: string }): Promise<{ accountId: string; tx: TxReceipt }>;
  getBalance(accountId: string): Promise<Yocto>;
  transfer(args: { from: string; to: string; amount: Yocto; memo?: string }): Promise<TxReceipt>;
  /** Mort : transfère le solde restant au bénéficiaire puis supprime/gèle le compte. Renvoie le montant récupéré. */
  closeAccount(args: { accountId: string; beneficiary: string }): Promise<{ swept: Yocto; tx: TxReceipt }>;

  // --- registre ---
  registerAgent(record: Omit<AgentRecord, "alive" | "deathTick" | "cause">): Promise<TxReceipt>;
  markAgentDead(args: { agentId: string; deathTick: number; cause: CauseOfDeath }): Promise<TxReceipt>;
  getAgentRecord(agentId: string): Promise<AgentRecord | null>;
  listAgentRecords(): Promise<AgentRecord[]>;

  // --- séquestre (un par tâche, id = taskId) ---
  lockEscrow(args: { taskId: string; payer: string; amount: Yocto }): Promise<TxReceipt>;
  /** Exige une preuve `accepted` ; sinon ChainError PROOF_REQUIRED. */
  releaseEscrow(args: { taskId: string; payee: string; proof: ReleaseProof }): Promise<TxReceipt>;
  refundEscrow(args: { taskId: string; reason: string }): Promise<TxReceipt>;
  getEscrow(taskId: string): Promise<{ taskId: string; payer: string; amount: Yocto; status: "locked" | "released" | "refunded" } | null>;

  // --- réputation ---
  addReputation(args: { agentId: string; taskId: string; delta: number; proofHash: string }): Promise<{ total: number; tx: TxReceipt }>;
  getReputation(agentId: string): Promise<number>;
}
