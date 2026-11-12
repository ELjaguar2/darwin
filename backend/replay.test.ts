import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../shared/index.ts";
import { createApp } from "./app.ts";
import { ReplayError, createReplay, loadReplayFile, parseReplay, parseSpeed } from "./replay.ts";
import { createReplayRuntime } from "./replay-runtime.ts";
import { DEFAULT_REPLAY_FILE, replayEnv } from "./replay-main.ts";

const tmp: string[] = [];
afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
});

const T0 = Date.parse("2026-11-10T22:50:00.000Z");
const ts = (s: number) => new Date(T0 + s * 1000).toISOString();
const agent = (id: string, parentId: string | null = null, gen = 1) => ({
  id, name: `N-${id}`, accountId: `${id}.master.testnet`, generation: gen, parentId, childrenIds: [],
  genome: { profession: "writer", model: "m", askRatio: 1, risk: 0.5, reproThreshold: 2, generosity: 0.1, cooperation: 0.5, personality: "p" },
  status: "alive", birthTick: 0, bornAt: ts(0), birthCapital: "100", balance: "100", earned: "0", spentBrain: "0", reputation: 0, tasksDone: 0,
});
const task = (id: string, kind: "visitor" | "simulated" = "visitor") => ({
  id, requester: { kind, label: kind === "visitor" ? "Visitor" : "Simulated client" }, profession: "writer", title: `Mission ${id}`, prompt: "p", budget: "50",
  status: "posted", createdTick: 1, biddingEndsTick: 2, deadlineTick: 6, bidIds: [],
});
const explorerUrl = "https://testnet.nearblocks.io/txns/HASH1";

/** Small journal: founder, chain tx, complete visitor mission (bid, award, escrow, deliverable, verdict, payment). */
function smallJournal(): string {
  const rows: [number, number, string, unknown][] = [
    [0, 0, "sim.started", { mode: "testnet", preset: "selection", seed: 1, chain: "near", brain: "nearai" }],
    [1, 0, "chain.tx", { kind: "create_account", from: "master.testnet", to: "a-1.master.testnet", amount: "100", hash: "HASH1", explorerUrl }],
    [1, 0, "agent.born", { agent: agent("a-1"), parentId: null, birthTx: "HASH1" }],
    [2, 1, "task.posted", { task: task("t-1") }],
    [3, 1, "task.posted", { task: task("t-2", "simulated") }],
    [4, 1, "bid.placed", { bid: { id: "b-1", taskId: "t-1", agentId: "a-1", price: "40", etaTicks: 1, tick: 1 } }],
    [5, 2, "task.awarded", { taskId: "t-1", bidId: "b-1", winnerId: "a-1", price: "40", bids: 1 }],
    [5, 2, "escrow.locked", { taskId: "t-1", payer: "visiteur.testnet", amount: "40", tx: "TXLOCK" }],
    [6, 2, "deliverable.produced", { taskId: "t-1", profession: "writer", agentId: "a-1", files: [{ name: "texte.md", mime: "text/markdown", bytes: 10 }], productionCostUsd: 0, judgeCostUsd: 0, resultHash: "h" }],
    [6, 2, "task.submitted", { taskId: "t-1", agentId: "a-1", resultHash: "h" }],
    [7, 2, "task.validated", { taskId: "t-1", validation: { verdict: "accepted", score: 0.9, validator: "rule:writer", reason: "ok", resultHash: "h", tick: 2 } }],
    [7, 2, "escrow.released", { taskId: "t-1", payee: "a-1.master.testnet", amount: "40", tx: "TXPAY" }],
    [7, 2, "balance.changed", { agentId: "a-1", balance: "140", delta: "40", reason: "task" }],
    [30, 3, "agent.died", { agentId: "a-1", cause: "starvation", finalBalance: "0", swept: "0" }],
  ];
  return rows.map(([s, tick, type, data], i) => JSON.stringify({ seq: i + 1, ts: ts(s), tick, type, data })).join("\n") + "\n";
}

