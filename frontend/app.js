// Point d'entrée : chargement de l'état, flux SSE avec reprise, rendu des panneaux, formulaire de tâche.
// Aucune logique métier ici : la page reflète le journal d'événements. Aucun innerHTML (tout via textContent / h()).
import { Store, EVENT_TYPES } from "./store.js";
import { Tree } from "./tree.js";
import { big, formatNear, signedNear, nearNumber, shortHash, profOf, requesterBadge, STATUS_LABEL, h, errorMessages, TESTNET_EXPLORER, PROFESSIONS, PROFESSION_IDS, parseNearToYocto, nearInput, usd, multLabel } from "./format.js";
import { buildDeliverable } from "./deliverable.js";

const $ = (id) => document.getElementById(id);
const store = new Store();
let selectedAgent = null;
let selectedLetter = null;
let openTaskIds = new Set();
const dirty = new Set();
let renderQueued = false;
const markDirty = (...p) => { p.forEach((x) => dirty.add(x)); if (!renderQueued) { renderQueued = true; setTimeout(render, 120); } };

// ---------------------------------------------------------------- thème
$("themeBtn").addEventListener("click", () => {
  const root = document.documentElement;
  const cur = root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = cur === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("darwin-theme", next); } catch { /* stockage indisponible : sans effet */ }
});

// ---------------------------------------------------------------- réseau
const API_TIMEOUT_MS = 10000;
async function api(path, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), API_TIMEOUT_MS); // jamais d'attente infinie
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
  if (!r.ok) throw new Error("GET /api/state : " + r.status);
  store.load(r.body);
  tree.live = false;
  for (const [id, n] of tree.nodes) { n.g.remove(); }
  tree.nodes.clear(); tree.gEdges.replaceChildren(); tree.edges.clear(); tree.gFx.replaceChildren();
  tree.schedule();
  // historique récent pour alimenter le flux de transactions (facultatif : ignoré en cas d'échec)
  try {
    const since = Math.max(0, store.lastSeq - 200);
    const ev = await api(`/api/events?since=${since}&limit=200`);
    const list = Array.isArray(ev.body) ? ev.body : ev.body?.events;
    if (ev.ok && Array.isArray(list)) for (const e of list) { if (e.seq <= store.lastSeq) store.apply(e, { live: false }); }
  } catch { /* ignoré */ }
  await loadHealth();
  await loadCatalogue();
  setTimeout(() => { tree.live = true; }, 600);
  markDirty("all");
}

// Catalogue des métiers (GET /api/catalogue). Repli propre si 404 ou erreur : libellés locaux, sans prix ni grille.
let catalogue = null; // Map id -> {id,label,refUsd,nearPrice,deliverable,rubric,acceptScore}
let catalogueEvents = null; // MarketEvent[] actifs côté serveur (null = inconnu)
async function loadCatalogue() {
  try {
    const r = await api("/api/catalogue");
    if (r.ok && Array.isArray(r.body?.professions)) {
      catalogue = new Map(r.body.professions.filter((p) => p && typeof p.id === "string").map((p) => [p.id, p]));
      catalogueEvents = Array.isArray(r.body.activeEvents) ? r.body.activeEvents : null;
      for (const e of catalogueEvents ?? []) store.addMarketEvent(e);
    } else { catalogue = null; catalogueEvents = null; }
  } catch { catalogue = null; catalogueEvents = null; }
  buildProfessionSelect();
  markDirty("market", "spec", "legend");
}
const specOf = (p) => catalogue?.get(p) ?? null;
const labelOf = (p) => specOf(p)?.label ?? profOf(p).label;

async function loadHealth() {
  try { const r = await api("/api/health"); if (r.ok) { store.health = r.body; markDirty("banners", "tools", "header"); } } catch { /* ignoré */ }
}

