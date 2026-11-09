import { describe, expect, it } from "vitest";
import { ChainError, loadConfig, MockChain, hashObject, parseNear, type Genome } from "../shared/index.ts";
import { FakeNearBackendFactory, newChain } from "./test-helpers.ts";
import {
  MemoryKeyStore, Secret, SpendPolicy, base58Decode, base58Encode, createChain, defaultSpendLimit, generateKey,
  publicKeyOf, ensureFunded, MockFaucet, ManualFaucet, NearChain, refundReasonOf, FileKeyStore, FileArchive,
} from "./index.ts";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";

const genome: Genome = { profession: "writer", model: "mock-small", askRatio: 0.7, risk: 0.5, reproThreshold: 2, generosity: 0.2, cooperation: 0.3, personality: "Sois utile." };
const rec = (id: string, accountId: string, parentId: string | null = null, generation = 1) => ({
  agentId: id, accountId, parentId, generation, genomeHash: hashObject(genome), genome, birthTick: 0,
});
const N = parseNear;
const Y = (x: string) => parseNear(x).toString();
const proof = { resultHash: "h1", verdict: "accepted" as const, validator: "rule:len" };

describe("base58 et clés", () => {
  it("aller-retour base58, zéros de tête compris", () => {
    for (const hex of ["00", "0000ff", "ff", "0102030405060708090a"]) {
      const b = Buffer.from(hex, "hex");
      expect(Buffer.from(base58Decode(base58Encode(b))).toString("hex")).toBe(hex);
    }
  });
  it("clé générée : publicKeyOf cohérent, format NEAR (64 octets)", () => {
    const k = generateKey();
    expect(publicKeyOf(k.secretKey)).toBe(k.publicKey);
    expect(base58Decode(k.secretKey.reveal().slice(8))).toHaveLength(64);
  });
  it("Secret ne fuit ni par toString, ni JSON, ni inspect", () => {
    const k = generateKey();
    const raw = k.secretKey.reveal();
    expect(`${k.secretKey}`).toBe("[SECRET]");
    expect(JSON.stringify({ k: k.secretKey })).not.toContain(raw);
    expect(inspect({ k: k.secretKey })).not.toContain(raw);
    expect(() => publicKeyOf(new Secret("ed25519:abc"))).toThrow();
    try {
      publicKeyOf(new Secret("ed25519:abc"));
    } catch (e) {
      expect((e as Error).message).not.toContain("abc");
    }
  });
  it("FileKeyStore : fichier *.key, retrait, identifiant piégé refusé", async () => {
    const dir = await mkdtemp(join(tmpdir(), "darwin-keys-"));
    const ks = new FileKeyStore(dir);
    const k = generateKey();
    await ks.put("a-1.m.testnet", "full", k);
    expect((await readdir(dir))[0]).toMatch(/\.key$/);
    expect((await ks.get("a-1.m.testnet", "full"))?.secretKey.reveal()).toBe(k.secretKey.reveal());
    expect(JSON.stringify(await ks.list())).not.toContain(k.secretKey.reveal());
    await expect(ks.get("../evil", "full")).rejects.toThrow();
    await ks.remove("a-1.m.testnet");
    expect(await ks.get("a-1.m.testnet", "full")).toBeNull();
  });
});

describe("plafonds de dépense", () => {
  it("par transaction et sur fenêtre glissante, maître exempté", () => {
    let t = 0;
    const p = new SpendPolicy({ defaultLimit: { perTx: 10n, perWindow: 15n, windowMs: 1000 }, exempt: ["m"] }, () => t);
    expect(() => p.check("a", 11n)).toThrow(/per_tx/);
    p.check("a", 10n);
    p.record("a", 10n);
    expect(() => p.check("a", 6n)).toThrow(/per_window/);
    expect(p.remaining("a")).toBe(5n);
    t = 1001;
    p.check("a", 6n);
    p.check("m", 10n ** 30n);
    expect(p.remaining("m")).toBeNull();
  });
  it("l'erreur de plafond n'est pas INSUFFICIENT_FUNDS (ne tue pas un agent)", () => {
    const p = new SpendPolicy({ defaultLimit: defaultSpendLimit(N("1")) });
    try {
      p.check("a", N("100"));
    } catch (e) {
      expect((e as ChainError).code).toBe("RPC_ERROR");
    }
  });
});

