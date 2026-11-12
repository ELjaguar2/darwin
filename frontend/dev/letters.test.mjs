// L25: LetterTracker (letter.received) on fabricated events and on journals without the event.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { LetterTracker, letterCountText } from "../letters.js";
import { EVENT_TYPES } from "../store.js";

const ev = (seq, data) => ({ seq, tick: seq, type: "letter.received", data });
const run = (evs) => { const t = new LetterTracker(); for (const e of evs) t.ingest(e); return t; };

describe("LetterTracker", () => {
  it("letter.received is a known event type (otherwise the SSE client drops it)", () => { expect(EVENT_TYPES).toContain("letter.received"); });
  it("counts received, empty and fallback letters", () => {
    const t = run([
      ev(1, { childId: "c1", parentId: "p", letterId: "l1", length: 420, excerpt: "My child, ...", status: "received" }),
      ev(2, { childId: "c2", parentId: "p", length: 0, excerpt: "", status: "empty" }),
      ev(3, { childId: "c3", parentId: "p", letterId: "l3", length: 90, excerpt: "Fallback text", status: "received", fallback: true }),
    ]);
    expect(t.summary()).toEqual({ total: 3, nonEmpty: 2, empty: 1, fallback: 1 });
    expect(letterCountText(t.summary())).toBe("Letters received by children: 3 (2 non-empty, 1 empty, 1 fallback)");
    expect(t.get("c2").status).toBe("empty"); expect(t.get("c3").fallback).toBe(true); expect(t.get("c1").letterId).toBe("l1");
  });
  it("is defensive: truncates the excerpt to 160 chars, ignores events without childId, length 0 means empty", () => {
    const t = run([ev(1, { childId: "c", parentId: "p", length: 500, excerpt: "x".repeat(400), status: "received" }), ev(2, { parentId: "p", length: 3, status: "received" }), ev(3, { childId: "z", length: 0 })]);
    expect(t.get("c").excerpt.length).toBe(160);
    expect(t.summary().total).toBe(2); expect(t.get("z").status).toBe("empty");
  });
  it("a later event for the same child replaces the earlier one (no double count)", () => {
    const t = run([ev(1, { childId: "c", length: 0, status: "empty" }), ev(2, { childId: "c", length: 10, excerpt: "hi", status: "received" })]);
    expect(t.summary()).toEqual({ total: 1, nonEmpty: 1, empty: 0, fallback: 0 });
  });
  it("older journals (run 8, 9c, 10) have no letter.received: nothing displayed", () => {
    for (const n of ["run8-journal", "run9c-journal", "run10-subcontracting-journal"]) {
      const f = new URL(`../../docs/preuves/${n}.jsonl`, import.meta.url);
      if (!fs.existsSync(f)) continue;
      const t = new LetterTracker();
      for (const l of fs.readFileSync(f, "utf8").trim().split("\n")) t.ingest(JSON.parse(l));
      expect(t.summary().total).toBe(0);
      expect(letterCountText(t.summary())).toBeNull();
    }
  });
});
