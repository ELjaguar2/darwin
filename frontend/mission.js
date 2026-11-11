// Page « Mission » (L17) : agents vivants en cartes, barre de mission façon LLM, fil de chat en direct.
// Aucune logique métier : le métier et le budget proposés par la barre sont une aide de saisie (le serveur valide et applique ses bornes).
// Aucun innerHTML : texte en nœuds Text, livrables via deliverable.js (SVG uniquement en <img data:>, jamais injecté).
import { store, core, api, on, txUrl, aliveAgents, labelOfJob } from "./core.js";
import { h, formatNear, formatNearSmall, nearNumber, big, nearInput, parseNearToYocto, shortHash, errorMessages, requesterBadge } from "./format.js";
import { jobOf, icon, avatar, firstName } from "./jobs.js";
import { buildChatDeliverable } from "./chat-deliverable.js";

const JOB_IDS = ["logo", "finance", "architecture", "marketing", "translation", "legal"];
const RULES = [
  ["translation", /tradui|traduc|translat|en anglais|en espagnol|en allemand|en italien/i],
  ["legal", /juridi|rgpd|gdpr|contrat|cgu|cgv|l[ée]gal|conformit|mentions l/i],
  ["logo", /logo|logotype|identit[ée] visuelle|embl[èe]me|pictogramme/i],
  ["finance", /financ|budget|bilan|rentab|chiffre d'affaires|tr[ée]sorerie|pr[ée]vision|marge|\bROI\b|ventes/i],
  ["architecture", /architect|\bAPI\b|microservice|base de donn|infrastructure|backend|logiciel|d[ée]ploiement|diagramme|sch[ée]ma/i],
  ["marketing", /marketing|slogan|accroche|annonce|newsletter|publicit|texte|fiche produit|r[ée]seaux|description|r[ée]dige|[ée]cris/i],
];
/** Aide de saisie : devine le métier d'après les mots de la mission (null si rien ne ressort). */
export function inferJob(text) {
  for (const [id, re] of RULES) if (re.test(text)) return id;
  return null;
}

const $ = (id) => document.getElementById(id);
const specOf = (p) => core.catalogue?.get(p) ?? null;
const labelOf = (p) => labelOfJob(p, jobOf(p).label);
const minBudget = (p) => { const s = specOf(p); return s ? big(s.nearPrice) : null; };

let onOpenAgent = () => {};
const mine = new Set(); // ids des missions postées depuis cette page
const speaking = new Map(); // agentId -> timer
const sel = { job: "marketing", jobTouched: false, budgetTouched: false };

// ------------------------------------------------------------------ cartes d'agents
const cards = new Map();
function gaugeMax(a) {
  const founders = [...store.agents.values()].filter((x) => x.generation === 1).map((x) => big(x.birthCapital)).filter((v) => v > 0n);
  const base = founders.length ? founders.reduce((m, v) => (v < m ? v : m)) : big(a.birthCapital);
  const thr = Number(a.genome?.reproThreshold) || 2;
  return nearNumber(base) * thr || 1;
}
export function renderStrip() {
  const strip = $("strip");
  const list = aliveAgents().sort((a, b) => (a.birthTick ?? 0) - (b.birthTick ?? 0) || a.id.localeCompare(b.id));
  const seen = new Set();
  for (const a of list) {
    seen.add(a.id);
    let c = cards.get(a.id);
    if (!c) {
      const fill = h("span", { class: "gauge-fill" });
      const name = h("span", { class: "ag-name" });
      const btn = h("button", { type: "button", class: "agent-card", onclick: () => onOpenAgent(a.id) }, avatar(a, 46), name, h("span", { class: "gauge", "aria-hidden": "true" }, fill));
      c = { btn, fill, name, born: core.live };
      if (core.live) btn.classList.add("born");
      cards.set(a.id, c);
      strip.append(btn);
    }
    const ratio = Math.max(0.03, Math.min(1, nearNumber(a.balance) / gaugeMax(a)));
    c.fill.style.width = `${Math.round(ratio * 100)}%`;
    c.btn.classList.toggle("low", ratio < 0.25);
    c.btn.classList.toggle("full", ratio >= 0.98);
    c.name.textContent = firstName(a);
    c.btn.setAttribute("aria-label", `${firstName(a)}, ${labelOf(a.genome?.profession)}, ${formatNear(a.balance, 2)} NEAR. Ouvrir sa fiche.`);
    c.btn.title = `${firstName(a)} · ${labelOf(a.genome?.profession)} · ${formatNear(a.balance, 3)} NEAR`;
  }
  for (const [id, c] of [...cards]) {
    if (seen.has(id)) continue;
    cards.delete(id);
    c.btn.classList.add("leaving");
    setTimeout(() => c.btn.remove(), 700);
  }
  // l'ordre suit la naissance
  list.forEach((a, i) => { const c = cards.get(a.id); if (c && strip.children[i] !== c.btn && !c.btn.classList.contains("leaving")) strip.insertBefore(c.btn, strip.children[i] ?? null); });
  const empty = $("stripEmpty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    const all = [...store.agents.values()];
    const gen = all.reduce((m, a) => Math.max(m, Number(a.generation) || 0), 0);
    const ended = core.mode === "replay" && core.replayInfo?.phase === "ended";
    empty.textContent = all.length ? `${ended ? "Rejeu terminé · " : ""}Plus aucun agent vivant · génération ${gen}` : ended ? "Rejeu terminé" : "En attente des premiers agents…";
  }
}
let stripTimer = 0;
const scheduleStrip = () => { if (!stripTimer) stripTimer = setTimeout(() => { stripTimer = 0; renderStrip(); }, 120); };

function speak(agentId) {
  const c = cards.get(agentId);
  if (!c) return;
  c.btn.classList.add("speaking");
  clearTimeout(speaking.get(agentId));
  speaking.set(agentId, setTimeout(() => { c.btn.classList.remove("speaking"); speaking.delete(agentId); }, 2600));
}

// ------------------------------------------------------------------ fil de chat
const threads = new Map(); // taskId -> thread
const MAX_THREADS = 14;
let queue = [], qTimer = 0;

function pump() {
  if (qTimer) return;
  const step = () => {
    qTimer = 0;
    const fn = queue.shift();
    if (!fn) return;
    try { fn(); } catch (e) { console.warn("fil", e?.message); }
    if (queue.length) qTimer = setTimeout(step, queue.length > 14 ? 40 : queue.length > 6 ? 220 : 520);
  };
  qTimer = setTimeout(step, 0);
}
function flushQueue() { clearTimeout(qTimer); qTimer = 0; const q = queue; queue = []; for (const fn of q) { try { fn(); } catch (e) { console.warn("fil", e?.message); } } }
/** Ordre garanti : en rattrapage (silent) tout passe tout de suite, sinon les messages sont cadencés pour rester lisibles. */
function enqueue(fn, silent) { if (silent) { flushQueue(); fn(true); } else { queue.push(() => fn(false)); pump(); } }

function requesterTag(t) {
  const r = t.requester;
  if (mine.has(t.id)) return { text: "vous · financé par le compte de démo", cls: "tag-me", title: "Mission postée depuis cette page ; le budget est avancé par le compte de démonstration." };
  if (r?.kind === "simulated") return { text: "simulé", cls: "tag-sim", title: "Client artificiel : cette mission ne vient pas d'un humain." };
  if (r?.kind === "agent") return { text: "sous-traitance", cls: "tag-agent", title: "Mission confiée par un agent à un autre." };
  const b = requesterBadge(r, t.badge);
  return { text: `${r?.label ? String(r.label) : "visiteur"} · financé par le compte de démo`, cls: "tag-visitor", title: b.title ?? "" };
}

function ensureThread(task, silent) {
  if (!task?.id) return null;
  let th = threads.get(task.id);
  if (th) { th.task = { ...th.task, ...task }; return th; }
  th = { id: task.id, task: { ...task }, msgs: [], el: null, open: null, done: false, doneAt: 0, deliv: null };
  threads.set(task.id, th);
  th.msgs.push({ kind: "mission" });
  const feed = $("feed");
  th.el = h("article", { class: "thread", "aria-label": `Mission ${task.title ?? task.id}` });
  feed.prepend(th.el);
  $("feedHint").hidden = true;
  th.fresh = !silent;
  while (threads.size > MAX_THREADS) { const [k, old] = threads.entries().next().value; old.el.remove(); threads.delete(k); }
  return th;
}
const bids = new Map(); // taskId -> bids

function money(y, d = 3) { return `${formatNear(y, d)} NEAR`; }
function pitchOf(b, a) {
  const p = typeof b.pitch === "string" ? b.pitch.trim() : "";
  if (p) return p.slice(0, 240);
  // le journal réel ne garde pas toujours la phrase de pitch : on résume l'offre sans rien inventer
  const eta = Number(b.etaTicks);
  return `${Number.isFinite(eta) && eta > 0 ? `Livraison en ${eta} tick${eta > 1 ? "s" : ""}` : "Offre déposée"}${a ? ` · ${labelOf(a.genome?.profession)}` : ""}.`;
}

function txChip(hash, label) {
  if (!hash) return null;
  const url = txUrl(hash);
  return url
    ? h("a", { class: "tx-link", href: url, target: "_blank", rel: "noopener noreferrer", title: `${label} : ${hash}`, "aria-label": `${label}, transaction ${hash} sur l'explorateur (nouvel onglet)` }, "preuve ↗")
    : h("span", { class: "tx-link off", title: `${label} : ${hash}` }, core.mode === "mock" ? "mock" : shortHash(hash));
}

function bubble(agentId, body, extra = "") {
  const a = store.agents.get(agentId);
  return h("div", { class: `msg agent ${extra}`, dataset: { agent: agentId } },
    a ? avatar(a, 34) : h("span", { class: "avatar ghost" }),
    h("div", { class: "bub" }, h("div", { class: "who" }, a ? firstName(a) : String(agentId), a ? h("span", { class: `jchip ${jobOf(a.genome?.profession).cls}` }, icon(jobOf(a.genome?.profession).icon, 12), labelOf(a.genome?.profession)) : null), body));
}

function msgNode(th, m) {
  const t = th.task;
  switch (m.kind) {
    case "mission": {
      const tag = requesterTag(t);
      const job = jobOf(t.profession);
      return h("div", { class: "msg req" }, h("div", { class: "bub" },
        h("div", { class: "who" }, h("span", { class: `rtag ${tag.cls}`, title: tag.title }, tag.text), h("span", { class: `jchip ${job.cls}` }, icon(job.icon, 12), labelOf(t.profession)), h("span", { class: "budget" }, money(t.budget, 3))),
        h("div", { class: "ttl" }, t.title),
        t.prompt && t.prompt !== t.title ? h("div", { class: "prm" }, String(t.prompt).slice(0, 400)) : null));
    }
    case "bid": return bubble(m.agentId, h("div", null, h("span", { class: "price" }, money(m.price, 3)), h("span", { class: "pitch" }, m.pitch)), "bid");
    case "award": return h("div", { class: "msg sys" }, h("span", { class: "pill-sys" }, "★ ", h("b", null, m.name), ` remporte la mission · ${money(m.price, 3)}${m.bids ? ` · ${m.bids} offre${m.bids > 1 ? "s" : ""}` : ""}`), txChip(m.tx, "Séquestre verrouillé"));
    case "work": return bubble(m.agentId, h("div", { class: "work" }, h("span", { class: "dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")), `réfléchit${m.cost ? ` · cerveau payé ${formatNearSmall(m.cost)} NEAR` : ""}`), "work");
    case "submit": return bubble(m.agentId, h("div", null, "Livrable remis", m.hash ? h("code", { class: "hash" }, shortHash(m.hash)) : null), "submit");
    case "deliverable": return h("div", { class: "msg deliv" }, m.node);
    case "verdict": return h("div", { class: `msg judge ${m.ok ? "ok" : "ko"}` }, h("div", { class: "bub" },
      h("div", { class: "who" }, h("span", { class: "judge-ico", "aria-hidden": "true" }, "⚖"), "Juge", m.validator ? h("span", { class: "muted" }, ` ${m.validator}`) : null),
      h("div", null, h("b", { class: "vd" }, m.ok ? "Accepté ✓" : "Rejeté ✗"), Number.isFinite(m.score) ? ` · score ${Math.round(m.score * 100)} %` : "", m.reason ? h("div", { class: "why" }, String(m.reason).slice(0, 260)) : null)));
    case "paid": return h("div", { class: "msg sys paid" }, h("span", { class: "pill-sys paid" }, h("b", null, "payé ✓"), ` ${money(m.amount, 3)} → ${m.name}`), txChip(m.tx, "Paiement du séquestre"));
    case "refund": return h("div", { class: "msg sys bad" }, h("span", { class: "pill-sys bad" }, `remboursé · ${money(m.amount, 3)} rendus au client`), txChip(m.tx, "Remboursement"));
    case "expired": return h("div", { class: "msg sys bad" }, h("span", { class: "pill-sys bad" }, `expirée · ${{ no_bids: "aucune offre", deadline: "délai dépassé", unfunded: "client sans fonds", winner_dead: "le gagnant est mort" }[m.reason] ?? m.reason ?? ""}`));
    case "sub": return h("div", { class: "msg sys" }, h("span", { class: "pill-sys" }, `${m.name} sous-traite une partie du travail`));
    default: return h("div");
  }
}

function summaryLine(th) {
  const t = th.task;
  const win = t.winnerId ? firstName(store.agents.get(t.winnerId)) : null;
  const state = th.state === "paid" ? ["payé ✓", "ok"] : th.state === "refund" ? ["remboursé", "ko"] : th.state === "expired" ? ["expirée", "ko"] : ["en cours", "live"];
  return h("button", { type: "button", class: "t-sum", "aria-expanded": String(th.isOpen), onclick: () => { th.open = !th.isOpen; th.collapsedByUser = !th.open; renderThread(th); } },
    h("span", { class: `st ${state[1]}` }, state[0]),
    h("span", { class: "t-title" }, t.title),
    h("span", { class: "t-meta" }, win ? `${win} · ` : "", money(th.paid ?? t.awardPrice ?? t.budget, 3)),
    h("span", { class: "chev", "aria-hidden": "true" }, th.isOpen ? "▾" : "▸"));
}
function renderThread(th) {
  th.isOpen = th.open ?? (!th.done || (mine.has(th.id) && !th.collapsedByUser) || Date.now() - th.doneAt < 9000);
  const body = h("div", { class: "t-body" });
  for (const m of th.msgs) {
    const n = msgNode(th, m);
    if (!m.shown && !m.silent) n.classList.add("in");
    m.shown = true;
    body.append(n);
  }
  th.el.className = `thread${th.done ? " done" : ""}${mine.has(th.id) ? " mine" : ""}${th.isOpen ? " open" : ""}`;
  th.el.replaceChildren(summaryLine(th), th.isOpen ? body : h("span"));
  if (th.fresh) { th.fresh = false; th.el.classList.add("pop"); }
}
function finishThread(th, state) {
  th.done = true; th.state = state; th.doneAt = Date.now();
  setTimeout(() => { if (th.open === null && !mine.has(th.id) && th.el.isConnected) renderThread(th); }, 9000); // se replie seul après quelques secondes
}
function push(th, msg, silent) { msg.silent = silent; th.msgs.push(msg); renderThread(th); }

function taskOfWinner(agentId) {
  for (const th of [...threads.values()].reverse()) if (th.task.winnerId === agentId && !th.done && th.stage !== "submitted") return th;
  return null;
}

/** Entrée des événements du journal. */
export function ingest(ev, { silent = false } = {}) {
  const d = ev.data ?? {};
  switch (ev.type) {
    case "agent.born": case "agent.died": case "agent.reproduced": case "balance.changed": scheduleStrip(); break;
    default: break;
  }
  switch (ev.type) {
    case "task.posted": {
      const t = d.task; if (!t?.id) return;
      enqueue((s) => { const th = ensureThread(t, s); if (th) renderThread(th); }, silent);
      break;
    }
    case "bid.placed": {
      const b = d.bid; if (!b?.taskId) return;
      enqueue((s) => {
        const th = threads.get(b.taskId); if (!th) return;
        const a = store.agents.get(b.agentId);
        bids.set(b.taskId, [...(bids.get(b.taskId) ?? []), b]);
        push(th, { kind: "bid", agentId: b.agentId, price: b.price, pitch: pitchOf(b, a) }, s);
        if (!s) speak(b.agentId);
      }, silent);
      break;
    }
    case "task.awarded": {
      enqueue((s) => {
        const th = threads.get(d.taskId); if (!th) return;
        th.task.winnerId = d.winnerId; th.task.awardPrice = d.price; th.stage = "awarded";
        th.pendingAward = { kind: "award", name: firstName(store.agents.get(d.winnerId)), price: d.price, bids: d.bids };
        push(th, th.pendingAward, s);
        if (!s) speak(d.winnerId);
      }, silent);
      break;
    }
    case "escrow.locked": {
      enqueue((s) => { const th = threads.get(d.taskId); if (!th) return; const m = [...th.msgs].reverse().find((x) => x.kind === "award"); if (m) { m.tx = d.tx; renderThread(th); } }, silent);
      break;
    }
    case "brain.charged": {
      if (d.purpose !== "execute_task") return;
      enqueue((s) => { const th = taskOfWinner(d.agentId); if (!th) return; push(th, { kind: "work", agentId: d.agentId, cost: d.cost }, s); if (!s) speak(d.agentId); }, silent);
      break;
    }
    case "task.submitted": {
      enqueue((s) => { const th = threads.get(d.taskId); if (!th) return; th.stage = "submitted"; push(th, { kind: "submit", agentId: d.agentId, hash: d.resultHash }, s); if (!s) speak(d.agentId); }, silent);
      break;
    }
    case "deliverable.produced": {
      enqueue((s) => {
        const th = threads.get(d.taskId); if (!th) return;
        const inline = Array.isArray(d.files) && d.files.some((f) => typeof f?.content === "string") ? { taskId: d.taskId, files: d.files } : null; // journal futur : contenu dans files[]
        const msg = { kind: "deliverable", node: buildChatDeliverable(inline, d) };
        push(th, msg, s);
        // le contenu (texte, SVG) vient de l'API ; sans contenu (rejeu d'un journal), la liste des fichiers reste affichée
        // en rejeu, le contenu éventuel est déjà dans files[] : on n'interroge pas l'API (404 attendu pour les anciens journaux)
        if (core.mode === "replay") return;
        api(`/api/tasks/${encodeURIComponent(d.taskId)}/deliverable`).then((r) => {
          if (r.ok && r.body && Array.isArray(r.body.files)) { msg.node = buildChatDeliverable(r.body, d); renderThread(th); }
        }).catch(() => { /* conservé tel quel */ });
      }, silent);
      break;
    }
    case "task.validated": {
      enqueue((s) => {
        const th = threads.get(d.taskId); if (!th) return;
        const v = d.validation ?? {};
        push(th, { kind: "verdict", ok: v.verdict === "accepted", score: Number(v.score), reason: v.reason, validator: String(v.validator ?? "").replace(/^brain:/, "") }, s);
      }, silent);
      break;
    }
    case "escrow.released": {
      enqueue((s) => {
        const th = threads.get(d.taskId); if (!th) return;
        const a = store.agentByAccount(d.payee);
        th.paid = d.amount;
        push(th, { kind: "paid", amount: d.amount, name: a ? firstName(a) : String(d.payee ?? "").split(".")[0], tx: d.tx }, s);
        finishThread(th, "paid"); renderThread(th);
        if (!s && a) speak(a.id);
      }, silent);
      break;
    }
    case "escrow.refunded": {
      enqueue((s) => { const th = threads.get(d.taskId); if (!th) return; push(th, { kind: "refund", amount: d.amount, tx: d.tx }, s); finishThread(th, "refund"); renderThread(th); }, silent);
      break;
    }
    case "task.expired": {
      enqueue((s) => { const th = threads.get(d.taskId); if (!th) return; if (th.state === "refund") return; push(th, { kind: "expired", reason: d.reason }, s); finishThread(th, "expired"); renderThread(th); }, silent);
      break;
    }
    case "subcontract.created": {
      enqueue((s) => { const th = threads.get(d.parentTaskId); if (th) push(th, { kind: "sub", name: firstName(store.agents.get(d.byAgentId)) }, s); }, silent);
      break;
    }
    default: break;
  }
}

export function resetMission() {
  flushQueue();
  for (const th of threads.values()) th.el.remove();
  threads.clear(); bids.clear();
  for (const c of cards.values()) c.btn.remove();
  cards.clear();
  $("feedHint").hidden = false;
  renderStrip();
}

// ------------------------------------------------------------------ barre de mission
function setStatus(kind, title, lines = []) {
  const box = $("mStatus");
  box.className = `m-status ${kind}`;
  box.hidden = !title;
  box.replaceChildren(...(title ? [h("strong", null, title), ...lines.map((x) => h("span", null, " " + x))] : []));
}

function renderChips() {
  const spec = specOf(sel.job);
  const jb = jobOf(sel.job);
  const btn = $("jobBtn");
  btn.replaceChildren(icon(jb.icon, 18), h("span", null, labelOf(sel.job)), h("span", { class: "chev", "aria-hidden": "true" }, "▾"));
  btn.className = `chip job-chip ${jb.cls}`;
  btn.setAttribute("aria-label", `Métier : ${labelOf(sel.job)}. Cliquer pour changer.`);
  const min = minBudget(sel.job);
  $("budgetMin").textContent = min != null ? `min. ${nearInput(min)}` : "";
  if (min != null) {
    const cur = parseNearToYocto($("budgetInput").value);
    if (!sel.budgetTouched || cur == null || cur < min) { $("budgetInput").value = nearInput(min); sel.budgetTouched = false; }
  }
  $("jobHelp").textContent = spec?.deliverable ? `Livrable : ${spec.deliverable}` : "";
  const warn = sel.job === "legal" ? "Ceci n'est pas un avis juridique : faites relire la checklist par un professionnel." : sel.job === "logo" ? "Le logo est original : 3 dessins inédits, jamais une marque existante." : "";
  $("jobWarn").textContent = warn;
  $("jobWarn").hidden = !warn;
  const ids = core.catalogue ? [...core.catalogue.keys()].filter((i) => JOB_IDS.includes(i)) : JOB_IDS;
  const menu = $("jobMenu");
  menu.replaceChildren(...(ids.length ? ids : JOB_IDS).map((id) => {
    const s = specOf(id), j = jobOf(id);
    return h("li", { role: "none" }, h("button", { type: "button", role: "menuitemradio", "aria-checked": String(id === sel.job), class: `${j.cls}${id === sel.job ? " on" : ""}`, onclick: () => { sel.job = id; sel.jobTouched = true; closeMenu(); renderChips(); } },
      icon(j.icon, 18), h("span", { class: "mi-l" }, labelOf(id)), s ? h("span", { class: "mi-p" }, `${nearInput(s.nearPrice)} NEAR`) : null));
  }));
}
function closeMenu() { $("jobMenu").hidden = true; $("jobBtn").setAttribute("aria-expanded", "false"); }

function renderMode() {
  const replay = core.mode === "replay";
  const input = $("mInput");
  input.disabled = replay;
  $("mSend").disabled = replay;
  $("jobBtn").disabled = replay;
  $("budgetInput").disabled = replay;
  input.placeholder = replay ? "Missions désactivées en rejeu" : "Décrivez votre mission…";
  $("composer").classList.toggle("off", replay);
  $("replayNote").hidden = !replay;
  $("publicNote").hidden = replay;
}

let cooldown = 0;
function lockSend(sec) {
  clearInterval(cooldown);
  const b = $("mSend");
  if (!sec) { b.disabled = core.mode === "replay"; b.classList.remove("wait"); b.textContent = ""; b.append(h("span", { class: "sr" }, "Envoyer la mission"), arrowIcon()); return; }
  let left = Math.min(60, Math.max(1, Math.ceil(sec)));
  b.disabled = true; b.classList.add("wait");
  const tick = () => { b.textContent = `${left}s`; if (left-- <= 0) { clearInterval(cooldown); lockSend(0); } };
  tick(); cooldown = setInterval(tick, 1000);
}
function arrowIcon() {
  const svg = icon("x", 20);
  svg.replaceChildren();
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", "M5 12h14M13 6l6 6-6 6");
  svg.append(p);
  return svg;
}

async function submit() {
  if (core.mode === "replay") return;
  const prompt = $("mInput").value.trim();
  const budgetNear = $("budgetInput").value.trim().replace(",", ".");
  const errs = [];
  if (prompt.length < 10) errs.push("Décrivez la mission en quelques mots de plus (10 caractères minimum).");
  if (!/^\d+(\.\d{1,6})?$/.test(budgetNear)) errs.push("Budget : un nombre décimal en NEAR, 6 décimales maximum (ex. 0.05).");
  const min = minBudget(sel.job), cur = parseNearToYocto(budgetNear);
  if (min != null && cur != null && cur < min) errs.push(`Budget trop bas : le minimum pour « ${labelOf(sel.job)} » est ${nearInput(min)} NEAR (vous proposez ${budgetNear}).`);
  if (errs.length) { setStatus("err", errs[0], errs.slice(1)); return; }
  const first = prompt.split(/\n/)[0].trim();
  const payload = { title: (first.length > 80 ? first.slice(0, 77) + "…" : first), prompt, profession: sel.job, budgetNear, requesterLabel: "visiteur" };
  $("mSend").disabled = true;
  setStatus("info", "Envoi…");
  try {
    const r = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    const retry = Number(r.headers.get("Retry-After")) || 0;
    if (r.status === 201 || r.status === 200) {
      const t = r.body?.task ?? r.body ?? {};
      setStatus("", "");
      $("mInput").value = ""; autosize();
      sel.jobTouched = false;
      lockSend(0);
      if (t.id) {
        mine.add(t.id);
        const th = ensureThread({ requester: { kind: "visitor", label: "visiteur" }, ...payload, budget: String(parseNearToYocto(budgetNear) ?? 0n), ...t }, false);
        if (th) { th.open = true; renderThread(th); }
        $("feed").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    } else if (r.status === 400) {
      const m = errorMessages(r.body);
      setStatus("err", /budget|trop bas|minimum/i.test(m.join(" ")) ? "Budget refusé par le serveur" : "Le serveur refuse cette mission", m.length ? m : ["Données invalides."]); lockSend(0);
    } else if (r.status === 429) {
      setStatus("warn", "Trop de missions pour le moment.", [...errorMessages(r.body), retry ? `Réessayez dans ${retry} s.` : "Réessayez dans un moment."]); lockSend(retry || 15);
    } else if (r.status === 503) {
      const pending = r.body?.error?.code === "VALIDATION_PENDING";
      setStatus("warn", pending ? "Validation en cours, patientez un instant." : "Service indisponible.", [...errorMessages(r.body)]); lockSend(retry || 5);
    } else if (r.status === 403) {
      setStatus("err", "Requête refusée.", ["Ouvrez la page depuis l'adresse du serveur (protection anti-CSRF)."]); lockSend(0);
    } else { setStatus("err", `Erreur inattendue (${r.status}).`, errorMessages(r.body)); lockSend(0); }
  } catch { setStatus("err", "Serveur injoignable.", ["Vérifiez que le backend tourne puis réessayez."]); lockSend(0); }
}

function autosize() {
  const t = $("mInput");
  t.style.height = "auto";
  t.style.height = `${Math.min(t.scrollHeight, 168)}px`;
}

export function initMission({ openAgent }) {
  onOpenAgent = openAgent;
  $("mInput").addEventListener("input", () => {
    autosize();
    if (!sel.jobTouched) { const j = inferJob($("mInput").value); const next = j ?? "marketing"; if (next !== sel.job) { sel.job = next; renderChips(); } }
  });
  $("mInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } });
  $("composer").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
  $("budgetInput").addEventListener("input", () => { sel.budgetTouched = true; });
  $("budgetChip").addEventListener("click", (e) => { if (e.target !== $("budgetInput")) $("budgetInput").focus(); });
  $("jobBtn").addEventListener("click", () => { const m = $("jobMenu"); m.hidden = !m.hidden; $("jobBtn").setAttribute("aria-expanded", String(!m.hidden)); if (!m.hidden) m.querySelector("button.on, button")?.focus(); });
  document.addEventListener("click", (e) => { if (!e.target.closest?.(".job-wrap")) closeMenu(); });
  $("jobMenu").addEventListener("keydown", (e) => { if (e.key === "Escape") { closeMenu(); $("jobBtn").focus(); } });
  on("event", (ev, o) => ingest(ev, o));
  on("meta", () => { renderMode(); renderChips(); scheduleStrip(); });
  on("reset", resetMission);
  on("loaded", () => { renderStrip(); renderMode(); renderChips(); });
  renderChips(); renderMode(); lockSend(0);
  // les missions terminées se replient d'elles-mêmes ; rien d'autre à planifier
}