// ---------------------------------------------------------------- SSE avec reprise
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
    setConn("live", "En direct");
    if (wasDown) { wasDown = false; await resyncIfRestarted(); }
  };
  const onMsg = (m) => {
    let ev;
    try { ev = JSON.parse(m.data); } catch { invalidMsgs++; return; }
    if (!isValidEvent(ev)) { invalidMsgs++; return; } // null, non-objet, type inconnu, seq invalide : ignoré sans effet
    if (ev.seq > store.lastSeq + 1 && store.lastSeq > 0) { // trou : on rouvre depuis le dernier seq connu, avec attente croissante
      gapStreak++;
      clearTimeout(reconnectTimer);
      if (es) es.close();
      reconnectTimer = setTimeout(connect, Math.min(10000, 500 * 2 ** Math.min(gapStreak, 5)));
      setConn("retry", "Resynchronisation…");
      return;
    }
    if (ev.seq > store.lastSeq && ++okStreak >= 20) { gapStreak = 0; okStreak = 0; }
    handleEvent(ev);
  };
  for (const t of EVENT_TYPES) es.addEventListener(t, onMsg);
  es.onmessage = onMsg;
  es.addEventListener("reset", () => { // le serveur a redémarré : on vide l'affichage, le rejeu depuis le début suit sur ce même flux
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
    setConn("retry", `Reconnexion… (essai ${retries})`);
    if (es.readyState === EventSource.CLOSED) {
      const delay = Math.min(10000, 800 * 2 ** Math.min(retries, 4));
      reconnectTimer = setTimeout(connect, delay);
    }
    if (retries > 6) setConn("down", `Hors ligne (essai ${retries})`);
  };
}
async function resyncIfRestarted() {
  try {
    const r = await api("/api/state");
    if (r.ok && r.body.lastSeq < store.lastSeq) { await loadState(); connect(); } // le serveur a redémarré (journal repartit de zéro)
  } catch { /* ignoré */ }
}

// ---------------------------------------------------------------- événements -> effets visuels
function handleEvent(ev) {
  try { applyEvent(ev); } catch (e) { console.warn("événement ignoré", ev?.type, e?.message); }
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

// ---------------------------------------------------------------- rendu
function render() {
  renderQueued = false;
  const all = dirty.has("all");
  if (all || dirty.has("header")) renderHeader();
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
function renderBanners() {
  const ul = $("banners");
  const mode = store.mode;
  const mockChain = store.health?.mock ?? store.chain.kind === "mock";
  const mockBrain = store.brain.kind === "mock";
  const esc = store.health?.escrow;
  const items = [];
  if (mode === "mock" || mockChain) items.push(pill("warn", "MODE MOCK", "chaîne et IA simulées, aucun NEAR réel.", "Aucune transaction n'est écrite sur la chaîne."));
  else items.push(pill("ok", "TESTNET NEAR", "fonds de test sans valeur, transactions vérifiables.", "Réseau de test NEAR."));
  if (!mockChain && mockBrain) items.push(pill("warn", "IA mock", "cerveau simulé (pas de clé NEAR AI Cloud).", ""));
  items.push(pill("info", "Client simulé", "tâches « simulé » = client artificiel.", ""));
  items.push(pill("info", "Visiteur (financé par le compte de démo)", "vous ne payez pas, le compte de démo avance le budget.", ""));
  if (esc === "operator-account") items.push(pill("danger", "Séquestre dégradé", "compte piloté par l'opérateur, sans contrat. Registre et réputation : journal local.", "Mode dégradé annoncé par le serveur (/api/health)."));
  else if (mode === "mock" || mockChain) items.push(pill("warn", "Séquestre simulé", "tenu en mémoire (mock).", ""));
  else if (esc === "contract") items.push(pill("ok", "Séquestre sur contrat", store.chain.contractId ? `Contrat ${store.chain.contractId}.` : "Contrat Darwin sur testnet.", ""));
  else items.push(pill("neutral", "Séquestre", "État non communiqué par le serveur.", ""));
  items.push(pill("info", "Modèle de confiance", "l'opérateur valide les résultats (« validé par » sur chaque paiement).", ""));
  for (const w of store.warnings.slice(0, 2)) items.push(pill(w.level === "error" ? "danger" : "warn", w.level === "error" ? "Erreur" : "Avertissement", `${w.code} : ${w.message}`, ""));
  ul.replaceChildren(...items);
  // le résumé (seul visible quand le bloc est replié sur mobile) rappelle l'essentiel
  const keys = items.slice(0, 4).map((li) => li.firstChild.textContent).filter((t) => !/^Visiteur/.test(t));
  $("honesty").firstElementChild.textContent = `Transparence : ${keys.join(" · ")}`;
}

function renderTools() {
  const near = store.chain.kind === "near" && !store.health?.mock;
  const esc = store.health?.escrow;
  const tools = [
    ["NEAR testnet (RPC FastNEAR)", near ? "actif : comptes, transferts, preuves en chaîne" : "simulé (mock) : aucun appel réseau", near],
    ["Contrat Darwin (near-sdk, Rust)", near ? (esc === "operator-account" ? "dégradé : séquestre par compte opérateur, registre local" : "registre, séquestre, réputation") : "simulé (mock)", near && esc !== "operator-account"],
    ["NEAR AI Cloud", store.brain.kind === "nearai" ? "actif : cerveau des agents, coût par tokens `usage`" : "simulé (mock) : coûts d'IA fictifs", store.brain.kind === "nearai"],
    ["NEAR Intents (1Click)", "V2 : devis en simulation uniquement, désactivé par défaut", false],
    ["Explorateur testnet.nearblocks.io", near ? "lien sur chaque transaction qui a un hash" : "aucun lien en mock (hash fictifs)", near],
  ];
  $("tools").replaceChildren(...tools.map(([n, s, on]) => h("li", { class: on ? "on" : "off" }, h("strong", null, n), h("span", null, s), h("span", { class: "tag-state" }, on ? "réel" : "simulé / inactif"))));
}

// --- agents (liste keyée, réordonnée seulement si l'ordre change)
const agentRows = new Map();
function renderAgents() {
  const list = [...store.agents.values()];
  list.sort((a, b) => (a.status === b.status ? 0 : a.status === "alive" ? -1 : 1) || (nearNumber(b.balance) - nearNumber(a.balance)) || a.id.localeCompare(b.id));
  const max = Math.max(1, ...list.filter((a) => a.status === "alive").map((a) => nearNumber(a.balance)));
  const ul = $("agents");
  $("agentsHint").textContent = `${list.filter((a) => a.status === "alive").length} vivants`;
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
    r.bal.textContent = dead ? "mort" : formatNear(a.balance, 2);
    r.btn.setAttribute("aria-label", `${a.name}, génération ${a.generation}, ${dead ? "mort" : formatNear(a.balance, 2) + " NEAR"}. Ouvrir la fiche.`);
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
    const st = s.alive === 0 ? "éteinte" : s.alive >= 3 ? "prospère" : "fragile";
    const cls = s.alive === 0 ? "extinct" : s.alive >= 3 ? "thrive" : "frail";
    return h("li", { class: `lin ${cls}`, "data-l": String((i) % 8) },
      h("span", { class: "lin-dot", "aria-hidden": "true" }),
      h("span", { class: "lin-name" }, `Lignée ${s.root.name}`),
      h("span", { class: "lin-bar", role: "img", "aria-label": `${s.alive} vivants sur ${s.total}` },
        h("span", { class: "lin-total", css: { width: `${(s.total / max) * 100}%` } }, h("span", { class: "lin-alive", css: { width: `${(s.alive / s.total) * 100}%` } }))),
      h("span", { class: "lin-txt" }, `${s.alive}/${s.total} vivants${s.total - s.alive ? ` · ${s.total - s.alive} mort${s.total - s.alive > 1 ? "s" : ""}` : ""} · gén. ${s.maxGen} · `, h("b", null, st)));
  }));
}

