import { describe, expect, it } from "vitest";
import {
  ChainError, MockBrain, MockChain, MOCK_MODELS, PRESETS, costYocto, billableCompletionTokens, createJournal, createRng,
  formatNear, hashObject, loadConfig, parseNear, redactConfig, GenomeSchema,
} from "./index.ts";

const genome = {
  profession: "marketing", model: "mock/small", askRatio: 0.7, risk: 0.5, reproThreshold: 2,
  generosity: 0.2, cooperation: 0.5, personality: "Serious and thrifty.",
} as const;

describe("money", () => {
  it("aller-retour NEAR <-> yocto", () => {
    expect(parseNear("1.5")).toBe(1_500_000_000_000_000_000_000_000n);
    expect(formatNear(parseNear("0.25"))).toBe("0.25");
    expect(() => parseNear("abc")).toThrow();
  });
  it("AI cost: reasoning tokens counted, rounded up", () => {
    const price = { usdPerMTokIn: 1, usdPerMTokOut: 2 };
    const a = costYocto({ promptTokens: 1000, completionTokens: 500, reasoningTokens: 0, totalTokens: 1500 }, price, 2);
    const b = costYocto({ promptTokens: 1000, completionTokens: 500, reasoningTokens: 300, totalTokens: 1800 }, price, 2);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(0n);
  });
  it("billableCompletionTokens : max(completion, total - prompt, reasoning, 0)", () => {
    const base = { promptTokens: 100, completionTokens: 50, reasoningTokens: 0, totalTokens: 150 };
    expect(billableCompletionTokens(base)).toBe(50);
    expect(billableCompletionTokens({ ...base, totalTokens: 400 })).toBe(300);
    // total_tokens absent (0): reasoning alone counts
    expect(billableCompletionTokens({ ...base, totalTokens: 0, reasoningTokens: 120 })).toBe(120);
    expect(billableCompletionTokens({ ...base, totalTokens: Number.NaN })).toBe(50);
    expect(billableCompletionTokens({ promptTokens: 10, completionTokens: 0, reasoningTokens: 0, totalTokens: 0 })).toBe(0);
  });
  it("unknown or invalid price: error, never a silent zero cost", () => {
    const u = { promptTokens: 10, completionTokens: 10, reasoningTokens: 0, totalTokens: 20 };
    expect(() => costYocto(u, undefined as never, 2)).toThrow();
    expect(() => costYocto(u, { usdPerMTokIn: Number.NaN, usdPerMTokOut: 1 }, 2)).toThrow();
  });
});

describe("config", () => {
  it("default = mock without a key", () => {
    const c = loadConfig({});
    expect(c.mode).toBe("mock");
    expect(c.chain).toBe("mock");
    expect(c.brain).toBe("mock");
  });
  it("testnet without an AI key = mock brain; with a key = nearai; secrets masked", () => {
    expect(loadConfig({ DARWIN_MODE: "testnet" }).brain).toBe("mock");
    const c = loadConfig({ DARWIN_MODE: "testnet", NEARAI_API_KEY: "secret-xyz", NEAR_MASTER_PRIVATE_KEY: "ed25519:abc" });
    expect(c.brain).toBe("nearai");
    expect(JSON.stringify(redactConfig(c))).not.toMatch(/secret-xyz|ed25519:abc/);
  });
  it("brain USD caps: absent = undefined, valid = numbers, invalid = error", () => {
    const d = loadConfig({});
    expect(d.nearai.maxUsdPerRun).toBeUndefined();
    expect(d.nearai.maxUsdPerHour).toBeUndefined();
    const c = loadConfig({ NEARAI_MAX_USD_PER_RUN: "5", NEARAI_MAX_USD_PER_HOUR: "0.5" });
    expect(c.nearai.maxUsdPerRun).toBe(5);
    expect(c.nearai.maxUsdPerHour).toBe(0.5);
    expect(() => loadConfig({ NEARAI_MAX_USD_PER_RUN: "0" })).toThrow(/NEARAI_MAX_USD_PER_RUN/);
    expect(() => loadConfig({ NEARAI_MAX_USD_PER_HOUR: "abc" })).toThrow(/NEARAI_MAX_USD_PER_HOUR/);
  });
  it("DARWIN_ALLOWED_HOSTS: normalised list, empty by default", () => {
    expect(loadConfig({}).server.allowedHosts).toEqual([]);
    expect(loadConfig({ DARWIN_ALLOWED_HOSTS: " Demo.Example.org, ,b.test:8080 " }).server.allowedHosts).toEqual(["demo.example.org", "b.test:8080"]);
  });
  it("consistent presets (minVital < capital)", () => {
    for (const m of ["mock", "testnet"] as const)
      for (const p of ["normal", "demo"] as const) expect(PRESETS[m][p].minVital).toBeLessThan(PRESETS[m][p].birthCapital);
  });
});

