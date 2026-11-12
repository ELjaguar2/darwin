// Client state rebuilt from /api/state then the event stream. No business logic: pure mirror of the log.
// Types (copied as JSDoc, see shared/types.ts) : Agent, Task, Letter, DarwinEvent {seq, ts, tick, type, data}.
import { explorerUrl, txKindLabel, big } from "./format.js";

export const EVENT_TYPES = [
  "sim.started", "sim.paused", "sim.resumed", "sim.stopped", "sim.tick",
  "agent.born", "agent.reproduced", "agent.died", "letter.written",
  "task.posted", "bid.placed", "task.awarded", "task.expired", "escrow.locked", "task.submitted",
  "task.validated", "escrow.released", "escrow.refunded", "subcontract.created", "subcontract.integrated", "subcontract.fallback", "reputation.updated",
  "brain.charged", "balance.changed", "funding.received",
  "chain.tx", "intents.quote", "system.warning", "system.error",
  "deliverable.produced", "market.event", "population.snapshot", // L16
];

const MAX_FEED = 400;
const MAX_CHRONICLE = 120;
const MAX_TASKS = 200;

export class Store {
  constructor() { this.reset(); this.subs = new Set(); }

  reset() {
    this.agents = new Map();
    this.tasks = new Map();
    this.letters = new Map();
    this.feed = []; // transactions: {key, hash, seq, tick, label, from, to, amount, url, mock, source}
    this.feedByHash = new Map();
    this.chronicle = []; // sentences: {seq, tick, kind, text, agentId?}
    this.warnings = [];
    this.lastSeq = 0;
    this.tick = 0;
    this.mode = "mock";
    this.chain = { kind: "mock", masterId: "" };
    this.brain = { kind: "mock" };
    this.health = null;
    this.sim = { running: false, paused: false, stopped: null };
    this.totals = { alive: 0, dead: 0, born: 0, tasksSettled: 0, totalBalance: "0" };
    this.generations = 0;
    this.bidCount = new Map(); // taskId -> number of bids
    this.deliverables = new Map(); // taskId -> metadata (deliverable.produced event)
    this.marketEvents = []; // MarketEvent[] (deduplicated by id, most recent first)
    this.snapshot = null; // last population.snapshot: {tick, byProfession, byGeneration}
  }

  /** Latest population snapshot (server state or event), keeps the most recent. Accepted shape: object or {data}. */
  setSnapshot(s) {
    const d = s?.data ?? s;
    if (!d || typeof d !== "object" || typeof d.byGeneration !== "object" || !d.byGeneration) return;
    if (this.snapshot && (d.tick ?? 0) < (this.snapshot.tick ?? 0)) return;
    this.snapshot = { tick: d.tick ?? 0, byProfession: d.byProfession ?? {}, byGeneration: d.byGeneration };
  }

  addMarketEvent(e) {
    if (!e || typeof e.id !== "string") return;
    if (this.marketEvents.some((x) => x.id === e.id)) return;
    this.marketEvents.unshift(e);
    this.marketEvents.sort((a, b) => (b.startTick ?? 0) - (a.startTick ?? 0) || b.id.localeCompare(a.id));
    if (this.marketEvents.length > 60) this.marketEvents.length = 60;
  }

  /** Market events active at the current tick (local computation, fallback if /api/catalogue is missing). */
  activeMarketEvents() { return this.marketEvents.filter((e) => e.startTick <= this.tick && this.tick < e.endTick); }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  notify(ev) { for (const fn of this.subs) fn(ev, this); }

  /** Loads a SimState snapshot. */
  load(state) {
    this.reset();
    this.mode = state.mode ?? "mock";
    this.chain = state.chain ?? this.chain;
    this.brain = state.brain ?? this.brain;
    this.tick = state.tick ?? 0;
    this.sim = { running: !!state.running, paused: !!state.paused, stopped: null };
    this.generations = state.generations ?? 0;
    this.totals = state.totals ?? this.totals;
    for (const a of state.agents ?? []) this.agents.set(a.id, a);
    for (const t of state.tasks ?? []) this.tasks.set(t.id, t);
    this.trimTasks();
    for (const l of state.letters ?? []) this.letters.set(l.id, l);
    this.lastSeq = state.lastSeq ?? 0;
    this.setSnapshot(state.populationSnapshot ?? state.population ?? state.lastPopulationSnapshot ?? state.snapshot);
    for (const e of state.marketEvents ?? state.activeEvents ?? []) this.addMarketEvent(e);
    this.notify({ type: "__loaded" });
  }

  /** Bounds memory: keeps the MAX_TASKS most recent tasks (Map = insertion order). */
  trimTasks() {
    while (this.tasks.size > MAX_TASKS) { const k = this.tasks.keys().next().value; this.tasks.delete(k); this.bidCount.delete(k); }
  }

  agentByAccount(acc) { for (const a of this.agents.values()) if (a.accountId === acc) return a; return null; }
  name(id) { return this.agents.get(id)?.name ?? id; }

