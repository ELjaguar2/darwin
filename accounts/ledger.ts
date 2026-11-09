// Registre, séquestre et réputation LOCAUX de NearChain en mode dégradé (D-016/D-022) : tant que le contrat
// `contracts/darwin` (lot L3) n'est pas branché, ces trois fonctions vivent dans le journal local, pas on-chain.
// Ils ne doivent JAMAIS être présentés comme « on-chain » ou « contrat intelligent » (D-022). Persistance JSON optionnelle.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentRecord } from "../shared/chain.ts";

export interface EscrowRow {
  taskId: string;
  payer: string;
  amount: string; // yocto
  /** `releasing`/`refunding` : transfert décidé, pas encore confirmé (écrit AVANT le transfert, reprise par recover()). */
  status: "locked" | "releasing" | "released" | "refunding" | "refunded";
  escrowBefore?: string; // solde du compte escrow avant le transfert (sert à la reprise après plantage)
  payee?: string;
  proofHash?: string; // result_hash de la preuve de libération
  reason?: "rejected" | "expired";
}

interface LedgerData {
  records: Record<string, AgentRecord>;
  reputation: Record<string, number>;
  reputationProofs: string[]; // `${agentId}|${taskId}` déjà comptés (pas de double crédit)
  escrows: Record<string, EscrowRow>;
  reservations: Record<string, string>; // taskId -> payeur (réservation opérateur, consommée au verrouillage)
  closedAccounts: string[];
}

export class LocalLedger {
  private d: LedgerData = { records: {}, reputation: {}, reputationProofs: [], escrows: {}, reservations: {}, closedAccounts: [] };
  private saving: Promise<void> = Promise.resolve();

  constructor(private path?: string) {}

  async load(): Promise<void> {
    if (!this.path) return;
    try {
      this.d = { ...this.d, ...(JSON.parse(await readFile(this.path, "utf8")) as Partial<LedgerData>) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }

  /** Enregistre sur disque (écritures sérialisées, remplacement atomique). */
  async save(): Promise<void> {
    if (!this.path) return;
    const path = this.path;
    this.saving = this.saving.then(async () => {
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.tmp`;
      await writeFile(tmp, JSON.stringify(this.d));
      await rename(tmp, path);
    });
    return this.saving;
  }

  get records() {
    return this.d.records;
  }
  get reputation() {
    return this.d.reputation;
  }
  get reputationProofs() {
    return this.d.reputationProofs;
  }
  get escrows() {
    return this.d.escrows;
  }
  get reservations() {
    return this.d.reservations;
  }
  get closedAccounts() {
    return this.d.closedAccounts;
  }
}
