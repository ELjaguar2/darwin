// Entry point: state loading, SSE stream with resume, panel rendering, task form.
// No business logic here: the page mirrors the event log. No innerHTML (everything via textContent / h()).
import { Store, EVENT_TYPES } from "./store.js";
import { Tree } from "./tree.js";
import { big, formatNear, formatNearSmall, signedNear, nearNumber, shortHash, profOf, requesterBadge, STATUS_LABEL, h, errorMessages, TESTNET_EXPLORER, PROFESSIONS, PROFESSION_IDS, parseNearToYocto, nearInput, usd, multLabel } from "./format.js";
import { buildDeliverable } from "./deliverable.js";

const $ = (id) => document.getElementById(id);
const store = new Store();
let selectedAgent = null;
let selectedLetter = null;
let openTaskIds = new Set();
const dirty = new Set();
let renderQueued = false;
const markDirty = (...p) => { p.forEach((x) => dirty.add(x)); if (!renderQueued) { renderQueued = true; setTimeout(render, 120); } };

// ---------------------------------------------------------------- theme
$("themeBtn").addEventListener("click", () => {
  const root = document.documentElement;
  const cur = root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = cur === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("darwin-theme", next); } catch { /* storage unavailable: no effect */ }
});

// ---------------------------------------------------------------- network
const API_TIMEOUT_MS = 10000;
async function api(path, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), API_TIMEOUT_MS); // never wait forever
  let r, text;
  try {
    r = await fetch(path, { headers: { Accept: "application/json" }, signal: ctl.signal, ...opts });
    text = await r.text();
  } finally { clearTimeout(timer); }
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, ok: r.ok, body, headers: r.headers };
}

let tree;
let live = false;

async function loadState() {
  const r = await api("/api/state");
  if (!r.ok) throw new Error("GET /api/state: " + r.status);
  store.load(r.body);
  tree.live = false;
  for (const [id, n] of tree.nodes) { n.g.remove(); }
  tree.nodes.clear(); tree.gEdges.replaceChildren(); tree.edges.clear(); tree.gFx.replaceChildren();
  tree.schedule();
  // recent history to feed the transaction stream (optional: ignored on failure)
  try {
    const since = Math.max(0, store.lastSeq - 200);
    const ev = await api(`/api/events?since=${since}&limit=200`);
    const list = Array.isArray(ev.body) ? ev.body : ev.body?.events;
    if (ev.ok && Array.isArray(list)) for (const e of list) { if (e.seq <= store.lastSeq) store.apply(e, { live: false }); }
  } catch { /* ignored */ }
  await loadHealth();
  await loadCatalogue();
  setTimeout(() => { tree.live = true; }, 600);
  markDirty("all");
}

// Profession catalogue (GET /api/catalogue). Clean fallback on 404 or error: local labels, no price or rubric.
let catalogue = null; // Map id -> {id,label,refUsd,nearPrice,deliverable,rubric,acceptScore}
let catalogueEvents = null; // MarketEvent[] active server-side (null = unknown)
async function loadCatalogue() {
  try {
    const r = await api("/api/catalogue");
    if (r.ok && Array.isArray(r.body?.professions)) {
      catalogue = new Map(r.body.professions.map((p) => (p && typeof p === "object" ? { ...p, id: p.id ?? p.profession } : p)).filter((p) => p && typeof p.id === "string").map((p) => [p.id, p]));
      catalogueEvents = Array.isArray(r.body.activeEvents ?? r.body.events) ? (r.body.activeEvents ?? r.body.events) : null;
      for (const e of catalogueEvents ?? []) store.addMarketEvent(e);
    } else { catalogue = null; catalogueEvents = null; }
  } catch { catalogue = null; catalogueEvents = null; }
  buildProfessionSelect();
  markDirty("market", "spec", "legend");
}
const specOf = (p) => catalogue?.get(p) ?? null;
const labelOf = (p) => specOf(p)?.label ?? profOf(p).label;

async function loadHealth() {
  try {
    const r = await api("/api/health");
    if (r.ok) {
      store.health = r.body; markDirty("banners", "tools", "header", "replay");
      if (r.body?.replay && !replayPoll) replayPoll = setInterval(loadHealth, 4000); // replay mode: player progress and speed
    }
  } catch { /* ignored */ }
}
let replayPoll = 0;

