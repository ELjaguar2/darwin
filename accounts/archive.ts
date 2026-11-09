// Archivage à la mort : une ligne JSON par compte clos (compte, bénéficiaire, montant récupéré, tx, clés publiques retirées).
// Jamais de clé privée. Fichier : <dataDir>/accounts-archive.jsonl (ignoré par git via data/).
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface ArchivedAccount {
  accountId: string;
  beneficiary: string;
  swept: string; // yocto
  closedAt: string; // ISO
  tx: string;
  disposition: "deleted" | "frozen"; // frozen : suppression impossible (solde < réserve de gaz), clés retirées
  retiredPublicKeys: string[];
}

export interface AccountArchive {
  add(row: ArchivedAccount): Promise<void>;
  list(): Promise<ArchivedAccount[]>;
}

export class MemoryArchive implements AccountArchive {
  rows: ArchivedAccount[] = [];
  async add(row: ArchivedAccount) {
    this.rows.push(row);
  }
  async list() {
    return [...this.rows];
  }
}

export class FileArchive implements AccountArchive {
  constructor(private path: string) {}
  async add(row: ArchivedAccount) {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, JSON.stringify(row) + "\n");
  }
  async list() {
    try {
      return (await readFile(this.path, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as ArchivedAccount);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
}