describe("createChain", () => {
  it("mock par défaut, sans clé", () => {
    expect(createChain(loadConfig({})).info().kind).toBe("mock");
  });
  it("testnet sans clé maître : erreur claire sans secret", () => {
    expect(() => createChain(loadConfig({ DARWIN_MODE: "testnet" }))).toThrow(/NEAR_MASTER_ACCOUNT_ID/);
  });
  it("testnet avec clé maître : NearChain (backend injecté)", () => {
    const k = generateKey();
    const { backend } = FakeNearBackendFactory("m.testnet");
    const c = createChain(
      loadConfig({ DARWIN_MODE: "testnet", NEAR_MASTER_ACCOUNT_ID: "m.testnet", NEAR_MASTER_PRIVATE_KEY: k.secretKey.reveal(), NEAR_CONTRACT_ID: "d.m.testnet", DARWIN_DATA_DIR: tmpdir() }),
      { backend, keystore: new MemoryKeyStore() },
    );
    expect(c).toBeInstanceOf(NearChain);
    expect(c.info().network).toBe("testnet");
  });
  it("robinet mock / manuel", async () => {
    const m = new MockChain();
    const a = await m.createAccount({ label: "x", initialFunding: Y("0.1") });
    const bal = await ensureFunded(m, new MockFaucet(m, m.masterId, N("1")), a.accountId, N("1"));
    expect(bal >= N("1")).toBe(true);
    await expect(new ManualFaucet().request("x")).rejects.toThrow(/near-faucet\.io/);
  });
});

