// Budget IA global persistant + journal de consommation réelle (data/ai-usage.jsonl).
// Le cumul survit au redémarrage (data/ai-budget.json). Une fois le plafond d'arrêt atteint, `reserve` lève BrainError BUDGET_EXHAUSTED
// et `onExhausted` est appelé UNE fois (le backend arrête alors la simulation proprement). Aucune clé n'est jamais écrite ici.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrainError } from "../shared/index.ts";

export interface UsageRecord {
  ts: string;
  provider: "nearai" | "fallback";
  /** id demandé (clé du catalogue) ; `servedModel` = nom renvoyé par le fournisseur. */
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
  /** Plafond d'arrêt en EUR (DARWIN_AI_BUDGET_EUR_STOP). */
  stopEur: number;
  /** Budget total en EUR (information et contrôle de cohérence). */
  totalEur: number;
  /** USD pour 1 EUR. */
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
    if (!(o.eurUsdRate > 0)) throw new Error("eurUsdRate doit être > 0");
    if (!(o.stopEur > 0) || o.stopEur > o.totalEur) throw new Error("budget IA incohérent (0 < stop <= total)");
    this.budgetPath = join(o.dir, BUDGET_FILE);
    this.usagePath = join(o.dir, USAGE_FILE);
    mkdirSync(o.dir, { recursive: true });
    if (existsSync(this.budgetPath)) {
      try {
        const j = JSON.parse(readFileSync(this.budgetPath, "utf8"));
        if (typeof j?.spentUsd === "number" && Number.isFinite(j.spentUsd) && j.spentUsd >= 0) this.spentUsd = j.spentUsd;
        else throw new Error("format");
      } catch {
        // Fichier corrompu : on reconstruit depuis le journal d'usage (jamais repartir de zéro en silence).
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
        } catch { /* ligne tronquée ignorée */ }
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

  /** Réserve le pire cas d'un appel ; refuse (BUDGET_EXHAUSTED) si le plafond d'arrêt serait franchi. */
  reserve(worstUsd: number): void {
    if (this.spentUsd + this.pendingUsd + worstUsd > this.stopUsd) {
      if (!this.notified) {
        this.notified = true;
        try { this.o.onExhausted?.({ spentEur: this.spentEur(), stopEur: this.o.stopEur }); } catch { /* ne jamais casser l'appelant */ }
      }
      throw new BrainError(
        "BUDGET_EXHAUSTED",
        `Budget IA atteint (${this.spentEur().toFixed(4)} EUR dépensés, arrêt à ${this.o.stopEur} EUR) : appel refusé`,
      );
    }
    this.pendingUsd += worstUsd;
  }

  /** Libère la réservation et enregistre le coût réel (persistant + journal d'usage). */
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
      // Le cumul en mémoire reste valide ; l'échec d'écriture ne doit pas faire perdre la réponse déjà payée.
    }
    if (this.exhausted() && !this.notified) {
      this.notified = true;
      try { this.o.onExhausted?.({ spentEur: this.spentEur(), stopEur: this.o.stopEur }); } catch { /* idem */ }
    }
  }
}

export function ensureDir(p: string) { mkdirSync(dirname(p), { recursive: true }); }

/** Relit le journal d'usage (rapport). Les lignes illisibles sont ignorées. */
export function readUsage(path: string): UsageRecord[] {
  if (!existsSync(path)) return [];
  const out: UsageRecord[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as UsageRecord); } catch { /* ignorée */ }
  }
  return out;
}
