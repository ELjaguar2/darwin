// Page « Preuves » (L17) : population et spécialisation par génération, flux d'argent, transactions on-chain, attestation TEE, briques NEAR.
// Tout est calculé à partir du journal reçu (agrégats d'affichage). Aucun innerHTML.
import { store, core, ledger, on, aliveAgents, labelOfJob } from "./core.js";
import { h, formatNear, formatNearSmall, shortHash, big, nearNumber } from "./format.js";
import { jobOf, icon } from "./jobs.js";

/** Modèles marqués attestables (TEE) dans docs/ATTESTATION_TEE.md §1 (liste blanche du cerveau). Les autres sont externes : rien n'est prouvé pour eux. */
export const TEE_MODELS = new Set(["Qwen/Qwen3.8-27B", "z-ai/glm-5.3-flash", "Qwen/Qwen3.6-35B-A3B-FP8", "deepseek-ai/DeepSeek-V4.1-Flash-1017"]);

const $ = (id) => document.getElementById(id);
const labelOf = (p) => labelOfJob(p, jobOf(p).label);
let txLimit = 30, timer = 0;
const schedule = () => { if (!timer) timer = setTimeout(() => { timer = 0; render(); }, 250); };

function kpi(label, value, sub) {
  return h("div", { class: "kpi" }, h("b", null, String(value)), h("span", null, label), sub ? h("small", null, sub) : null);
}

function renderKpis() {
  const all = [...store.agents.values()], alive = all.filter((a) => a.status === "alive").length;
  const gen = Math.max(store.generations, ...all.map((a) => a.generation), 0);
  $("kpis").replaceChildren(
    kpi(gen > 1 ? "générations" : "génération", gen), kpi(alive > 1 ? "vivants" : "vivant", alive), kpi(all.length - alive > 1 ? "morts" : "mort", all.length - alive), kpi("missions payées", store.totals.tasksSettled ?? 0),
    kpi("NEAR gagnés", formatNear(ledger.totals.earned, 2), "par les agents"));
}

function renderPopulation() {
  const all = [...store.agents.values()];
  const gens = [...new Set(all.map((a) => a.generation))].sort((a, b) => a - b);
  const totalsAlive = new Map();
  const rows = gens.map((g) => {
    const members = all.filter((a) => a.generation === g);
    const byJob = new Map();
    for (const a of members) { const j = a.genome?.profession ?? "?"; const r = byJob.get(j) ?? { alive: 0, dead: 0 }; if (a.status === "alive") { r.alive++; totalsAlive.set(j, (totalsAlive.get(j) ?? 0) + 1); } else r.dead++; byJob.set(j, r); }
    return { g, members, byJob };
  });
  const max = Math.max(1, ...rows.map((r) => r.members.length));
  const out = rows.map((r) => {
    const segs = [];
    for (const [j, v] of r.byJob) {
      const jb = jobOf(j);
      if (v.alive) segs.push(h("span", { class: `seg ${jb.cls}`, title: `${labelOf(j)} : ${v.alive} vivant${v.alive > 1 ? "s" : ""}`, css: { flexGrow: String(v.alive) } }, h("b", null, v.alive)));
      if (v.dead) segs.push(h("span", { class: `seg dead ${jb.cls}`, title: `${labelOf(j)} : ${v.dead} mort${v.dead > 1 ? "s" : ""}`, css: { flexGrow: String(v.dead) } }, h("b", null, "†" + v.dead)));
    }
    const alive = r.members.filter((a) => a.status === "alive").length;
    const label = `Génération ${r.g} : ${[...r.byJob].map(([j, v]) => `${labelOf(j)} ${v.alive} vivants ${v.dead} morts`).join(", ")}`;
    return h("li", { class: "pop-row", role: "img", "aria-label": label },
      h("span", { class: "pop-g" }, `Gén. ${r.g}`),
      h("span", { class: "pop-bar", css: { width: `${Math.max(8, (r.members.length / max) * 100)}%` } }, segs),
      h("span", { class: "pop-n" }, alive ? `${alive} / ${r.members.length}` : "éteinte"));
  });
  $("population").replaceChildren(...(out.length ? out : [h("li", { class: "muted" }, "En attente des premiers agents…")]));
  const jobs = [...new Set(all.map((a) => a.genome?.profession).filter(Boolean))];
  $("popLegend").replaceChildren(...jobs.map((j) => h("li", { class: jobOf(j).cls }, h("span", { class: "dot" }), `${labelOf(j)} `, h("b", null, totalsAlive.get(j) ?? 0))), h("li", { class: "dead-key" }, h("span", { class: "dot hatch" }), "mort"));
  const dom = [...totalsAlive].sort((a, b) => b[1] - a[1])[0];
  $("popNote").textContent = dom ? `Métier dominant parmi les vivants : ${labelOf(dom[0])} (${dom[1]} sur ${[...totalsAlive.values()].reduce((s, n) => s + n, 0)}). Hypothèse à vérifier sur ce journal : les lignées spécialisées là où la demande est forte devraient mieux survivre ; les chiffres ci-dessus ne le prouvent pas à eux seuls.` : "";
}