const writeTmp = (text: string, name = "j.jsonl") => {
  const d = mkdtempSync(join(tmpdir(), "darwin-replay-"));
  tmp.push(d);
  const f = join(d, name);
  writeFileSync(f, text);
  return f;
};

/** Reader with a manual clock: `step()` fires the next event and returns the requested delay. */
function manual(text = smallJournal(), opts: Parameters<typeof createReplay>[1] = {}) {
  const waits: number[] = [];
  let pending: (() => void) | undefined;
  const replay = createReplay(parseReplay(text, "j.jsonl"), {
    ...opts,
    setTimer: (fn, ms) => { waits.push(ms); pending = fn; return Symbol("t"); },
    clearTimer: () => { pending = undefined; },
  });
  const step = (n = 1) => { for (let i = 0; i < n; i++) { const f = pending; pending = undefined; f?.(); } };
  return { replay, waits, step, hasPending: () => pending !== undefined };
}

describe("validation du journal", () => {
  it("reads run8: 1819 events, date read from the journal, no renumbering", () => {
    const { events, meta } = loadReplayFile(DEFAULT_REPLAY_FILE);
    expect(events).toHaveLength(1819);
    expect(meta.recordedOn).toBe("2026-11-10");
    expect(meta.renumbered).toBe(false);
    expect(meta.recorded).toMatchObject({ mode: "testnet", chain: "near", preset: "selection" });
  });
  it("missing file: clear error", () => {
    expect(() => loadReplayFile("/nope/absent.jsonl")).toThrow(/not found/);
    try { loadReplayFile("/nope/absent.jsonl"); } catch (e) { expect((e as ReplayError).code).toBe("REPLAY_FILE_MISSING"); }
  });
  it("empty, broken JSON, missing field, non-increasing ts: rejected with the offending line", () => {
    expect(() => parseReplay("\n\n", "x.jsonl")).toThrow(/empty/);
    expect(() => parseReplay('{"seq":1,"ts":"2026-11-10T00:00:00Z","tick":0,"type":"sim.paused","data":{}}\nnot json\n{"seq":3,"ts":"2026-11-10T00:00:00Z","tick":0,"type":"sim.paused","data":{}}', "x.jsonl")).toThrow(/line 2.*JSON/);
    expect(() => parseReplay('{"seq":1,"ts":"yesterday","tick":0,"type":"sim.paused","data":{}}', "x.jsonl")).toThrow(/line 1.*ts/);
    expect(() => parseReplay('{"seq":1,"ts":"2026-11-10T00:00:00Z","tick":0,"type":"sim.paused"}', "x.jsonl")).toThrow(/data/);
    const back = '{"seq":1,"ts":"2026-11-10T00:00:10Z","tick":0,"type":"sim.paused","data":{}}\n{"seq":2,"ts":"2026-11-10T00:00:05Z","tick":0,"type":"sim.paused","data":{}}';
    expect(() => parseReplay(back, "x.jsonl")).toThrow(/earlier/);
  });
  it("truncated last line tolerated, unknown type skipped, seq renumbered with no gap", () => {
    const l = (seq: number, type: string) => JSON.stringify({ seq, ts: ts(seq), tick: 0, type, data: {} });
    const { events, meta } = parseReplay([l(5, "sim.paused"), l(9, "sim.future"), l(12, "sim.resumed"), '{"seq":13,"ts'].join("\n"), "x.jsonl");
    expect(events.map((e) => e.seq)).toEqual([1, 2]);
    expect(meta).toMatchObject({ skipped: 2, renumbered: true });
  });
  it("valid and invalid speeds", () => {
    expect(parseSpeed("x5")).toBe(5);
    expect(parseSpeed(20)).toBe(20);
    for (const bad of [0, -1, 1000, "abc", NaN, null]) expect(() => parseSpeed(bad)).toThrow(ReplayError);
  });
  it("the replay drops every secret: environment without a key, system messages masked", () => {
    const env = replayEnv({ NEARAI_API_KEY: "x", NEAR_MASTER_PRIVATE_KEY: "y", DARWIN_MODE: "replay", PORT: "1" });
    expect(env).toMatchObject({ DARWIN_MODE: "mock", PORT: "1" });
    expect(env.NEARAI_API_KEY).toBeUndefined();
    expect(env.NEAR_MASTER_PRIVATE_KEY).toBeUndefined();
    const key = "ed25519" + ":" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const line = JSON.stringify({ seq: 1, ts: ts(0), tick: 0, type: "system.warning", data: { code: "X", message: `key ${key}` } });
    const m = manual(line);
    m.step();
    expect(JSON.stringify(m.replay.emitted())).not.toContain("ABCDEFGHIJ");
  });
});

