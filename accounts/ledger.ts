// LOCAL registry, escrow and reputation of NearChain in degraded mode (D-016/D-022): as long as the
// `contracts/darwin` contract (lot L3) is not wired in, these three functions live in the local journal, not on-chain.
// They must NEVER be presented as "on-chain" or "smart contract" (D-022). Optional JSON persistence.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentRecord } from "../shared/chain.ts";

export interface EscrowRow {
  taskId: string;
  payer: string;
  amount: string; // yocto
  /** `releasing`/`refunding`: transfer decided, not yet confirmed (written BEFORE the transfer, resumed by recover()). */
  status: "locked" | "releasing" | "released" | "refunding" | "refunded";
  escrowBefore?: string; // balance of the escrow account before the transfer (used for recovery after a crash)
  payee?: string;
  proofHash?: string; // result_hash of the release proof
  reason?: "rejected" | "expired";
}

interface LedgerData {
  records: Record<string, AgentRecord>;
  reputation: Record<string, number>;
  reputationProofs: string[]; // `${agentId}|${taskId}` already counted (no double credit)
  escrows: Record<string, EscrowRow>;
  reservations: Record<string, string>; // taskId -> payer (operator reservation, consumed on lock)
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

  /** Saves to disk (serialised writes, atomic replacement). */
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