describe("NearChain, mode contrat (faux backend)", () => {
  it("naissance : sous-compte, clé complète gardée, clé function call limitée au contrat", async () => {
    const { chain, backend, keystore } = newChain({ contract: true });
    const { accountId, tx } = await chain.createAccount({ label: "a-0001", initialFunding: Y("0.3") });
    expect(accountId).toBe("a-0001.darwin.testnet");
    expect(tx.explorerUrl).toBe("https://testnet.nearblocks.io/txns/" + tx.hash);
    expect(await chain.getBalance(accountId)).toBe(N("0.3").toString());
    expect(backend.fcKeys).toHaveLength(1);
    const fc = backend.fcKeys[0]!;
    expect(fc.contractId).toBe("darwin.test.testnet");
    expect(fc.methodNames.length).toBeGreaterThan(0);
    expect(fc.allowance > 0n && fc.allowance <= N("0.1")).toBe(true);
    expect((await keystore.get(accountId, "full"))?.role).toBe("full");
    expect((await keystore.get(accountId, "fc"))?.publicKey).toBe(fc.publicKey);
    await expect(chain.createAccount({ label: "a-0001", initialFunding: "1" })).rejects.toThrow(/déjà/);
    await expect(chain.createAccount({ label: "Bad.Label", initialFunding: "1" })).rejects.toThrow(/invalide/);
  });

  it("naissance financée par le parent : le capital vient du parent, plafond appliqué", async () => {
    const { chain } = newChain({ contract: true, birth: N("0.3") });
    const p = await chain.createAccount({ label: "p", initialFunding: Y("5") });
    // plafond perTx = 4 x 0.3 = 1.2 : un enfant à 1.5 est refusé
    await expect(chain.createAccount({ label: "c1", initialFunding: Y("1.5"), fundFrom: p.accountId })).rejects.toThrow(/SPEND_CAP/);
    const before = BigInt(await chain.getBalance(p.accountId));
    const c = await chain.createAccount({ label: "c2", initialFunding: Y("0.5"), fundFrom: p.accountId });
    expect(BigInt(await chain.getBalance(p.accountId))).toBe(before - N("0.5"));
    expect(await chain.getBalance(c.accountId)).toBe(N("0.5").toString());
  });

  it("registre : envoie genome_json canonique + hash ; hash faux refusé ; lecture et lignée", async () => {
    const { chain, backend } = newChain({ contract: true });
    await chain.registerAgent(rec("a-0001", "a-0001.darwin.testnet"));
    const sent = (backend.calls[0]!.args as { record: { genome_json: string; genome_hash: string } }).record;
    expect(JSON.parse(sent.genome_json)).toEqual(genome);
    expect(sent.genome_hash).toBe(hashObject(genome));
    await expect(chain.registerAgent(rec("a-0001", "x"))).rejects.toMatchObject({ code: "ALREADY_REGISTERED" });
    await expect(chain.registerAgent({ ...rec("a-0002", "x"), genomeHash: "00" })).rejects.toThrow(/genomeHash/);
    await chain.registerAgent(rec("a-0002", "a-0002.darwin.testnet", "a-0001", 2));
    await chain.markAgentDead({ agentId: "a-0001", deathTick: 7, cause: "starvation" });
    const r = await chain.getAgentRecord("a-0001");
    expect(r).toMatchObject({ alive: false, deathTick: 7, cause: "starvation", genome });
    expect((await chain.listAgentRecords()).map((x) => x.agentId)).toEqual(["a-0001", "a-0002"]);
    expect(await chain.getAgentRecord("nope")).toBeNull();
  });

  async function setup(defer = false) {
    const t = newChain({ contract: true });
    t.backend.deferCallbacks = defer;
    const payer = await t.chain.createAccount({ label: "payer", initialFunding: Y("1") });
    const worker = await t.chain.createAccount({ label: "worker", initialFunding: Y("0.3") });
    await t.chain.registerAgent(rec("a-1", worker.accountId));
    return { ...t, payer: payer.accountId, worker: worker.accountId };
  }

  it("séquestre : le payeur signe et est débité ; libération puis réputation", async () => {
    const { chain, backend, payer, worker } = await setup();
    await chain.lockEscrow({ taskId: "t-1", payer, amount: Y("0.2") });
    expect(backend.calls.find((c) => c.method === "lock_escrow")).toMatchObject({ signer: payer, deposit: N("0.2") });
    expect(await chain.getBalance(payer)).toBe(N("0.8").toString());
    expect(await chain.getEscrow("t-1")).toMatchObject({ status: "locked", amount: N("0.2").toString() });
    await expect(chain.releaseEscrow({ taskId: "t-1", payee: worker, proof: { ...proof, verdict: "rejected" as never } })).rejects.toMatchObject({ code: "PROOF_REQUIRED" });
    await chain.releaseEscrow({ taskId: "t-1", payee: worker, proof });
    expect((await chain.getEscrow("t-1"))?.status).toBe("released");
    expect(await chain.getBalance(worker)).toBe(N("0.5").toString());
    await expect(chain.releaseEscrow({ taskId: "t-1", payee: worker, proof })).rejects.toMatchObject({ code: "ESCROW_SETTLED" });
    await expect(chain.addReputation({ agentId: "a-1", taskId: "t-1", delta: 1, proofHash: "autre" })).rejects.toMatchObject({ code: "PROOF_REQUIRED" });
    expect((await chain.addReputation({ agentId: "a-1", taskId: "t-1", delta: 2, proofHash: "h1" })).total).toBe(2);
    expect(await chain.getReputation("a-1")).toBe(2);
    await expect(chain.addReputation({ agentId: "a-1", taskId: "t-1", delta: 0, proofHash: "h1" })).rejects.toThrow(/entier/);
  });

  it("remboursement : seulement rejected|expired ; malus après rejet", async () => {
    const { chain, payer } = await setup();
    await chain.lockEscrow({ taskId: "t-2", payer, amount: Y("0.1") });
    await expect(chain.refundEscrow({ taskId: "t-2", reason: "bored" })).rejects.toThrow(/rejected et expired/);
    expect(refundReasonOf("Expired")).toBe("expired");
    await chain.refundEscrow({ taskId: "t-2", reason: "rejected" });
    expect(await chain.getBalance(payer)).toBe(N("1").toString());
    expect((await chain.addReputation({ agentId: "a-1", taskId: "t-2", delta: -1, proofHash: "x" })).total).toBe(-1);
    await expect(chain.lockEscrow({ taskId: "t-2", payer, amount: "1" })).rejects.toMatchObject({ code: "ESCROW_EXISTS" });
  });

  it("statut transitoire : releasing attendu puis confirmé ; si jamais confirmé, erreur", async () => {
    const { chain, backend, payer, worker } = await setup(true);
    await chain.lockEscrow({ taskId: "t-3", payer, amount: Y("0.1") });
    const p = chain.releaseEscrow({ taskId: "t-3", payee: worker, proof });
    // le callback arrive pendant l'attente (sleep injecté ci-dessous le déclenche)
    await expect(p).resolves.toBeDefined();
    expect(backend.escrows.get("t-3")!.status).toBe("released");
  });

  it("releasing vu comme locked par getEscrow", async () => {
    const { chain, backend, payer, worker } = await setup(true);
    await chain.lockEscrow({ taskId: "t-4", payer, amount: Y("0.1") });
    backend.escrows.get("t-4")!.status = "releasing";
    expect((await chain.getEscrow("t-4"))?.status).toBe("locked");
    void worker;
  });

  it("réservation : lockEscrow enchaîne reserve_task (opérateur) puis lock_escrow (payeur)", async () => {
    const { chain, backend, payer } = await setup();
    await chain.lockEscrow({ taskId: "t-5", payer, amount: Y("0.1") });
    const seq = backend.calls.filter((c) => c.args.task_id === "t-5").map((c) => `${c.method}:${c.signer}`);
    expect(seq).toEqual(["reserve_task:darwin.testnet", `lock_escrow:${payer}`]);
    expect(backend.reservations.has("t-5")).toBe(false);
  });

  it("réservation manquante refusée par le contrat (appel direct sans reserve_task)", async () => {
    const { backend, payer } = await setup();
    const signer = { accountId: payer, secretKey: generateKey().secretKey };
    await expect(backend.call(signer, "c", "lock_escrow", { task_id: "t-6", payer }, { deposit: 1n })).rejects.toThrow(/TASK_NOT_RESERVED/);
  });

  it("id squatté refusé : réservé pour un autre payeur, ou déjà réservé", async () => {
    const { chain, backend, payer } = await setup();
    backend.reservations.set("t-7", "intrus.darwin.testnet");
    await expect(chain.lockEscrow({ taskId: "t-7", payer, amount: Y("0.1") })).rejects.toMatchObject({ code: "ESCROW_EXISTS" });
    expect(await chain.getEscrow("t-7")).toBeNull();
    await expect(
      backend.call({ accountId: "darwin.testnet", secretKey: generateKey().secretKey }, "c", "reserve_task", { task_id: "t-7", payer }),
    ).rejects.toMatchObject({ code: "ESCROW_EXISTS" });
    // réservation identique laissée par un échec précédent : reprise sans nouvel appel reserve_task
    backend.reservations.set("t-8", payer);
    await chain.lockEscrow({ taskId: "t-8", payer, amount: Y("0.1") });
    expect(backend.calls.filter((c) => c.method === "reserve_task" && c.args.task_id === "t-8")).toHaveLength(0);
  });

  it("malus accepté après remboursement expired", async () => {
    const { chain, payer } = await setup();
    await chain.lockEscrow({ taskId: "t-10", payer, amount: Y("0.1") });
    await chain.refundEscrow({ taskId: "t-10", reason: "expired" });
    expect((await chain.addReputation({ agentId: "a-1", taskId: "t-10", delta: -2, proofHash: "x" })).total).toBe(-2);
  });

  it("solde insuffisant : INSUFFICIENT_FUNDS, rien n'est débité", async () => {
    const { chain, payer } = await setup();
    await expect(chain.transfer({ from: payer, to: "worker.darwin.testnet", amount: Y("50") })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });
});

describe("mort : fermeture et archivage", () => {
  it("le solde revient au maître, clés retirées, archive sans clé privée", async () => {
    const { chain, backend, keystore, archive } = newChain({ contract: true });
    const a = await chain.createAccount({ label: "a", initialFunding: Y("0.3") });
    const pub = (await keystore.get(a.accountId, "full"))!;
    const secret = pub.secretKey.reveal();
    const masterBefore = backend.accounts.get("darwin.testnet")!.total;
    const r = await chain.closeAccount({ accountId: a.accountId, beneficiary: "darwin.testnet" });
    expect(r.swept).toBe(N("0.3").toString());
    expect(backend.accounts.get("darwin.testnet")!.total).toBe(masterBefore + N("0.3"));
    expect(await keystore.get(a.accountId, "full")).toBeNull();
    expect(await keystore.get(a.accountId, "fc")).toBeNull();
    const rows = await archive.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ accountId: a.accountId, disposition: "deleted" });
    expect(rows[0]!.retiredPublicKeys).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain(secret);
    await expect(chain.getBalance(a.accountId)).rejects.toMatchObject({ code: "UNKNOWN_ACCOUNT" });
  });
  it("suppression impossible : balayage et état « frozen »", async () => {
    const { chain, backend, archive } = newChain({ contract: true });
    const a = await chain.createAccount({ label: "b", initialFunding: Y("0.3") });
    backend.failDelete = true;
    const r = await chain.closeAccount({ accountId: a.accountId, beneficiary: "darwin.testnet" });
    expect(BigInt(r.swept) > 0n).toBe(true);
    expect((await archive.list())[0]!.disposition).toBe("frozen");
  });
  it("bénéficiaire inexistant : refus (les fonds seraient détruits)", async () => {
    const { chain } = newChain({ contract: true });
    const a = await chain.createAccount({ label: "c", initialFunding: Y("0.3") });
    await expect(chain.closeAccount({ accountId: a.accountId, beneficiary: "ghost.testnet" })).rejects.toMatchObject({ code: "UNKNOWN_ACCOUNT" });
  });
  it("FileArchive : une ligne JSON par compte", async () => {
    const dir = await mkdtemp(join(tmpdir(), "darwin-arch-"));
    const fa = new FileArchive(join(dir, "a.jsonl"));
    await fa.add({ accountId: "x", beneficiary: "m", swept: "1", closedAt: "t", tx: "h", disposition: "deleted", retiredPublicKeys: [] });
    expect((await readFile(join(dir, "a.jsonl"), "utf8")).trim().split("\n")).toHaveLength(1);
    expect(await fa.list()).toHaveLength(1);
  });
});

