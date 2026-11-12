// Per-account spending caps. The master account is exempt (it is the operator); the caps protect
// against an agent (or an engine bug) that would drain its account or a third party's in one go.
import { ChainError } from "../shared/chain.ts";

export interface SpendLimit {
  /** Maximum amount of a single outflow (yocto). */
  perTx: bigint;
  /** Maximum total sent out over the sliding window (yocto). */
  perWindow: bigint;
  windowMs: number;
}

export class SpendCapError extends ChainError {
  constructor(public capKind: "per_tx" | "per_window", message: string) {
    // Dedicated code from shared/ (D-031): distinct from INSUFFICIENT_FUNDS so that an agent does not die from it.
    super("SPEND_CAP_EXCEEDED", `SPEND_CAP_EXCEEDED(${capKind}): ${message}`);
    this.name = "SpendCapError";
  }
}

export interface SpendPolicyOptions {
  /** Default cap (all non-exempt accounts). `null` = no cap. */
  defaultLimit: SpendLimit | null;
  /** Per-account overrides (e.g. `visitors.<master>`). `null` = exempt. */
  perAccount?: Record<string, SpendLimit | null>;
  exempt?: string[]; // e.g. master account
}

export class SpendPolicy {
  private spent = new Map<string, Array<{ at: number; amount: bigint }>>();
  constructor(private opts: SpendPolicyOptions, private now: () => number = Date.now) {}

  limitFor(accountId: string): SpendLimit | null {
    if (this.opts.exempt?.includes(accountId)) return null;
    const o = this.opts.perAccount;
    if (o && Object.prototype.hasOwnProperty.call(o, accountId)) return o[accountId] ?? null;
    return this.opts.defaultLimit;
  }

  private windowTotal(accountId: string, windowMs: number): bigint {
    const t = this.now();
    const rows = (this.spent.get(accountId) ?? []).filter((r) => t - r.at < windowMs);
    this.spent.set(accountId, rows);
    return rows.reduce((a, r) => a + r.amount, 0n);
  }

  /** Checks without recording. Throws SpendCapError if the cap would be exceeded. */
  check(accountId: string, amount: bigint): void {
    const lim = this.limitFor(accountId);
    if (!lim) return;
    if (amount > lim.perTx) throw new SpendCapError("per_tx", `${accountId}: outflow of ${amount} > per-transaction cap ${lim.perTx}`);
    const total = this.windowTotal(accountId, lim.windowMs);
    if (total + amount > lim.perWindow) {
      throw new SpendCapError("per_window", `${accountId}: ${total + amount} > cap over ${lim.windowMs} ms (${lim.perWindow})`);
    }
  }

  /** To call once the outflow is done. */
  record(accountId: string, amount: bigint): void {
    if (!this.limitFor(accountId)) return;
    const rows = this.spent.get(accountId) ?? [];
    rows.push({ at: this.now(), amount });
    this.spent.set(accountId, rows);
  }

  /** Remaining spend over the window (null = no cap). */
  remaining(accountId: string): bigint | null {
    const lim = this.limitFor(accountId);
    if (!lim) return null;
    const left = lim.perWindow - this.windowTotal(accountId, lim.windowMs);
    return left < 0n ? 0n : left;
  }
}

/** Default cap derived from the birth capital: 4x per outflow, 50x per hour. Adjustable by the caller. */
export function defaultSpendLimit(birthCapital: bigint): SpendLimit {
  return { perTx: birthCapital * 4n, perWindow: birthCapital * 50n, windowMs: 3_600_000 };
}
