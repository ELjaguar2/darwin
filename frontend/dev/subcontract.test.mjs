// L21: SubTracker (display aggregates of agent-to-agent subcontracting) on fabricated events and on the run8 journal.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { SubTracker, splitSubcontract } from "../subcontract.js";

const Y = 10n ** 21n;
const mk = (seq, type, data) => ({ seq, tick: seq, type, data });
const fabricated = () => [
  mk(1, "task.posted", { task: { id: "P1", requester: { kind: "simulated" }, profession: "marketing", budget: String(100n * Y) } }),
  mk(2, "task.awarded", { taskId: "P1", winnerId: "a1", price: String(90n * Y) }),
  mk(3, "task.posted", { task: { id: "C1", requester: { kind: "agent", agentId: "a1" }, profession: "translation", budget: String(40n * Y) } }),
  mk(4, "subcontract.created", { parentTaskId: "P1", childTaskId: "C1", byAgentId: "a1" }),
  mk(5, "task.awarded", { taskId: "C1", winnerId: "a2", price: String(35n * Y) }),
  mk(6, "escrow.locked", { taskId: "C1", payer: "a1.x", amount: String(35n * Y), tx: "LOCK1" }),
  mk(7, "escrow.released", { taskId: "C1", payee: "a2.x", amount: String(35n * Y), tx: "REL1" }),
  mk(8, "task.posted", { task: { id: "C2", requester: { kind: "agent", agentId: "a1" }, profession: "logo", budget: String(30n * Y) } }),
  mk(9, "subcontract.created", { parentTaskId: "P1", childTaskId: "C2", byAgentId: "a1", profession: "logo", budget: String(30n * Y), parentPrice: String(90n * Y), commission: String(55n * Y) }),
  mk(10, "task.expired", { taskId: "C2", reason: "no_bids" }),
];

describe("SubTracker", () => {
  it("computes missing optional fields and prefers the ones carried by the event", () => {
    const t = new SubTracker(); for (const e of fabricated()) t.ingest(e);
    const c1 = t.record("C1"), c2 = t.record("C2");
    expect(c1.status).toBe("paid"); expect(c1.commission).toBe(55n * Y); expect(c1.commissionKind).toBe("actual"); expect(c1.price).toBe(35n * Y); expect(c1.budget).toBe(40n * Y); expect(c1.lockTx).toBe("LOCK1"); expect(c1.releaseTx).toBe("REL1");
    expect(c2.status).toBe("expired"); expect(c2.commission).toBe(0n); expect(c2.commissionKind).toBe("none"); expect(c2.price).toBeNull(); expect(c2.expiredReason).toBe("no_bids");
    const s = t.summary();
    expect([s.count, s.awarded, s.paid, s.expired]).toEqual([2, 1, 1, 1]);
    expect(s.delegated).toBe(35n * Y); expect(s.paidTotal).toBe(35n * Y); expect(s.commission).toBe(55n * Y); // real: parent price - escrowed; expired moves nothing
  });
  it("before the award the commission is only an upper bound (parent price - budget)", () => {
    const t = new SubTracker();
    t.ingest(mk(1, "task.posted", { task: { id: "P", requester: { kind: "simulated" }, profession: "marketing", budget: String(100n * Y) } }));
    t.ingest(mk(2, "task.awarded", { taskId: "P", winnerId: "a", price: String(90n * Y) }));
    t.ingest(mk(3, "task.posted", { task: { id: "C", requester: { kind: "agent" }, profession: "logo", budget: String(40n * Y) } }));
    t.ingest(mk(4, "subcontract.created", { parentTaskId: "P", childTaskId: "C", byAgentId: "a" }));
    expect([t.record("C").commission, t.record("C").commissionKind]).toEqual([50n * Y, "max"]);
    expect(t.summary().commission).toBe(0n); // nothing counted until awarded
  });
  it("leaves commission unknown when the parent price is unknown (never invents)", () => {
    const t = new SubTracker();
    t.ingest(mk(1, "task.posted", { task: { id: "C", requester: { kind: "agent" }, profession: "logo", budget: String(10n * Y) } }));
    t.ingest(mk(2, "subcontract.created", { parentTaskId: "UNKNOWN", childTaskId: "C", byAgentId: "a" }));
    expect(t.record("C").commission).toBeNull();
    expect(t.record("C").status).toBe("open");
  });
  it("run8 journal: 11 subcontracts, 3 awarded and paid, 8 expired", () => {
    const f = new URL("../../docs/preuves/run8-journal.jsonl", import.meta.url);
    if (!fs.existsSync(f)) return;
    const t = new SubTracker();
    for (const l of fs.readFileSync(f, "utf8").trim().split("\n")) t.ingest(JSON.parse(l));
    const s = t.summary();
    expect([s.count, s.awarded, s.paid, s.expired]).toEqual([11, 3, 3, 8]);
    expect(String(s.paidTotal)).toBe("14322874130000000000000");
    // independent: commission = parent awarded price - child awarded price, summed over the 3 paid
    expect(String(s.delegated)).toBe(String(s.paidTotal)); // every paid child was escrowed for what it was paid
  });
});