describe("MockChain", () => {
  it("full cycle: birth, escrow with proof, death; conservation of mass", async () => {
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
    // no credit without a verified proof
    await expect(
      chain.releaseEscrow({ taskId: "t-1", payee: parent.accountId, proof: { resultHash: "", verdict: "rejected" as never, validator: "" } }),
    ).rejects.toMatchObject({ code: "PROOF_REQUIRED" });
    await chain.releaseEscrow({ taskId: "t-1", payee: parent.accountId, proof: { resultHash: "h", verdict: "accepted", validator: "rule:test" } });
    await expect(chain.refundEscrow({ taskId: "t-1", reason: "rejected" })).rejects.toMatchObject({ code: "ESCROW_SETTLED" });
    expect(await chain.getBalance(parent.accountId)).toBe(parseNear("12").toString());

    await chain.markAgentDead({ agentId: "a-0001", deathTick: 9, cause: "starvation" });
    const closed = await chain.closeAccount({ accountId: parent.accountId, beneficiary: chain.masterId });
    expect(closed.swept).toBe(parseNear("12").toString());
    expect((await chain.getAgentRecord("a-0001"))?.alive).toBe(false); // lineage kept
    expect(chain.totalSupply()).toBe(supply);
  });
  it("contract rules: refund reasons, reputation tied to the escrow, one write per (task, agent)", async () => {
    const chain = new MockChain();
    const cap = parseNear("10").toString();
    const a = await chain.createAccount({ label: "a-0001", initialFunding: cap });
    const client = await chain.createAccount({ label: "client", initialFunding: cap });
    await chain.registerAgent({ agentId: "a-0001", accountId: a.accountId, parentId: null, generation: 1, genomeHash: hashObject(genome), genome, birthTick: 0 });
    const amount = parseNear("1").toString();
    const proof = { resultHash: "h1", verdict: "accepted" as const, validator: "rule:test" };
    const rep = (taskId: string, delta: number, proofHash: string) => chain.addReputation({ agentId: "a-0001", taskId, delta, proofHash });

    await chain.lockEscrow({ taskId: "t-1", payer: client.accountId, amount });
    await expect(chain.refundEscrow({ taskId: "t-1", reason: "deadline" })).rejects.toMatchObject({ code: "RPC_ERROR" });
    await expect(rep("t-1", 1, "h1")).rejects.toMatchObject({ code: "PROOF_REQUIRED" }); // not yet released
    await expect(rep("inconnu", 1, "h1")).rejects.toMatchObject({ code: "ESCROW_UNKNOWN" });
    await chain.releaseEscrow({ taskId: "t-1", payee: a.accountId, proof });
    await expect(rep("t-1", 1, "autre")).rejects.toMatchObject({ code: "PROOF_REQUIRED" });
    await expect(rep("t-1", 1.5, "h1")).rejects.toMatchObject({ code: "RPC_ERROR" });
    await expect(rep("t-1", 101, "h1")).rejects.toMatchObject({ code: "RPC_ERROR" });
    await expect(rep("t-1", -1, "h1")).rejects.toMatchObject({ code: "PROOF_REQUIRED" }); // penalty only after a refund
    expect((await rep("t-1", 2, "h1")).total).toBe(2);
    await expect(rep("t-1", 2, "h1")).rejects.toMatchObject({ code: "REPUTATION_EXISTS" });

    await chain.lockEscrow({ taskId: "t-2", payer: client.accountId, amount });
    await chain.refundEscrow({ taskId: "t-2", reason: "expired" });
    await expect(rep("t-2", 1, "h")).rejects.toMatchObject({ code: "PROOF_REQUIRED" });
    expect((await rep("t-2", -1, "h")).total).toBe(1);
    await expect(chain.lockEscrow({ taskId: "t-2", payer: client.accountId, amount })).rejects.toMatchObject({ code: "ESCROW_EXISTS" });
  });
  it("insufficient balance refused", async () => {
    const chain = new MockChain();
    const a = await chain.createAccount({ label: "a", initialFunding: "1" });
    await expect(chain.transfer({ from: a.accountId, to: chain.masterId, amount: "2" })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });
});

describe("MockBrain", () => {
  it("deterministic, usage filled in, unknown model refused", async () => {
    const brain = new MockBrain();
    const req = { agentId: "a-1", purpose: "execute_task", model: MOCK_MODELS[0]!.id, messages: [{ role: "user", content: "Write a haiku." }] } as const;
    const r1 = await brain.complete(req);
    const r2 = await brain.complete(req);
    expect(r1.text).toBe(r2.text);
    expect(r1.mock).toBe(true);
    expect(r1.usage.totalTokens).toBe(r1.usage.promptTokens + r1.usage.completionTokens);
    await expect(brain.complete({ ...req, model: "inconnu" })).rejects.toMatchObject({ code: "UNKNOWN_MODEL" });
  });
});

describe("journal, rng, genome", () => {
  it("journal numbered with no gap, since() replay", () => {
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
