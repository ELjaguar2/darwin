// L17 security review fixes (docs/SECURITE.md §7, findings 2 to 6): hostile journal, control body, mime, masking.
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/index.ts";
import { createApp } from "./app.ts";
import { MAX_REPLAY_BYTES, ReplayError, createReplay, parseReplay, type ParsedReplay } from "./replay.ts";
import { createReplayRuntime } from "./replay-runtime.ts";
import { replayControlError, replayEnv } from "./replay-main.ts";
import { redactEvent, redactText } from "./redact.ts";
import { isSafeFileName, safeMime } from "./safe.ts";

const line = (seq: number, type: string, data: unknown) => JSON.stringify({ seq, ts: new Date(Date.UTC(2026, 10, 10, 22, 0, seq)).toISOString(), tick: 1, type, data });
const journal = (...rows: [string, unknown][]) => rows.map(([t, d], i) => line(i + 1, t, d)).join("\n") + "\n";
const reject = (text: string, re: RegExp) => expect(() => parseReplay(text, "h.jsonl")).toThrow(re);

describe("hostile journal (finding 2)", () => {
  it("MAX_REPLAY_BYTES is 20 MB", () => expect(MAX_REPLAY_BYTES).toBe(20 * 1024 * 1024));
  it.each([
    ["agent.born", {}],
    ["agent.born", { agent: "x" }],
    ["agent.born", { agent: { id: "a-1" } }],
    ["agent.died", {}],
    ["task.posted", {}],
    ["task.posted", { task: { id: "t-1" } }],
    ["bid.placed", { bid: null }],
    ["letter.written", { letter: {} }],
    ["task.awarded", {}],
    ["escrow.released", { amount: "1" }],
    ["deliverable.produced", { taskId: "t-1" }],
    ["deliverable.produced", { taskId: "t-1", files: "nope" }],
    ["deliverable.produced", { taskId: "t-1", files: [null] }],
    ["balance.changed", { balance: "1" }],
  ])("rejects malformed %s at load time", (type, data) => {
    reject(journal(["sim.started", {}], [type, data]), /line 2.*malformed/);
  });
  it("rejects a file name with a separator or too long, normalises the mime", () => {
    const ok = (name: unknown, mime: unknown) => journal(["deliverable.produced", { taskId: "t-1", files: [{ name, mime, bytes: 1, content: "x" }] }]);
    reject(ok("../../etc/passwd", "text/plain"), /invalid file name/);
    reject(ok("a/b.md", "text/plain"), /invalid file name/);
    reject(ok("a".repeat(65), "text/plain"), /invalid file name/);
    reject(ok(42, "text/plain"), /invalid file name/);
    const p = parseReplay(ok("x.md", "text/html"), "h.jsonl");
    expect((p.events[0]!.data as any).files[0].mime).toBe("text/plain");
  });
  it("safeguard: an unusable event (past validation) puts the replay in ended, without an exception", () => {
    // built directly, without parseReplay: simulates what validation would not have seen
    const mk = (seq: number, type: string, data: unknown) => ({ seq, ts: new Date(Date.UTC(2026, 10, 10, 22, 0, seq)).toISOString(), tick: 1, type, data }) as any;
    const parsed: ParsedReplay = {
      events: [mk(1, "sim.started", { mode: "mock" }), mk(2, "deliverable.produced", { taskId: "t-1", files: null }), mk(3, "sim.paused", {})],
      meta: { file: "h.jsonl", events: 3, startedAt: "", endedAt: "", recordedOn: "2026-11-10", originalDurationMs: 0, ticks: 1, skipped: 0, renumbered: false, recorded: {} },
    };
    let pending: (() => void) | undefined;
    const replay = createReplay(parsed, { setTimer: (fn) => { pending = fn; return 1; }, clearTimer: () => { pending = undefined; } });
    const step = () => { const f = pending; pending = undefined; f?.(); };
    step();
    expect(() => step()).not.toThrow();
    const st = replay.status();
    expect(st.phase).toBe("ended");
    expect(st.position).toBe(1);
    expect(st.warning).toMatch(/interrupted.*deliverable\.produced/);
    expect(pending).toBeUndefined();
  });
});