describe("reader: pacing and speeds", () => {
  it("delay = original gap / speed, capped by maxGapMs", () => {
    const x1 = manual(undefined, { speed: 1, maxGapMs: 8000 });
    x1.step(13);
    // original gaps (s): 0,1,1,1,1,1,0,0,0,1,0,0,0,23 -> the last one is capped at 8 s
    expect(x1.waits.slice(0, 6)).toEqual([0, 1000, 0, 1000, 1000, 1000]);
    expect(x1.waits.at(-1)).toBe(8000);
    const x5 = manual(undefined, { speed: 5 });
    x5.step(5);
    expect(x5.waits.slice(0, 4)).toEqual([0, 1000 / 5, 0, 1000 / 5]);
    const x20 = manual(undefined, { speed: 20 });
    x20.step(2);
    expect(x20.waits[1]).toBe(50);
  });
  it("changing speed midway applies to the next event", () => {
    const m = manual(undefined, { speed: 1 });
    m.step(2);
    m.replay.setSpeed(20);
    expect(m.waits.at(-1)).toBe(0); // ev 3: gap 0
    m.step();
    expect(m.waits.at(-1)).toBe(1000 / 20);
    expect(m.replay.status().speed).toBe(20);
    expect(() => m.replay.setSpeed(0)).toThrow(ReplayError);
    expect(m.replay.status().speed).toBe(20);
  });
  it("pause, resume, end of replay, restart and loop", () => {
    const m = manual(undefined, { speed: 1, loop: true, loopPauseMs: 123 });
    m.step(3);
    m.replay.pause();
    expect(m.hasPending()).toBe(false);
    expect(m.replay.status()).toMatchObject({ phase: "paused", position: 3 });
    m.replay.resume();
    m.step(11);
    expect(m.replay.status()).toMatchObject({ phase: "ended", position: 14, total: 14 });
    expect(m.waits.at(-1)).toBe(123); // pause before the loop
    let resets = 0;
    m.replay.journal.subscribeReset(() => resets++);
    m.step(); // the loop restarts
    expect(resets).toBe(1);
    expect(m.replay.status()).toMatchObject({ phase: "playing", position: 0, rounds: 1 });
    m.step(2);
    expect(m.replay.journal.lastSeq).toBe(2);
  });
  it("real-time replay (real timers) at high speed: all events, in order", async () => {
    const replay = createReplay(parseReplay(smallJournal(), "j.jsonl"), { speed: 100, maxGapMs: 50 });
    const seen: number[] = [];
    replay.journal.subscribe((e) => seen.push(e.seq));
    await new Promise<void>((res) => { const t = setInterval(() => { if (replay.status().phase === "ended") { clearInterval(t); res(); } }, 5); });
    expect(seen).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });
  it("the journal is read-only", () => {
    const m = manual();
    expect(() => m.replay.journal.emit({ type: "sim.paused", data: {} })).toThrow(/read-only/);
  });
});

