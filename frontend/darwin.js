// Interface L17 : routage à trois onglets, bandeau de mode toujours visible, notifications discrètes, thème.
import { store, core, api, on, start } from "./core.js";
import { h, formatNear } from "./format.js";
import { firstName } from "./jobs.js";
import { initMission, renderStrip } from "./mission.js";
import { initLignees, select, showLignees } from "./lignees.js";
import { initPreuves } from "./preuves.js";

const $ = (id) => document.getElementById(id);
const PAGES = ["mission", "lignees", "preuves"];
const TITLES = { mission: "Mission", lignees: "Lignées", preuves: "Preuves" };

function route() {
  const m = /^#\/?(mission|lignees|preuves)/.exec(location.hash);
  const page = m ? m[1] : "mission";
  for (const p of PAGES) {
    $(p).hidden = p !== page;
    const tab = document.querySelector(`[data-tab="${p}"]`);
    tab.classList.toggle("on", p === page);
    if (p === page) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
  }
  document.title = `${TITLES[page]} · Darwin`;
  document.body.dataset.page = page;
  if (page === "lignees") showLignees();
  if (page === "mission") renderStrip();
}

function renderMeta() {
  const pill = $("modePill");
  const brainReal = store.brain.kind === "nearai" || store.health?.brain?.kind === "nearai";
  const m = core.mode;
  const rmeta = core.replayInfo?.meta ?? {};
  const realRun = rmeta.recorded?.chain === "near"; // seul un journal marqué « chaîne near » est présenté comme run réel
  pill.dataset.mode = m;
  pill.replaceChildren(h("span", { class: "mp-dot", "aria-hidden": "true" }),
    m === "replay" ? h("b", null, "REJEU") : m === "testnet" ? h("b", null, "TESTNET NEAR") : h("b", null, "MODE MOCK"),
    h("span", { class: "mp-sub" }, m === "replay" ? (realRun ? "run réel enregistré" : "run enregistré") : m === "testnet" ? (brainReal ? "IA réelle · fonds sans valeur" : "IA simulée · fonds sans valeur") : "chaîne et IA simulées"));
  pill.title = m === "replay" ? `Les données viennent d'un journal enregistré${realRun ? " (run réel sur testnet)" : " (non marqué comme run réel testnet)"}, pas d'une simulation en cours.` : m === "testnet" ? "Réseau de test NEAR : transactions vérifiables, aucun fonds réel." : "Aucune transaction réelle : chaîne et IA simulées en mémoire.";
  const esc = core.health?.escrow ?? store.health?.escrow;
  const eb = $("escBadge");
  eb.hidden = !(m === "testnet" && esc && esc !== "contract");
  const ban = $("replayBanner");
  ban.hidden = m !== "replay";
  if (m === "replay") renderReplay();
  document.body.dataset.mode = m;
  const c = $("conn");
  c.dataset.state = core.conn.state;
  const ended = m === "replay" && core.replayInfo?.phase === "ended";
  c.dataset.ended = String(ended);
  $("connText").textContent = m === "replay" && core.conn.state === "live" ? (ended ? "Rejeu terminé" : "Rejeu en cours") : core.conn.text;
  renderStrip();
  placeToasts();
}

function renderReplay() {
  const rp = core.replayInfo ?? {};
  const meta = rp.meta ?? {};
  const on = meta.recordedOn ? new Date(`${meta.recordedOn}T00:00:00Z`) : null;
  const date = on && !Number.isNaN(on.getTime()) ? on.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const kind = meta.recorded?.chain === "near" ? "run réel testnet" : "run enregistré";
  const label = typeof meta.label === "string" && meta.label ? meta.label.slice(0, 140) : `Rejeu d'un ${kind}${date ? ` du ${date}` : ""}`;
  const phase = { playing: "en cours", paused: "en pause", ended: "terminé" }[rp.phase] ?? "";
  const pct = rp.total ? Math.min(100, Math.round((Number(rp.position) / Number(rp.total)) * 100)) : 0;
  const ban = $("replayBanner");
  const speeds = [1, 5, 20].map((v) => h("button", { type: "button", "aria-pressed": String(rp.speed === v), onclick: () => replayCtl("speed", { speed: v }) }, `x${v}`));
  const extra = rp.phase === "ended" ? h("button", { type: "button", onclick: () => replayCtl("restart") }, "Rejouer") : null;
  ban.replaceChildren(h("span", { class: "rb-ico", "aria-hidden": "true" }, "⏵"), h("b", { id: "replayText" }, label),
    h("span", { class: "rb-prog", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": "Progression du rejeu" }, h("i", { css: { width: `${pct}%` } })),
    h("span", { class: "rb-txt" }, `${phase}${rp.total ? ` · ${pct} %` : ""}`),
    h("span", { class: "rp-ctl" }, ...speeds, extra));
}
async function replayCtl(name, body) {
  try { const r = await api(`/api/replay/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body ?? {}) }); if (r.ok && r.body && core.health) { core.health.replay = r.body; core.replayInfo = r.body; renderMeta(); } } catch { /* jeton requis ou serveur arrêté : sans effet */ }
}

// ------------------------------------------------------------------ notifications discrètes
function placeToasts() {
  const box = $("toasts"), ban = $("replayBanner");
  if (core.mode === "replay" && !ban.hidden) box.style.top = `${Math.round(Math.max(78, ban.getBoundingClientRect().bottom + 10))}px`;
  else box.style.removeProperty("top");
}

function toast(kind, glyph, text, agentId) {
  const box = $("toasts");
  placeToasts();
  const t = h("div", { class: `toast ${kind}`, role: "status" }, h("span", { class: "t-g", "aria-hidden": "true" }, glyph), h("span", null, text));
  if (agentId) { t.classList.add("click"); t.addEventListener("click", () => openAgent(agentId)); }
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => t.classList.add("out"), 4600);
  setTimeout(() => t.remove(), 5400);
}

function onEvent(ev, { silent } = {}) {
  if (silent || !core.live) return;
  const d = ev.data ?? {};
  if (ev.type === "agent.born" && d.agent) {
    const p = d.parentId ? store.agents.get(d.parentId) : null;
    toast("birth", "✦", p ? `${firstName(d.agent)} naît de ${firstName(p)} · génération ${d.agent.generation}` : `${firstName(d.agent)} rejoint la simulation`, d.agent.id);
  } else if (ev.type === "agent.died") {
    const a = store.agents.get(d.agentId);
    toast("death", "✝", `${firstName(a) || d.agentId} s'éteint${d.cause === "starvation" ? " : à court d'argent" : ""}`, d.agentId);
  } else if (ev.type === "sim.stopped") {
    toast("sys", "■", `Simulation terminée · ${d.generations ?? "?"} génération${d.generations > 1 ? "s" : ""}`);
  }
}

function openAgent(id) {
  location.hash = "#/lignees";
  route();
  setTimeout(() => select(id), 60);
}

// ------------------------------------------------------------------ thème
function initTheme() {
  $("themeBtn").addEventListener("click", () => {
    const root = document.documentElement;
    const next = (root.dataset.theme || "dark") === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("darwin-theme", next); } catch { /* stockage indisponible */ }
  });
}

export function boot() {
  initTheme();
  initMission({ openAgent });
  initLignees();
  initPreuves();
  on("event", onEvent);
  on("meta", renderMeta);
  on("conn", renderMeta);
  on("loaded", renderMeta);
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", placeToasts);
  route(); renderMeta();
  if (/[?&]debug\b/.test(location.search)) window.__darwin = { store, core };
  start();
}
void formatNear;
