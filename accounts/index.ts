// Entry point of accounts/: `createChain(config)` picks MockChain or NearChain according to the configuration.
import { MockChain } from "../shared/mock/mock-chain.ts";
import type { Chain } from "../shared/chain.ts";
import type { Config } from "../shared/config.ts";
import { ChainError } from "../shared/chain.ts";
import { FileArchive } from "./archive.ts";
import { FileKeyStore, Secret, publicKeyOf, type KeyStore } from "./keys.ts";
import { LocalLedger } from "./ledger.ts";
import { loadNearApiBackend, type NearBackend } from "./near-backend.ts";
import { NearChain, type NearChainOptions } from "./near-chain.ts";
import { SpendPolicy, defaultSpendLimit } from "./policy.ts";
import { join } from "node:path";

export * from "./base58.ts";
export * from "./keys.ts";
export * from "./policy.ts";
export * from "./archive.ts";
export * from "./ledger.ts";
export * from "./faucet.ts";
export * from "./near-backend.ts";
export * from "./near-chain.ts";

/** near-api-js backend loaded on first use (the package stays optional). */
export function lazyNearBackend(rpcUrl: string): NearBackend {
  let p: Promise<NearBackend> | undefined;
  const b = () => (p ??= loadNearApiBackend(rpcUrl));
  return {
    status: async () => (await b()).status(),
    getState: async (a) => (await b()).getState(a),
    createSubAccount: async (...a) => (await b()).createSubAccount(...a),
    transfer: async (...a) => (await b()).transfer(...a),
    deleteAccount: async (...a) => (await b()).deleteAccount(...a),
    addFunctionCallKey: async (...a) => (await b()).addFunctionCallKey(...a),
    call: async (...a) => (await b()).call(...a),
    view: async (...a) => (await b()).view(...a),
  };
}

export interface CreateChainExtras {
  backend?: NearBackend; // tests : faux backend
  keystore?: KeyStore;
  onTx?: NearChainOptions["onTx"];
  onWarning?: NearChainOptions["onWarning"];
}

/** Keyless mock (default) or testnet NearChain. Never mainnet. */
export function createChain(config: Config, extra: CreateChainExtras = {}): Chain {
  if (config.chain === "mock") return new MockChain();
  const { masterAccountId, masterPrivateKey, contractId, rpcUrl } = config.near;
  if (!masterAccountId || !masterPrivateKey) {
    throw new ChainError("RPC_ERROR", "Testnet mode: NEAR_MASTER_ACCOUNT_ID and NEAR_MASTER_PRIVATE_KEY are required (see docs/BESOINS_HUMAIN.md).");
  }
  const masterKey = new Secret(masterPrivateKey);
  publicKeyOf(masterKey); // validates the format without displaying it
  const dir = join(config.server.dataDir, "keys");
  const birth = config.sim.birthCapital;
  return new NearChain({
    masterId: masterAccountId,
    masterKey,
    contractId,
    backend: extra.backend ?? lazyNearBackend(rpcUrl),
    keystore: extra.keystore ?? new FileKeyStore(dir),
    archive: new FileArchive(join(config.server.dataDir, "accounts-archive.jsonl")),
    ledger: new LocalLedger(join(config.server.dataDir, "ledger.json")),
    policy: new SpendPolicy({ defaultLimit: defaultSpendLimit(birth), exempt: [masterAccountId] }),
    onTx: extra.onTx,
    onWarning: extra.onWarning,
  });
}
