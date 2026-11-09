// Robinet testnet. Vérifié le 2026-11-09 (docs.near.org/getting-started/faucet) : la doc officielle cite un formulaire
// intégré à la page (NEAR testnet seulement) et https://near-faucet.io ; AUCUNE API, quantité ni limite documentée.
// Donc pas d'appel HTTP codé de mémoire : `ManualFaucet` dit à l'humain quoi faire (docs/BESOINS_HUMAIN.md),
// `MockFaucet` crédite un MockChain pour les tests et la démo sans clé.
import type { Chain } from "../shared/chain.ts";
import type { Yocto } from "../shared/money.ts";

export interface Faucet {
  /** Demande des fonds pour `accountId`. Renvoie le montant reçu (0 si le robinet ne peut pas le faire seul). */
  request(accountId: string): Promise<{ received: Yocto; source: "faucet" | "manual" }>;
}

export class ManualFaucet implements Faucet {
  async request(accountId: string): Promise<{ received: Yocto; source: "faucet" | "manual" }> {
    throw new Error(
      `Robinet automatique indisponible (aucune API documentée). Financer ${accountId} à la main via https://near-faucet.io ou le formulaire de https://docs.near.org/getting-started/faucet.`,
    );
  }
}

export class MockFaucet implements Faucet {
  constructor(private chain: Chain, private from: string, private amount: bigint) {}
  async request(accountId: string) {
    await this.chain.transfer({ from: this.from, to: accountId, amount: this.amount.toString(), memo: "mock faucet" });
    return { received: this.amount.toString(), source: "faucet" as const };
  }
}

/** Demande au robinet tant que le solde est sous `min` (au plus `maxRequests` fois). Renvoie le solde final. */
export async function ensureFunded(chain: Chain, faucet: Faucet, accountId: string, min: bigint, maxRequests = 3): Promise<bigint> {
  let bal = BigInt(await chain.getBalance(accountId));
  for (let i = 0; i < maxRequests && bal < min; i++) {
    await faucet.request(accountId);
    bal = BigInt(await chain.getBalance(accountId));
  }
  return bal;
}
