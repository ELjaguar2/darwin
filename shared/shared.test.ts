import { describe, expect, it } from "vitest";
import {
  ChainError, MockBrain, MockChain, MOCK_MODELS, PRESETS, costYocto, createJournal, createRng,
  formatNear, hashObject, loadConfig, parseNear, redactConfig, GenomeSchema,
} from "./index.ts";

const genome = {
  profession: "writer", model: "mock/small", askRatio: 0.7, risk: 0.5, reproThreshold: 2,
  generosity: 0.2, cooperation: 0.5, personality: "Sérieux et économe.",
} as const;

describe("money", () => {
  it("aller-retour NEAR <-> yocto", () => {
    expect(parseNear("1.5")).toBe(1_500_000_000_000_000_000_000_000n);
    expect(formatNear(parseNear("0.25"))).toBe("0.25");
    expect(() => parseNear("abc")).toThrow();
  });
  it("coût IA : tokens de raisonnement comptés, arrondi au supérieur", () => {
    const price = { usdPerMTokIn: 1, usdPerMTokOut: 2 };
    const a = costYocto({ promptTokens: 1000, completionTokens: 500, reasoningTokens: 0, totalTokens: 1500 }, price, 2);
    const b = costYocto({ promptTokens: 1000, completionTokens: 500, reasoningTokens: 300, totalTokens: 1800 }, price, 2);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(0n);
  });
});

describe("config", () => {
  it("défaut = mock sans clé", () => {
    const c = loadConfig({});
    expect(c.mode).toBe("mock");
    expect(c.chain).toBe("mock");
    expect(c.brain).toBe("mock");
  });
  it("testnet sans clé IA = cerveau mock ; avec clé = nearai ; secrets masqués", () => {
    expect(loadConfig({ DARWIN_MODE: "testnet" }).brain).toBe("mock");
    const c = loadConfig({ DARWIN_MODE: "testnet", NEARAI_API_KEY: "secret-xyz", NEAR_MASTER_PRIVATE_KEY: "ed25519:abc" });
    expect(c.brain).toBe("nearai");
    expect(JSON.stringify(redactConfig(c))).not.toMatch(/secret-xyz|ed25519:abc/);
  });
  it("presets cohérents (minVital < capital)", () => {
    for (const m of ["mock", "testnet"] as const)
      for (const p of ["normal", "demo"] as const) expect(PRESETS[m][p].minVital).toBeLessThan(PRESETS[m][p].birthCapital);
  });
});

describe("MockChain", () => {
  it("cycle complet : naissance, séquestre avec preuve, mort ; conservation de la masse", async () => {
    const chain = new MockChain();
    const supply = chain.totalSupply();
    const cap = parseNear("10").toString();

    const parent = await chain.createAccount({ label: "a-0001", initialFunding: cap });
    const client = await chain.createAccount({ label: "client", initialFunding: cap });
    await chain.registerAgent({
      agentId: "a-0001", accountId: parent.accountId, parentId: null, generation: 1,
      genomeHash: hashObject(genome), genome, birthTick: 0,
    });
    expect((await chain.getAgentRecord("a-0001"))?.alive).toBe(true);

    const budget = parseNear("2").toString();
    await chain.lockEscrow({ taskId: "t-1", payer: client.accountId, amount: budget });
    // pas de crédit sans preuve vérifiée
    await expect(
      chain.releaseEscrow({ taskId: "t-1", payee: parent.accountId, proof: { resultHash: "", verdict: "rejected" as never, validator: "" } }),
    ).rejects.toMatchObject({ code: "PROOF_REQUIRED" });
    await chain.releaseEscrow({ taskId: "t-1", payee: parent.accountId, proof: { resultHash: "h", verdict: "accepted", validator: "rule:test" } });
    await expect(chain.refundEscrow({ taskId: "t-1", reason: "x" })).rejects.toBeInstanceOf(ChainError);
    expect(await chain.getBalance(parent.accountId)).toBe(parseNear("12").toString());

    await chain.markAgentDead({ agentId: "a-0001", deathTick: 9, cause: "starvation" });
    const closed = await chain.closeAccount({ accountId: parent.accountId, beneficiary: chain.masterId });
    expect(closed.swept).toBe(parseNear("12").toString());
    expect((await chain.getAgentRecord("a-0001"))?.alive).toBe(false); // lignée conservée
    expect(chain.totalSupply()).toBe(supply);
  });
  it("solde insuffisant refusé", async () => {
    const chain = new MockChain();
    const a = await chain.createAccount({ label: "a", initialFunding: "1" });
    await expect(chain.transfer({ from: a.accountId, to: chain.masterId, amount: "2" })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });
});

describe("MockBrain", () => {
  it("déterministe, usage renseigné, modèle inconnu refusé", async () => {
    const brain = new MockBrain();
    const req = { agentId: "a-1", purpose: "execute_task", model: MOCK_MODELS[0]!.id, messages: [{ role: "user", content: "Écris un haïku." }] } as const;
    const r1 = await brain.complete(req);
    const r2 = await brain.complete(req);
    expect(r1.text).toBe(r2.text);
    expect(r1.mock).toBe(true);
    expect(r1.usage.totalTokens).toBe(r1.usage.promptTokens + r1.usage.completionTokens);
    await expect(brain.complete({ ...req, model: "inconnu" })).rejects.toMatchObject({ code: "UNKNOWN_MODEL" });
  });
});

describe("journal, rng, génome", () => {
  it("journal numéroté sans trou, rejeu since()", () => {
    const j = createJournal();
    const seen: number[] = [];
    j.subscribe((e) => seen.push(e.seq));
    j.emit({ type: "sim.paused", data: {} });
    j.setTick(5);
    const e = j.emit({ type: "system.warning", data: { code: "X", message: "m" } });
    expect(e.tick).toBe(5);
    expect(seen).toEqual([1, 2]);
    expect(j.since(1).map((x) => x.seq)).toEqual([2]);
  });
  it("rng reproductible", () => {
    const a = createRng(7), b = createRng(7);
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });
  it("GenomeSchema valide / rejette", () => {
    expect(GenomeSchema.safeParse(genome).success).toBe(true);
    expect(GenomeSchema.safeParse({ ...genome, askRatio: 5 }).success).toBe(false);
  });
});