function renderFlows() {
  const t = ledger.totals;
  const items = [["Gagné", t.earned, "earn", "missions payées aux agents"], ["Dépensé en cerveau IA", t.brain, "brain", "appels à l'IA, débités des soldes"], ["Transmis aux enfants", t.passed, "pass", "capital donné à chaque naissance"]];
  const max = Math.max(1, ...items.map(([, v]) => nearNumber(v)));
  $("flows").replaceChildren(...items.map(([l, v, cls, sub]) => h("li", { class: `flow ${cls}` },
    h("div", { class: "flow-top" }, h("span", null, l), h("b", null, `${cls === "brain" ? formatNearSmall(v) : formatNear(v, 2)} NEAR`)),
    h("div", { class: "flow-bar", role: "img", "aria-label": `${l} : ${cls === "brain" ? formatNearSmall(v) : formatNear(v, 3)} NEAR` }, h("span", { css: { width: `${Math.max(1.5, (nearNumber(v) / max) * 100)}%` } })),
    h("small", null, sub))));
  const gens = [...ledger.byGen.keys()].sort((a, b) => a - b);
  $("flowGen").replaceChildren(...(gens.length ? [
    h("thead", null, h("tr", null, ["Génération", "Gagné", "Cerveau", "Transmis"].map((x) => h("th", { scope: "col" }, x)))),
    h("tbody", null, gens.map((g) => { const r = ledger.byGen.get(g); return h("tr", null, h("th", { scope: "row" }, `Gén. ${g}`), h("td", { class: "earn" }, formatNear(r.earned, 2)), h("td", { class: "brain" }, formatNearSmall(r.brain)), h("td", { class: "pass" }, formatNear(r.passed, 2))); })),
  ] : []));
  $("flowNote").textContent = t.fees > 0n ? `Frais réseau payés par les agents : ${formatNear(t.fees, 3)} NEAR (non inclus ci-dessus).` : "";
}

function renderTxs() {
  const list = store.feed.filter((x) => !x.minor);
  const shown = list.slice(0, txLimit);
  const who = (acc) => { if (!acc) return null; const a = store.agentByAccount(acc); return a ? a.name.replace(/[-\s]\d+$/, "") : String(acc).split(".")[0]; };
  $("txs").replaceChildren(...(shown.length ? shown.map((it) => {
    const flow = [who(it.from), who(it.to)].filter(Boolean).join(" → ");
    const link = it.url
      ? h("a", { class: "hash", href: it.url, target: "_blank", rel: "noopener noreferrer", "aria-label": `Voir la transaction ${it.hash} sur nearblocks (nouvel onglet)` }, shortHash(it.hash), " ↗")
      : h("span", { class: "hash", title: it.hash }, shortHash(it.hash), it.mock ? h("span", { class: "tag-mini" }, "mock") : null);
    return h("li", null, h("span", { class: "tx-l" }, it.label ?? "Transaction", flow ? h("small", null, flow) : null), it.amount != null ? h("b", { class: "tx-a" }, `${formatNear(it.amount, 3)}`) : h("span"), link);
  }) : [h("li", { class: "muted" }, "Aucune transaction pour l'instant.")]));
  const more = $("txMore");
  more.hidden = list.length <= txLimit;
  more.textContent = `Voir plus (${list.length - txLimit} restantes)`;
  const real = list.filter((x) => x.url).length;
  $("txHint").textContent = store.chain.kind === "near" && real ? `${real} transaction${real > 1 ? "s" : ""} vérifiable${real > 1 ? "s" : ""} sur testnet.nearblocks.io` : "Hash fictifs : mode simulé, aucun explorateur.";
}