// --- flux de transactions
const feedRows = new Map();
function renderFeed() {
  const ol = $("feed");
  $("feedHint").textContent = store.chain.kind === "near" ? "liens testnet.nearblocks.io" : "hash fictifs (mock), pas d'explorateur";
  const shown = store.feed.filter((it) => $("showMinor").checked || !it.minor).slice(0, 60);
  const rows = shown.map((it) => {
    const fk = it.key + "|" + it.label;
    let r = feedRows.get(fk);
    if (!r) {
      const who = (a) => { if (!a) return null; const ag = store.agentByAccount(a); return ag ? ag.name : a.split(".")[0]; };
      const flow = [who(it.from), who(it.to)].filter(Boolean).join(" → ");
      const hashEl = it.url
        ? h("a", { href: it.url, target: "_blank", rel: "noopener noreferrer", class: "hash", "aria-label": `Voir la transaction ${it.hash} sur l'explorateur (nouvel onglet)` }, shortHash(it.hash), " ↗")
        : h("span", { class: "hash", title: it.hash }, shortHash(it.hash));
      r = h("li", { class: it.fresh ? "fresh" : "" },
        h("div", { class: "tx-top" }, h("span", { class: "tx-label" }, it.label ?? "Transaction"), it.amount != null ? h("span", { class: "tx-amt" }, formatNear(it.amount, 2), " NEAR") : null),
        h("div", { class: "tx-bot" }, h("span", { class: "tx-flow" }, flow || " "), h("span", { class: "tx-h" }, it.mock ? h("span", { class: "badge b-mock", title: "Hash fictif : transaction simulée" }, "mock") : null, hashEl)));
      feedRows.set(fk, r);
      it.fresh = false;
    }
    return r;
  });
  syncList(ol, rows);
  const keep = new Set(shown.map((i) => i.key + "|" + i.label));
  for (const k of [...feedRows.keys()]) if (!keep.has(k)) feedRows.delete(k);
}

