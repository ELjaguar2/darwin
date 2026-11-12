// Agent-to-agent subcontracting (L21): pure display aggregates computed from the received log. No DOM, no business rule.
// `subcontract.created` may carry optional fields (profession, budget, parentPrice, commission, in yocto); older journals do not:
// then budget = task.posted(child).budget, parentPrice = task.awarded(parent).price, commission = parentPrice - budget (if both known, >= 0).
const B = (v) => { try { return v == null || v === "" ? null : BigInt(v); } catch { return null; } };

export class SubTracker {
  constructor() { this.reset(); }
  reset() {
    this.tasks = new Map(); // taskId -> {profession, budget, requesterKind, title, requesterAgentId}
    this.awards = new Map(); // taskId -> {price, winnerId}
    this.locks = new Map(); // taskId -> {payer, amount, tx}
    this.releases = new Map(); // taskId -> {payee, amount, tx}
    this.ends = new Map(); // taskId -> "expired:<reason>" | "refunded"
    this.subs = new Map(); // childTaskId -> {parentTaskId, childTaskId, byAgentId, tick, opt}
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
      default: break;
    }
  }
  isChild(taskId) { return this.subs.has(taskId); }
  parentOf(taskId) { return this.subs.get(taskId)?.parentTaskId ?? null; }
  childrenOf(taskId) { return [...this.subs.values()].filter((s) => s.parentTaskId === taskId).map((s) => s.childTaskId); }
  /** Record for a child task, with derived fields (null when unknown). */
  record(childId) {
    const s = this.subs.get(childId);
    if (!s) return null;
    const child = this.tasks.get(childId), award = this.awards.get(childId), lock = this.locks.get(childId), rel = this.releases.get(childId), end = this.ends.get(childId);
    const budget = s.opt.budget ?? child?.budget ?? null;
    const parentPrice = s.opt.parentPrice ?? this.awards.get(s.parentTaskId)?.price ?? null;
    const status = rel ? "paid" : end === "refunded" ? "refunded" : end ? "expired" : award ? "awarded" : "open";
    // amount actually escrowed for the child (can be below the budget): escrow.locked.amount, else the awarded price, else the released amount
    const price = status === "expired" || status === "refunded" ? null : (lock?.amount ?? award?.price ?? rel?.amount ?? null);
    // real commission = parent price - escrowed child amount; before the award only the maximum (parent price - budget) is known; no money moved otherwise
    let commission = null, commissionKind = "unknown";
    if (status === "expired" || status === "refunded") { commission = 0n; commissionKind = "none"; }
    else if (price != null && parentPrice != null && parentPrice >= price) { commission = parentPrice - price; commissionKind = "actual"; }
    else if (status === "open") {
      commission = s.opt.commission ?? (budget != null && parentPrice != null && parentPrice >= budget ? parentPrice - budget : null);
      if (commission != null) commissionKind = "max";
    }
    return {
      childTaskId: childId, parentTaskId: s.parentTaskId, byAgentId: s.byAgentId, tick: s.tick,
      profession: s.opt.profession ?? child?.profession ?? null, budget, parentPrice, price, commission, commissionKind, status,
      expiredReason: end?.startsWith("expired:") ? end.slice(8) : null,
      winnerId: award?.winnerId ?? null, payee: rel?.payee ?? null, paidAmount: rel?.amount ?? null,
      lockTx: lock?.tx ?? null, lockPayer: lock?.payer ?? null, releaseTx: rel?.tx ?? null,
    };
  }
  records() { return [...this.subs.keys()].map((id) => this.record(id)); }
  /** Aggregates: delegated = amounts actually escrowed (awarded/paid; nothing for expired); paid = sum released; commission = real commission on awarded/paid ones. */
  summary() {
    const rs = this.records();
    const sum = (xs) => xs.reduce((a, v) => a + (v ?? 0n), 0n);
    const paid = rs.filter((r) => r.status === "paid");
    const live = rs.filter((r) => r.status === "awarded" || r.status === "paid");
    return {
      records: rs, count: rs.length,
      awarded: rs.filter((r) => r.status === "awarded" || r.status === "paid" || (r.status === "refunded" && r.winnerId)).length,
      paid: paid.length, expired: rs.filter((r) => r.status === "expired").length,
      delegated: sum(live.map((r) => r.price)), paidTotal: sum(paid.map((r) => r.paidAmount ?? r.price)), commission: sum(live.map((r) => (r.commissionKind === "actual" ? r.commission : null))),
    };
  }
}
export const subs = new SubTracker();