function renderTee() {
  const t = ledger.totals;
  const mockBrain = store.brain.kind === "mock" || core.health?.brain?.kind === "mock";
  let tee = 0;
  for (const [m, n] of t.models) if (TEE_MODELS.has(m)) tee += n;
  const box = $("tee");
  let cls, head, body;
  if (mockBrain && core.mode !== "replay") { cls = "na"; head = "TEE : sans objet"; body = "L'IA est simulée (mock) : aucun appel réel, rien à attester."; }
  else if (!t.brainCalls) { cls = "na"; head = "TEE : aucun appel enregistré"; body = "Aucun appel de cerveau dans le journal reçu."; }
  else if (tee > 0) { cls = "ok"; head = `TEE : ${tee} appel${tee > 1 ? "s" : ""} sur ${t.brainCalls}`; body = `${tee} appel${tee > 1 ? "s" : ""} sur ${t.brainCalls} passent par un modèle attestable (Intel TDX + GPU NVIDIA). Les ${t.brainCalls - tee} autres utilisent des modèles externes : rien n'est prouvé pour eux.`; }
  else { cls = "warn"; head = `TEE : 0 appel sur ${t.brainCalls}`; body = "Aucun appel de ce journal n'a utilisé un modèle attestable."; }
  box.className = `tee ${cls}`;
  box.replaceChildren(h("div", { class: "tee-head" }, h("span", { class: "tee-shield", "aria-hidden": "true" }, cls === "ok" ? "✓" : "–"), h("b", null, head)), h("p", null, body),
    h("p", { class: "muted small" }, "L'attestation est un contrôle à la demande (commande ai:verify-attestation), pas une preuve par appel. Dernière vérification enregistrée : 10 novembre 2026, modèle z-ai/glm-5.3-flash, 20 contrôles réussis, 0 échec (docs/ATTESTATION_TEE.md)."));
}

function renderTools() {
  const near = store.chain.kind === "near" && !(store.health?.mock ?? false) || core.mode === "replay" && store.chain.kind === "near";
  const esc = store.health?.escrow;
  const real = core.mode !== "mock";
  const brainReal = store.brain.kind === "nearai" || (core.mode === "replay" && ledger.totals.brainCalls > 0);
  const tools = [
    ["NEAR testnet", "comptes, transferts, preuves en chaîne (RPC FastNEAR)", near],
    ["Contrat Darwin", esc === "operator-account" ? "séquestre dégradé : compte opérateur, registre local" : "registre, séquestre, réputation (Rust, near-sdk)", near && esc !== "operator-account"],
    ["NEAR AI Cloud", "cerveau des agents, coût débité par tokens", brainReal],
    ["NEAR Intents (1Click)", "V2 : devis en simulation, désactivé par défaut", false],
    ["Explorateur nearblocks", "un lien par transaction vérifiable", near],
  ];
  $("tools").replaceChildren(...tools.map(([n, s, on]) => h("li", { class: on ? "on" : "off" }, h("b", null, n), h("span", null, s), h("em", null, on ? (core.mode === "replay" ? "réel (rejeu)" : "réel") : real && !on ? "inactif" : "simulé"))));
  const notes = [["Client simulé", "les missions « simulé » viennent d'un client artificiel."], ["Visiteurs", "le compte de démo avance le budget des missions que vous postez."], ["Confiance", "un juge IA note chaque livrable (« validé par » sur chaque paiement) ; le juge est choisi par l'opérateur, pas trustless."]];
  $("honest").replaceChildren(...notes.map(([a, b]) => h("li", null, h("b", null, a), " ", b)));
}

function render() { renderKpis(); renderPopulation(); renderFlows(); renderTxs(); renderTee(); renderTools(); }

export function initPreuves() {
  $("txMore").addEventListener("click", () => { txLimit += 30; renderTxs(); });
  on("event", (ev) => { if (core.live || ev.type) schedule(); });
  on("loaded", render); on("reset", render); on("meta", schedule);
  render();
}
void aliveAgents; void icon; void big;