// Remplace les enfants seulement si l'ordre/le contenu change : un replaceChildren inutile relance les animations CSS.
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

// --- légende des métiers (arbre) et spécialisation
function renderLegend() {
  const sw = (id) => h("li", null, h("span", { class: `sw ${profOf(id).cls}`, "aria-hidden": "true" }, profOf(id).glyph), labelOf(id));
  $("legend").replaceChildren(...PROFESSION_IDS.map(sw), h("li", { class: "lg-note" }, "Taille = solde, anneau = lignée, gris = mort"));
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
  $("specHint").textContent = snap ? `${alive} vivants · tick ${snap.tick}` : "";
  const dom = PROFESSION_IDS.filter((p) => totals[p] > 0).sort((a, b) => totals[b] - totals[a])[0];
  $("specLegend").replaceChildren(...PROFESSION_IDS.map((p) => h("li", { class: totals[p] === 0 && snap ? "zero" : null },
    h("span", { class: `sw ${profOf(p).cls}`, "aria-hidden": "true" }, profOf(p).glyph), `${labelOf(p)} `, h("b", null, snap ? totals[p] : ""))));
  if (!snap) { $("spec").replaceChildren(h("li", { class: "muted" }, "En attente du premier instantané de population…")); return; }
  if (!rows.length) { $("spec").replaceChildren(h("li", { class: "muted" }, "Aucun agent vivant.")); return; }
  const out = rows.map((r) => {
    const label = `Génération ${r.g} : ${r.parts.filter(([, n]) => n).map(([p, n]) => `${labelOf(p)} ${n}`).join(", ") || "aucun vivant"}`;
    return h("li", { class: "spec-row", "aria-label": label },
      h("span", { class: "spec-gen", "aria-hidden": "true" }, `Gén. ${r.g}`),
      h("span", { class: "spec-bar", "aria-hidden": "true", css: { width: `${Math.max(r.sum ? 6 : 0, (r.sum / maxSum) * 100)}%` } },
        ...r.parts.filter(([, n]) => n > 0).map(([p, n]) => h("span", { class: `seg ${profOf(p).cls}`, title: `${labelOf(p)} : ${n}`, css: { flexGrow: String(n) } }, h("b", null, n)))),
      h("span", { class: "spec-n", "aria-hidden": "true" }, r.sum ? `${r.sum} vivant${r.sum > 1 ? "s" : ""}` : "éteinte"));
  });
  if (dom) out.push(h("li", { class: "spec-note muted small" }, `Métier dominant : ${labelOf(dom)} (${totals[dom]} sur ${alive}). Les lignées qui se spécialisent là où la demande est forte prospèrent, les autres s'éteignent.`));
  $("spec").replaceChildren(...out);
}

// --- marché : événements de demande, historique, prix plancher
function renderMarket() {
  const tick = store.tick;
  const server = catalogueEvents && catalogueEvents.length ? catalogueEvents : null;
  const active = server ?? store.activeMarketEvents();
  const activeIds = new Set(active.map((e) => e.id));
  const evLi = (e, isActive) => {
    const up = e.demandMultiplier >= 1;
    const left = Math.max(0, (e.endTick ?? 0) - tick);
    return h("li", { class: `mev ${up ? "up" : "down"}${isActive ? " on" : ""}` },
      h("span", { class: "mev-mult", "aria-label": `Demande ${up ? "en hausse" : "en baisse"} ${multLabel(e.demandMultiplier)}` }, (up ? "▲ " : "▼ ") + multLabel(e.demandMultiplier)),
      h("span", { class: "mev-main" }, h("b", { class: "mev-title" }, e.title), " ", h("span", { class: `sw sm ${profOf(e.profession).cls}`, "aria-hidden": "true" }, profOf(e.profession).glyph), h("span", { class: "muted small" }, ` ${labelOf(e.profession)}`)),
      h("span", { class: "mev-left" }, isActive ? (left === 0 ? "dernier tick" : `${left} tick${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}`) : `terminé (tick ${e.endTick})`));
  };
  $("marketHint").textContent = active.length ? `${active.length} en cours` : "marché calme";
  $("mActive").replaceChildren(...(active.length ? active.map((e) => evLi(e, true)) : [h("li", { class: "muted small" }, "Aucun événement en cours : la demande suit les prix de référence.")]));
  const hist = store.marketEvents.filter((e) => !activeIds.has(e.id)).slice(0, 20);
  $("mHist").replaceChildren(...(hist.length ? hist.map((e) => evLi(e, false)) : [h("li", { class: "muted small" }, "Aucun événement passé.")]));
  $("prices").replaceChildren(...PROFESSION_IDS.map((p) => {
    const s = specOf(p);
    return h("li", null, h("span", { class: `sw sm ${profOf(p).cls}`, "aria-hidden": "true" }, profOf(p).glyph), h("span", null, labelOf(p)),
      h("b", null, s ? `${nearInput(s.nearPrice)} NEAR` : "n/d"), s ? h("small", { class: "muted" }, `réf. ${s.refUsd} $`) : null);
  }));
}