describe("replay control (findings 3 and 4)", () => {
  const app = () => {
    const m = parseReplay(journal(["sim.started", { mode: "mock" }]), "h.jsonl");
    const rt = createReplayRuntime(loadConfig(replayEnv({})), createReplay(m, { autoStart: false }));
    return createApp(rt);
  };
  it("the 4 POST /api/replay/* refuse a body over 1 KB (413)", async () => {
    const a = app();
    const big = JSON.stringify({ speed: 2, pad: "x".repeat(2000) });
    for (const n of ["speed", "pause", "resume", "restart"]) {
      const r = await a.request(`/api/replay/${n}`, { method: "POST", headers: { "content-type": "application/json", "content-length": String(big.length) }, body: big });
      expect(r.status).toBe(413);
    }
    const ok = await a.request("/api/replay/speed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ speed: 2 }) });
    expect(ok.status).toBe(200);
  });
  it("locked without a token: startup refused; with a token or open: accepted", () => {
    expect(replayControlError({ DARWIN_REPLAY_CONTROL: "locked" }, undefined)).toMatch(/DARWIN_ADMIN_TOKEN/);
    expect(replayControlError({ DARWIN_REPLAY_CONTROL: " LOCKED " }, undefined)).toMatch(/requires/);
    expect(replayControlError({ DARWIN_REPLAY_CONTROL: "locked" }, "x".repeat(24))).toBeUndefined();
    expect(replayControlError({}, undefined)).toBeUndefined();
  });
  it("ReplayError is indeed the thrown type (message readable by the launcher)", () => {
    expect(new ReplayError("REPLAY_FILE_INVALID", "m")).toBeInstanceOf(Error);
  });
});

describe("mime and names (finding 5)", () => {
  it("allow-list with text/plain fallback", () => {
    for (const m of ["text/plain", "text/markdown", "image/svg+xml", "text/vnd.mermaid", "application/json"]) expect(safeMime(m)).toBe(m);
    expect(safeMime("text/html")).toBe("text/plain");
    expect(safeMime("application/javascript")).toBe("text/plain");
    expect(safeMime("TEXT/MARKDOWN; charset=utf-8")).toBe("text/markdown");
    expect(safeMime(undefined)).toBe("text/plain");
  });
  it("file names", () => {
    expect(isSafeFileName("logo-1.svg")).toBe(true);
    for (const n of ["", "a/b", "a\\b", "..", ".", "A.md", "a b", "x".repeat(65), 3]) expect(isSafeFileName(n)).toBe(false);
  });
});

describe("masking before emission (finding 6)", () => {
  const B58 = "5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe6E3AgLr5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe";
  it("bare 64-byte base58 key masked, no false positive on text or a hash", () => {
    const key = B58.slice(0, 88);
    expect(redactText(`my key ${key} end`)).toBe("my key [key masked] end");
    expect(redactText("a".repeat(88))).toBe("a".repeat(88)); // no mix of uppercase/numeral
    const h = "1".repeat(44) + "A".repeat(2) + "b";
    expect(redactText(h)).toBe(h);
    expect(redactText("9647d982663bc2493a2ecf562d17837ef7ad1d32b9169bbf704afcedf3ba2110")).toContain("9647d982"); // sha256 hex: 64 characters
    expect(redactText("An ordinary sentence with some words and a transaction hash 6Zr4Tq2ZxqQ9wq3kXr7mYv9o3Jf8kN5pHc1VbA2dEf3G")).toContain("transaction hash 6Zr4");
  });
  it("redactEvent covers files, pitch, task text and messages", () => {
    const secret = ["sk", "a1B2c3D4e5F6g7H8i9J0k"].join("-"); // assembled at runtime: the scanner must not see a dummy key in the tree
    const ev = (type: string, data: any) => { const e = { type, data }; redactEvent(e); return e.data; };
    expect(ev("deliverable.produced", { files: [{ name: "a.md", content: `key ${secret}` }] }).files[0].content).not.toContain(secret);
    expect(ev("bid.placed", { bid: { pitch: `Bearer abcdefgh12345678` } }).bid.pitch).toBe("Bearer [masked]");
    const t = ev("task.posted", { task: { title: secret, prompt: `ed25519:${"A".repeat(40)}` } }).task;
    expect(t.title).not.toContain(secret);
    expect(t.prompt).toBe("ed25519:[masked]");
    expect(ev("system.warning", { message: secret }).message).not.toContain(secret);
    expect(() => redactEvent({ type: "task.posted", data: null as any })).not.toThrow();
    expect(() => redactEvent({ type: "task.posted", data: {} })).not.toThrow();
  });
});
