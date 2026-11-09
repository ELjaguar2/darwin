// Point d'entrée : chargement de l'état, flux SSE avec reprise, rendu des panneaux, formulaire de tâche.
// Aucune logique métier ici : la page reflète le journal d'événements. Aucun innerHTML (tout via textContent / h()).
import { Store, EVENT_TYPES } from "./store.js";
import { Tree } from "./tree.js";
import { formatNear, signedNear, nearNumber, shortHash, profOf, requesterBadge, STATUS_LABEL, h, errorMessages, TESTNET_EXPLORER } from "./format.js";

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
async function api(path, opts) {
  const r = await fetch(path, { headers: { Accept: "application/json" }, ...opts });
  const text = await r.text();
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
  setTimeout(() => { tree.live = true; }, 600);
  markDirty("all");
}

async function loadHealth() {
  try { const r = await api("/api/health"); if (r.ok) { store.health = r.body; markDirty("banners", "tools", "header"); } } catch { /* ignoré */ }
}

// ---------------------------------------------------------------- SSE avec reprise
let es = null;
let retries = 0;
let reconnectTimer = 0;
let wasDown = false;
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
    try { ev = JSON.parse(m.data); } catch { return; }
    if (ev.seq > store.lastSeq + 1 && store.lastSeq > 0) { // trou : on rouvre depuis le dernier seq connu
      connect(); return;
    }
    handleEvent(ev);
  };
  for (const t of EVENT_TYPES) es.addEventListener(t, onMsg);
  es.onmessage = onMsg;
  es.addEventListener("reset", () => { // le serveur a redémarré : on vide l'affichage, le rejeu depuis le début suit sur ce même flux
    const keep = { mode: store.mode, chain: store.chain, brain: store.brain, health: store.health };
    store.reset(); Object.assign(store, keep);
    for (const [, n] of tree.nodes) n.g.remove();
    tree.nodes.clear(); tree.gEdges.replaceChildren(); tree.edges.clear(); tree.gFx.replaceChildren();
    selectedAgent = null; selectedLetter = null; agentRows.clear(); feedRows.clear(); chronRows.clear(); $("chron").replaceChildren();
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
  store.apply(ev);
  const d = ev.data ?? {};
  switch (ev.type) {
    case "agent.born": case "agent.died": case "agent.reproduced":
      tree.schedule(); markDirty("agents", "lineages", "header", "letters"); break;
    case "balance.changed":
      tree.schedule(); markDirty("agents");
      if (d.reason === "task" || d.reason === "brain" || d.reason === "birth") tree.float(d.agentId, signedNear(d.delta), BigInt(d.delta) >= 0n ? "up" : "down");
      break;
    case "escrow.released": { const a = store.agentByAccount(d.payee); if (a) tree.pulse(a.id); markDirty("tasks", "chron", "feed", "header"); break; }
    case "letter.written": markDirty("letters", "chron"); break;
    case "sim.tick": markDirty("header"); break;
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
  for (const a of store.agents.values()) if (a.status === "alive") total += BigInt(a.balance ?? 0);
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
      h("span", { class: "lin-txt" }, `${s.alive}/${s.total} · gén. ${s.maxGen} · `, h("b", null, st)));
  }));
}