// --- tâches : cycle de vie + livrable
const delivCache = new Map(); // taskId -> {state: "loading"|"ok"|"none"|"err", node?}
function ensureDeliverable(t) {
  const c = delivCache.get(t.id);
  if (c) return c;
  const entry = { state: "loading", node: null };
  delivCache.set(t.id, entry);
  api(`/api/tasks/${encodeURIComponent(t.id)}/deliverable`).then((r) => {
    if (delivCache.get(t.id) !== entry) return; // invalidé entre-temps
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
    { label: "Publiée", done: true },
    { label: "Enchères", done: bids > 0 || !past("posted"), note: bids ? `${bids} offre${bids > 1 ? "s" : ""}` : "" },
    { label: "Attribuée", done: !!t.winnerId || past("awarded", "submitted", "settled", "rejected"), tx: [t.escrow?.lockTx, "séquestre"] },
    { label: "Livrée", done: !!t.result || store.deliverables.has(t.id) || past("submitted", "settled", "rejected") },
    { label: "Validée", done: !!t.validation, note: t.validation ? (t.validation.verdict === "accepted" ? "accepté" : "rejeté") : "" },
    refunded ? { label: "Remboursée", done: true, bad: true, tx: [t.escrow?.settleTx, "remboursement"] }
      : t.status === "expired" ? { label: "Expirée", done: true, bad: true }
      : { label: "Payée", done: t.status === "settled", tx: [t.escrow?.settleTx, "paiement"] },
  ];
  const cur = steps.findIndex((s) => !s.done);
  return h("ol", { class: "life", "aria-label": "Cycle de vie de la tâche" }, steps.map((s, i) => h("li", { class: `${s.done ? "done" : i === cur ? "now" : ""}${s.bad ? " bad" : ""}`, "aria-current": i === cur ? "step" : null },
    h("span", { class: "life-dot", "aria-hidden": "true" }, s.done ? (s.bad ? "✕" : "✓") : String(i + 1)),
    h("span", { class: "life-l" }, s.label, s.note ? h("small", null, s.note) : null, s.tx && s.tx[0] ? txChip(s.tx[0], s.tx[1]) : null))));
}
function txChip(hash, label) {
  const url = store.feedByHash.get(hash)?.url;
  const mock = /^mock_/.test(hash) || store.chain.kind === "mock";
  return url
    ? h("a", { class: "txchip", href: url, target: "_blank", rel: "noopener noreferrer", title: `Voir la transaction (${label}) sur l'explorateur`, "aria-label": `Transaction de ${label} ${hash}, nouvel onglet` }, shortHash(hash), " ↗")
    : h("code", { class: "txchip", title: `${label} : ${hash}${mock ? " (hash fictif, aucune transaction réelle)" : ""}` }, shortHash(hash), mock ? " · mock" : "");
}
function deliverableBlock(t) {
  const known = store.deliverables.has(t.id) || t.validation || t.result || ["submitted", "settled", "rejected"].includes(t.status);
  if (!known || (!openTaskIds.has(t.id) && !delivCache.has(t.id))) return null; // on ne charge que les tâches ouvertes
  const e = ensureDeliverable(t);
  if (e.state === "ok") return e.node;
  return h("p", { class: "muted small" }, e.state === "loading" ? "Chargement du livrable…" : e.state === "none" ? "Livrable non disponible sur ce serveur (texte brut ci-dessus)." : "Livrable momentanément indisponible.");
}

// --- tâches
function renderTasks() {
  const sorted = [...store.tasks.values()].sort((a, b) => b.id.localeCompare(a.id));
  const list = sorted.filter((t, i) => i < 14 || openTaskIds.has(t.id)); // une tâche ouverte reste affichée même quand de nouvelles arrivent
  $("tasksHint").textContent = store.tasksOpen != null ? `${store.tasksOpen} ouvertes` : "";
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
        t.requester?.kind === "visitor" ? h("p", { class: "small muted" }, `Demandé par « ${t.requester.label} » (budget avancé par le compte de démo).`) : null,
        h("p", { class: "t-prompt" }, t.prompt),
        win ? h("p", { class: "small" }, `Attribuée à `, h("b", null, win), price ? ` pour ${formatNear(price, 2)} NEAR` : "", t.bids ? ` (${t.bids} offres)` : "") : null,
        t.expiredReason ? h("p", { class: "small muted" }, `Expirée : ${{ no_bids: "aucune offre", deadline: "délai dépassé", unfunded: "payeur sans fonds", winner_dead: "le gagnant est mort" }[t.expiredReason] ?? t.expiredReason}.`) : null,
        t.validation ? h("p", { class: "small" }, h("b", null, t.validation.verdict === "accepted" ? "Accepté" : "Rejeté"), ` · validé par : `, h("code", null, t.validatedBy ?? t.validation.validator), ` · score ${Number(t.validation.score).toFixed(2)}`, t.validation.reason ? ` · ${t.validation.reason}` : "") : null,
        t.result?.text ? h("p", { class: "t-result" }, t.result.text) : null,
        t.result?.resultHash ? h("p", { class: "small muted" }, "Empreinte du résultat : ", h("code", null, shortHash(t.result.resultHash))) : null,
        deliverableBlock(t)));
    return h("li", { id: `task-${t.id}` }, det);
  }));
}

