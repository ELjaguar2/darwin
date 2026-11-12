// Core of the L17 interface: state loading, history, SSE stream with resume, catalogue, health, mode (mock / testnet / replay).
// No business logic: everything reflects the backend event log. No innerHTML.
import { Store, EVENT_TYPES } from "./store.js";
import { big, explorerUrl } from "./format.js";
import { subs } from "./subcontract.js";
import { letterReceipts } from "./letters.js";

export const store = new Store();
store.explorerBase = undefined;

const KNOWN = new Set(EVENT_TYPES);
const listeners = { event: new Set(), loaded: new Set(), conn: new Set(), meta: new Set(), reset: new Set() };
export const on = (kind, fn) => { listeners[kind].add(fn); return () => listeners[kind].delete(fn); };
const fire = (kind, ...a) => { for (const fn of listeners[kind]) { try { fn(...a); } catch (e) { console.warn("listener", kind, e?.message); } } };

export const core = {
  mode: "mock", // "mock" | "testnet" | "replay"
  replayInfo: null,
  health: null,
  catalogue: null, // Map id -> {id,label,refUsd,nearPrice,deliverable,rubric,acceptScore}
  conn: { state: "connecting", text: "Connecting…" },
  live: false, // false during the initial catch-up: no notification or animation
};

/** Mode is always displayed: replay if the backend announces it (health.mode, state.mode, sim.started, replay field), otherwise testnet/mock. */
function computeMode() {
  const h = core.health, s = core.stateRaw;
  const replay = core.mode === "replay" && !core.resetting || store.mode === "replay" || h?.mode === "replay" || !!h?.replay || !!s?.replay || core.sawReplayStart;
  const mock = h?.mock ?? (store.mode === "mock" || store.chain.kind === "mock");
  core.mode = replay ? "replay" : (store.mode === "testnet" || h?.mode === "testnet" || !mock) ? "testnet" : "mock";
  core.replayInfo = replay ? (h?.replay && typeof h.replay === "object" ? h.replay : s?.replay && typeof s.replay === "object" ? s.replay : {}) : null;
  fire("meta");
  if (replay && !core.replayPoll) core.replayPoll = setInterval(loadHealth, 3000); // player progress
}

// ------------------------------------------------------------------ network
async function api(path, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  let r, text;
  try { r = await fetch(path, { headers: { Accept: "application/json" }, signal: ctl.signal, ...opts }); text = await r.text(); } finally { clearTimeout(timer); }
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, ok: r.ok, body, headers: r.headers };
}
export { api };

// ------------------------------------------------------------------ financial ledger (aggregates, never business rules)
class Ledger {
  constructor() { this.reset(); }
  reset() {
    this.maxSeq = 0;
    subs.reset();
    letterReceipts.reset();
    this.hist = new Map(); // agentId -> [{tick, delta (bigint), reason, balance (bigint)}]
    this.totals = { earned: 0n, brain: 0n, passed: 0n, fees: 0n, brainCalls: 0, teeCalls: 0, models: new Map() };
    this.byGen = new Map(); // generation -> {earned, brain, passed}
    this.births = []; // {tick, agentId}
  }
  gen(g) { let r = this.byGen.get(g); if (!r) { r = { earned: 0n, brain: 0n, passed: 0n }; this.byGen.set(g, r); } return r; }
  ingest(ev) {
    if (ev.seq <= this.maxSeq) return;
    this.maxSeq = ev.seq;
    letterReceipts.ingest(ev); // L25
    subs.ingest(ev); // L21: agent-to-agent subcontracting (display aggregates)
    const d = ev.data ?? {};
    switch (ev.type) {
      case "balance.changed": {
        if (!d.agentId) break;
        let l = this.hist.get(d.agentId);
        if (!l) this.hist.set(d.agentId, (l = []));
        l.push({ tick: ev.tick ?? 0, delta: big(d.delta), reason: d.reason ?? "?", balance: big(d.balance) });
        if (l.length > 400) l.splice(0, l.length - 400);
        if (d.reason === "chain_fee") this.totals.fees += -big(d.delta);
        break;
      }
      case "escrow.released": {
        const a = store.agentByAccount(d.payee);
        const amt = big(d.amount);
        this.totals.earned += amt;
        if (a) this.gen(a.generation).earned += amt;
        break;
      }
      case "brain.charged": {
        const c = big(d.cost);
        this.totals.brain += c; this.totals.brainCalls++;
        const a = store.agents.get(d.agentId);
        if (a) this.gen(a.generation).brain += c;
        const m = String(d.model ?? "?");
        this.totals.models.set(m, (this.totals.models.get(m) ?? 0) + 1);
        break;
      }
      case "agent.reproduced": {
        const t = big(d.transferred);
        this.totals.passed += t;
        const p = store.agents.get(d.parentId);
        if (p) this.gen(p.generation).passed += t;
        break;
      }
      default: break;
    }
  }
}
export const ledger = new Ledger();

// ------------------------------------------------------------------ loading
async function loadHistory() {
  let since = 0;
  for (let page = 0; page < 40; page++) {
    const r = await api(`/api/events?since=${since}&limit=1000`);
    const list = Array.isArray(r.body) ? r.body : r.body?.events;
    if (!r.ok || !Array.isArray(list) || !list.length) break;
    for (const e of list) {
      if (!e || typeof e.seq !== "number" || e.seq > store.lastSeq) continue;
      store.apply(e, { live: false });
      ledger.ingest(e);
      fire("event", e, { silent: true });
      since = Math.max(since, e.seq);
    }
    if (since >= store.lastSeq || list.length < 1000) break;
  }
}

