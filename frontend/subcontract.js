// Agent-to-agent subcontracting (L21): pure display aggregates computed from the received log. No DOM, no business rule.
// Events: `subcontract.created` (optional profession/budget/parentPrice/commission), `subcontract.integrated` (real commission = parentPrice - childPrice),
// `subcontract.fallback` (the parent did the work itself, commission 0). Older journals (run 8 / 9c) have only `created`: then
// budget = task.posted(child).budget, parentPrice = task.awarded(parent).price, and once the child is awarded the commission is
// parentPrice - escrowed child amount ("actual"); before the award it is only an upper bound ("max", parentPrice - budget).
const B = (v) => { try { return v == null || v === "" ? null : BigInt(v); } catch { return null; } };

export const FALLBACK_REASON = { no_bids: "no bidder", rejected: "sub-task rejected", deadline: "deadline passed", failed: "sub-task failed" };

export class SubTracker {
  constructor() { this.reset(); }
  reset() {
    this.tasks = new Map(); // taskId -> {profession, budget, requesterKind, title, requesterAgentId}
    this.awards = new Map(); // taskId -> {price, winnerId}
    this.locks = new Map(); // taskId -> {payer, amount, tx}
    this.releases = new Map(); // taskId -> {payee, amount, tx}
    this.ends = new Map(); // taskId -> "expired:<reason>" | "refunded"
    this.subs = new Map(); // child key (task id, or "fb:<parent>" when no child exists) -> {parentTaskId, childTaskId, byAgentId, tick, opt}
    this.integrated = new Map(); // child key -> integrated event data
    this.fallbacks = new Map(); // child key -> {reason, parentTaskId}
    this.modern = false; // the log carries integrated / fallback events (real subcontracting engine)
  }
  keyFor(parentTaskId, childTaskId) {
    if (childTaskId) return childTaskId;
    for (const s of this.subs.values()) if (s.parentTaskId === parentTaskId) return s.childTaskId ?? `fb:${parentTaskId}`;
    return `fb:${parentTaskId}`;
  }
  ingest(ev) {
    const d = ev?.data ?? {};
    switch (ev?.type) {
      case "task.posted": if (d.task?.id) this.tasks.set(d.task.id, { profession: d.task.profession, budget: B(d.task.budget), requesterKind: d.task.requester?.kind, requesterAgentId: d.task.requester?.agentId, title: d.task.title }); break;
      case "task.awarded": this.awards.set(d.taskId, { price: B(d.price), winnerId: d.winnerId }); break;
      case "escrow.locked": this.locks.set(d.taskId, { payer: d.payer, amount: B(d.amount), tx: d.tx }); break;
      case "escrow.released": this.releases.set(d.taskId, { payee: d.payee, amount: B(d.amount), tx: d.tx }); break;
      case "escrow.refunded": this.ends.set(d.taskId, "refunded"); break;
      case "task.expired": if (!this.ends.has(d.taskId)) this.ends.set(d.taskId, `expired:${d.reason ?? ""}`); break;
      case "subcontract.created":
        if (d.childTaskId) this.subs.set(d.childTaskId, { parentTaskId: d.parentTaskId, childTaskId: d.childTaskId, byAgentId: d.byAgentId, tick: ev.tick ?? 0, opt: { profession: d.profession, budget: B(d.budget), parentPrice: B(d.parentPrice), commission: B(d.commission) } });
        break;
      case "subcontract.integrated": {
        this.modern = true;
        const k = this.keyFor(d.parentTaskId, d.childTaskId);
        this.integrated.set(k, { childAgentId: d.childAgentId, childProfession: d.childProfession, childPrice: B(d.childPrice), parentPrice: B(d.parentPrice), commission: B(d.commission), tick: ev.tick ?? 0 });
        break;
      }
      case "subcontract.fallback": {
        this.modern = true;
        const k = this.keyFor(d.parentTaskId, d.childTaskId);
        if (!this.subs.has(k)) this.subs.set(k, { parentTaskId: d.parentTaskId, childTaskId: null, byAgentId: this.awards.get(d.parentTaskId)?.winnerId ?? null, tick: ev.tick ?? 0, opt: {} });
        this.fallbacks.set(k, { reason: d.reason, parentTaskId: d.parentTaskId });
        break;
      }
      default: break;
    }
  }
  isChild(taskId) { return this.subs.has(taskId); }
  parentOf(taskId) { return this.subs.get(taskId)?.parentTaskId ?? null; }
  childrenOf(taskId) { return [...this.subs.values()].filter((s) => s.parentTaskId === taskId && s.childTaskId).map((s) => s.childTaskId); }
  /** Record of a subcontract (by child task id), with derived fields (null when unknown). */
  record(key) {
    const s = this.subs.get(key);
    if (!s) return null;
    const cid = s.childTaskId;
    const child = cid ? this.tasks.get(cid) : null, award = cid ? this.awards.get(cid) : null, lock = cid ? this.locks.get(cid) : null, rel = cid ? this.releases.get(cid) : null, end = cid ? this.ends.get(cid) : null;
    const integ = this.integrated.get(key) ?? null, fb = this.fallbacks.get(key) ?? null;
    const budget = s.opt.budget ?? child?.budget ?? null;
    const parentPrice = integ?.parentPrice ?? s.opt.parentPrice ?? this.awards.get(s.parentTaskId)?.price ?? null;
    const childStatus = rel ? "paid" : end === "refunded" ? "refunded" : end ? "expired" : award ? "awarded" : "open";
    const status = integ ? "integrated" : fb ? "fallback" : childStatus;
    const dead = childStatus === "expired" || childStatus === "refunded";
    // amount actually escrowed for the child (can be below the budget): integrated price, else escrow.locked.amount, else awarded price, else released amount
    const price = integ?.childPrice ?? (dead || fb ? null : (lock?.amount ?? award?.price ?? rel?.amount ?? null));
    let commission = null, commissionKind = "unknown";
    // the commission is earned only when the PARENT mission is paid; a rejected (refunded) parent earns nothing although the child was paid
    const parentRefunded = this.ends.get(s.parentTaskId) === "refunded", parentPaid = this.releases.has(s.parentTaskId);
    if (integ && integ.commission != null) {
      if (parentRefunded) { commission = 0n; commissionKind = "void"; }
      else { commission = integ.commission; commissionKind = parentPaid ? "actual" : "expected"; }
    }
    else if (fb || dead) { commission = 0n; commissionKind = "none"; }
    else if (price != null && parentPrice != null && parentPrice >= price) { commission = parentPrice - price; commissionKind = this.modern ? "expected" : "actual"; }
    else if (childStatus === "open") {
      commission = s.opt.commission ?? (budget != null && parentPrice != null && parentPrice >= budget ? parentPrice - budget : null);
      if (commission != null) commissionKind = "max";
    }
    return {
      key, childTaskId: cid, parentTaskId: s.parentTaskId, byAgentId: s.byAgentId, tick: s.tick,
      profession: integ?.childProfession ?? s.opt.profession ?? child?.profession ?? null, budget, parentPrice, price, commission, commissionKind, status, childStatus,
      fallbackReason: fb?.reason ?? null, expiredReason: end?.startsWith("expired:") ? end.slice(8) : null,
      winnerId: integ?.childAgentId ?? award?.winnerId ?? null, payee: rel?.payee ?? null, paidAmount: rel?.amount ?? null,
      parentRejected: parentRefunded, lockTx: lock?.tx ?? null, lockPayer: lock?.payer ?? null, releaseTx: rel?.tx ?? null, parentReleaseTx: this.releases.get(s.parentTaskId)?.tx ?? null,
    };
  }
  records() { return [...this.subs.keys()].map((k) => this.record(k)); }
  /** Aggregates. delegated = amounts actually escrowed; paid = released to child agents; commission = real (integrated, or legacy awarded - escrowed). */
  summary() {
    const rs = this.records();
    const sum = (xs) => xs.reduce((a, v) => a + (v ?? 0n), 0n);
    const byReason = {};
    for (const r of rs) if (r.status === "fallback") byReason[r.fallbackReason ?? "failed"] = (byReason[r.fallbackReason ?? "failed"] ?? 0) + 1;
    const paidRs = rs.filter((r) => r.paidAmount != null || (r.status === "integrated" && r.price != null));
    return {
      records: rs, count: rs.length,
      integrated: rs.filter((r) => r.status === "integrated").length,
      fallback: rs.filter((r) => r.status === "fallback").length, fallbackByReason: byReason,
      awarded: rs.filter((r) => ["awarded", "paid", "integrated"].includes(r.childStatus) || r.status === "integrated" || (r.childStatus === "refunded" && r.winnerId)).length,
      paid: rs.filter((r) => r.childStatus === "paid").length,
      expired: rs.filter((r) => r.childStatus === "expired").length,
      delegated: sum(rs.map((r) => r.price)), paidTotal: sum(paidRs.map((r) => r.paidAmount ?? r.price)),
      commission: sum(rs.map((r) => (r.commissionKind === "actual" ? r.commission : null))),
    };
  }
}
export const subs = new SubTracker();

/** Splits a Markdown deliverable around the subcontracting section written by the parent agent (exact titles). Pure.
 *  Returns [{kind:"md"|"sub"|"inhouse", text, name?, profession?, reason?}]; the section runs to the next "# " / "## " heading. */
export function splitSubcontract(content) {
  const lines = String(content ?? "").replace(/\r\n?/g, "\n").split("\n");
  const parts = [];
  let buf = [];
  const flush = () => { const t = buf.join("\n"); if (t.trim()) parts.push({ kind: "md", text: t }); buf = []; };
  let i = 0;
  while (i < lines.length) {
    const sub = /^## Subcontracted to (.+?) \((.+)\)\s*$/.exec(lines[i]);
    const inh = /^## Done in-house \(subcontract failed: (.+)\)\s*$/.exec(lines[i]);
    if (sub || inh) {
      flush();
      const body = []; i++;
      while (i < lines.length && !/^#{1,2} /.test(lines[i])) body.push(lines[i++]);
      parts.push(sub ? { kind: "sub", name: sub[1], profession: sub[2], text: body.join("\n") } : { kind: "inhouse", reason: inh[1], text: body.join("\n") });
      continue;
    }
    buf.push(lines[i++]);
  }
  flush();
  return parts;
}
