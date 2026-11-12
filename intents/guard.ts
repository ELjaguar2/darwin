// Locks of the Intents module: real spending requires ALL of the following.
//  1. INTENTS_ENABLED=true  2. INTENTS_DRY_ONLY=false  3. written human green light (docs/BESOINS_HUMAIN.md, outside the code)
//  4. an identical dry:true quote, made beforehand  5. amount <= USD cap.
import type { Config } from "../shared/index.ts";

export class IntentsDisabledError extends Error {
  constructor() { super("NEAR Intents disabled (INTENTS_ENABLED!=true)."); this.name = "IntentsDisabledError"; }
}
export class IntentsGuardError extends Error {
  constructor(msg: string) { super(msg); this.name = "IntentsGuardError"; }
}

export const DEFAULT_MAX_USD = 5;

export function assertEnabled(c: Config["intents"]): void {
  if (!c.enabled) throw new IntentsDisabledError();
}

/** Lock on calls that can lead to spending (dry:false, deposit/submit). */
export function assertLive(c: Config["intents"]): void {
  assertEnabled(c);
  if (c.dryOnly) {
    throw new IntentsGuardError(
      "INTENTS_DRY_ONLY is active (default): dry:false and deposit/submit are refused. Requires INTENTS_DRY_ONLY=false after a written human green light in docs/BESOINS_HUMAIN.md.",
    );
  }
}

/** Stable fingerprint of a quote's parameters, to require "dry before live" on the same parameters. */
export function quoteKey(p: { originAsset: string; destinationAsset: string; amountIn: string; refundTo: string; recipient: string }): string {
  return JSON.stringify([p.originAsset, p.destinationAsset, p.amountIn, p.refundTo, p.recipient]);
}