export async function loadCatalogue() {
  try {
    const r = await api("/api/catalogue");
    if (r.ok && Array.isArray(r.body?.professions)) {
      core.catalogue = new Map(r.body.professions.map((p) => (p && typeof p === "object" ? { ...p, id: p.id ?? p.profession } : p)).filter((p) => p && typeof p.id === "string").map((p) => [p.id, p]));
      for (const e of r.body.activeEvents ?? r.body.events ?? []) store.addMarketEvent(e);
    } else core.catalogue = null;
  } catch { core.catalogue = null; }
  fire("meta");
}
export async function loadHealth() {
  try { const r = await api("/api/health"); if (r.ok) { core.health = r.body; store.health = r.body; computeMode(); } } catch { /* ignored */ }
}

export async function loadState() {
  const r = await api("/api/state");
  if (!r.ok) throw new Error("GET /api/state: " + r.status);
  core.live = false;
  core.sawReplayStart = false; core.resetting = true;
  store.load(r.body);
  core.stateRaw = r.body;
  ledger.reset();
  fire("reset");
  computeMode(); core.resetting = false;
  try { await loadHistory(); } catch { /* history is optional */ }
  await loadHealth();
  await loadCatalogue();
  computeMode();
  fire("loaded");
  setTimeout(() => { core.live = true; fire("meta"); }, 700);
}

// ------------------------------------------------------------------ SSE with resume
let es = null, retries = 0, reconnectTimer = 0, wasDown = false, gapStreak = 0, okStreak = 0;
const isValidEvent = (ev) => !!ev && typeof ev === "object" && !Array.isArray(ev) && Number.isSafeInteger(ev.seq) && ev.seq > 0
  && typeof ev.type === "string" && KNOWN.has(ev.type) && (ev.data == null || (typeof ev.data === "object" && !Array.isArray(ev.data)));
function setConn(state, text) { core.conn = { state, text }; fire("conn"); }

function handleEvent(ev) {
  try {
    if (ev.type === "sim.started" && (ev.data?.mode === "replay" || ev.data?.replay)) { core.sawReplayStart = true; computeMode(); }
    store.apply(ev);
    ledger.ingest(ev);
    fire("event", ev, { silent: !core.live });
  } catch (e) { console.warn("event ignored", ev?.type, e?.message); }
}

export function connect() {
  clearTimeout(reconnectTimer);
  if (es) es.close();
  es = new EventSource(`/api/stream?since=${store.lastSeq}`);
  es.onopen = async () => {
    retries = 0;
    setConn("live", core.mode === "replay" ? "Replay running" : "Live");
    if (wasDown) { wasDown = false; try { const r = await api("/api/state"); if (r.ok && r.body.lastSeq < store.lastSeq) { await loadState(); connect(); } } catch { /* ignored */ } }
  };
  const onMsg = (m) => {
    let ev;
    try { ev = JSON.parse(m.data); } catch { return; }
    if (!isValidEvent(ev)) return;
    if (ev.seq > store.lastSeq + 1 && store.lastSeq > 0) {
      gapStreak++;
      clearTimeout(reconnectTimer);
      if (es) es.close();
      reconnectTimer = setTimeout(connect, Math.min(10000, 500 * 2 ** Math.min(gapStreak, 5)));
      setConn("retry", "Resynchronizing…");
      return;
    }
    if (ev.seq > store.lastSeq && ++okStreak >= 20) { gapStreak = 0; okStreak = 0; }
    handleEvent(ev);
  };
  for (const t of EVENT_TYPES) es.addEventListener(t, onMsg);
  es.onmessage = onMsg;
  es.addEventListener("reset", () => { // the server restarted (or the replay restarts): clear, the stream replays from the start
    const keep = { mode: store.mode, chain: store.chain, brain: store.brain, health: store.health, explorerBase: store.explorerBase };
    store.reset(); Object.assign(store, keep);
    ledger.reset();
    core.live = false;
    fire("reset");
    setTimeout(() => { core.live = true; fire("meta"); }, 900);
  });
  es.onerror = () => {
    wasDown = true; retries++;
    setConn("retry", `Reconnecting… (attempt ${retries})`);
    if (es.readyState === EventSource.CLOSED) reconnectTimer = setTimeout(connect, Math.min(10000, 800 * 2 ** Math.min(retries, 4)));
    if (retries > 6) setConn("down", "Offline");
  };
}

export function start() {
  const go = () => loadState().then(() => connect()).catch((e) => {
    setConn("down", "Backend unreachable");
    console.warn(String(e?.message ?? e));
    setTimeout(go, 3000);
  });
  go();
  setInterval(loadHealth, 20000);
  setInterval(() => { if (store.lastSeq > 0) loadCatalogue(); }, 30000);
}

// ------------------------------------------------------------------ shared helpers
/** Explorer link for a hash: URL seen in the stream, otherwise rebuilt. null in mock. */
export function txUrl(hash) {
  if (!hash) return null;
  return store.feedByHash.get(hash)?.url ?? explorerUrl(hash, { chainKind: store.chain.kind, base: store.explorerBase });
}
export const aliveAgents = () => [...store.agents.values()].filter((a) => a.status === "alive");
export const labelOfJob = (id, fallback) => core.catalogue?.get(id)?.label ?? fallback;
