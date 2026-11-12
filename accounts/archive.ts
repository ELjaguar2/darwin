// Archive on death: one JSON line per closed account (account, beneficiary, recovered amount, tx, removed public keys).
// Never a private key. File: <dataDir>/accounts-archive.jsonl (ignored by git through data/).
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface ArchivedAccount {
  accountId: string;
  beneficiary: string;
  swept: string; // yocto
  closedAt: string; // ISO
  tx: string;
  disposition: "deleted" | "frozen"; // frozen: deletion impossible (balance < gas reserve), keys removed
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