// ---- real subcontracting engine (subcontract.integrated / subcontract.fallback) ----
const base = (child = "C") => [
  mk(1, "task.posted", { task: { id: "P", requester: { kind: "simulated" }, profession: "marketing", budget: String(100n * Y) } }),
  mk(2, "task.awarded", { taskId: "P", winnerId: "a1", price: String(90n * Y) }),
  mk(3, "task.posted", { task: { id: child, requester: { kind: "agent", agentId: "a1" }, profession: "translation", budget: String(40n * Y) } }),
  mk(4, "subcontract.created", { parentTaskId: "P", childTaskId: child, byAgentId: "a1", profession: "translation", budget: String(40n * Y), parentPrice: String(90n * Y), commission: String(50n * Y) }),
];
const run = (evs) => { const t = new SubTracker(); for (const e of evs) t.ingest(e); return t; };

describe("SubTracker: real subcontracting", () => {
  it("created -> integrated: real commission = parentPrice - childPrice, counted in the totals", () => {
    const t = run([...base(),
      mk(5, "task.awarded", { taskId: "C", winnerId: "a2", price: String(30n * Y) }),
      mk(6, "escrow.locked", { taskId: "C", payer: "a1.x", amount: String(30n * Y), tx: "LOCK" }),
      mk(7, "escrow.released", { taskId: "C", payee: "a2.x", amount: String(30n * Y), tx: "REL" }),
      mk(8, "escrow.released", { taskId: "P", payee: "a1.x", amount: String(90n * Y), tx: "PREL" }),
      mk(9, "subcontract.integrated", { parentTaskId: "P", childTaskId: "C", childAgentId: "a2", childProfession: "translation", childPrice: String(30n * Y), parentPrice: String(90n * Y), commission: String(60n * Y) })]);
    const r = t.record("C");
    expect([r.status, r.commission, r.commissionKind, r.price, r.lockTx, r.releaseTx, r.parentReleaseTx]).toEqual(["integrated", 60n * Y, "actual", 30n * Y, "LOCK", "REL", "PREL"]);
    const s = t.summary();
    expect([s.count, s.integrated, s.fallback, s.expired]).toEqual([1, 1, 0, 0]);
    expect([s.paidTotal, s.commission]).toEqual([30n * Y, 60n * Y]);
  });
  it("integrated but parent REJECTED (refunded): child paid, no commission earned", () => {
    const t = run([...base(),
      mk(5, "task.awarded", { taskId: "C", winnerId: "a2", price: String(30n * Y) }),
      mk(7, "escrow.released", { taskId: "C", payee: "a2.x", amount: String(30n * Y), tx: "REL" }),
      mk(9, "subcontract.integrated", { parentTaskId: "P", childTaskId: "C", childAgentId: "a2", childProfession: "translation", childPrice: String(30n * Y), parentPrice: String(90n * Y), commission: String(60n * Y) }),
      mk(10, "escrow.refunded", { taskId: "P", payer: "c", amount: String(90n * Y), tx: "RF" })]);
    const r = t.record("C"), s = t.summary();
    expect([r.commissionKind, r.commission, r.parentRejected]).toEqual(["void", 0n, true]);
    expect([s.integrated, s.paidTotal, s.commission]).toEqual([1, 30n * Y, 0n]);
  });
  it("awarded but not yet integrated (modern log): commission is expected, not summed", () => {
    const t = run([...base("C"), mk(5, "task.awarded", { taskId: "C", winnerId: "a2", price: String(30n * Y) }),
      mk(6, "subcontract.fallback", { parentTaskId: "P", childTaskId: "OTHER", reason: "deadline", commission: "0" })]);
    const r = t.record("C");
    expect([r.commissionKind, r.commission]).toEqual(["expected", 60n * Y]);
    expect(t.summary().commission).toBe(0n);
  });
  for (const reason of ["no_bids", "rejected", "deadline", "failed"]) {
    it(`created -> fallback (${reason}): no commission, counted by reason`, () => {
      const t = run([...base(), ...(reason === "no_bids" ? [mk(5, "task.expired", { taskId: "C", reason: "no_bids" })] : []), mk(6, "subcontract.fallback", { parentTaskId: "P", childTaskId: "C", reason, commission: "0" })]);
      const r = t.record("C");
      expect([r.status, r.fallbackReason, r.commission, r.commissionKind, r.price]).toEqual(["fallback", reason, 0n, "none", null]);
      const s = t.summary();
      expect([s.fallback, s.fallbackByReason[reason], s.integrated, s.commission]).toEqual([1, 1, 0, 0n]);
    });
  }
  it("fallback without a child task still yields a record (keyed by the parent)", () => {
    const t = run([base()[0], base()[1], mk(5, "subcontract.fallback", { parentTaskId: "P", reason: "no_bids", commission: "0" })]);
    const rs = t.records();
    expect(rs.length).toBe(1); expect(rs[0].status).toBe("fallback"); expect(rs[0].byAgentId).toBe("a1"); expect(rs[0].childTaskId).toBeNull();
  });
  it("created -> expired (legacy log, no integrated/fallback): honest expired, nothing counted", () => {
    const t = run([...base(), mk(5, "task.expired", { taskId: "C", reason: "no_bids" })]);
    const r = t.record("C");
    expect([r.status, r.expiredReason, r.commissionKind]).toEqual(["expired", "no_bids", "none"]);
    const s = t.summary();
    expect([s.count, s.expired, s.integrated, s.fallback, s.delegated, s.commission]).toEqual([1, 1, 0, 0, 0n, 0n]);
  });
  it("run10 journal: 5 integrated (3 parents paid, 2 rejected), 1 fallback, real commission 0.0246 + 0.021 + 0.012", () => {
    const f = new URL("../../docs/preuves/run10-subcontracting-journal.jsonl", import.meta.url);
    if (!fs.existsSync(f)) return;
    const t = new SubTracker();
    for (const l of fs.readFileSync(f, "utf8").trim().split("\n")) t.ingest(JSON.parse(l));
    const s = t.summary();
    expect([s.count, s.integrated, s.fallback, s.fallbackByReason.no_bids]).toEqual([6, 5, 1, 1]);
    expect(s.records.filter((r) => r.commissionKind === "actual").length).toBe(3);
    expect(s.records.filter((r) => r.commissionKind === "void").length).toBe(2);
    expect(Number(s.commission) / 1e24).toBeCloseTo(0.0246 + 0.021 + 0.012, 3);
    expect(Number(s.paidTotal) / 1e24).toBeCloseTo(0.12, 3);
  });
  it("run9c journal: only expired subcontracts, no money moved", () => {
    const f = new URL("../../docs/preuves/run9c-journal.jsonl", import.meta.url);
    if (!fs.existsSync(f)) return;
    const t = new SubTracker();
    for (const l of fs.readFileSync(f, "utf8").trim().split("\n")) t.ingest(JSON.parse(l));
    const s = t.summary();
    expect(s.integrated + s.fallback).toBe(0);
    expect([s.count, s.expired, s.awarded, s.paid]).toEqual([18, 18, 0, 0]); // 18 created, all expired (no bidder)
    expect([s.delegated, s.paidTotal, s.commission]).toEqual([0n, 0n, 0n]);
  });
});

describe("splitSubcontract", () => {
  it("isolates the exact '## Subcontracted to <name> (<profession>)' section up to the next heading", () => {
    const p = splitSubcontract("# Report\nintro\n\n## Subcontracted to Ada (Translation)\nFrench text\n\n## Conclusion\nbye");
    expect(p.map((x) => x.kind)).toEqual(["md", "sub", "md"]);
    expect([p[1].name, p[1].profession, p[1].text.trim()]).toEqual(["Ada", "Translation", "French text"]);
    expect(p[2].text).toContain("## Conclusion");
  });
  it("detects the in-house fallback section and ignores near-miss titles", () => {
    const p = splitSubcontract("## Done in-house (subcontract failed: no_bids)\nI did it.");
    expect([p[0].kind, p[0].reason]).toEqual(["inhouse", "no_bids"]);
    expect(splitSubcontract("## subcontracted to Ada (X)\nx").every((x) => x.kind === "md")).toBe(true);
    expect(splitSubcontract("plain").length).toBe(1);
  });
});
