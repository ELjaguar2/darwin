// Plafonds de dépense par compte. Le compte maître est exempté (c'est l'opérateur) ; les plafonds protègent
// contre un agent (ou un bug du moteur) qui viderait son compte ou celui d'un tiers d'un coup.
import { ChainError } from "../shared/chain.ts";

export interface SpendLimit {
  /** Montant maximal d'une sortie unique (yocto). */
  perTx: bigint;
  /** Total maximal sorti sur la fenêtre glissante (yocto). */
  perWindow: bigint;
  windowMs: number;
}

export class SpendCapError extends ChainError {
  constructor(public capKind: "per_tx" | "per_window", message: string) {
    // Pas de code dédié dans shared/ : RPC_ERROR (et non INSUFFICIENT_FUNDS, pour ne pas faire mourir un agent par erreur).
    super("RPC_ERROR", `SPEND_CAP_EXCEEDED(${capKind}): ${message}`);
    this.name = "SpendCapError";
  }
}

export interface SpendPolicyOptions {
  /** Plafond par défaut (tous comptes non exemptés). `null` = aucun plafond. */
  defaultLimit: SpendLimit | null;
  /** Surcharges par compte (ex. `visitors.<maître>`). `null` = exempté. */
  perAccount?: Record<string, SpendLimit | null>;
  exempt?: string[]; // ex. compte maître
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

  /** Vérifie sans enregistrer. Lève SpendCapError si le plafond serait dépassé. */
  check(accountId: string, amount: bigint): void {
    const lim = this.limitFor(accountId);
    if (!lim) return;
    if (amount > lim.perTx) throw new SpendCapError("per_tx", `${accountId} : sortie de ${amount} > plafond par transaction ${lim.perTx}`);
    const total = this.windowTotal(accountId, lim.windowMs);
    if (total + amount > lim.perWindow) {
      throw new SpendCapError("per_window", `${accountId} : ${total + amount} > plafond sur ${lim.windowMs} ms (${lim.perWindow})`);
    }
  }

  /** À appeler une fois la sortie effectuée. */
  record(accountId: string, amount: bigint): void {
    if (!this.limitFor(accountId)) return;
    const rows = this.spent.get(accountId) ?? [];
    rows.push({ at: this.now(), amount });
    this.spent.set(accountId, rows);
  }

  /** Dépense restante sur la fenêtre (null = pas de plafond). */
  remaining(accountId: string): bigint | null {
    const lim = this.limitFor(accountId);
    if (!lim) return null;
    const left = lim.perWindow - this.windowTotal(accountId, lim.windowMs);
    return left < 0n ? 0n : left;
  }
}

/** Plafond par défaut dérivé du capital de naissance : 4x par sortie, 50x par heure. Réglable par l'appelant. */
export function defaultSpendLimit(birthCapital: bigint): SpendLimit {
  return { perTx: birthCapital * 4n, perWindow: birthCapital * 50n, windowMs: 3_600_000 };
}