  addTx({ hash, seq, tick, label, from, to, amount, explicit, source, kind }) {
    if (!hash) return;
    const url = explorerUrl(hash, { explicit, chainKind: this.chain.kind, base: this.explorerBase });
    const mock = /^mock_/.test(hash) || this.chain.kind === "mock";
    const minor = source === "chain.tx" && kind === "transfer" && !!to && to === this.chain.masterId; // metabolism: same transfer to the master account every tick
    const known = this.feedByHash.get(hash);
    if (known) {
      if (source !== "chain.tx") known.minor = false; // enriches the existing entry (chain.tx + business event share the same hash)
      if (label && source !== "chain.tx") known.label = label;
      known.from ??= from; known.to ??= to; known.amount ??= amount; known.url ??= url;
      return known;
    }
    const it = { key: hash, hash, seq, tick, label: minor ? "Cost of living (metabolism)" : label, from, to, amount, url, mock, source, minor, fresh: true };
    this.feed.unshift(it);
    this.feedByHash.set(hash, it);
    if (this.feed.length > MAX_FEED) { const old = this.feed.pop(); this.feedByHash.delete(old.hash); }
    return it;
  }

  chron(ev, kind, text, extra = {}) {
    this.chronicle.unshift({ seq: ev.seq, tick: ev.tick, kind, text, ...extra });
    if (this.chronicle.length > MAX_CHRONICLE) this.chronicle.pop();
  }

