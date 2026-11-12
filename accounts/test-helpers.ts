// Test helpers: NearChain wired to the fake backend, with no network or real key.
import { parseNear } from "../shared/money.ts";
import { MemoryArchive } from "./archive.ts";
import { FakeNearBackend } from "./fake-backend.ts";
import { MemoryKeyStore, generateKey } from "./keys.ts";
import { NearChain } from "./near-chain.ts";
import { SpendPolicy, defaultSpendLimit } from "./policy.ts";

export function FakeNearBackendFactory(master: string) {
  return { backend: new FakeNearBackend(master) };
}

export function newChain(o: { contract: boolean; birth?: bigint }) {
  const master = "darwin.testnet";
  const backend = new FakeNearBackend(master);
  const keystore = new MemoryKeyStore();
  const archive = new MemoryArchive();
  const chain = new NearChain({
    masterId: master,
    masterKey: generateKey().secretKey,
    backend,
    contractId: o.contract ? backend.contractId : undefined,
    keystore,
    archive,
    policy: new SpendPolicy({ defaultLimit: defaultSpendLimit(o.birth ?? parseNear("100")), exempt: [master] }),
    sleep: async () => backend.settle(), // the "callback" arrives during the wait
    settlePollMs: 0,
  });
  return { chain, backend, keystore, archive };
}