// --- flux de transactions
const feedRows = new Map();
function renderFeed() {
  const ol = $("feed");
  $("feedHint").textContent = store.chain.kind === "near" ? "liens testnet.nearblocks.io" : "hash fictifs (mock), pas d'explorateur";
  const rows = store.feed.slice(0, 60).map((it) => {
    let r = feedRows.get(it.key);
    if (!r) {
      const who = (a) => { if (!a) return null; const ag = store.agentByAccount(a); return ag ? ag.name : a.split(".")[0]; };
      const flow = [who(it.from), who(it.to)].filter(Boolean).join(" → ");
      const hashEl = it.url
        ? h("a", { href: it.url, target: "_blank", rel: "noopener noreferrer", class: "hash", "aria-label": `Voir la transaction ${it.hash} sur l'explorateur (nouvel onglet)` }, shortHash(it.hash), " ↗")
        : h("span", { class: "hash", title: it.hash }, shortHash(it.hash));
      r = h("li", { class: it.fresh ? "fresh" : "" },
        h("div", { class: "tx-top" }, h("span", { class: "tx-label" }, it.label ?? "Transaction"), it.amount != null ? h("span", { class: "tx-amt" }, formatNear(it.amount, 2), " NEAR") : null),
        h("div", { class: "tx-bot" }, h("span", { class: "tx-flow" }, flow || " "), h("span", { class: "tx-h" }, it.mock ? h("span", { class: "badge b-mock", title: "Hash fictif : transaction simulée" }, "mock") : null, hashEl)));
      feedRows.set(it.key, r);
      it.fresh = false;
    }
    return r;
  });
  syncList(ol, rows);
  const keep = new Set(store.feed.slice(0, 60).map((i) => i.key));
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

// --- tâches
function renderTasks() {
  const list = [...store.tasks.values()].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 14);
  $("tasksHint").textContent = store.tasksOpen != null ? `${store.tasksOpen} ouvertes` : "";
  $("tasks").replaceChildren(...list.map((t) => {
    const rb = requesterBadge(t.requester, t.badge);
    const win = t.winnerId ? store.name(t.winnerId) : null;
    const price = t.awardPrice ?? t.escrow?.amount;
    const det = h("details", { class: "task", open: openTaskIds.has(t.id) || null, ontoggle: (e) => { e.target.open ? openTaskIds.add(t.id) : openTaskIds.delete(t.id); } },
      h("summary", null,
        h("span", { class: `st st-${t.status}` }, STATUS_LABEL[t.status] ?? t.status),
        h("span", { class: "t-title" }, t.title),
        h("span", { class: "t-bud" }, formatNear(t.budget, 2), " NEAR")),
      h("div", { class: "t-body" },
        h("p", null, h("span", { class: `badge ${rb.cls}`, title: rb.title }, rb.text), " ", h("span", { class: "muted small" }, `${t.id} · ${profOf(t.profession).label}`)),
        t.requester?.kind === "visitor" ? h("p", { class: "small muted" }, `Demandé par « ${t.requester.label} » (budget avancé par le compte de démo).`) : null,
        h("p", { class: "t-prompt" }, t.prompt),
        win ? h("p", { class: "small" }, `Attribuée à `, h("b", null, win), price ? ` pour ${formatNear(price, 2)} NEAR` : "", t.bids ? ` (${t.bids} offres)` : "") : null,
        t.expiredReason ? h("p", { class: "small muted" }, `Expirée : ${{ no_bids: "aucune offre", deadline: "délai dépassé", unfunded: "payeur sans fonds", winner_dead: "le gagnant est mort" }[t.expiredReason] ?? t.expiredReason}.`) : null,
        t.validation ? h("p", { class: "small" }, h("b", null, t.validation.verdict === "accepted" ? "Accepté" : "Rejeté"), ` · validé par : `, h("code", null, t.validatedBy ?? t.validation.validator), ` · score ${Number(t.validation.score).toFixed(2)}`, t.validation.reason ? ` · ${t.validation.reason}` : "") : null,
        t.result?.text ? h("p", { class: "t-result" }, t.result.text) : null,
        t.result?.resultHash ? h("p", { class: "small muted" }, "Empreinte du résultat : ", h("code", null, shortHash(t.result.resultHash))) : null,
        txLink(t.escrow?.lockTx, "Verrouillage"), txLink(t.escrow?.settleTx, t.escrow?.status === "refunded" ? "Remboursement" : "Paiement")));
    return h("li", { id: `task-${t.id}` }, det);
  }));
}
function txLink(hash, label) {
  if (!hash) return null;
  const f = store.feedByHash.get(hash);
  const url = f?.url;
  return h("p", { class: "small" }, `${label} : `, url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, shortHash(hash), " ↗") : h("code", null, shortHash(hash)), /^mock_/.test(hash) ? h("span", { class: "badge b-mock" }, "mock") : null);
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
  if (!l && a?.letterId) { try { const r = await api(`/api/letters/${encodeURIComponent(a.letterId)}`); if (r.ok) { store.letters.set(r.body.id, r.body); l = r.body; } } catch { /* ignoré */ } }
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
  if (local.length) { setStatus("err", "Formulaire incomplet", local); return; }
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
      form.reset(); $("fPromptCount").textContent = "0/4000"; $("fBudget").value = payload.budgetNear; $("fLabel").value = payload.requesterLabel;
      markDirty("tasks"); lockButton(0);
      if (t.id) { openTaskIds.add(t.id); setTimeout(() => { render(); document.getElementById(`task-${t.id}`)?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, 300); }
    } else if (r.status === 400) {
      setStatus("err", "Le serveur refuse cette tâche (400)", errorMessages(r.body).length ? errorMessages(r.body) : ["Données invalides."]); lockButton(0);
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
  window.__darwin = { store, tree }; // inspection manuelle / tests
  if (innerWidth < 700) $("honesty").open = false;
  loadState().then(() => { connect(); }).catch((e) => {
    setConn("down", "Backend injoignable");
    $("banners").replaceChildren(pill("danger", "Backend injoignable", String(e.message ?? e), ""));
    setTimeout(boot2, 3000);
  });
}
function boot2() { loadState().then(connect).catch(() => setTimeout(boot2, 3000)); }
setInterval(loadHealth, 20000);
boot();
