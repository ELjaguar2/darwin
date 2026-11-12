// Tests of the subcontract proof generator on a tiny synthetic journal (no network).
import { describe, expect, it } from "vitest";
import { analyze, fmtNear, render } from "./subcontract-proof.mjs";

const M = "m.testnet";
const ev = (type, data) => ({ seq: 1, ts: "2026-01-01T00:00:00Z", tick: 1, type, data });
const Y = (n) => (BigInt(n) * 10n ** 21n).toString(); // n/1000 NEAR
const journal = (payer) => [
  ev("agent.born", { agent: { id: "a-1", name: "Ada-1", accountId: `a-1.${M}` } }),
  ev("agent.born", { agent: { id: "a-2", name: "Bob-2", accountId: `a-2.${M}` } }),
  ev("task.posted", { task: { id: "t-p", profession: "legal", requester: { kind: "simulated" } } }),
  ev("subcontract.created", { parentTaskId: "t-p", childTaskId: "t-c", byAgentId: "a-1", profession: "marketing", budget: Y(24), parentPrice: Y(45), commission: Y(21) }),
  ev("escrow.locked", { taskId: "t-c", payer, amount: Y(24), tx: "LOCK" }),
  ev("escrow.released", { taskId: "t-c", payee: `a-2.${M}`, amount: Y(24), tx: "CREL" }),
  ev("subcontract.integrated", { parentTaskId: "t-p", childTaskId: "t-c", childAgentId: "a-2", childProfession: "marketing", childPrice: Y(24), parentPrice: Y(45), commission: Y(21) }),
  ev("task.validated", { taskId: "t-p", validation: { verdict: "accepted", score: 1 } }),
  ev("escrow.released", { taskId: "t-p", payee: `a-1.${M}`, amount: Y(45), tx: "PREL" }),
];

describe("subcontract-proof", () => {
  it("formats NEAR amounts", () => { expect(fmtNear(Y(45))).toBe("0.0450"); });
  it("complete subcontract: payer = delegating agent, all checks pass", () => {
    const rows = analyze(journal(`a-1.${M}`));
    expect(rows).toHaveLength(1);
    expect(rows[0].complete).toBe(true);
    const { markdown, failed } = render(rows);
    expect(failed).toEqual([]);
    expect(markdown).toContain("`LOCK`");
  });
  it("detects a child lock paid by someone else", () => {
    const { failed } = render(analyze(journal(`sim-client.${M}`)));
    expect(failed.join()).toContain("child lock payer");
  });
});
