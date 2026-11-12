// Persistent global AI budget + real consumption journal (data/ai-usage.jsonl).
// The total survives a restart (data/ai-budget.json). Once the stop cap is reached, `reserve` throws BrainError BUDGET_EXHAUSTED
// and `onExhausted` is called ONCE (the backend then stops the simulation cleanly). No key is ever written here.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrainError } from "../shared/index.ts";

export interface UsageRecord {
  ts: string;
  provider: "nearai" | "fallback";
  /** requested id (catalogue key); `servedModel` = name returned by the provider. */
  model: string;
  servedModel?: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  costUsd: number;
  costEur: number;
  eurUsdRate: number;
  responseId: string | null;
  agentId: string;
  purpose: string;
}

export interface AiBudgetOptions {
  dir: string;
  /** Stop cap in EUR (DARWIN_AI_BUDGET_EUR_STOP). */
  stopEur: number;
  /** Total budget in EUR (information and consistency check). */
  totalEur: number;
  /** USD per 1 EUR. */
  eurUsdRate: number;
  onExhausted?: (info: { spentEur: number; stopEur: number }) => void;
}

export const BUDGET_FILE = "ai-budget.json";
export const USAGE_FILE = "ai-usage.jsonl";

export class AiBudget {
  private spentUsd = 0;
  private pendingUsd = 0;
  private notified = false;
  readonly budgetPath: string;
  readonly usagePath: string;

  constructor(private readonly o: AiBudgetOptions) {
    if (!(o.eurUsdRate > 0)) throw new Error("eurUsdRate must be > 0");
    if (!(o.stopEur > 0) || o.stopEur > o.totalEur) throw new Error("inconsistent AI budget (0 < stop <= total)");
    this.budgetPath = join(o.dir, BUDGET_FILE);
    this.usagePath = join(o.dir, USAGE_FILE);
    mkdirSync(o.dir, { recursive: true });
    if (existsSync(this.budgetPath)) {
      try {
        const j = JSON.parse(readFileSync(this.budgetPath, "utf8"));
        if (typeof j?.spentUsd === "number" && Number.isFinite(j.spentUsd) && j.spentUsd >= 0) this.spentUsd = j.spentUsd;
        else throw new Error("format");
      } catch {
        // Corrupted file: rebuild from the usage journal (never silently restart from zero).
        this.spentUsd = this.sumFromLog();
      }
    } else if (existsSync(this.usagePath)) this.spentUsd = this.sumFromLog();
  }

  private sumFromLog(): number {
    try {
      let t = 0;
      for (const line of readFileSync(this.usagePath, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const c = JSON.parse(line)?.costUsd;
          if (typeof c === "number" && Number.isFinite(c)) t += c;
        } catch { /* truncated line ignored */ }
      }
      return t;
    } catch {
      return 0;
    }
  }

  get stopUsd(): number { return this.o.stopEur * this.o.eurUsdRate; }
  get eurUsdRate(): number { return this.o.eurUsdRate; }
  spentEur(): number { return this.spentUsd / this.o.eurUsdRate; }
  state() {
    return { spentUsd: this.spentUsd, spentEur: this.spentEur(), stopEur: this.o.stopEur, totalEur: this.o.totalEur, exhausted: this.exhausted() };
  }
  exhausted(): boolean { return this.spentUsd + this.pendingUsd >= this.stopUsd; }

  /** Reserves the worst case of a call; refuses (BUDGET_EXHAUSTED) if the stop cap would be crossed. */
  reserve(worstUsd: number): void {
    if (this.spentUsd + this.pendingUsd + worstUsd > this.stopUsd) {
      if (!this.notified) {
        this.notified = true;
        try { this.o.onExhausted?.({ spentEur: this.spentEur(), stopEur: this.o.stopEur }); } catch { /* ne jamais casser l'appelant */ }
      }
      throw new BrainError(
        "BUDGET_EXHAUSTED",
        `AI budget reached (${this.spentEur().toFixed(4)} EUR spent, stop at ${this.o.stopEur} EUR): call refused`,
      );
    }
    this.pendingUsd += worstUsd;
  }

  /** Releases the reservation and records the real cost (persistent + usage journal). */
  settle(worstUsd: number, rec?: Omit<UsageRecord, "ts" | "costEur" | "eurUsdRate">): void {
    this.pendingUsd = Math.max(0, this.pendingUsd - worstUsd);
    if (!rec) return;
    this.spentUsd += rec.costUsd;
    const full: UsageRecord = { ts: new Date().toISOString(), ...rec, costEur: rec.costUsd / this.o.eurUsdRate, eurUsdRate: this.o.eurUsdRate };
    try {
      appendFileSync(this.usagePath, JSON.stringify(full) + "\n");
      const tmp = this.budgetPath + ".tmp";
      writeFileSync(tmp, JSON.stringify({ spentUsd: this.spentUsd, updatedAt: full.ts }));
      renameSync(tmp, this.budgetPath);
    } catch {
      // The in-memory total remains valid; a write failure must not lose the response already paid for.
    }
    if (this.exhausted() && !this.notified) {
      this.notified = true;
      try { this.o.onExhausted?.({ spentEur: this.spentEur(), stopEur: this.o.stopEur }); } catch { /* idem */ }
    }
  }
}

export function ensureDir(p: string) { mkdirSync(dirname(p), { recursive: true }); }

/** Re-reads the usage journal (report). Unreadable lines are ignored. */
export function readUsage(path: string): UsageRecord[] {
  if (!existsSync(path)) return [];
  const out: UsageRecord[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as UsageRecord); } catch { /* ignored */ }
  }
  return out;
}