// --- lettres et fiche agent
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
  return h("li", null, h("span", null, label), h("span", { class: "gbar", role: "img", "aria-label": `${label} : ${Number(v).toFixed(2)}` }, h("span", { css: { width: `${Math.max(3, Math.min(100, pct))}%` } })), h("b", null, Number(v).toFixed(2)));
}
async function renderLetters() {
  const fiche = $("fiche");
  const a = selectedAgent ? store.agents.get(selectedAgent) : null;
  if (a) {
    const g = a.genome ?? {};
    const parent = a.parentId ? store.agents.get(a.parentId) : null;
    fiche.replaceChildren(
      h("h3", null, a.name, " ", h("small", { class: "muted" }, `${a.id} · génération ${a.generation}`)),
      h("p", null, h("span", { class: `sw ${profOf(g.profession).cls}`, "aria-hidden": "true" }, profOf(g.profession).glyph), ` ${profOf(g.profession).label} · modèle `, h("code", null, g.model ?? "?"), a.status === "dead" ? h("span", { class: "badge b-dead" }, `mort (tick ${a.deathTick ?? "?"})`) : h("span", { class: "badge b-alive" }, "vivant")),
      h("dl", { class: "kv" },
        h("div", null, h("dt", null, "Solde"), h("dd", null, a.status === "dead" ? "0" : formatNear(a.balance, 3), " NEAR")),
        h("div", null, h("dt", null, "Gagné"), h("dd", null, formatNear(a.earned ?? 0, 2))),
        h("div", null, h("dt", null, "Payé à l'IA"), h("dd", null, formatNear(a.spentBrain ?? 0, 2))),
        h("div", null, h("dt", null, "Réputation"), h("dd", null, a.reputation ?? 0)),
        h("div", null, h("dt", null, "Tâches faites"), h("dd", null, a.tasksDone ?? 0)),
        h("div", null, h("dt", null, "Enfants"), h("dd", null, (a.childrenIds ?? []).length))),
      h("ul", { class: "genes" }, bar("Prix demandé", g.askRatio ?? 0, 0.3, 1), bar("Risque", g.risk ?? 0, 0, 1), bar("Seuil repro.", g.reproThreshold ?? 1.2, 1.2, 4), bar("Générosité", g.generosity ?? 0, 0, 0.6), bar("Coopération", g.cooperation ?? 0, 0, 1)),
      parent ? h("p", { class: "small" }, "Parent : ", h("button", { type: "button", class: "link", onclick: () => selectAgent(parent.id) }, parent.name)) : h("p", { class: "small muted" }, "Fondateur (génération 1)."),
      g.personality ? h("p", { class: "small persona" }, h("b", null, "Personnalité : "), g.personality) : null);
  }
  // liste des lettres
  const letters = [...store.letters.values()].sort((x, y) => y.id.localeCompare(x.id));
  if (!selectedLetter && letters.length) selectedLetter = letters[0].id;
  $("letterList").replaceChildren(...letters.slice(0, 30).map((l) => h("li", null, h("button", { type: "button", class: l.id === selectedLetter ? "sel" : "", "aria-current": l.id === selectedLetter ? "true" : null, onclick: () => { selectedLetter = l.id; markDirty("letters"); } }, `${store.name(l.fromAgentId)} → ${store.name(l.toAgentId)}`, h("small", null, ` g${l.generation}`)))));
  let l = selectedLetter ? store.letters.get(selectedLetter) : null;
  if (!l && a?.letterId) { try { const r = await api(`/api/letters/${encodeURIComponent(a.letterId)}`); const lt = r.body?.letter ?? r.body; if (r.ok && lt?.id) { store.letters.set(lt.id, lt); l = lt; } } catch { /* ignoré */ } }
  const box = $("letter");
  if (!l) { box.replaceChildren(h("p", { class: "muted" }, letters.length ? "Choisissez une lettre." : "Les lettres apparaissent à chaque naissance.")); return; }
  box.replaceChildren(
    h("header", null, h("b", null, `${store.name(l.fromAgentId)} → ${store.name(l.toAgentId)}`), h("span", { class: "muted small" }, ` · génération ${l.generation} · tick ${l.tick} · modèle `, h("code", null, l.model ?? "?")), l.mock ? h("span", { class: "badge b-mock", title: "Lettre générée par le cerveau simulé" }, "mock") : null),
    h("div", { class: "letter-text" }, l.text));
}

