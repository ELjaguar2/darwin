// Verrous du module Intents : la dépense réelle exige TOUT ce qui suit.
//  1. INTENTS_ENABLED=true  2. INTENTS_DRY_ONLY=false  3. feu vert humain écrit (docs/BESOINS_HUMAIN.md, hors code)
//  4. un devis dry:true identique, effectué avant  5. montant <= plafond USD.
import type { Config } from "../shared/index.ts";

export class IntentsDisabledError extends Error {
  constructor() { super("NEAR Intents désactivé (INTENTS_ENABLED!=true)."); this.name = "IntentsDisabledError"; }
}
export class IntentsGuardError extends Error {
  constructor(msg: string) { super(msg); this.name = "IntentsGuardError"; }
}

export const DEFAULT_MAX_USD = 5;

export function assertEnabled(c: Config["intents"]): void {
  if (!c.enabled) throw new IntentsDisabledError();
}

/** Verrou des appels qui peuvent mener à une dépense (dry:false, deposit/submit). */
export function assertLive(c: Config["intents"]): void {
  assertEnabled(c);
  if (c.dryOnly) {
    throw new IntentsGuardError(
      "INTENTS_DRY_ONLY est actif (défaut) : dry:false et deposit/submit sont refusés. Exige INTENTS_DRY_ONLY=false après un feu vert humain écrit dans docs/BESOINS_HUMAIN.md.",
    );
  }
}

/** Empreinte stable des paramètres d'un devis, pour exiger « dry avant live » sur les mêmes paramètres. */
export function quoteKey(p: { originAsset: string; destinationAsset: string; amountIn: string; refundTo: string; recipient: string }): string {
  return JSON.stringify([p.originAsset, p.destinationAsset, p.amountIn, p.refundTo, p.recipient]);
}
