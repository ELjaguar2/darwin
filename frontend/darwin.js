// Interface L17 : routage à trois onglets, bandeau de mode toujours visible, notifications discrètes, thème.
import { store, core, on, start } from "./core.js";
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
  pill.dataset.mode = m;
  pill.replaceChildren(h("span", { class: "mp-dot", "aria-hidden": "true" }),
    m === "replay" ? h("b", null, "REJEU") : m === "testnet" ? h("b", null, "TESTNET NEAR") : h("b", null, "MODE MOCK"),
    h("span", { class: "mp-sub" }, m === "replay" ? "run réel enregistré" : m === "testnet" ? (brainReal ? "IA réelle · fonds sans valeur" : "IA simulée · fonds sans valeur") : "chaîne et IA simulées"));
  pill.title = m === "replay" ? "Les données viennent d'un journal enregistré, pas d'une simulation en cours." : m === "testnet" ? "Réseau de test NEAR : transactions vérifiables, aucun fonds réel." : "Aucune transaction réelle : chaîne et IA simulées en mémoire.";
  const ban = $("replayBanner");
  ban.hidden = m !== "replay";
  if (m === "replay") {
    const label = typeof core.replayInfo?.label === "string" && core.replayInfo.label ? core.replayInfo.label.slice(0, 140) : "Rejeu d'un run réel testnet du 10 novembre 2026";
    $("replayText").textContent = label;
  }
  document.body.dataset.mode = m;
  const c = $("conn");
  c.dataset.state = core.conn.state;
  $("connText").textContent = m === "replay" && core.conn.state === "live" ? "Rejeu en cours" : core.conn.text;
}

// ------------------------------------------------------------------ notifications discrètes
function toast(kind, glyph, text, agentId) {
  const box = $("toasts");
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
  route(); renderMeta();
  if (/[?&]debug\b/.test(location.search)) window.__darwin = { store, core };
  start();
}
void formatNear;
