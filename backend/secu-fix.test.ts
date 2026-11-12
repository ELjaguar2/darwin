// Correctifs de la revue sécurité L17 (docs/SECURITE.md §7, constats 2 à 6) : journal hostile, corps de contrôle, mime, masquage.
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

describe("journal hostile (constat 2)", () => {
  it("MAX_REPLAY_BYTES vaut 20 Mo", () => expect(MAX_REPLAY_BYTES).toBe(20 * 1024 * 1024));
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
  ])("refuse %s mal formé au chargement", (type, data) => {
    reject(journal(["sim.started", {}], [type, data]), /ligne 2.*mal formé/);
  });
  it("refuse un nom de fichier à séparateur ou trop long, normalise le mime", () => {
    const ok = (name: unknown, mime: unknown) => journal(["deliverable.produced", { taskId: "t-1", files: [{ name, mime, bytes: 1, content: "x" }] }]);
    reject(ok("../../etc/passwd", "text/plain"), /nom de fichier invalide/);
    reject(ok("a/b.md", "text/plain"), /nom de fichier invalide/);
    reject(ok("a".repeat(65), "text/plain"), /nom de fichier invalide/);
    reject(ok(42, "text/plain"), /nom de fichier invalide/);
    const p = parseReplay(ok("x.md", "text/html"), "h.jsonl");
    expect((p.events[0]!.data as any).files[0].mime).toBe("text/plain");
  });
  it("garde-fou : un événement inexploitable (hors validation) passe le rejeu en ended, sans exception", () => {
    // construit directement, sans parseReplay : simule ce que la validation n'aurait pas vu
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
    expect(st.warning).toMatch(/interrompu.*deliverable\.produced/);
    expect(pending).toBeUndefined();
  });
});

describe("contrôle du rejeu (constats 3 et 4)", () => {
  const app = () => {
    const m = parseReplay(journal(["sim.started", { mode: "mock" }]), "h.jsonl");
    const rt = createReplayRuntime(loadConfig(replayEnv({})), createReplay(m, { autoStart: false }));
    return createApp(rt);
  };
  it("les 4 POST /api/replay/* refusent un corps de plus de 1 Ko (413)", async () => {
    const a = app();
    const big = JSON.stringify({ speed: 2, pad: "x".repeat(2000) });
    for (const n of ["speed", "pause", "resume", "restart"]) {
      const r = await a.request(`/api/replay/${n}`, { method: "POST", headers: { "content-type": "application/json", "content-length": String(big.length) }, body: big });
      expect(r.status).toBe(413);
    }
    const ok = await a.request("/api/replay/speed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ speed: 2 }) });
    expect(ok.status).toBe(200);
  });
  it("locked sans jeton : démarrage refusé ; avec jeton ou ouvert : accepté", () => {
    expect(replayControlError({ DARWIN_REPLAY_CONTROL: "locked" }, undefined)).toMatch(/DARWIN_ADMIN_TOKEN/);
    expect(replayControlError({ DARWIN_REPLAY_CONTROL: " LOCKED " }, undefined)).toMatch(/exige/);
    expect(replayControlError({ DARWIN_REPLAY_CONTROL: "locked" }, "x".repeat(24))).toBeUndefined();
    expect(replayControlError({}, undefined)).toBeUndefined();
  });
  it("ReplayError est bien le type levé (message lisible par le lanceur)", () => {
    expect(new ReplayError("REPLAY_FILE_INVALID", "m")).toBeInstanceOf(Error);
  });
});

describe("mime et noms (constat 5)", () => {
  it("liste blanche avec repli text/plain", () => {
    for (const m of ["text/plain", "text/markdown", "image/svg+xml", "text/vnd.mermaid", "application/json"]) expect(safeMime(m)).toBe(m);
    expect(safeMime("text/html")).toBe("text/plain");
    expect(safeMime("application/javascript")).toBe("text/plain");
    expect(safeMime("TEXT/MARKDOWN; charset=utf-8")).toBe("text/markdown");
    expect(safeMime(undefined)).toBe("text/plain");
  });
  it("noms de fichier", () => {
    expect(isSafeFileName("logo-1.svg")).toBe(true);
    for (const n of ["", "a/b", "a\\b", "..", ".", "A.md", "a b", "x".repeat(65), 3]) expect(isSafeFileName(n)).toBe(false);
  });
});

describe("masquage avant émission (constat 6)", () => {
  const B58 = "5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe6E3AgLr5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe";
  it("clé base58 nue de 64 octets masquée, sans faux positif sur du texte ou un hash", () => {
    const key = B58.slice(0, 88);
    expect(redactText(`ma clé ${key} fin`)).toBe("ma clé [clé masquée] fin");
    expect(redactText("a".repeat(88))).toBe("a".repeat(88)); // pas de mélange majuscule/chiffre
    const h = "1".repeat(44) + "A".repeat(2) + "b";
    expect(redactText(h)).toBe(h);
    expect(redactText("9647d982663bc2493a2ecf562d17837ef7ad1d32b9169bbf704afcedf3ba2110")).toContain("9647d982"); // sha256 hex : 64 caractères
    expect(redactText("Une phrase ordinaire avec des mots et un hash de transaction 6Zr4Tq2ZxqQ9wq3kXr7mYv9o3Jf8kN5pHc1VbA2dEf3G")).toContain("hash de transaction 6Zr4");
  });
  it("redactEvent couvre fichiers, pitch, texte de tâche et messages", () => {
    const secret = "sk-" + "a1B2c3D4e5F6g7H8i9J0k";
    const ev = (type: string, data: any) => { const e = { type, data }; redactEvent(e); return e.data; };
    expect(ev("deliverable.produced", { files: [{ name: "a.md", content: `clé ${secret}` }] }).files[0].content).not.toContain(secret);
    expect(ev("bid.placed", { bid: { pitch: `Bearer abcdefgh12345678` } }).bid.pitch).toBe("Bearer [masqué]");
    const t = ev("task.posted", { task: { title: secret, prompt: `ed25519:${"A".repeat(40)}` } }).task;
    expect(t.title).not.toContain(secret);
    expect(t.prompt).toBe("ed25519:[masqué]");
    expect(ev("system.warning", { message: secret }).message).not.toContain(secret);
    expect(() => redactEvent({ type: "task.posted", data: null as any })).not.toThrow();
    expect(() => redactEvent({ type: "task.posted", data: {} })).not.toThrow();
  });
});
