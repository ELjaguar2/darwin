// Testnet faucet. Checked on 2026-11-09 (docs.near.org/getting-started/faucet): the official doc cites a form
// built into the page (NEAR testnet only) and https://near-faucet.io; NO API, amount or limit documented.
// So no HTTP call coded from memory: `ManualFaucet` tells the human what to do (docs/BESOINS_HUMAIN.md),
// `MockFaucet` credits a MockChain for tests and the keyless demo.
import type { Chain } from "../shared/chain.ts";
import type { Yocto } from "../shared/money.ts";

export interface Faucet {
  /** Requests funds for `accountId`. Returns the amount received (0 if the faucet cannot do it alone). */
  request(accountId: string): Promise<{ received: Yocto; source: "faucet" | "manual" }>;
}

export class ManualFaucet implements Faucet {
  async request(accountId: string): Promise<{ received: Yocto; source: "faucet" | "manual" }> {
    throw new Error(
      `Automatic faucet unavailable (no documented API). Fund ${accountId} by hand via https://near-faucet.io or the form at https://docs.near.org/getting-started/faucet.`,
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

/** Asks the faucet while the balance is below `min` (at most `maxRequests` times). Returns the final balance. */
export async function ensureFunded(chain: Chain, faucet: Faucet, accountId: string, min: bigint, maxRequests = 3): Promise<bigint> {
  let bal = BigInt(await chain.getBalance(accountId));
  for (let i = 0; i < maxRequests && bal < min; i++) {
    await faucet.request(accountId);
    bal = BigInt(await chain.getBalance(accountId));
  }
  return bal;
}
