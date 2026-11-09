// État client reconstruit depuis /api/state puis le flux d'événements. Aucune logique métier : pur reflet du journal.
// Types (recopiés en JSDoc, voir shared/types.ts) : Agent, Task, Letter, DarwinEvent {seq, ts, tick, type, data}.
import { explorerUrl, txKindLabel } from "./format.js";

export const EVENT_TYPES = [
  "sim.started", "sim.paused", "sim.resumed", "sim.stopped", "sim.tick",
  "agent.born", "agent.reproduced", "agent.died", "letter.written",
  "task.posted", "bid.placed", "task.awarded", "task.expired", "escrow.locked", "task.submitted",
  "task.validated", "escrow.released", "escrow.refunded", "subcontract.created", "reputation.updated",
  "brain.charged", "balance.changed", "funding.received",
  "chain.tx", "intents.quote", "system.warning", "system.error",
];

const MAX_FEED = 120;
const MAX_CHRONICLE = 120;

export class Store {
  constructor() { this.reset(); this.subs = new Set(); }

  reset() {
    this.agents = new Map();
    this.tasks = new Map();
    this.letters = new Map();
    this.feed = []; // transactions : {key, hash, seq, tick, label, from, to, amount, url, mock, source}
    this.feedByHash = new Map();
    this.chronicle = []; // phrases : {seq, tick, kind, text, agentId?}
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
    this.bidCount = new Map(); // taskId -> nombre d'offres
  }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  notify(ev) { for (const fn of this.subs) fn(ev, this); }