// ---------------------------------------------------------------- formulaire de tâche
const form = $("taskForm");
const statusBox = $("fStatus");
let cooldown = 0;
function setStatus(kind, title, lines = []) {
  statusBox.className = `form-status ${kind}`;
  statusBox.replaceChildren(h("strong", null, title), lines.length ? h("ul", null, lines.map((x) => h("li", null, x))) : null);
}
// Choix du métier : libellés et budget minimum viennent du catalogue serveur (repli : libellés locaux, sans prix).
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
    if (!budgetTouched || cur == null || cur < min) { $("fBudget").value = nearInput(min); budgetTouched = false; } // saisie volontaire au-dessus du minimum : conservée
    $("fBudgetHelp").textContent = `Budget minimum pour ce métier : ${nearInput(min)} NEAR (prix de référence d'un freelance humain : ${s.refUsd} $, converti à un taux de test). Décimal, 6 décimales max.`;
  } else $("fBudgetHelp").textContent = "Nombre décimal, jusqu'à 6 décimales (ex. 0.05). Le serveur applique le budget minimum du métier.";
  const box = $("fProfInfo");
  const notes = [];
  if (s?.deliverable) notes.push(h("p", null, h("b", null, "Livrable attendu : "), s.deliverable));
  if (p === "legal") notes.push(h("p", { class: "warnbox" }, h("b", null, "Ceci n'est pas un avis juridique."), " L'agent produit une checklist à titre informatif : faites-la relire par un professionnel du droit avant toute décision."));
  if (p === "logo") notes.push(h("p", { class: "infobox" }, "Le logo est original : l'agent propose 3 dessins inédits et ne reprend jamais une marque existante. Évitez de citer une marque dans la consigne."));
  box.replaceChildren(...notes);
}
$("fProf").addEventListener("change", () => onProfChange(true));
$("fBudget").addEventListener("input", () => { budgetTouched = true; });
$("showMinor").addEventListener("change", () => markDirty("feed"));
$("fPrompt").addEventListener("input", (e) => { $("fPromptCount").textContent = `${e.target.value.length}/4000`; });
function lockButton(sec) {
  clearInterval(cooldown);
  const btn = $("fSubmit");
  if (!sec) { btn.disabled = false; btn.textContent = "Publier la tâche"; return; }
  let left = Math.min(60, Math.max(1, Math.ceil(sec)));
  btn.disabled = true;
  const tickBtn = () => { btn.textContent = `Réessayer dans ${left} s`; if (left-- <= 0) { clearInterval(cooldown); lockButton(0); } };
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
    requesterLabel: String(fd.get("requesterLabel") ?? "").trim() || "visiteur",
  };
  const local = [];
  if (payload.title.length < 3) local.push("Titre : 3 caractères minimum.");
  if (payload.prompt.length < 10) local.push("Consigne : 10 caractères minimum.");
  if (!/^\d+(\.\d{1,6})?$/.test(payload.budgetNear)) local.push("Budget : nombre décimal en NEAR, 6 décimales maximum (ex. 1.5).");
  const min = minBudget(payload.profession), cur = parseNearToYocto(payload.budgetNear);
  if (min != null && cur != null && cur < min) local.push(`Budget trop bas : le minimum pour « ${labelOf(payload.profession)} » est ${nearInput(min)} NEAR (vous proposez ${payload.budgetNear}). Augmentez le budget ou choisissez un autre métier.`);
  if (local.length) { setStatus("err", local.length === 1 && cur != null && min != null && cur < min ? "Budget trop bas" : "Formulaire incomplet", local); return; }
  const btn = $("fSubmit");
  btn.disabled = true; btn.textContent = "Envoi…";
  setStatus("info", "Envoi en cours…");
  try {
    const r = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    const retry = Number(r.headers.get("Retry-After")) || 0;
    if (r.status === 201 || r.status === 200) {
      const t = r.body ?? {};
      if (t.id && !store.tasks.has(t.id)) { store.tasks.set(t.id, t); }
      setStatus("ok", `Tâche ${t.id ?? ""} publiée`, ["Les agents de ce métier enchérissent au prochain tick. Suivez-la dans le marché ci-dessous.", "Budget avancé par le compte de démo."]);
      form.reset(); $("fPromptCount").textContent = "0/4000"; $("fProf").value = payload.profession; $("fBudget").value = payload.budgetNear; $("fLabel").value = payload.requesterLabel; onProfChange(true);
      markDirty("tasks"); lockButton(0);
      if (t.id) { openTaskIds.add(t.id); setTimeout(() => { render(); document.getElementById(`task-${t.id}`)?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, 300); }
    } else if (r.status === 400) {
      const msgs = errorMessages(r.body);
      const low = msgs.some((m) => /budget|trop bas|minimum|too low/i.test(m));
      setStatus("err", low ? "Budget refusé par le serveur (400)" : "Le serveur refuse cette tâche (400)", msgs.length ? msgs : ["Données invalides."]); lockButton(0);
    } else if (r.status === 429) {
      const m = errorMessages(r.body);
      setStatus("warn", "Trop de demandes (429)", [...(m.length ? m : ["Limite atteinte : trop de tâches ouvertes ou plafond horaire du compte de démo."]), retry ? `Réessayez dans ${retry} s.` : "Réessayez dans un moment."]); lockButton(retry || 15);
    } else if (r.status === 503) {
      const m = errorMessages(r.body);
      const pending = r.body?.error?.code === "VALIDATION_PENDING"; // état d'attente (validation en cours), pas une panne
      setStatus("warn", pending ? "Validation en cours : patientez (503)" : "Service indisponible (503)", [...(m.length ? m : ["La simulation n'accepte pas de tâche pour le moment."]), pending ? "Ce n'est pas une panne : réessayez dans un instant." : "Réessayez dans quelques secondes."]); lockButton(retry || 5);
    } else if (r.status === 413 || r.status === 415) {
      setStatus("err", r.status === 413 ? "Message trop volumineux (413)" : "Format non accepté (415)", errorMessages(r.body)); lockButton(0);
    } else if (r.status === 403) {
      setStatus("err", "Requête refusée (403)", ["Ouvrez la page depuis la même adresse que le serveur (protection anti-CSRF).", ...errorMessages(r.body)]); lockButton(0);
    } else {
      setStatus("err", `Erreur inattendue (${r.status})`, errorMessages(r.body)); lockButton(0);
    }
  } catch (err) {
    setStatus("err", "Serveur injoignable", ["Vérifiez que le backend tourne puis réessayez."]); lockButton(0);
  }
});

// ---------------------------------------------------------------- démarrage
function boot() {
  tree = new Tree($("tree"), store, { onSelect: selectAgent });
  if (/[?&]debug\b/.test(location.search)) window.__darwin = { store, tree, stats: () => ({ invalidMsgs, gapStreak }) }; // réservé au mode ?debug
  if (innerWidth < 700) $("honesty").open = false;
  loadState().then(() => { connect(); }).catch((e) => {
    setConn("down", "Backend injoignable");
    $("banners").replaceChildren(pill("danger", "Backend injoignable", String(e.message ?? e), ""));
    setTimeout(boot2, 3000);
  });
}
function boot2() { loadState().then(connect).catch(() => setTimeout(boot2, 3000)); }
setInterval(loadHealth, 20000);
setInterval(() => { if (live || store.lastSeq > 0) loadCatalogue(); }, 30000);
buildProfessionSelect();
markDirty("legend", "spec", "market");
boot();
