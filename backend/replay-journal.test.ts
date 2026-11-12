// Lot L18: the journal carries the bid pitch (`bid.placed.data.bid.pitch`) and the deliverable content (`deliverable.produced.data.files[].content`).
// Replay must serve them; old journals (run5 to run9b) without these fields must keep replaying.
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/index.ts";
import { createApp } from "./app.ts";
import { createReplay, parseReplay } from "./replay.ts";
import { createReplayRuntime } from "./replay-runtime.ts";
import { replayEnv } from "./replay-main.ts";

const T0 = Date.parse("2026-11-12T10:00:00.000Z");
const ts = (s: number) => new Date(T0 + s * 1000).toISOString();
const agent = {
  id: "a-1", name: "N-a-1", accountId: "a-1.master.testnet", generation: 1, parentId: null, childrenIds: [],
  genome: { profession: "writer", model: "m", askRatio: 1, risk: 0.5, reproThreshold: 2, generosity: 0.1, cooperation: 0.5, personality: "p" },
  status: "alive", birthTick: 0, bornAt: ts(0), birthCapital: "100", balance: "100", earned: "0", spentBrain: "0", reputation: 0, tasksDone: 0,
};
const task = {
  id: "t-1", requester: { kind: "visitor", label: "Visiteur" }, profession: "writer", title: "Mission t-1", prompt: "p", budget: "50",
  status: "posted", createdTick: 1, biddingEndsTick: 2, deadlineTick: 6, bidIds: [],
};
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
const PITCH = "I deliver a clean, proofread text, without inventing anything.";
const texte = { name: "texte.md", mime: "text/markdown", bytes: 23, content: "# Titre\n\nUn paragraphe." };

/** Complete visitor mission; `bid` and `files` are what run 9c will write (or, without them, what the old runs wrote). */
function journal(opts: { pitch?: string; files: unknown[] }): string {
  const bid = { id: "b-1", taskId: "t-1", agentId: "a-1", price: "40", etaTicks: 1, tick: 1, ...(opts.pitch ? { pitch: opts.pitch } : {}) };
  const rows: [number, string, unknown][] = [
    [0, "agent.born", { agent, parentId: null }],
    [1, "task.posted", { task }],
    [2, "bid.placed", { bid }],
    [3, "task.awarded", { taskId: "t-1", bidId: "b-1", winnerId: "a-1", price: "40", bids: 1 }],
    [3, "escrow.locked", { taskId: "t-1", payer: "visiteur.testnet", amount: "40", tx: "TXLOCK" }],
    [4, "task.submitted", { taskId: "t-1", agentId: "a-1", resultHash: "h" }],
    [5, "task.validated", { taskId: "t-1", validation: { verdict: "accepted", score: 0.9, validator: "rule:writer", reason: "ok", resultHash: "h", tick: 2 } }],
    // real market order: the deliverable is journalled right after validation
    [5, "deliverable.produced", { taskId: "t-1", profession: "writer", agentId: "a-1", files: opts.files, productionCostUsd: 0, judgeCostUsd: 0, resultHash: "h" }],
    [5, "escrow.released", { taskId: "t-1", payee: "a-1.master.testnet", amount: "40", tx: "TXPAY" }],
  ];
  return rows.map(([s, type, data], i) => JSON.stringify({ seq: i + 1, ts: ts(s), tick: s, type, data })).join("\n") + "\n";
}

function appOf(text: string) {
  // manual clock: everything is replayed at once through the captured timer
  const fns: (() => void)[] = [];
  const r = createReplay(parseReplay(text, "j.jsonl"), { speed: 5, setTimer: (fn) => { fns.push(fn); return 0; }, clearTimer: () => {} });
  for (let i = 0; i < 9; i++) fns.pop()?.();
  return createApp(createReplayRuntime(loadConfig(replayEnv({})), r));
}
const json = async (r: Response | Promise<Response>) => (await r).json() as Promise<any>;

describe("enriched journal (L18): bid pitch and deliverable content", () => {
  it("the pitch is replayed in /api/replay/missions, /api/tasks/:id and /api/events", async () => {
    const app = appOf(journal({ pitch: PITCH, files: [texte] }));
    const m = await json(app.request("/api/replay/missions"));
    expect(m.missions[0].events.find((e: any) => e.type === "bid.placed").data.bid.pitch).toBe(PITCH);
    expect((await json(app.request("/api/tasks/t-1"))).bids[0].pitch).toBe(PITCH);
    expect((await json(app.request("/api/events?since=0&limit=100"))).events.find((e: any) => e.type === "bid.placed").data.bid.pitch).toBe(PITCH);
  });

  it("GET /api/tasks/:id/deliverable serves files[].content in replay (text, SVG, truncated flag)", async () => {
    const app = appOf(journal({ files: [texte, { name: "logo-1.svg", mime: "image/svg+xml", bytes: 90000, content: SVG, truncated: true }] }));
    const r = await app.request("/api/tasks/t-1/deliverable");
    expect(r.status).toBe(200);
    const d = await r.json() as any;
    expect(d).toMatchObject({ taskId: "t-1", agentId: "a-1", verdict: "accepted", score: 0.9 });
    expect(d.files).toEqual([{ name: "texte.md", mime: "text/markdown", content: texte.content }, { name: "logo-1.svg", mime: "image/svg+xml", content: SVG, truncated: true }]);
    expect(d.rawText).toBeUndefined();
    const f = await app.request("/api/tasks/t-1/deliverable/texte.md");
    expect(f.status).toBe(200);
    expect(f.headers.get("content-type")).toContain("text/markdown");
    expect(await f.text()).toBe(texte.content);
  });

  it("/api/state and /api/tasks do not carry the contents; /api/events (like the stream) does", async () => {
    const app = appOf(journal({ pitch: PITCH, files: [texte] }));
    for (const path of ["/api/state", "/api/tasks"]) expect(await (await app.request(path)).text()).not.toContain("Un paragraphe");
    expect(await (await app.request("/api/events?since=0&limit=100")).text()).toContain("Un paragraphe");
  });

  it("backward compatibility: without pitch or content (run5 to run9b) the journal replays; the deliverable stays 404", async () => {
    const app = appOf(journal({ files: [{ name: "texte.md", mime: "text/markdown", bytes: 23 }] }));
    const m = await json(app.request("/api/replay/missions"));
    expect(m.missions[0].events.find((e: any) => e.type === "bid.placed").data.bid.pitch).toBeUndefined();
    expect(m.missions[0].status).toBe("settled");
    expect((await app.request("/api/tasks/t-1/deliverable")).status).toBe(404);
  });

  it("files where just one lacks content: no deliverable served (all or nothing)", async () => {
    const app = appOf(journal({ files: [texte, { name: "b.md", mime: "text/markdown", bytes: 3 }] }));
    expect((await app.request("/api/tasks/t-1/deliverable")).status).toBe(404);
  });
});