describe("API en mode replay", () => {
  function appFor(opts: { text?: string; steps?: number; env?: Record<string, string>; control?: "open" | "locked" } = {}) {
    const m = manual(opts.text, { speed: 5 });
    m.step(opts.steps ?? 0);
    const config = loadConfig(replayEnv({ ...opts.env }));
    const rt = createReplayRuntime(config, m.replay);
    return { ...m, rt, app: createApp(rt, opts.control ? { replayControl: opts.control } : {}) };
  }
  const json = async (r: Response | Promise<Response>) => (await r).json() as Promise<any>;

  it("exposes replay mode and metadata (date read from the journal) in /api/health and /api/state", async () => {
    const { app } = appFor({ steps: 3 });
    const h = await json(app.request("/api/health"));
    expect(h.mode).toBe("replay");
    expect(h.replay).toMatchObject({ mode: "replay", phase: "playing", speed: 5, position: 3, total: 14 });
    expect(h.replay.meta.recordedOn).toBe("2026-11-10");
    const s = await json(app.request("/api/state"));
    expect(s.mode).toBe("replay");
    expect(s.lastSeq).toBe(3);
    expect(s.replay.meta.file).toBe("j.jsonl");
    expect(JSON.stringify(await json(app.request("/api/config")))).not.toMatch(/PRIVATE|apiKey":"/);
  });

  it("refuses any write: POST /api/tasks and /api/sim/* return 403 REPLAY_READ_ONLY", async () => {
    const { app, replay } = appFor({ steps: 2 });
    const body = JSON.stringify({ title: "Tea slogan", prompt: "Write a slogan for an organic tea shop.", profession: "writer", budgetNear: "1" });
    const r = await app.request("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("REPLAY_READ_ONLY");
    for (const a of ["start", "pause", "resume", "stop"]) expect((await app.request(`/api/sim/${a}`, { method: "POST" })).status).toBe(403);
    const bad = await app.request("/api/tasks", { method: "POST", body: "not json" }); // even an absurd body: refused before validation
    expect(bad.status).toBe(403);
    expect(replay.status().position).toBe(2);
  });

  it("late client: the state reflects exactly the events already emitted, then the stream resumes with no gap", async () => {
    const { app, step, replay } = appFor({ steps: 12 });
    const s = await json(app.request("/api/state"));
    expect(s.lastSeq).toBe(12);
    expect(s.agents).toHaveLength(1);
    expect(s.agents[0]).toMatchObject({ id: "a-1", balance: "100", earned: "40", tasksDone: 1, status: "alive" });
    expect(s.tasks.find((t: any) => t.id === "t-1")).toMatchObject({ status: "settled", winnerId: "a-1", bidIds: ["b-1"], validation: { verdict: "accepted" } });
    expect(s.totals).toMatchObject({ alive: 1, dead: 0, born: 1, tasksSettled: 1 });
    // bids and escrow of the mission
    const t = await json(app.request("/api/tasks/t-1"));
    expect(t.bids).toHaveLength(1);
    expect(t.escrow).toMatchObject({ status: "released", lockTx: "TXLOCK", settleTx: "TXPAY" });
    // stream from lastSeq: sends only the rest
    const ctl = new AbortController();
    const res = await app.request(`/api/stream?since=${s.lastSeq}`, { signal: ctl.signal });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let text = "";
    step(2); // events 13 and 14
    while (!text.includes('"seq":14')) text += dec.decode((await reader.read()).value);
    ctl.abort();
    expect(text).toContain("event: balance.changed");
    expect(text).toContain("event: agent.died");
    expect(text).not.toContain('"seq":12');
    expect(replay.status().position).toBe(14);
  });

  it("the stream keeps explorerUrl of the chain.tx and visitor missions have their full thread", async () => {
    const { app } = appFor({ steps: 14 });
    const ev = await json(app.request("/api/events?since=0&limit=100"));
    expect(ev.events.find((e: any) => e.type === "chain.tx").data.explorerUrl).toBe(explorerUrl);
    const m = await json(app.request("/api/replay/missions"));
    expect(m.missions).toHaveLength(1); // t-2 is a simulated client: not a visitor mission
    const types = m.missions[0].events.map((e: any) => e.type);
    expect(types).toEqual(["task.posted", "bid.placed", "task.awarded", "escrow.locked", "deliverable.produced", "task.submitted", "task.validated", "escrow.released"]);
    expect(m.missions[0]).toMatchObject({ taskId: "t-1", status: "settled" });
    expect(m.missions[0].events[0].data.task.title).toBe("Mission t-1");
  });

  it("playback control: valid/invalid speed, pause, resume; open by default, token required if locked", async () => {
    const { app, replay } = appFor({ steps: 1 });
    const post = (p: string, body?: unknown, h: Record<string, string> = {}) => app.request(p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) });
    expect((await json(post("/api/replay/speed", { speed: 20 }))).speed).toBe(20);
    const bad = await post("/api/replay/speed", { speed: 9999 });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("REPLAY_BAD_SPEED");
    expect((await json(post("/api/replay/pause"))).phase).toBe("paused");
    expect((await json(post("/api/replay/resume"))).phase).toBe("playing");
    expect(replay.status().speed).toBe(20);

    const tok = ["token", "admin", "0123456789", "abcdefghij"].join("-");
    const raw = (a: ReturnType<typeof appFor>, p: string, h: Record<string, string> = {}) => a.app.request(p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: '{"speed":20}' });

    // D-044: by default the control is open, even if DARWIN_ADMIN_TOKEN is set in the environment
    const open = appFor({ steps: 1, env: { DARWIN_ADMIN_TOKEN: tok } });
    expect((await raw(open, "/api/replay/speed")).status).toBe(200);
    expect(open.replay.status().speed).toBe(20);
    expect((await open.app.request("/api/replay/pause", { method: "POST" })).status).toBe(200);
    expect((await open.app.request("/api/replay/resume", { method: "POST" })).status).toBe(200);
    expect((await open.app.request("/api/replay/restart", { method: "POST" })).status).toBe(200);
    // /api/sim/* stays closed in replay
    expect((await open.app.request("/api/sim/stop", { method: "POST" })).status).toBe(403);
    expect((await open.app.request("/api/sim/start", { method: "POST", headers: { authorization: `Bearer ${tok}` } })).status).toBe(403);

    // locked mode: token required
    const locked = appFor({ steps: 1, control: "locked", env: { DARWIN_ADMIN_TOKEN: tok } });
    expect((await raw(locked, "/api/replay/speed")).status).toBe(401);
    expect(locked.replay.status().speed).toBe(5);
    expect((await raw(locked, "/api/replay/speed", { authorization: "Bearer " + tok })).status).toBe(200);
    expect(locked.replay.status().speed).toBe(20);
  });

  it("/classique redirige vers /?classique", async () => {
    const { app } = appFor();
    const r = await app.request("/classique");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/?classique");
  });

  it("fin de rejeu et redémarrage : reset envoyé aux clients connectés, état vidé", async () => {
    const { app, step, replay } = appFor({ steps: 0 });
    const ctl = new AbortController();
    const res = await app.request("/api/stream", { signal: ctl.signal });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    step(14);
    expect(replay.status().phase).toBe("ended");
    let text = "";
    while (!text.includes('"seq":14')) text += dec.decode((await reader.read()).value);
    replay.restart();
    step(1);
    while (!text.includes("event: reset")) text += dec.decode((await reader.read()).value);
    ctl.abort();
    expect(replay.status()).toMatchObject({ phase: "playing", position: 1, rounds: 1 });
    expect((await json(app.request("/api/state"))).lastSeq).toBe(1);
  });

  it("full run8: final state consistent with the journal (12 agents, 7 deaths, 3 generations)", async () => {
    const parsed = loadReplayFile(DEFAULT_REPLAY_FILE);
    const waits: (() => void)[] = [];
    const replay = createReplay(parsed, { setTimer: (fn) => { waits.push(fn); return 0; }, clearTimer: () => {} });
    for (let i = 0; i < parsed.events.length; i++) waits.pop()?.();
    const app = createApp(createReplayRuntime(loadConfig(replayEnv({})), replay));
    const s = await json(app.request("/api/state"));
    expect(s.totals).toMatchObject({ born: 12, dead: 7, alive: 5 });
    expect(s.generations).toBe(3);
    expect(s.lastSeq).toBe(1819);
    expect(s.totals.tasksSettled).toBe(63);
    expect(replay.status().phase).toBe("ended");
  });
});