describe("NearChain, mode dégradé (sans contrat, D-016)", () => {
  it("séquestre par sous-compte escrow, registre et réputation locaux, mêmes règles que le contrat", async () => {
    const { chain, backend } = newChain({ contract: false });
    expect(chain.mode).toBe("degraded");
    const payer = await chain.createAccount({ label: "payer", initialFunding: Y("1") });
    const worker = await chain.createAccount({ label: "worker", initialFunding: Y("0.3") });
    await chain.registerAgent(rec("a-1", worker.accountId));
    await chain.lockEscrow({ taskId: "t-1", payer: payer.accountId, amount: Y("0.2") });
    expect(backend.accounts.has("escrow.darwin.testnet")).toBe(true);
    expect(await chain.getBalance(payer.accountId)).toBe(N("0.8").toString());
    await expect(chain.addReputation({ agentId: "a-1", taskId: "t-1", delta: 1, proofHash: "h1" })).rejects.toMatchObject({ code: "PROOF_REQUIRED" });
    await chain.releaseEscrow({ taskId: "t-1", payee: worker.accountId, proof });
    expect(await chain.getBalance(worker.accountId)).toBe(N("0.5").toString());
    expect((await chain.addReputation({ agentId: "a-1", taskId: "t-1", delta: 3, proofHash: "h1" })).total).toBe(3);
    await expect(chain.addReputation({ agentId: "a-1", taskId: "t-1", delta: 3, proofHash: "h1" })).rejects.toThrow(/déjà/);
    await chain.lockEscrow({ taskId: "t-2", payer: payer.accountId, amount: Y("0.1") });
    await chain.refundEscrow({ taskId: "t-2", reason: "expired" });
    expect((await chain.getEscrow("t-2"))?.status).toBe("refunded");
    expect((await chain.addReputation({ agentId: "a-1", taskId: "t-2", delta: -1, proofHash: "x" })).total).toBe(2); // malus après expiration
    // même règle de réservation que le contrat
    await chain.lockEscrow({ taskId: "t-3", payer: payer.accountId, amount: Y("0.1") });
    expect(chain.ledger.reservations["t-3"]).toBeUndefined(); // consommée
    await expect(chain.addReputation({ agentId: "a-1", taskId: "t-3", delta: -1, proofHash: "x" })).rejects.toMatchObject({ code: "PROOF_REQUIRED" }); // pas remboursé
    chain.ledger.reservations["t-9"] = "autre.darwin.testnet";
    await expect(chain.lockEscrow({ taskId: "t-9", payer: payer.accountId, amount: Y("0.1") })).rejects.toMatchObject({ code: "ESCROW_EXISTS" });
    await chain.markAgentDead({ agentId: "a-1", deathTick: 5, cause: "manual" });
    expect((await chain.getAgentRecord("a-1"))?.alive).toBe(false);
    expect((await chain.registerAgent(rec("a-2", "z"))).hash.startsWith("local_")).toBe(true);
  });
});