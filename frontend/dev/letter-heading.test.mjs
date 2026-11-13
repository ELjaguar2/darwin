// L29: letterHeading on real journals and fabricated cases.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { LetterTracker, letterHeading } from "../letters.js";

function load(name) {
  const t = new LetterTracker(); const written = new Map();
  for (const line of fs.readFileSync(new URL(`../../docs/preuves/${name}`, import.meta.url), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    t.ingest(e);
    if (e.type === "letter.written" && e.data?.letter?.toAgentId) written.set(e.data.letter.toAgentId, e.data.letter);
  }
  return { t, written };
}
const WRITTEN = "Letter written (not passed to the child in this run)";
describe.each([["run8-journal.jsonl", 8], ["run9c-journal.jsonl", 10], ["run10-subcontracting-journal.jsonl", 3]])("%s (no letter.received)", (name, n) => {
  it("every child with a letter shows 'written', never 'received'", () => {
    const { t, written } = load(name);
    expect(t.summary().total).toBe(0); expect(written.size).toBe(n);
    for (const [id, l] of written) { const h = letterHeading(id, t, l, "Gaia"); expect(h.kind).toBe("written"); expect(h.title).toBe(WRITTEN); }
  });
});
describe("run11 (3 letter.received)", () => {
  it("shows 'Letter received from <parent>' for a-254411..13", () => {
    const { t, written } = load("run11-letters-journal.jsonl");
    for (const id of ["a-254411", "a-254412", "a-254413"]) {
      expect(t.get(id).status).toBe("received");
      expect(letterHeading(id, t, written.get(id), "Gaia")).toEqual({ kind: "received", title: "Letter received from Gaia" });
    }
  });
});
describe("fabricated", () => {
  const ev = (d) => ({ type: "letter.received", tick: 1, data: d });
  it("empty, fallback, no letter", () => {
    const t = new LetterTracker();
    t.ingest(ev({ childId: "e", length: 0, status: "empty" }));
    t.ingest(ev({ childId: "f", length: 30, excerpt: "x", status: "received", fallback: true }));
    expect(letterHeading("e", t, { text: "x" }, "P").title).toBe("No letter received (empty)");
    expect(letterHeading("f", t, null, "P")).toEqual({ kind: "received", title: "Letter received from P" });
    expect(letterHeading("z", t, null, "P")).toEqual({ kind: null, title: null });
    expect(letterHeading("z", t, { text: "x" }, "").title).toBe(WRITTEN);
    expect(letterHeading("f", t, null, "").title).toBe("Letter received from its parent");
  });
});
