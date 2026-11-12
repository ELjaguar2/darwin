import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FakeNearBackend } from "../accounts/fake-backend.ts";
import { generateKey } from "../accounts/keys.ts";
import { NearAiBrain } from "../brain/index.ts";
import { MarketError, SIMULATED_BADGE, VISITOR_FUNDING_LABEL } from "../market/index.ts";
import { loadConfig, type DarwinEvent } from "../shared/index.ts";
import { MAX_OPEN_TASKS_PER_IP, assertSafeBinding, createApp } from "./app.ts";
import { redactText } from "./redact.ts";
import { RateLimiter } from "./rate-limit.ts";
import { createRuntime, type Runtime } from "./runtime.ts";
import { createStore, loadSavedState, SavedStateError } from "./store.ts";

const tmp: string[] = [];
const mkdtmp = () => {
  const d = mkdtempSync(join(tmpdir(), "darwin-be-"));
  tmp.push(d);
  return d;
};
afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
});

// Fake values assembled at runtime: the secret scanner must see nothing in the repository.
const FAKE = (...p: string[]) => p.join("-");
const F_API = FAKE("sk", "supersecret", "key", "0123456789");
const F_ADMIN = FAKE("tok", "secret", "abcdef", "0123456789");
const F_JWT = FAKE("jwt", "secret", "xyz", "123456");
const F_NEAR = "ed25519" + ":" + "ABCDEFGHIJKLMNOPQRSTUV";
const F_GOOD = FAKE("the", "good", "token", "123", "abcdefghijklmnop");
const TASK = { title: "Tea slogan", prompt: "Write a slogan for an organic tea shop.", profession: "marketing", budgetNear: "1.5", requesterLabel: "Alice" };
const post = (app: ReturnType<typeof createApp>, body: unknown, headers: Record<string, string> = {}) =>
  app.request("/api/tasks", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

async function setup(env: Record<string, string> = {}, appOpts: Parameters<typeof createApp>[1] = {}, ticks = 0) {
  const config = loadConfig({ DARWIN_PRESET: "demo", ...env });
  const rt = createRuntime(config, { autoRun: false });
  await rt.startSim();
  for (let i = 0; i < ticks; i++) await rt.engine.tick();
  const app = createApp(rt, { getIp: () => "1.2.3.4", frontendDir: join(tmpdir(), "darwin-no-frontend"), ...appOpts });
  return { rt, app, config };
}
const json = async (r: Response) => (await r.json()) as any;

describe("reads", () => {
  it("/api/health: mode, escrow, version, brain.kind, no secret", async () => {
    const { app } = await setup({ NEARAI_API_KEY: F_API, DARWIN_ADMIN_TOKEN: F_ADMIN });
    const r = await app.request("/api/health");
    expect(r.status).toBe(200);
    const h = await json(r);
    expect(h).toMatchObject({ ok: true, mode: "mock", brain: { kind: "mock" }, escrow: "operator-account", mock: true, running: true });
    expect(h.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(h.visitors.hourlyCap).toMatch(/^\d+$/);
    expect(JSON.stringify(h)).not.toMatch(/supersecret|tok-secret/);
  });

  it("/api/config exposes no secret nor the raw config", async () => {
    const { app } = await setup({ NEARAI_API_KEY: F_API, DARWIN_ADMIN_TOKEN: F_ADMIN, NEAR_MASTER_PRIVATE_KEY: F_NEAR, INTENTS_JWT: F_JWT });
    const text = await (await app.request("/api/config")).text();
    expect(text).not.toMatch(/supersecret|tok-secret|ABCDEFGHIJ|jwt-secret|adminToken|masterPrivateKey|apiKey|dataDir/);
    expect(JSON.parse(text).mode).toBe("mock");
  });

  it("state, agents, lineage, detail, letters, tasks", async () => {
    const { app, rt } = await setup({}, {}, 120);
    const s = await json(await app.request("/api/state"));
    expect(s.agents.length).toBeGreaterThanOrEqual(4);
    expect(s.lastSeq).toBe(rt.journal.lastSeq);
    expect((await json(await app.request("/api/agents?status=alive"))).agents.every((a: any) => a.status === "alive")).toBe(true);
    const lin = await json(await app.request("/api/lineage"));
    expect(lin.roots.length).toBe(4);
    expect(lin.nodes[0]).toHaveProperty("parentId");
    const child = lin.nodes.find((n: any) => n.parentId);
    expect(child, "at least one birth within 120 ticks").toBeTruthy();
    const d = await json(await app.request(`/api/agents/${child.id}`));
    expect(d.ancestors[0]).toBe(child.parentId);
    const l = await json(await app.request(`/api/agents/${child.id}/letter`));
    expect(l.letter.toAgentId).toBe(child.id);
    expect((await json(await app.request(`/api/letters/${l.letter.id}`))).letter.id).toBe(l.letter.id);
    expect((await app.request("/api/agents/zzz")).status).toBe(404);
    expect((await app.request("/api/agents/a-0001/letter")).status).toBe(404); // fondateur
    const tasks = await json(await app.request("/api/tasks?status=settled&limit=5"));
    expect(tasks.tasks.length).toBeGreaterThan(0);
    expect(tasks.tasks[0].badge).toBe(SIMULATED_BADGE);
    const t = await json(await app.request(`/api/tasks/${tasks.tasks[0].id}`));
    expect(t.bids.length).toBeGreaterThan(0);
    expect(t.escrow.status).toBe("released");
    expect(t.task.validatedBy).toMatch(/^(brain|rule):/);
    const ev = await json(await app.request("/api/events?since=3&limit=2"));
    expect(ev.events.map((e: DarwinEvent) => e.seq)).toEqual([4, 5]);
    expect((await app.request("/api/nope")).status).toBe(404);
  });

  it("mock: chain.tx never duplicated (only the engine emits them)", async () => {
    const { rt } = await setup({}, {}, 60);
    const txs = rt.journal.since(0, 1e6).filter((e) => e.type === "chain.tx");
    expect(txs.length).toBeGreaterThan(0);
    const hashes = txs.map((e) => (e.data as { hash: string }).hash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("security headers and fallback without frontend/", async () => {
    const { app } = await setup();
    const r = await app.request("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(await r.text()).toContain("Darwin");
    expect((await app.request("/.env")).status).toBe(404);
    expect((await app.request("/inconnu.js")).status).toBe(404);
  });
});

describe("POST /api/tasks", () => {
  it("201 + task labelled visitor, then settled by the market", async () => {
    const { app, rt } = await setup();
    const professions = [...new Set(rt.engine.getState().agents.map((x) => x.genome.profession))]; // professions represented among the founders
    const ids: string[] = [];
    for (const profession of professions) {
      const r = await post(app, { ...TASK, profession, budgetNear: "3.5" });
      expect(r.status).toBe(201);
      const t = await json(r);
      expect(t.requester.kind).toBe("visitor");
      expect(t.badge).toBe(VISITOR_FUNDING_LABEL);
      expect(r.headers.get("location")).toBe(`/api/tasks/${t.id}`);
      ids.push(t.id);
    }
    // the market decides alone (bids, validation, payment): at least one visitor task must be settled
    const settled = () => ids.filter((id) => rt.market.getTask(id)?.status === "settled");
    for (let i = 0; i < 25 && settled().length === 0; i++) await rt.engine.tick();
    expect(settled().length).toBeGreaterThan(0);
    const d = await json(await app.request(`/api/tasks/${settled()[0]}`));
    expect(d.task.status).toBe("settled");
    expect(d.task.validatedBy).toMatch(/:/);
    expect(d.escrow.status).toBe("released");
  });

  it("numeric budgetNear accepted", async () => {
    const { app } = await setup();
    expect((await post(app, { ...TASK, budgetNear: 1.5 })).status).toBe(201);
  });

  it("400: invalid JSON, invalid fields, budget out of bounds", async () => {
    const { app } = await setup();
    expect((await post(app, "{not json")).status).toBe(400);
    expect((await post(app, [1])).status).toBe(400);
    const bad = await post(app, { title: "x" });
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.code).toBe("INVALID_INPUT");
    expect((await post(app, { ...TASK, budgetNear: "9999" })).status).toBe(400);
    expect((await post(app, { ...TASK, prompt: "a".repeat(4001) })).status).toBe(400);
  });

  it("415 without JSON, 413 body too large, 403 foreign origin", async () => {
    const { app } = await setup();
    const r = await app.request("/api/tasks", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
    expect(r.status).toBe(415);
    expect((await post(app, "x".repeat(20_000))).status).toBe(413);
    expect((await post(app, TASK, { origin: "http://evil.example" })).status).toBe(403);
  });

  it("429 beyond 10 open tasks per IP, but not for another IP", async () => {
    let ip = "9.9.9.9";
    const { app } = await setup({}, { getIp: () => ip, limits: { postTask: 1000 } });
    for (let i = 0; i < MAX_OPEN_TASKS_PER_IP; i++) expect((await post(app, TASK)).status).toBe(201);
    const r = await post(app, TASK);
    expect(r.status).toBe(429);
    expect((await json(r)).error.code).toBe("TOO_MANY_OPEN_TASKS");
    ip = "8.8.8.8";
    expect((await post(app, TASK)).status).toBe(201);
  });

  it("429 submission rate limit (Retry-After)", async () => {
    const { app } = await setup({}, { limits: { postTask: 2 } });
    await post(app, TASK);
    await post(app, TASK);
    const r = await post(app, TASK);
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("429 hourly cap of the demo account (MarketError VISITOR_CAP_EXCEEDED)", async () => {
    const { app } = await setup({ DARWIN_VISITOR_HOURLY_CAP_NEAR: "2" });
    expect((await post(app, TASK)).status).toBe(201);
    const r = await post(app, TASK);
    expect(r.status).toBe(429);
    expect((await json(r)).error.code).toBe("VISITOR_CAP_EXCEEDED");
    expect(r.headers.get("retry-after")).toBeTruthy();
  });

  it("503 if the simulation is not running", async () => {
    const { app, rt } = await setup();
    await rt.engine.stop();
    const r = await post(app, TASK);
    expect(r.status).toBe(503);
    expect((await json(r)).error.code).toBe("SIM_NOT_RUNNING");
  });

  it("VALIDATION_PENDING = 503 retryable (non-fatal), other market errors = httpStatus, unknown = 500 with no leak", async () => {
    const { rt } = await setup();
    let err: unknown = new MarketError("VALIDATION_PENDING", "juge indisponible");
    const stub = { ...rt, market: { ...rt.market, postVisitorTask: async () => { throw err; } } } as unknown as Runtime;
    const app = createApp(stub, { getIp: () => "5.5.5.5", frontendDir: "/nonexistent", limits: { postTask: 1000 } });
    const r = await post(app, TASK);
    expect(r.status).toBe(503);
    expect(r.headers.get("retry-after")).toBe("5");
    expect((await json(r)).error).toMatchObject({ code: "VALIDATION_PENDING", retryable: true });
    err = new MarketError("UNKNOWN_AGENT", "x");
    expect((await post(app, TASK)).status).toBe(404);
    err = new Error("boom ed25519:ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    const r500 = await post(app, TASK);
    expect(r500.status).toBe(500);
    expect(await r500.text()).not.toMatch(/boom|ABCDEF/);
    // a failed submission does not consume the IP quota
    err = new MarketError("BUDGET_OUT_OF_RANGE", "x");
    for (let i = 0; i < MAX_OPEN_TASKS_PER_IP + 3; i++) expect((await post(app, TASK)).status).toBe(400);
  });
});

describe("administration", () => {
  it("without a configured token (127.0.0.1): pause/resume/stop work, invalid states = 409", async () => {
    const { app } = await setup();
    const p = (x: string) => app.request(`/api/sim/${x}`, { method: "POST" });
    expect((await p("resume")).status).toBe(409);
    expect((await json(await p("pause"))).paused).toBe(true);
    expect((await p("pause")).status).toBe(409);
    expect((await json(await p("resume"))).paused).toBe(false);
    expect((await p("start")).status).toBe(409);
    expect((await p("stop")).status).toBe(200);
    expect((await p("stop")).status).toBe(409);
    expect((await p("start")).status).toBe(409); // not restartable
  });

  it("with a token: 401 without/with a wrong token, 200 with the right one, blocking after repeated failures", async () => {
    const { app } = await setup({ DARWIN_ADMIN_TOKEN: F_GOOD }, { limits: { adminFailures: 3 } });
    const call = (auth?: string) => app.request("/api/sim/pause", { method: "POST", headers: auth ? { authorization: auth } : {} });
    expect((await call()).status).toBe(401);
    expect((await call("Bearer mauvais")).status).toBe(401);
    expect((await call(`Bearer ${F_GOOD}`)).status).toBe(200);
    expect((await call(`Bearer ${F_GOOD}x`)).status).toBe(401);
    expect((await call("Bearer encore-faux")).status).toBe(429);
    expect((await call(`Bearer ${F_GOOD}`)).status).toBe(429); // the IP is blocked for a moment
  });

  it("R7: HOST outside 127.0.0.1 without a token = startup refused", async () => {
    expect(() => assertSafeBinding("0.0.0.0", undefined)).toThrow(/DARWIN_ADMIN_TOKEN/);
    expect(() => assertSafeBinding("0.0.0.0", F_ADMIN)).not.toThrow();
    expect(() => assertSafeBinding("127.0.0.1", undefined)).not.toThrow();
    const config = loadConfig({ HOST: "0.0.0.0" });
    const rt = createRuntime(config, { autoRun: false });
    expect(() => createApp(rt)).toThrow(/mandatory/);
  });
});

describe("anti DNS rebinding and token", () => {
  const at = (host: string, path: string, init: RequestInit = {}) => new Request(`http://${host}${path}`, init);
  it("forged Host refused (read, admin write, submission, SSE, static); local hosts accepted", async () => {
    const { app } = await setup();
    for (const bad of ["evil.example", "evil.example:3000", "127.0.0.1.evil.example", "localhost.evil.example:3000"]) {
      expect((await app.request(at(bad, "/api/health"))).status, bad).toBe(403);
      expect((await app.request(at(bad, "/api/sim/stop", { method: "POST" }))).status, bad).toBe(403);
      expect((await app.request(at(bad, "/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(TASK) }))).status, bad).toBe(403);
      expect((await app.request(at(bad, "/api/stream"))).status, bad).toBe(403);
      expect((await app.request(at(bad, "/"))).status, bad).toBe(403);
    }
    // a forged Origin with the same forged Host does not pass either
    expect((await app.request(at("evil.example", "/api/sim/stop", { method: "POST", headers: { origin: "http://evil.example" } }))).status).toBe(403);
    for (const ok of ["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000", "[::1]:3000", "LOCALHOST:3000"]) {
      expect((await app.request(at(ok, "/api/health"))).status, ok).toBe(200);
    }
  });
  it("DARWIN_ALLOWED_HOSTS adds hosts; configured HOST accepted; * disables", async () => {
    const a = await setup({ DARWIN_ALLOWED_HOSTS: "demo.example.org", PORT: "4000" });
    expect((await a.app.request(at("demo.example.org", "/api/health"))).status).toBe(200);
    expect((await a.app.request(at("demo.example.org:4000", "/api/health"))).status).toBe(200);
    expect((await a.app.request(at("other.example.org", "/api/health"))).status).toBe(403);
    const b = await setup({ HOST: "0.0.0.0", DARWIN_ADMIN_TOKEN: F_ADMIN });
    expect((await b.app.request(at("0.0.0.0", "/api/health"))).status).toBe(403); // network wildcard, not a name
    const c = await setup({ DARWIN_ALLOWED_HOSTS: "*" });
    expect((await c.app.request(at("nimporte.quoi", "/api/health"))).status).toBe(200);
  });
  it("admin token too short: startup refused", async () => {
    expect(() => assertSafeBinding("127.0.0.1", "short")).toThrow(/too short/);
    expect(() => assertSafeBinding("127.0.0.1", "x".repeat(23))).toThrow(/24/);
    expect(() => assertSafeBinding("127.0.0.1", "x".repeat(24))).not.toThrow();
    const rt = createRuntime(loadConfig({ DARWIN_ADMIN_TOKEN: "court" }), { autoRun: false });
    expect(() => createApp(rt)).toThrow(/too short/);
  });
});

describe("flux SSE", () => {
  async function readEvents(res: Response, n: number): Promise<{ raw: string; ids: number[] }> {
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let raw = "";
    while ((raw.match(/^id: /gm) ?? []).length < n) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += dec.decode(value);
    }
    await reader.cancel();
    return { raw, ids: [...raw.matchAll(/^id: (\d+)/gm)].map((m) => Number(m[1])) };
  }

  it("id/event/data, resume via Last-Event-ID and ?since, then live events", async () => {
    const { app, rt } = await setup({}, {}, 3);
    const all = await readEvents(await app.request("/api/stream"), 5);
    expect(all.ids).toEqual([1, 2, 3, 4, 5]);
    expect(all.raw).toMatch(/event: sim\.started\ndata: \{"seq":1,/);
    const resumed = await readEvents(await app.request("/api/stream", { headers: { "last-event-id": "4" } }), 3);
    expect(resumed.ids).toEqual([5, 6, 7]);
    const since = await readEvents(await app.request("/api/stream?since=10"), 2);
    expect(since.ids).toEqual([11, 12]);
    // live: we read to the end of the replay then a new event
    const last = rt.journal.lastSeq;
    const res = await app.request("/api/stream", { headers: { "last-event-id": String(last) } });
    const pending = readEvents(res, 1);
    await new Promise((r) => setTimeout(r, 30));
    rt.journal.emit({ type: "system.warning", data: { code: "T", message: "live" } });
    expect((await pending).ids).toEqual([last + 1]);
  });

  it("Last-Event-ID greater than the journal (restart): reset event then replay from the start", async () => {
    const { app, rt } = await setup();
    const res = await app.request("/api/stream", { headers: { "last-event-id": "99999" } });
    const { raw, ids } = await readEvents(res, 1);
    expect(raw).toMatch(/event: reset\ndata: \{"lastSeq":\d+\}/);
    expect(ids[0]).toBe(1);
    expect(rt.journal.lastSeq).toBeGreaterThan(0);
  });

  it("periodic ping", async () => {
    const { app, rt } = await setup({}, { pingMs: 20 });
    const res = await app.request("/api/stream", { headers: { "last-event-id": String(rt.journal.lastSeq) } });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let raw = "";
    while (!raw.includes(": ping")) raw += dec.decode((await reader.read()).value);
    await reader.cancel();
    expect(raw).toContain(": ping");
  });

  it("stream cap per IP", async () => {
    const { app } = await setup({}, { limits: { streamsPerIp: 1 } });
    const first = await app.request("/api/stream");
    expect((await app.request("/api/stream")).status).toBe(429);
    await first.body!.cancel();
  });
});

describe("persistance", () => {
  it("JSONL journal, state and lineages in data/, previous launch kept as .prev", async () => {
    const dir = mkdtmp();
    const config = loadConfig({ DARWIN_PRESET: "demo" });
    const run = async (ticks: number) => {
      const rt = createRuntime(config, { autoRun: false, store: createStore(dir), snapshotEveryMs: 3_600_000 });
      await rt.startSim();
      for (let i = 0; i < ticks; i++) await rt.engine.tick();
      await rt.shutdown();
      return rt;
    };
    await run(5);
    expect(existsSync(join(dir, "journal.prev.jsonl"))).toBe(false);
    const rt = await run(8);
    expect(existsSync(join(dir, "journal.prev.jsonl"))).toBe(true);
    const lines = readFileSync(join(dir, "journal.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as DarwinEvent);
    expect(lines.length).toBe(rt.journal.lastSeq);
    expect(lines.map((e) => e.seq)).toEqual(lines.map((_, i) => i + 1));
    expect(lines.at(-1)!.type).toBe("sim.stopped");
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    expect(state.lastSeq).toBe(rt.journal.lastSeq);
    const lineage = JSON.parse(readFileSync(join(dir, "lineage.json"), "utf8"));
    expect(lineage.nodes.length).toBe(state.agents.length);
    expect(readFileSync(join(dir, "journal.jsonl"), "utf8")).not.toMatch(/ed25519:|Bearer /);
    expect(loadSavedState(join(dir, "state.json")).agents.length).toBe(state.agents.length); // re-reading a current state: accepted
  });

  it("cleanly rejects a saved state with old professions (writer, coder...)", () => {
    const dir = mkdtmp();
    const old = join(dir, "state.json");
    writeFileSync(old, JSON.stringify({ agents: [{ id: "a-0001", genome: { profession: "writer" } }, { id: "a-0002", genome: { profession: "coder" } }] }));
    expect(() => loadSavedState(old)).toThrow(SavedStateError);
    expect(() => loadSavedState(old)).toThrow(/obsolete professions \[writer, coder\].*logo, finance/);
    writeFileSync(old, "{not json");
    expect(() => loadSavedState(old)).toThrow(/unreadable/);
  });
});

describe("wiring (chain.tx, system.warning, brain caps, testnet)", () => {
  const testnetEnv = (extra: Record<string, string> = {}) => ({
    DARWIN_MODE: "testnet", DARWIN_PRESET: "demo", NEAR_MASTER_ACCOUNT_ID: "darwin.testnet", NEAR_MASTER_PRIVATE_KEY: generateKey().secretKey.reveal(), ...extra,
  });

  it("testnet (fake backend): checkReady, chain.tx via onTx, degraded escrow without a contract, mock brain warning", async () => {
    const backend = new FakeNearBackend("darwin.testnet");
    const config = loadConfig(testnetEnv({ DARWIN_DATA_DIR: mkdtmp() }));
    const rt = createRuntime(config, { autoRun: false, chainExtra: { backend } });
    await expect(rt.checkReady()).resolves.toBeUndefined();
    await rt.startSim();
    await rt.engine.tick();
    const evs = rt.journal.since(0, 1e6);
    expect(evs.some((e) => e.type === "system.warning" && (e.data as { code: string }).code === "BRAIN_NO_KEY")).toBe(true);
    const txs = evs.filter((e) => e.type === "chain.tx");
    expect(txs.length).toBeGreaterThan(0);
    const hashes = txs.map((e) => (e.data as { hash: string }).hash);
    expect(new Set(hashes).size).toBe(hashes.length); // NearChain emits, the engine does not: no duplicate
    const app = createApp(rt, { getIp: () => "1.1.1.1", frontendDir: "/nonexistent" });
    expect((await json(await app.request("/api/health"))).escrow).toBe("operator-account");
    expect((await json(await app.request("/api/health"))).mode).toBe("testnet");
  });

  it("testnet with a configured contract: escrow = contract", async () => {
    const backend = new FakeNearBackend("darwin.testnet");
    const config = loadConfig(testnetEnv({ NEAR_CONTRACT_ID: backend.contractId, DARWIN_DATA_DIR: mkdtmp() }));
    const rt = createRuntime(config, { autoRun: false, chainExtra: { backend } });
    expect(rt.escrowMode()).toBe("contract");
  });

  it("checkReady: master account not found = clear error without a key", async () => {
    const backend = new FakeNearBackend("autre.testnet");
    const config = loadConfig(testnetEnv({ DARWIN_DATA_DIR: mkdtmp() }));
    const rt = createRuntime(config, { autoRun: false, chainExtra: { backend } });
    const e = await rt.checkReady().catch((x: Error) => x);
    expect((e as Error).message).toMatch(/Testnet startup impossible.*darwin\.testnet/);
    expect((e as Error).message).not.toMatch(/ed25519:/);
  });

  it("NEARAI_MAX_USD_PER_RUN/HOUR caps passed to the brain; defaults kept otherwise", async () => {
    const env = { DARWIN_BRAIN: "nearai", NEARAI_API_KEY: FAKE("sk", "test", "key", "0123456789abcdef") };
    const a = createRuntime(loadConfig({ ...env, NEARAI_MAX_USD_PER_RUN: "0.25", NEARAI_MAX_USD_PER_HOUR: "0.1" }), { autoRun: false });
    expect(a.brain).toBeInstanceOf(NearAiBrain);
    expect((a.brain as NearAiBrain).guardrails).toMatchObject({ maxUsdPerRun: 0.25, maxUsdPerHour: 0.1 });
    const b = createRuntime(loadConfig(env), { autoRun: false });
    expect((b.brain as NearAiBrain).guardrails).toMatchObject({ maxUsdPerRun: 8.8, maxUsdPerHour: 1 }); // L11: default = stop cap of the AI budget (8 EUR x 1.10)
  });

  it("brain onWarning -> system.warning (masked)", () => {
    const rt = createRuntime(loadConfig({ DARWIN_BRAIN: "nearai" }), { autoRun: false });
    const w = rt.journal.since(0).find((e) => e.type === "system.warning");
    expect(w?.data).toMatchObject({ code: "BRAIN_NO_KEY" });
  });

  it("journal error messages are masked before any subscriber", async () => {
    const rt = createRuntime(loadConfig({}), { autoRun: false });
    const seen: string[] = [];
    rt.journal.subscribe((e) => seen.push(JSON.stringify(e)));
    rt.journal.emit({ type: "system.error", data: { code: "X", message: "key ed25519:ABCDEFGHIJKLMNOPQRSTUVWXYZ and Bearer abcdefghijklmnop" } });
    expect(seen[0]).not.toMatch(/ABCDEFGH|abcdefghijklmnop/);
  });
});

describe("utilitaires", () => {
  it("redactText", () => {
    expect(redactText("k=ed25519:ABCDEFGHIJKLMNOPQRSTUV")).not.toContain("ABCDEF");
    expect(redactText("Authorization: Bearer abcdefghijkl")).not.toContain("abcdefghijkl");
    expect(redactText(FAKE("sk", "abcdefghijklmnopqrstuv"))).toBe("[key masked]");
    expect(redactText("nothing to mask")).toBe("nothing to mask");
  });
  it("RateLimiter: fixed window", () => {
    let t = 0;
    const l = new RateLimiter(2, 1000, () => t);
    expect(l.hit("a").ok).toBe(true);
    expect(l.hit("a").ok).toBe(true);
    expect(l.hit("a").ok).toBe(false);
    expect(l.hit("b").ok).toBe(true);
    t = 1001;
    expect(l.hit("a").ok).toBe(true);
  });
});
