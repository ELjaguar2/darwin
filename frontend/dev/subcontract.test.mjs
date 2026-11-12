// L21: SubTracker (display aggregates of agent-to-agent subcontracting) on fabricated events and on the run8 journal.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { SubTracker } from "../subcontract.js";

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
