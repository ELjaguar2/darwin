// Letters received by children (L25): pure display aggregates from `letter.received` events. No DOM.
// data = { childId, parentId, letterId?, length, excerpt (<= 160 chars), status: "received" | "empty", fallback? }.
// Journals recorded before L25 have no such event: nothing is displayed for them.
export class LetterTracker {
  constructor() { this.reset(); }
  reset() { this.byChild = new Map(); }
  ingest(ev) {
    if (ev?.type !== "letter.received") return;
    const d = ev.data ?? {};
    if (typeof d.childId !== "string" || !d.childId) return;
    const length = Number.isFinite(Number(d.length)) ? Math.max(0, Number(d.length)) : 0;
    const status = d.status === "empty" || length === 0 && d.status !== "received" ? "empty" : "received";
    this.byChild.set(d.childId, {
      childId: d.childId, parentId: typeof d.parentId === "string" ? d.parentId : null, letterId: typeof d.letterId === "string" ? d.letterId : null,
      length, excerpt: typeof d.excerpt === "string" ? d.excerpt.slice(0, 160) : "", status, fallback: d.fallback === true, tick: ev.tick ?? 0,
    });
  }
  get(childId) { return this.byChild.get(childId) ?? null; }
  summary() {
    const all = [...this.byChild.values()];
    return { total: all.length, nonEmpty: all.filter((r) => r.status === "received").length, empty: all.filter((r) => r.status === "empty").length, fallback: all.filter((r) => r.fallback).length };
  }
}
export const letterReceipts = new LetterTracker();

/** L29: pure decision of the title of the letter section in a child's Lineage panel.
 *  "Received" is claimed only if the log holds a letter.received for this child; a letter.written alone is "written, not passed".
 *  Returns { kind: "received" | "empty" | "written" | null, title }. */
export function letterHeading(childId, tracker, writtenLetter, parentName) {
  const rc = tracker?.get?.(childId) ?? null;
  if (rc?.status === "empty") return { kind: "empty", title: "No letter received (empty)" };
  if (rc) return { kind: "received", title: `Letter received from ${parentName || "its parent"}` };
  if (writtenLetter) return { kind: "written", title: "Letter written (not passed to the child in this run)" };
  return { kind: null, title: null };
}

/** "Letters received by children: N (M non-empty, E empty, F fallback)", null when the log has no letter.received. */
export function letterCountText(s) {
  return s.total ? `Letters received by children: ${s.total} (${s.nonEmpty} non-empty, ${s.empty} empty, ${s.fallback} fallback)` : null;
}