  /** Charge un instantané SimState. */
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
    for (const l of state.letters ?? []) this.letters.set(l.id, l);
    this.lastSeq = state.lastSeq ?? 0;
    this.notify({ type: "__loaded" });
  }

  agentByAccount(acc) { for (const a of this.agents.values()) if (a.accountId === acc) return a; return null; }
  name(id) { return this.agents.get(id)?.name ?? id; }

  addTx({ hash, seq, tick, label, from, to, amount, explicit, source }) {
    if (!hash) return;
    const url = explorerUrl(hash, { explicit, chainKind: this.chain.kind, base: this.explorerBase });
    const mock = /^mock_/.test(hash) || this.chain.kind === "mock";
    const known = this.feedByHash.get(hash);
    if (known) { // enrichit l'entrée existante (chain.tx + événement métier partagent le même hash)
      if (label && source !== "chain.tx") known.label = label;
      known.from ??= from; known.to ??= to; known.amount ??= amount; known.url ??= url;
      return known;
    }
    const it = { key: hash, hash, seq, tick, label, from, to, amount, url, mock, source, fresh: true };
    this.feed.unshift(it);
    this.feedByHash.set(hash, it);
    if (this.feed.length > MAX_FEED) { const old = this.feed.pop(); this.feedByHash.delete(old.hash); }
    return it;
  }

  chron(ev, kind, text, extra = {}) {
    this.chronicle.unshift({ seq: ev.seq, tick: ev.tick, kind, text, ...extra });
    if (this.chronicle.length > MAX_CHRONICLE) this.chronicle.pop();
  }

  /** Applique un événement du journal. `live=false` : rejeu d'historique (feed uniquement, pas d'effet sur l'état). */
  apply(ev, { live = true } = {}) {
    if (!ev || typeof ev.seq !== "number") return;
    if (live) { if (ev.seq <= this.lastSeq) return; this.lastSeq = ev.seq; this.tick = Math.max(this.tick, ev.tick ?? 0); }
    const d = ev.data ?? {};
    const A = (id) => this.agents.get(id);
    switch (ev.type) {
      case "sim.started":
        this.mode = d.mode ?? this.mode; this.sim.running = true; this.sim.stopped = null;
        if (live) this.chron(ev, "sys", `Simulation lancée (${d.mode}, preset ${d.preset}).`);
        break;
      case "sim.paused": if (live) { this.sim.paused = true; this.chron(ev, "sys", "Simulation en pause."); } break;
      case "sim.resumed": if (live) { this.sim.paused = false; this.chron(ev, "sys", "Simulation reprise."); } break;
      case "sim.stopped":
        if (live) { this.sim.running = false; this.sim.stopped = d.reason; this.generations = Math.max(this.generations, d.generations ?? 0);
          this.chron(ev, "death", `Simulation terminée (${{ extinction: "extinction totale", manual: "arrêt manuel", max_ticks: "durée maximale", error: "erreur" }[d.reason] ?? d.reason}), ${d.generations} génération(s).`); }
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
          this.chron(ev, "birth", p ? `${d.agent.name} naît de ${p.name} (génération ${d.agent.generation}).` : `${d.agent.name}, fondateur (${d.agent.genome?.profession}).`, { agentId: d.agent.id });
        }
        this.addTx({ hash: d.birthTx, seq: ev.seq, tick: ev.tick, label: "Naissance", to: d.agent?.accountId, amount: d.agent?.birthCapital, source: ev.type });
        break;
      }
      case "agent.reproduced":
        if (live) { const p = A(d.parentId), c = A(d.childId); if (p) p.lastReproTick = ev.tick;
          const m = Object.keys(d.mutations ?? {}); if (c && m.length) this.chron(ev, "mut", `${c.name} a muté : ${m.join(", ")}.`, { agentId: d.childId }); }
        break;
      case "agent.died":
        if (live) { const a = A(d.agentId); if (a) { a.status = "dead"; a.causeOfDeath = d.cause; a.deathTick = ev.tick; a.diedAt = ev.ts; a.balance = "0"; }
          this.totals = { ...this.totals, dead: [...this.agents.values()].filter((x) => x.status === "dead").length, alive: [...this.agents.values()].filter((x) => x.status === "alive").length };
          this.chron(ev, "death", `${a?.name ?? d.agentId} meurt (${{ starvation: "à court d'argent", manual: "arrêt manuel", reset: "réinitialisation" }[d.cause] ?? d.cause}).`, { agentId: d.agentId }); }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: "Mort : solde récupéré", from: A(d.agentId)?.accountId, to: d.sweptTo, amount: d.swept, source: ev.type });
        break;
      case "letter.written":
        if (live && d.letter) { this.letters.set(d.letter.id, d.letter); const c = A(d.letter.toAgentId); if (c) c.letterId = d.letter.id;
          this.chron(ev, "letter", `${this.name(d.letter.fromAgentId)} écrit à ${this.name(d.letter.toAgentId)}.`, { letterId: d.letter.id }); }
        break;
      case "task.posted":
        if (live && d.task) this.tasks.set(d.task.id, d.task);
        break;
      case "bid.placed": if (live) this.bidCount.set(d.bid.taskId, (this.bidCount.get(d.bid.taskId) ?? 0) + 1); break;
      case "task.awarded":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "awarded"; t.winnerId = d.winnerId; t.winningBidId = d.bidId; t.awardPrice = d.price; t.bids = d.bids; } }
        break;
      case "task.expired": if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "expired"; t.expiredReason = d.reason; } } break;
      case "escrow.locked":
        if (live) { const t = this.tasks.get(d.taskId); if (t) t.escrow = { status: "locked", amount: d.amount, payer: d.payer, lockTx: d.tx }; }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Séquestre verrouillé (${d.taskId})`, from: d.payer, amount: d.amount, source: ev.type });
        break;
      case "task.submitted":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "submitted"; t.result = { ...(t.result ?? {}), resultHash: d.resultHash }; } }
        break;
      case "task.validated":
        if (live) { const t = this.tasks.get(d.taskId); if (t) t.validation = d.validation; }
        break;
      case "escrow.released":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = "settled"; t.escrow = { ...(t.escrow ?? {}), status: "released", payee: d.payee, amount: d.amount, settleTx: d.tx }; }
          const a = this.agentByAccount(d.payee); if (a) { a.tasksDone = (a.tasksDone ?? 0) + 1; a.earned = (BigInt(a.earned ?? 0) + BigInt(d.amount)).toString(); }
          this.totals = { ...this.totals, tasksSettled: (this.totals.tasksSettled ?? 0) + 1 };
          const tk = this.tasks.get(d.taskId);
          this.chron(ev, "pay", `${a?.name ?? d.payee} est payé pour « ${tk?.title ?? d.taskId} ».`, { agentId: a?.id, taskId: d.taskId }); }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Séquestre libéré (${d.taskId})`, to: d.payee, amount: d.amount, source: ev.type });
        break;
      case "escrow.refunded":
        if (live) { const t = this.tasks.get(d.taskId); if (t) { t.status = t.status === "expired" ? "expired" : "rejected"; t.escrow = { ...(t.escrow ?? {}), status: "refunded", settleTx: d.tx }; } }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Séquestre remboursé (${d.taskId})`, to: d.payer, amount: d.amount, source: ev.type });
        break;
      case "reputation.updated":
        if (live) { const a = A(d.agentId); if (a) a.reputation = d.total; }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Réputation ${d.delta > 0 ? "+" : ""}${d.delta}`, source: ev.type });
        break;
      case "brain.charged":
        if (live) { const a = A(d.agentId); if (a) a.spentBrain = (BigInt(a.spentBrain ?? 0) + BigInt(d.cost)).toString(); }
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: `Cerveau IA payé (${d.model}${d.mock ? ", mock" : ""})`, from: A(d.agentId)?.accountId, amount: d.cost, source: ev.type });
        break;
      case "balance.changed":
        if (live) { const a = A(d.agentId); if (a) a.balance = d.balance; }
        break;
      case "funding.received":
        this.addTx({ hash: d.tx, seq: ev.seq, tick: ev.tick, label: d.source === "demo" ? "Financement du compte de démo" : d.source === "faucet" ? "Faucet testnet" : "Financement (compte maître)", to: d.to, amount: d.amount, source: ev.type });
        break;
      case "chain.tx":
        this.addTx({ hash: d.hash, seq: ev.seq, tick: ev.tick, label: txKindLabel(d.kind), from: d.from, to: d.to, amount: d.amount, explicit: d.explorerUrl, source: "chain.tx" });
        break;
      case "system.warning": case "system.error":
        if (live) { this.warnings.unshift({ seq: ev.seq, level: ev.type === "system.error" ? "error" : "warning", code: d.code, message: d.message }); this.warnings.length = Math.min(this.warnings.length, 5); }
        break;
      default: break;
    }
    if (live) this.notify(ev);
  }

  /** Arbre : liste d'agents -> forêt. */
  lineageStats() {
    const roots = [...this.agents.values()].filter((a) => !a.parentId);
    return roots.map((r) => {
      let total = 0, alive = 0, balance = 0n, maxGen = r.generation;
      const stack = [r];
      while (stack.length) {
        const a = stack.pop(); total++; if (a.status === "alive") { alive++; balance += BigInt(a.balance ?? 0); }
        maxGen = Math.max(maxGen, a.generation);
        for (const cid of a.childrenIds ?? []) { const c = this.agents.get(cid); if (c) stack.push(c); }
      }
      return { root: r, total, alive, balance, maxGen };
    });
  }
}
