// L21: checks the SubTracker aggregates against an independent computation on a journal (default: docs/preuves/run8-journal.jsonl).
import fs from "node:fs";
import { SubTracker } from "../subcontract.js";
const file = process.argv[2] ?? "docs/preuves/run8-journal.jsonl";
const L = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const t = new SubTracker(); for (const e of L) t.ingest(e);
const s = t.summary();
// independent: straight scan, no shared code
const created = L.filter((e) => e.type === "subcontract.created").map((e) => e.data);
const posted = Object.fromEntries(L.filter((e) => e.type === "task.posted").map((e) => [e.data.task.id, e.data.task]));
const awarded = Object.fromEntries(L.filter((e) => e.type === "task.awarded").map((e) => [e.data.taskId, e.data]));
const rel = Object.fromEntries(L.filter((e) => e.type === "escrow.released").map((e) => [e.data.taskId, e.data]));
const exp = new Set(L.filter((e) => e.type === "task.expired").map((e) => e.data.taskId));
const lock = Object.fromEntries(L.filter((e) => e.type === "escrow.locked").map((e) => [e.data.taskId, e.data]));
const refundedParents = new Set(L.filter((e) => e.type === "escrow.refunded").map((e) => e.data.taskId));
let delegated = 0n, paidTotal = 0n, commission = 0n, nPaid = 0, nAw = 0, nExp = 0;
for (const c of created) {
  // real commission = parent awarded price - amount escrowed for the child (awarded price); expired: no money moved
  const aw = awarded[c.childTaskId];
  if (aw) nAw++;
  if (rel[c.childTaskId]) {
    nPaid++; paidTotal += BigInt(rel[c.childTaskId].amount);
    const escrowed = BigInt((lock[c.childTaskId] ?? aw).amount ?? aw.price);
    delegated += escrowed;
    if (!refundedParents.has(c.parentTaskId)) commission += BigInt(c.parentPrice ?? awarded[c.parentTaskId].price) - escrowed; // a rejected (refunded) parent earns no commission
  } else if (exp.has(c.childTaskId)) nExp++;
}
const mine = { count: s.count, awarded: s.awarded, paid: s.paid, expired: s.expired, delegated: String(s.delegated), paidTotal: String(s.paidTotal), commission: String(s.commission) };
const ref = { count: created.length, awarded: nAw, paid: nPaid, expired: nExp, delegated: String(delegated), paidTotal: String(paidTotal), commission: String(commission) };
console.log("tracker :", JSON.stringify(mine)); console.log("indep.  :", JSON.stringify(ref));
const near = (v) => (Number(v) / 1e24).toFixed(4);
console.log("NEAR    : delegated", near(delegated), "paid", near(paidTotal), "commission", near(commission));
for (const r of s.records) console.log(r.childTaskId, r.status, r.profession, "budget", near(r.budget ?? 0n), "escrowed", r.price != null ? near(r.price) : "-", "commission", r.commission != null ? near(r.commission) + "(" + r.commissionKind + ")" : "-", "paid", r.paidAmount != null ? near(r.paidAmount) : "-");
const okk = JSON.stringify(mine) === JSON.stringify(ref);
console.log(okk ? "MATCH" : "MISMATCH"); process.exit(okk ? 0 : 1);