  /** Applies a log event. `live=false`: history replay (feed only, no effect on state). */
  apply(ev, { live = true } = {}) {
    if (!ev || typeof ev.seq !== "number") return;
    if (live) { if (ev.seq <= this.lastSeq) return; this.lastSeq = ev.seq; this.tick = Math.max(this.tick, ev.tick ?? 0); }
    const d = ev.data ?? {};
    const A = (id) => this.agents.get(id);
    switch (ev.type) {
      case "deliverable.produced": if (d.taskId) this.deliverables.set(d.taskId, d); break;
      case "market.event":
        this.addMarketEvent(d.event);
        if (live && d.event) this.chron(ev, "sys", `Market: ${d.event.title} (${d.event.profession}, demand ×${d.event.demandMultiplier}).`);
        break;
      case "population.snapshot": this.setSnapshot({ tick: d.tick ?? ev.tick, byProfession: d.byProfession, byGeneration: d.byGeneration }); break;
      case "sim.started":
        this.mode = d.mode ?? this.mode; this.sim.running = true; this.sim.stopped = null;
        if (live) this.chron(ev, "sys", `Simulation started (${d.mode}, preset ${d.preset}).`);
        break;
      case "sim.paused": if (live) { this.sim.paused = true; this.chron(ev, "sys", "Simulation paused."); } break;
      case "sim.resumed": if (live) { this.sim.paused = false; this.chron(ev, "sys", "Simulation resumed."); } break;
      case "sim.stopped":
        if (live) { this.sim.running = false; this.sim.stopped = d.reason; this.generations = Math.max(this.generations, d.generations ?? 0);
          this.chron(ev, "death", `Simulation ended (${{ extinction: "total extinction", manual: "manual stop", max_ticks: "maximum duration", error: "error" }[d.reason] ?? d.reason}), ${d.generations} generation(s).`); }
        break;
      case "sim.tick":
        if (live) { this.totals = { ...this.totals, alive: d.alive, totalBalance: d.totalBalance }; this.tasksOpen = d.tasksOpen; }
        break;
      case "agent.born": {
        if (live && d.agent) {
          this.agents.set(d.agent.id, d.agent);
          this.generations = Math.max(this.generations, d.agent.generation);
          this.totals = { ...this.totals, born: this.agents.size, alive: [...this.agents.values()].filter((a) => a.status === "alive").length };
          const p = d.parentId ? A(d.parentId) : null;
          if (p) { p.childrenIds = p.childrenIds ?? []; if (!p.childrenIds.includes(d.agent.id)) p.childrenIds.push(d.agent.id); }
          this.chron(ev, "birth", p ? `${d.agent.name} is born from ${p.name} (generation ${d.agent.generation}).` : `${d.agent.name}, founder (${d.agent.genome?.profession}).`, { agentId: d.agent.id });
        }
        this.addTx({ hash: d.birthTx, seq: ev.seq, tick: ev.tick, label: "Birth", to: d.agent?.accountId, amount: d.agent?.birthCapital, source: ev.type });
        break;
      }
      case "agent.reproduced":
        if (live) { const p = A(d.parentId), c = A(d.childId); if (p) p.lastReproTick = ev.tick;
          const m = Object.keys(d.mutations ?? {}); if (c && m.length) this.chron(ev, "mut", `${c.name} mutated: ${m.join(", ")}.`, { agentId: d.childId }); }
        break;
      case "agent.died":
        if (live) { const a = A(d.agentId); if (a) { a.status = "dead"; a.causeOfDeath = d.cause; a.deathTick = ev.tick; a.diedAt = ev.ts; a.balance = "0"; }
          this.totals = { ...this.totals, dead: [...this.agents.values()].filter((x) => x.status === "dead").length, alive: [...this.agents.values()].filter((x) => x.status === "alive").length };
          this.chron(ev, "death", `${a?.name ?? d.agentId} dies (${{ starvation: "ran out of money", manual: "manual stop", reset: "reset" }[d.cause] ?? d.cause}).`, { agentId: d.agentId }); }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: "Death: balance recovered", from: A(d.agentId)?.accountId, to: d.sweptTo, amount: d.swept, source: ev.type });
        break;
      case "letter.written":
        if (live && d.letter) { this.letters.set(d.letter.id, d.letter); const c = A(d.letter.toAgentId); if (c) c.letterId = d.letter.id;
          this.chron(ev, "letter", `${this.name(d.letter.fromAgentId)} writes to ${this.name(d.letter.toAgentId)}.`, { letterId: d.letter.id }); }
        break;
      case "task.posted":
        if (live && d.task && d.task.id) { this.tasks.set(d.task.id, d.task); this.trimTasks(); }
        break;
      case "bid.placed": if (live) this.bidCount.set(d.bid.taskId, (this.bidCount.get(d.bid.taskId) ?? 0) + 1); break;
      case "task.awarded":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "awarded"; t.winnerId = d.winnerId; t.winningBidId = d.bidId; t.awardPrice = d.price; t.bids = d.bids; } }
        break;
      case "task.expired": if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "expired"; t.expiredReason = d.reason; } } break;
      case "escrow.locked":
        if (live) { const t = this.tasks.get(d.taskId); if (t) t.escrow = { status: "locked", amount: d.amount, payer: d.payer, lockTx: d.tx }; }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Escrow locked (${d.taskId})`, from: d.payer, amount: d.amount, source: ev.type });
        break;
      case "task.submitted":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "submitted"; t.result = { ...(t.result ?? {}), resultHash: d.resultHash }; } }
        break;
      case "task.validated":
        if (live) { const t = this.tasks.get(d.taskId); if (t) t.validation = d.validation; }
        break;
      case "escrow.released":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "settled"; t.escrow = { ...(t.escrow ?? {}), status: "released", payee: d.payee, amount: d.amount, settleTx: d.tx }; }
          const a = this.agentByAccount(d.payee); if (a) { a.tasksDone = (a.tasksDone ?? 0) + 1; a.earned = (big(a.earned ?? 0) + big(d.amount)).toString(); }
          this.totals = { ...this.totals, tasksSettled: (this.totals.tasksSettled ?? 0) + 1 };
          const tk = this.tasks.get(d.taskId);
          this.chron(ev, "pay", `${a?.name ?? d.payee} is paid for "${tk?.title ?? d.taskId}".`, { agentId: a?.id, taskId: d.taskId }); }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Escrow released (${d.taskId})`, to: d.payee, amount: d.amount, source: ev.type });
        break;
      case "escrow.refunded":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = t.status === "expired" ? "expired" : "rejected"; t.escrow = { ...(t.escrow ?? {}), status: "refunded", settleTx: d.tx }; } }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Escrow refunded (${d.taskId})`, to: d.payer, amount: d.amount, source: ev.type });
        break;
      case "reputation.updated":
        if (live) { const a = A(d.agentId); if (a) a.reputation = d.total; }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Reputation ${d.delta > 0 ? "+" : ""}${d.delta}`, source: ev.type });
        break;
      case "brain.charged":
        if (live) { const a = A(d.agentId); if (a) a.spentBrain = (big(a.spentBrain ?? 0) + big(d.cost)).toString(); }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `AI brain paid (${d.model}${d.mock ? ", mock" : ""})`, from: A(d.agentId)?.accountId, amount: d.cost, source: ev.type });
        break;
      case "balance.changed":
        if (live) { const a = A(d.agentId); if (a) a.balance = d.balance; }
        break;
      case "funding.received":
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: d.source === "demo" ? "Demo account funding" : d.source === "faucet" ? "Testnet faucet" : "Funding (master account)", to: d.to, amount: d.amount, source: ev.type });
        break;
      case "chain.tx":
        this.addTx({ hash: d.hash, seq: ev.seq, tick: ev.tick, label: txKindLabel(d.kind), from: d.from, to: d.to, amount: d.amount, explicit: d.explorerUrl, source: "chain.tx", kind: d.kind });
        break;
      case "system.warning": case "system.error":
        if (live) { this.warnings.unshift({ seq: ev.seq, level: ev.type === "system.error" ? "error" : "warning", code: d.code, message: d.message }); this.warnings.length = Math.min(this.warnings.length, 5); }
        break;
      default: break;
    }
    if (live) this.notify(ev);
  }

  /** Tree: list of agents -> forest. */
  lineageStats() {
    const roots = [...this.agents.values()].filter((a) => !a.parentId);
    return roots.map((r) => {
      let total = 0, alive = 0, balance = 0n, maxGen = r.generation;
      const stack = [r];
      while (stack.length) {
        const a = stack.pop(); total++; if (a.status === "alive") { alive++; balance += big(a.balance ?? 0); }
        maxGen = Math.max(maxGen, a.generation);
        for (const cid of a.childrenIds ?? []) { const c = this.agents.get(cid); if (c) stack.push(c); }
      }
      return { root: r, total, alive, balance, maxGen };
    });
  }
}