// ---------------------------------------------------------------- SSE with resume
let es = null;
let retries = 0;
let reconnectTimer = 0;
let wasDown = false;
let gapStreak = 0, okStreak = 0, invalidMsgs = 0;
const KNOWN = new Set(EVENT_TYPES);
function isValidEvent(ev) {
  return !!ev && typeof ev === "object" && !Array.isArray(ev) && Number.isSafeInteger(ev.seq) && ev.seq > 0
    && typeof ev.type === "string" && KNOWN.has(ev.type) && (ev.data == null || (typeof ev.data === "object" && !Array.isArray(ev.data)));
}
function setConn(state, text) {
  const c = $("conn");
  c.dataset.state = state;
  $("connText").textContent = text;
}
function connect() {
  clearTimeout(reconnectTimer);
  if (es) es.close();
  es = new EventSource(`/api/stream?since=${store.lastSeq}`);
  es.onopen = async () => {
    retries = 0;
    setConn("live", "Live");
    if (wasDown) { wasDown = false; await resyncIfRestarted(); }
  };
  const onMsg = (m) => {
    let ev;
    try { ev = JSON.parse(m.data); } catch { invalidMsgs++; return; }
    if (!isValidEvent(ev)) { invalidMsgs++; return; } // null, non-object, unknown type, invalid seq: ignored without effect
    if (ev.seq > store.lastSeq + 1 && store.lastSeq > 0) { // gap: reopen from the last known seq, with growing delay
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
  es.addEventListener("reset", () => { // the server restarted: clear the display, the replay from the start follows on this same stream
    const keep = { mode: store.mode, chain: store.chain, brain: store.brain, health: store.health };
    store.reset(); Object.assign(store, keep);
    for (const [, n] of tree.nodes) n.g.remove();
    tree.nodes.clear(); tree.gEdges.replaceChildren(); tree.edges.clear(); tree.gFx.replaceChildren();
    delivCache.clear(); selectedAgent = null; selectedLetter = null; agentRows.clear(); feedRows.clear(); chronRows.clear(); $("chron").replaceChildren();
    $("agents").replaceChildren(); $("feed").replaceChildren();
    tree.schedule(); markDirty("all");
  });
  es.onerror = () => {
    wasDown = true;
    retries++;
    setConn("retry", `Reconnecting… (attempt ${retries})`);
    if (es.readyState === EventSource.CLOSED) {
      const delay = Math.min(10000, 800 * 2 ** Math.min(retries, 4));
      reconnectTimer = setTimeout(connect, delay);
    }
    if (retries > 6) setConn("down", `Offline (attempt ${retries})`);
  };
}
async function resyncIfRestarted() {
  try {
    const r = await api("/api/state");
    if (r.ok && r.body.lastSeq < store.lastSeq) { await loadState(); connect(); } // the server restarted (log starts again from zero)
  } catch { /* ignored */ }
}

// ---------------------------------------------------------------- events -> visual effects
function handleEvent(ev) {
  try { applyEvent(ev); } catch (e) { console.warn("event ignored", ev?.type, e?.message); }
}
function applyEvent(ev) {
  store.apply(ev);
  const d = ev.data ?? {};
  switch (ev.type) {
    case "agent.born": case "agent.died": case "agent.reproduced":
      tree.schedule(); markDirty("agents", "lineages", "header", "letters"); break;
    case "balance.changed":
      tree.schedule(); markDirty("agents");
      if (d.reason === "task" || d.reason === "brain" || d.reason === "birth") tree.float(d.agentId, signedNear(d.delta), big(d.delta) >= 0n ? "up" : "down");
      break;
    case "escrow.released": { const a = store.agentByAccount(d.payee); if (a) tree.pulse(a.id); markDirty("tasks", "chron", "feed", "header"); break; }
    case "letter.written": markDirty("letters", "chron"); break;
    case "sim.tick": markDirty("header", "market"); break;
    case "market.event": markDirty("market"); break;
    case "population.snapshot": markDirty("spec"); break;
    case "deliverable.produced": delivCache.delete(d.taskId); markDirty("tasks"); break;
    case "task.validated": delivCache.delete(d.taskId); break;
    case "sim.started": case "sim.paused": case "sim.resumed": case "sim.stopped": markDirty("header", "banners", "chron"); break;
    case "system.warning": case "system.error": markDirty("banners"); break;
    default: break;
  }
  markDirty("feed", "tasks", "chron");
  $("tickInfo").textContent = `tick ${store.tick} · #${store.lastSeq}`;
}

// ---------------------------------------------------------------- rendering
function render() {
  renderQueued = false;
  const all = dirty.has("all");
  if (all || dirty.has("header")) renderHeader();
  if (all || dirty.has("replay")) renderReplayBar();
  if (all || dirty.has("banners")) renderBanners();
  if (all || dirty.has("tools")) renderTools();
  if (all || dirty.has("agents")) renderAgents();
  if (all || dirty.has("lineages")) renderLineages();
  if (all || dirty.has("feed")) renderFeed();
  if (all || dirty.has("chron")) renderChron();
  if (all || dirty.has("tasks")) renderTasks();
  if (all || dirty.has("letters")) renderLetters();
  if (all || dirty.has("legend")) renderLegend();
  if (all || dirty.has("spec")) renderSpec();
  if (all || dirty.has("market")) renderMarket();
  dirty.clear();
}

let lastGen = 0;
function renderHeader() {
  const t = store.totals;
  const alive = [...store.agents.values()].filter((a) => a.status === "alive").length;
  const dead = store.agents.size - alive;
  $("stAlive").textContent = alive;
  $("stDead").textContent = dead;
  $("stBorn").textContent = store.agents.size;
  $("stSettled").textContent = t.tasksSettled ?? 0;
  let total = 0n;
  for (const a of store.agents.values()) if (a.status === "alive") total += big(a.balance ?? 0);
  $("stTotal").textContent = formatNear(total, 1);
  const g = store.generations;
  const el = $("genNum");
  el.textContent = g;
  if (g > lastGen && lastGen > 0) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  lastGen = g;
  $("tickInfo").textContent = `tick ${store.tick} · #${store.lastSeq}`;
}

function pill(cls, strong, rest, title) {
  return h("li", { class: `pill ${cls}`, title }, h("strong", null, strong), rest ? " " + rest : "");
}
// Replay mode (L17): permanent banner. Nothing is displayed in live or mock mode (/api/health without a `replay` field).
function renderReplayBar() {
  const bar = $("replayBar");
  const rp = store.health?.replay;
  if (!rp) { bar.hidden = true; return; }
  const on = rp.meta?.recordedOn ? new Date(`${rp.meta.recordedOn}T00:00:00Z`) : null;
  const date = on && !Number.isNaN(on.getTime()) ? on.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "unknown date";
  const rec = rp.meta?.recorded ?? {};
  const kind = rec.chain === "near" ? "real testnet run" : "recorded run";
  const phase = { playing: "playing", paused: "paused", ended: "finished" }[rp.phase] ?? rp.phase;
  const speeds = [1, 5, 20].map((v) => h("button", { type: "button", "aria-pressed": String(rp.speed === v), onclick: () => replayCtl("speed", { speed: v }) }, `x${v}`));
  const extra = rp.phase === "ended" ? h("button", { type: "button", onclick: () => replayCtl("restart") }, "Replay again") : null;
  bar.replaceChildren(
    h("b", null, rp.meta?.label ?? `Replay of a ${kind} from ${date}`),
    h("span", { class: "muted small" }, `${phase} · event ${rp.position}/${rp.total} · transactions are real nearblocks links, no action is written during the replay`),
    h("span", { class: "rp-ctl" }, ...speeds, extra),
  );
  bar.hidden = false;
}
async function replayCtl(name, body) {
  try { const r = await api(`/api/replay/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body ?? {}) }); if (r.ok && store.health) { store.health.replay = r.body; markDirty("replay"); } } catch { /* token required or server stopped: no effect */ }
}

function renderBanners() {
  const ul = $("banners");
  const mode = store.mode;
  const mockChain = store.health?.mock ?? store.chain.kind === "mock";
  const mockBrain = store.brain.kind === "mock";
  const esc = store.health?.escrow;
  const items = [];
  if (mode === "mock" || mockChain) items.push(pill("warn", "MOCK MODE", "simulated chain and AI, no real NEAR.", "No transaction is written on the chain."));
  else items.push(pill("ok", "NEAR TESTNET", "valueless test funds, verifiable transactions.", "NEAR test network."));
  if (!mockChain && mockBrain) items.push(pill("warn", "Mock AI", "simulated brain (no NEAR AI Cloud key).", ""));
  items.push(pill("info", "Simulated client", "tasks tagged \"simulated\" = artificial client.", ""));
  items.push(pill("info", "Visitor (funded by the demo account)", "you do not pay, the demo account advances the budget.", ""));
  if (esc === "operator-account") items.push(pill("danger", "Degraded escrow", "account driven by the operator, no contract. Registry and reputation: local log.", "Degraded mode announced by the server (/api/health)."));
  else if (mode === "mock" || mockChain) items.push(pill("warn", "Simulated escrow", "held in memory (mock).", ""));
  else if (esc === "contract") items.push(pill("ok", "Contract escrow", store.chain.contractId ? `Contract ${store.chain.contractId}.` : "Darwin contract on testnet.", ""));
  else items.push(pill("neutral", "Escrow", "State not reported by the server.", ""));
  items.push(pill("info", "Trust model", "the operator validates the results (\"validated by\" on each payment).", ""));
  for (const w of store.warnings.slice(0, 2)) items.push(pill(w.level === "error" ? "danger" : "warn", w.level === "error" ? "Error" : "Warning", `${w.code}: ${w.message}`, ""));
  ul.replaceChildren(...items);
  // the summary (the only visible part when the block is collapsed on mobile) recalls the essentials
  const keys = items.slice(0, 4).map((li) => li.firstChild.textContent).filter((t) => !/^Visitor/.test(t));
  $("honesty").firstElementChild.textContent = `Transparency: ${keys.join(" · ")}`;
}

function renderTools() {
  const near = store.chain.kind === "near" && !store.health?.mock;
  const esc = store.health?.escrow;
  const tools = [
    ["NEAR testnet (RPC FastNEAR)", near ? "active: accounts, transfers, on-chain proofs" : "simulated (mock): no network call", near],
    ["Contrat Darwin (near-sdk, Rust)", near ? (esc === "operator-account" ? "degraded: escrow via operator account, local ledger" : "registry, escrow, reputation") : "simulated (mock)", near && esc !== "operator-account"],
    ["NEAR AI Cloud", store.brain.kind === "nearai" ? "active: agents' brain, cost per `usage` tokens" : "simulated (mock): fictitious AI costs", store.brain.kind === "nearai"],
    ["NEAR Intents (1Click)", "V2: quotes in simulation only, disabled by default", false],
    ["testnet.nearblocks.io explorer", near ? "link on every transaction that has a hash" : "no link in mock (fictitious hashes)", near],
  ];
  $("tools").replaceChildren(...tools.map(([n, s, on]) => h("li", { class: on ? "on" : "off" }, h("strong", null, n), h("span", null, s), h("span", { class: "tag-state" }, on ? "real" : "simulated / inactive"))));
}

// --- agents (keyed list, reordered only if the order changes)
const agentRows = new Map();
function renderAgents() {
  const list = [...store.agents.values()];
  list.sort((a, b) => (a.status === b.status ? 0 : a.status === "alive" ? -1 : 1) || (nearNumber(b.balance) - nearNumber(a.balance)) || a.id.localeCompare(b.id));
  const max = Math.max(1, ...list.filter((a) => a.status === "alive").map((a) => nearNumber(a.balance)));
  const ul = $("agents");
  $("agentsHint").textContent = `${list.filter((a) => a.status === "alive").length} alive`;
  const seen = new Set();
  const rows = [];
  for (const a of list) {
    seen.add(a.id);
    let r = agentRows.get(a.id);
    if (!r) {
      const prof = profOf(a.genome?.profession);
      const bar = h("span", { class: "bar-fill" });
      const bal = h("span", { class: "bal" });
      const btn = h("button", { type: "button", class: "agent-btn", onclick: () => selectAgent(a.id) },
        h("span", { class: `sw ${prof.cls}`, "aria-hidden": "true" }, prof.glyph),
        h("span", { class: "nm" }, a.name, h("small", null, ` g${a.generation}`)),
        h("span", { class: "bar", "aria-hidden": "true" }, bar), bal);
      r = { li: h("li", null, btn), bar, bal, btn };
      agentRows.set(a.id, r);
    }
    const dead = a.status === "dead";
    r.li.classList.toggle("dead", dead);
    r.li.classList.toggle("sel", selectedAgent === a.id);
    r.bar.style.width = dead ? "0%" : `${Math.max(2, (nearNumber(a.balance) / max) * 100)}%`;
    r.bal.textContent = dead ? "dead" : formatNear(a.balance, 2);
    r.btn.setAttribute("aria-label", `${a.name}, generation ${a.generation}, ${dead ? "dead" : formatNear(a.balance, 2) + " NEAR"}. Open profile.`);
    rows.push(r.li);
  }
  const cur = [...ul.children];
  if (cur.length !== rows.length || cur.some((c, i) => c !== rows[i])) ul.replaceChildren(...rows);
  for (const id of [...agentRows.keys()]) if (!seen.has(id)) agentRows.delete(id);
}

function renderLineages() {
  const stats = store.lineageStats();
  const max = Math.max(1, ...stats.map((s) => s.total));
  $("lineages").replaceChildren(...stats.map((s, i) => {
    const st = s.alive === 0 ? "extinct" : s.alive >= 3 ? "thriving" : "fragile";
    const cls = s.alive === 0 ? "extinct" : s.alive >= 3 ? "thrive" : "frail";
    return h("li", { class: `lin ${cls}`, "data-l": String((i) % 8) },
      h("span", { class: "lin-dot", "aria-hidden": "true" }),
      h("span", { class: "lin-name" }, `Lineage ${s.root.name}`),
      h("span", { class: "lin-bar", role: "img", "aria-label": `${s.alive} alive out of ${s.total}` },
        h("span", { class: "lin-total", css: { width: `${(s.total / max) * 100}%` } }, h("span", { class: "lin-alive", css: { width: `${(s.alive / s.total) * 100}%` } }))),
      h("span", { class: "lin-txt" }, `${s.alive}/${s.total} alive${s.total - s.alive ? ` · ${s.total - s.alive} dead` : ""} · gen. ${s.maxGen} · `, h("b", null, st)));
  }));
}

// --- transaction stream
const feedRows = new Map();
function renderFeed() {
  const ol = $("feed");
  $("feedHint").textContent = store.chain.kind === "near" ? "testnet.nearblocks.io links" : "fictitious hashes (mock), no explorer";
  const shown = store.feed.filter((it) => $("showMinor").checked || !it.minor).slice(0, 60);
  const rows = shown.map((it) => {
    const fk = it.key + "|" + it.label;
    let r = feedRows.get(fk);
    if (!r) {
      const who = (a) => { if (!a) return null; const ag = store.agentByAccount(a); return ag ? ag.name : a.split(".")[0]; };
      const flow = [who(it.from), who(it.to)].filter(Boolean).join(" → ");
      const hashEl = it.url
        ? h("a", { href: it.url, target: "_blank", rel: "noopener noreferrer", class: "hash", "aria-label": `View transaction ${it.hash} on the explorer (new tab)` }, shortHash(it.hash), " ↗")
        : h("span", { class: "hash", title: it.hash }, shortHash(it.hash));
      r = h("li", { class: it.fresh ? "fresh" : "" },
        h("div", { class: "tx-top" }, h("span", { class: "tx-label" }, it.label ?? "Transaction"), it.amount != null ? h("span", { class: "tx-amt" }, formatNear(it.amount, 2), " NEAR") : null),
        h("div", { class: "tx-bot" }, h("span", { class: "tx-flow" }, flow || " "), h("span", { class: "tx-h" }, it.mock ? h("span", { class: "badge b-mock", title: "Fictitious hash: simulated transaction" }, "mock") : null, hashEl)));
      feedRows.set(fk, r);
      it.fresh = false;
    }
    return r;
  });
  syncList(ol, rows);
  const keep = new Set(shown.map((i) => i.key + "|" + i.label));
  for (const k of [...feedRows.keys()]) if (!keep.has(k)) feedRows.delete(k);
}

// Replaces the children only if the order/content changes: a useless replaceChildren restarts CSS animations.
function syncList(ul, rows) {
  const cur = ul.children;
  if (cur.length === rows.length && rows.every((r, i) => cur[i] === r)) return;
  const want = new Set(rows);
  for (const c of [...cur]) if (!want.has(c)) c.remove();
  rows.forEach((r, i) => { if (ul.children[i] !== r) ul.insertBefore(r, ul.children[i] ?? null); });
}
const chronRows = new Map();
function renderChron() {
  const items = store.chronicle.slice(0, 60);
  syncList($("chron"), items.map((c) => {
    const ck = c.seq + c.text;
    if (chronRows.has(ck)) return chronRows.get(ck);
    const icon = { birth: "✦", death: "✝", pay: "◆", letter: "✉", mut: "≈", sys: "•" }[c.kind] ?? "•";
    const li = h("li", { class: `ch-${c.kind}` }, h("span", { class: "ch-i", "aria-hidden": "true" }, icon), h("span", { class: "ch-t" }, c.text), h("span", { class: "ch-tick" }, `t${c.tick}`));
    if (c.agentId) { li.tabIndex = 0; li.classList.add("click"); li.addEventListener("click", () => selectAgent(c.agentId)); li.addEventListener("keydown", (e) => { if (e.key === "Enter") selectAgent(c.agentId); }); }
    chronRows.set(ck, li);
    return li;
  }));
  const keep = new Set(items.map((c) => c.seq + c.text));
  for (const k of [...chronRows.keys()]) if (!keep.has(k)) chronRows.delete(k);
}

// --- profession legend (tree) and specialization
function renderLegend() {
  const sw = (id) => h("li", null, h("span", { class: `sw ${profOf(id).cls}`, "aria-hidden": "true" }, profOf(id).glyph), labelOf(id));
  $("legend").replaceChildren(...PROFESSION_IDS.map(sw), h("li", { class: "lg-note" }, "Size = balance, ring = lineage, gray = dead"));
}
function renderSpec() {
  const snap = store.snapshot;
  const gens = snap ? Object.keys(snap.byGeneration).map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [];
  const totals = Object.fromEntries(PROFESSION_IDS.map((p) => [p, 0]));
  const rows = gens.map((g) => {
    const rec = snap.byGeneration[String(g)] ?? {};
    const parts = PROFESSION_IDS.map((p) => [p, Math.max(0, Number(rec[p]) || 0)]);
    parts.forEach(([p, n]) => { totals[p] += n; });
    return { g, parts, sum: parts.reduce((s, [, n]) => s + n, 0) };
  });
  const maxSum = Math.max(1, ...rows.map((r) => r.sum));
  const alive = Object.values(totals).reduce((s, n) => s + n, 0);
  $("specHint").textContent = snap ? `${alive} alive · tick ${snap.tick}` : "";
  const dom = PROFESSION_IDS.filter((p) => totals[p] > 0).sort((a, b) => totals[b] - totals[a])[0];
  $("specLegend").replaceChildren(...PROFESSION_IDS.map((p) => h("li", { class: totals[p] === 0 && snap ? "zero" : null },
    h("span", { class: `sw ${profOf(p).cls}`, "aria-hidden": "true" }, profOf(p).glyph), `${labelOf(p)} `, h("b", null, snap ? totals[p] : ""))));
  if (!snap) { $("spec").replaceChildren(h("li", { class: "muted" }, "Waiting for the first population snapshot…")); return; }
  if (!rows.length) { $("spec").replaceChildren(h("li", { class: "muted" }, "No living agent.")); return; }
  const out = rows.map((r) => {
    const label = `Generation ${r.g}: ${r.parts.filter(([, n]) => n).map(([p, n]) => `${labelOf(p)} ${n}`).join(", ") || "none alive"}`;
    return h("li", { class: "spec-row", "aria-label": label },
      h("span", { class: "spec-gen", "aria-hidden": "true" }, `Gen. ${r.g}`),
      h("span", { class: "spec-bar", "aria-hidden": "true", css: { width: `${Math.max(r.sum ? 6 : 0, (r.sum / maxSum) * 100)}%` } },
        ...r.parts.filter(([, n]) => n > 0).map(([p, n]) => h("span", { class: `seg ${profOf(p).cls}`, title: `${labelOf(p)}: ${n}`, css: { flexGrow: String(n) } }, h("b", null, n)))),
      h("span", { class: "spec-n", "aria-hidden": "true" }, r.sum ? `${r.sum} alive` : "extinct"));
  });
  if (dom) out.push(h("li", { class: "spec-note muted small" }, `Dominant profession: ${labelOf(dom)} (${totals[dom]} of ${alive}). Hypothesis: lineages that specialize where demand is strong should survive better.`));
  $("spec").replaceChildren(...out);
}

// --- market: demand events, history, floor price
function renderMarket() {
  const tick = store.tick;
  const server = catalogueEvents && catalogueEvents.length ? catalogueEvents : null;
  const active = server ?? store.activeMarketEvents();
  const activeIds = new Set(active.map((e) => e.id));
  const evLi = (e, isActive) => {
    const up = e.demandMultiplier >= 1;
    const left = Math.max(0, (e.endTick ?? 0) - tick);
    return h("li", { class: `mev ${up ? "up" : "down"}${isActive ? " on" : ""}` },
      h("span", { class: "mev-mult", "aria-label": `Demand ${up ? "rising" : "falling"} ${multLabel(e.demandMultiplier)}` }, (up ? "▲ " : "▼ ") + multLabel(e.demandMultiplier)),
      h("span", { class: "mev-main" }, h("b", { class: "mev-title" }, e.title), " ", h("span", { class: `sw sm ${profOf(e.profession).cls}`, "aria-hidden": "true" }, profOf(e.profession).glyph), h("span", { class: "muted small" }, ` ${labelOf(e.profession)}`)),
      h("span", { class: "mev-left" }, isActive ? (left === 0 ? "last tick" : `${left} tick${left > 1 ? "s" : ""} left`) : `ended (tick ${e.endTick})`));
  };
  $("marketHint").textContent = active.length ? `${active.length} ongoing` : "quiet market";
  $("mActive").replaceChildren(...(active.length ? active.map((e) => evLi(e, true)) : [h("li", { class: "muted small" }, "No ongoing event: demand follows the reference prices.")]));
  const hist = store.marketEvents.filter((e) => !activeIds.has(e.id)).slice(0, 20);
  $("mHist").replaceChildren(...(hist.length ? hist.map((e) => evLi(e, false)) : [h("li", { class: "muted small" }, "No past event.")]));
  $("prices").replaceChildren(...PROFESSION_IDS.map((p) => {
    const s = specOf(p);
    return h("li", null, h("span", { class: `sw sm ${profOf(p).cls}`, "aria-hidden": "true" }, profOf(p).glyph), h("span", null, labelOf(p)),
      h("b", null, s ? `${nearInput(s.nearPrice)} NEAR` : "n/a"), s ? h("small", { class: "muted" }, `ref. $${s.refUsd}`) : null);
  }));
}

// --- tasks: lifecycle + deliverable
const delivCache = new Map(); // taskId -> {state: "loading"|"ok"|"none"|"err", node?}
function ensureDeliverable(t) {
  const c = delivCache.get(t.id);
  if (c) return c;
  const entry = { state: "loading", node: null };
  delivCache.set(t.id, entry);
  api(`/api/tasks/${encodeURIComponent(t.id)}/deliverable`).then((r) => {
    if (delivCache.get(t.id) !== entry) return; // invalidated in the meantime
    if (r.ok && r.body && Array.isArray(r.body.files)) { entry.state = "ok"; entry.node = buildDeliverable(r.body, specOf(r.body.profession ?? t.profession), labelOf(r.body.profession ?? t.profession)); }
    else entry.state = r.status === 404 ? "none" : "err";
    markDirty("tasks");
  }).catch(() => { if (delivCache.get(t.id) === entry) { entry.state = "err"; markDirty("tasks"); } });
  return entry;
}
function lifecycle(t) {
  const bids = t.bids ?? store.bidCount.get(t.id) ?? (t.bidIds?.length ?? 0);
  const past = (...s) => s.includes(t.status);
  const refunded = t.status === "rejected" || t.escrow?.status === "refunded";
  const steps = [
    { label: "Posted", done: true },
    { label: "Bidding", done: bids > 0 || !past("posted"), note: bids ? `${bids} bid${bids > 1 ? "s" : ""}` : "" },
    { label: "Awarded", done: !!t.winnerId || past("awarded", "submitted", "settled", "rejected"), tx: [t.escrow?.lockTx, "escrow"] },
    { label: "Delivered", done: !!t.result || store.deliverables.has(t.id) || past("submitted", "settled", "rejected") },
    { label: "Validated", done: !!t.validation, note: t.validation ? (t.validation.verdict === "accepted" ? "accepted" : "rejected") : "" },
    refunded ? { label: "Refunded", done: true, bad: true, tx: [t.escrow?.settleTx, "refund"] }
      : t.status === "expired" ? { label: "Expired", done: true, bad: true }
      : { label: "Paid", done: t.status === "settled", tx: [t.escrow?.settleTx, "payment"] },
  ];
  const cur = steps.findIndex((s) => !s.done);
  return h("ol", { class: "life", "aria-label": "Task lifecycle" }, steps.map((s, i) => h("li", { class: `${s.done ? "done" : i === cur ? "now" : ""}${s.bad ? " bad" : ""}`, "aria-current": i === cur ? "step" : null },
    h("span", { class: "life-dot", "aria-hidden": "true" }, s.done ? (s.bad ? "✕" : "✓") : String(i + 1)),
    h("span", { class: "life-l" }, s.label, s.note ? h("small", null, s.note) : null, s.tx && s.tx[0] ? txChip(s.tx[0], s.tx[1]) : null))));
}
function txChip(hash, label) {
  const url = store.feedByHash.get(hash)?.url;
  const mock = /^mock_/.test(hash) || store.chain.kind === "mock";
  return url
    ? h("a", { class: "txchip", href: url, target: "_blank", rel: "noopener noreferrer", title: `View the transaction (${label}) on the explorer`, "aria-label": `${label} transaction ${hash}, new tab` }, shortHash(hash), " ↗")
    : h("code", { class: "txchip", title: `${label}: ${hash}${mock ? " (fictitious hash, no real transaction)" : ""}` }, shortHash(hash), mock ? " · mock" : "");
}
function deliverableBlock(t) {
  const known = store.deliverables.has(t.id) || t.validation || t.result || ["submitted", "settled", "rejected"].includes(t.status);
  if (!known || (!openTaskIds.has(t.id) && !delivCache.has(t.id))) return null; // only open tasks are loaded
  const e = ensureDeliverable(t);
  if (e.state === "ok") return e.node;
  return h("p", { class: "muted small" }, e.state === "loading" ? "Loading the deliverable…" : e.state === "none" ? "Deliverable not available on this server (raw text above)." : "Deliverable temporarily unavailable.");
}

// --- tasks
function renderTasks() {
  const sorted = [...store.tasks.values()].sort((a, b) => b.id.localeCompare(a.id));
  const list = sorted.filter((t, i) => i < 14 || openTaskIds.has(t.id)); // an open task stays displayed even when new ones arrive
  $("tasksHint").textContent = store.tasksOpen != null ? `${store.tasksOpen} open` : "";
  $("tasks").replaceChildren(...list.map((t) => {
    const rb = requesterBadge(t.requester, t.badge);
    const win = t.winnerId ? store.name(t.winnerId) : null;
    const price = t.awardPrice ?? t.escrow?.amount;
    const det = h("details", { class: "task", open: openTaskIds.has(t.id) || null, ontoggle: (e) => { if (e.target.open) { openTaskIds.add(t.id); if (!delivCache.has(t.id)) markDirty("tasks"); } else openTaskIds.delete(t.id); } },
      h("summary", null,
        h("span", { class: `st st-${t.status}` }, STATUS_LABEL[t.status] ?? t.status),
        h("span", { class: "t-title" }, t.title),
        h("span", { class: "t-bud" }, formatNear(t.budget, 2), " NEAR")),
      h("div", { class: "t-body" },
        h("p", null, h("span", { class: `badge ${rb.cls}`, title: rb.title }, rb.text), " ", h("span", { class: `sw sm ${profOf(t.profession).cls}`, "aria-hidden": "true" }, profOf(t.profession).glyph), " ", h("span", { class: "muted small" }, `${t.id} · ${labelOf(t.profession)}`)),
        lifecycle(t),
        t.requester?.kind === "visitor" ? h("p", { class: "small muted" }, `Requested by "${t.requester.label}" (budget advanced by the demo account).`) : null,
        h("p", { class: "t-prompt" }, t.prompt),
        win ? h("p", { class: "small" }, `Awarded to `, h("b", null, win), price ? ` for ${formatNear(price, 2)} NEAR` : "", t.bids ? ` (${t.bids} bids)` : "") : null,
        t.expiredReason ? h("p", { class: "small muted" }, `Expired: ${{ no_bids: "no bids", deadline: "deadline passed", unfunded: "payer without funds", winner_dead: "the winner died" }[t.expiredReason] ?? t.expiredReason}.`) : null,
        t.validation ? h("p", { class: "small" }, h("b", null, t.validation.verdict === "accepted" ? "Accepted" : "Rejected"), ` · validated by: `, h("code", null, t.validatedBy ?? t.validation.validator), ` · score ${Number(t.validation.score).toFixed(2)}`, t.validation.reason ? ` · ${t.validation.reason}` : "") : null,
        t.result?.text ? h("p", { class: "t-result" }, t.result.text) : null,
        t.result?.resultHash ? h("p", { class: "small muted" }, "Result hash: ", h("code", null, shortHash(t.result.resultHash))) : null,
        deliverableBlock(t)));
    return h("li", { id: `task-${t.id}` }, det);
  }));
}

// --- letters and agent profile
function selectAgent(id) {
  selectedAgent = id;
  const a = store.agents.get(id);
  if (a?.letterId) selectedLetter = a.letterId;
  tree.setSelected(id);
  markDirty("agents", "letters");
  render();
}
function bar(label, v, lo, hi) {
  const pct = Math.round(((v - lo) / (hi - lo)) * 100);
  return h("li", null, h("span", null, label), h("span", { class: "gbar", role: "img", "aria-label": `${label}: ${Number(v).toFixed(2)}` }, h("span", { css: { width: `${Math.max(3, Math.min(100, pct))}%` } })), h("b", null, Number(v).toFixed(2)));
}
async function renderLetters() {
  const fiche = $("fiche");
  const a = selectedAgent ? store.agents.get(selectedAgent) : null;
  if (a) {
    const g = a.genome ?? {};
    const parent = a.parentId ? store.agents.get(a.parentId) : null;
    fiche.replaceChildren(
      h("h3", null, a.name, " ", h("small", { class: "muted" }, `${a.id} · generation ${a.generation}`)),
      h("p", null, h("span", { class: `sw ${profOf(g.profession).cls}`, "aria-hidden": "true" }, profOf(g.profession).glyph), ` ${profOf(g.profession).label} · model `, h("code", null, g.model ?? "?"), a.status === "dead" ? h("span", { class: "badge b-dead" }, `mort (tick ${a.deathTick ?? "?"})`) : h("span", { class: "badge b-alive" }, "vivant")),
      h("dl", { class: "kv" },
        h("div", null, h("dt", null, "Balance"), h("dd", null, a.status === "dead" ? "0" : formatNear(a.balance, 3), " NEAR")),
        h("div", null, h("dt", null, "Earned"), h("dd", null, formatNear(a.earned ?? 0, 2))),
        h("div", null, h("dt", null, "Paid to the AI"), h("dd", null, formatNearSmall(a.spentBrain ?? 0))),
        h("div", null, h("dt", null, "Reputation"), h("dd", null, a.reputation ?? 0)),
        h("div", null, h("dt", null, "Tasks done"), h("dd", null, a.tasksDone ?? 0)),
        h("div", null, h("dt", null, "Children"), h("dd", null, (a.childrenIds ?? []).length))),
      h("ul", { class: "genes" }, bar("Asking price", g.askRatio ?? 0, 0.3, 1), bar("Risk", g.risk ?? 0, 0, 1), bar("Repro. threshold", g.reproThreshold ?? 1.2, 1.2, 4), bar("Generosity", g.generosity ?? 0, 0, 0.6), bar("Cooperation", g.cooperation ?? 0, 0, 1)),
      parent ? h("p", { class: "small" }, "Parent: ", h("button", { type: "button", class: "link", onclick: () => selectAgent(parent.id) }, parent.name)) : h("p", { class: "small muted" }, "Founder (generation 1)."),
      g.personality ? h("p", { class: "small persona" }, h("b", null, "Personality: "), g.personality) : null);
  }
  // letter list
  const letters = [...store.letters.values()].sort((x, y) => y.id.localeCompare(x.id));
  if (!selectedLetter && letters.length) selectedLetter = letters[0].id;
  $("letterList").replaceChildren(...letters.slice(0, 30).map((l) => h("li", null, h("button", { type: "button", class: l.id === selectedLetter ? "sel" : "", "aria-current": l.id === selectedLetter ? "true" : null, onclick: () => { selectedLetter = l.id; markDirty("letters"); } }, `${store.name(l.fromAgentId)} → ${store.name(l.toAgentId)}`, h("small", null, ` g${l.generation}`)))));
  let l = selectedLetter ? store.letters.get(selectedLetter) : null;
  if (!l && a?.letterId) { try { const r = await api(`/api/letters/${encodeURIComponent(a.letterId)}`); const lt = r.body?.letter ?? r.body; if (r.ok && lt?.id) { store.letters.set(lt.id, lt); l = lt; } } catch { /* ignored */ } }
  const box = $("letter");
  if (!l) { box.replaceChildren(h("p", { class: "muted" }, letters.length ? "Choose a letter." : "Letters appear at each birth.")); return; }
  box.replaceChildren(
    h("header", null, h("b", null, `${store.name(l.fromAgentId)} → ${store.name(l.toAgentId)}`), h("span", { class: "muted small" }, ` · generation ${l.generation} · tick ${l.tick} · model `, h("code", null, l.model ?? "?")), l.mock ? h("span", { class: "badge b-mock", title: "Letter generated by the simulated brain" }, "mock") : null),
    h("div", { class: "letter-text" }, l.text));
}

// ---------------------------------------------------------------- task form
const form = $("taskForm");
const statusBox = $("fStatus");
let cooldown = 0;
function setStatus(kind, title, lines = []) {
  statusBox.className = `form-status ${kind}`;
  statusBox.replaceChildren(h("strong", null, title), lines.length ? h("ul", null, lines.map((x) => h("li", null, x))) : null);
}
// Profession choice: labels and minimum budget come from the server catalogue (fallback: local labels, no price).
let budgetTouched = false;
function buildProfessionSelect() {
  const sel = $("fProf");
  const keep = sel.value || "logo";
  const ids = catalogue ? [...catalogue.keys()].filter((id) => PROFESSIONS[id]) : PROFESSION_IDS;
  sel.replaceChildren(...(ids.length ? ids : PROFESSION_IDS).map((id) => {
    const s = specOf(id);
    return h("option", { value: id }, s ? `${s.label} (min. ${nearInput(s.nearPrice)} NEAR)` : labelOf(id));
  }));
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : sel.options[0].value;
  onProfChange(false);
}
function minBudget(p) { const s = specOf(p); return s ? big(s.nearPrice) : null; }
function onProfChange(userAction = true) {
  const p = $("fProf").value;
  const s = specOf(p);
  const min = minBudget(p);
  if (min != null) {
    const cur = parseNearToYocto($("fBudget").value);
    if (!budgetTouched || cur == null || cur < min) { $("fBudget").value = nearInput(min); budgetTouched = false; } // deliberate input above the minimum: kept
    $("fBudgetHelp").textContent = `Minimum budget for this profession: ${nearInput(min)} NEAR (reference price of a human freelancer: $${s.refUsd}, converted at a test rate). Decimal, 6 decimals max.`;
  } else $("fBudgetHelp").textContent = "Decimal number, up to 6 decimals (e.g. 0.05). The server applies the profession's minimum budget.";
  const box = $("fProfInfo");
  const notes = [];
  if (s?.deliverable) notes.push(h("p", null, h("b", null, "Expected deliverable: "), s.deliverable));
  if (p === "legal") notes.push(h("p", { class: "warnbox" }, h("b", null, "This is not legal advice."), " The agent produces an informational checklist: have a legal professional review it before any decision."));
  if (p === "logo") notes.push(h("p", { class: "infobox" }, "The logo is original: the agent proposes 3 new drawings and never copies an existing brand. Avoid naming a brand in the instructions."));
  box.replaceChildren(...notes);
}
$("fProf").addEventListener("change", () => onProfChange(true));
$("fBudget").addEventListener("input", () => { budgetTouched = true; });
$("showMinor").addEventListener("change", () => markDirty("feed"));
$("fPrompt").addEventListener("input", (e) => { $("fPromptCount").textContent = `${e.target.value.length}/4000`; });
function lockButton(sec) {
  clearInterval(cooldown);
  const btn = $("fSubmit");
  if (!sec) { btn.disabled = false; btn.textContent = "Post the task"; return; }
  let left = Math.min(60, Math.max(1, Math.ceil(sec)));
  btn.disabled = true;
  const tickBtn = () => { btn.textContent = `Retry in ${left} s`; if (left-- <= 0) { clearInterval(cooldown); lockButton(0); } };
  tickBtn(); cooldown = setInterval(tickBtn, 1000);
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {
    title: String(fd.get("title") ?? "").trim(),
    prompt: String(fd.get("prompt") ?? "").trim(),
    profession: fd.get("profession"),
    budgetNear: String(fd.get("budgetNear") ?? "").trim().replace(",", "."),
    requesterLabel: String(fd.get("requesterLabel") ?? "").trim() || "visitor",
  };
  const local = [];
  if (payload.title.length < 3) local.push("Title: 3 characters minimum.");
  if (payload.prompt.length < 10) local.push("Instructions: 10 characters minimum.");
  if (!/^\d+(\.\d{1,6})?$/.test(payload.budgetNear)) local.push("Budget: decimal number in NEAR, 6 decimals maximum (e.g. 1.5).");
  const min = minBudget(payload.profession), cur = parseNearToYocto(payload.budgetNear);
  if (min != null && cur != null && cur < min) local.push(`Budget too low: the minimum for "${labelOf(payload.profession)}" is ${nearInput(min)} NEAR (you offer ${payload.budgetNear}). Increase the budget or choose another profession.`);
  if (local.length) { setStatus("err", local.length === 1 && cur != null && min != null && cur < min ? "Budget too low" : "Incomplete form", local); return; }
  const btn = $("fSubmit");
  btn.disabled = true; btn.textContent = "Sending…";
  setStatus("info", "Sending…");
  try {
    const r = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    const retry = Number(r.headers.get("Retry-After")) || 0;
    if (r.status === 201 || r.status === 200) {
      const t = r.body ?? {};
      if (t.id && !store.tasks.has(t.id)) { store.tasks.set(t.id, t); }
      setStatus("ok", `Task ${t.id ?? ""} posted`, ["Agents of this profession bid at the next tick. Follow it in the market below.", "Budget advanced by the demo account."]);
      form.reset(); $("fPromptCount").textContent = "0/4000"; $("fProf").value = payload.profession; $("fBudget").value = payload.budgetNear; $("fLabel").value = payload.requesterLabel; onProfChange(true);
      markDirty("tasks"); lockButton(0);
      if (t.id) { openTaskIds.add(t.id); setTimeout(() => { render(); document.getElementById(`task-${t.id}`)?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, 300); }
    } else if (r.status === 400) {
      const msgs = errorMessages(r.body);
      const low = msgs.some((m) => /budget|too low|minimum|trop bas/i.test(m));
      setStatus("err", low ? "Budget rejected by the server (400)" : "The server rejects this task (400)", msgs.length ? msgs : ["Invalid data."]); lockButton(0);
    } else if (r.status === 429) {
      const m = errorMessages(r.body);
      setStatus("warn", "Too many requests (429)", [...(m.length ? m : ["Limit reached: too many open tasks or hourly cap of the demo account."]), retry ? `Try again in ${retry} s.` : "Try again in a moment."]); lockButton(retry || 15);
    } else if (r.status === 503) {
      const m = errorMessages(r.body);
      const pending = r.body?.error?.code === "VALIDATION_PENDING"; // waiting state (validation in progress), not an outage
      setStatus("warn", pending ? "Validation in progress: please wait (503)" : "Service unavailable (503)", [...(m.length ? m : ["The simulation is not accepting tasks right now."]), pending ? "This is not an outage: try again in a moment." : "Try again in a few seconds."]); lockButton(retry || 5);
    } else if (r.status === 413 || r.status === 415) {
      setStatus("err", r.status === 413 ? "Message too large (413)" : "Format not accepted (415)", errorMessages(r.body)); lockButton(0);
    } else if (r.status === 403) {
      setStatus("err", "Request refused (403)", ["Open the page from the same address as the server (anti-CSRF protection).", ...errorMessages(r.body)]); lockButton(0);
    } else {
      setStatus("err", `Unexpected error (${r.status})`, errorMessages(r.body)); lockButton(0);
    }
  } catch (err) {
    setStatus("err", "Server unreachable", ["Check that the backend is running, then try again."]); lockButton(0);
  }
});

// ---------------------------------------------------------------- startup
function boot() {
  tree = new Tree($("tree"), store, { onSelect: selectAgent });
  if (/[?&]debug\b/.test(location.search)) window.__darwin = { store, tree, stats: () => ({ invalidMsgs, gapStreak }) }; // reserved for ?debug mode
  if (innerWidth < 700) $("honesty").open = false;
  loadState().then(() => { connect(); }).catch((e) => {
    setConn("down", "Backend unreachable");
    $("banners").replaceChildren(pill("danger", "Backend unreachable", String(e.message ?? e), ""));
    setTimeout(boot2, 3000);
  });
}
function boot2() { loadState().then(connect).catch(() => setTimeout(boot2, 3000)); }
setInterval(loadHealth, 20000);
setInterval(() => { if (live || store.lastSeq > 0) loadCatalogue(); }, 30000);
buildProfessionSelect();
markDirty("legend", "spec", "market");
boot();
