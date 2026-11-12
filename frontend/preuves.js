// "Proof" page (L17): population and specialization per generation, money flows, on-chain transactions, TEE attestation, NEAR building blocks.
// Everything is computed from the received log (display aggregates). No innerHTML.
import { store, core, ledger, on, aliveAgents, labelOfJob, txUrl } from "./core.js";
import { h, formatNear, formatNearSmall, shortHash, big, nearNumber } from "./format.js";
import { jobOf, icon, firstName } from "./jobs.js";
import { subs, FALLBACK_REASON } from "./subcontract.js";

/** Models marked attestable (TEE) in docs/ATTESTATION_TEE.md section 1 (brain allowlist). The others are external: nothing is proven for them. */
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
    kpi(gen > 1 ? "generations" : "generation", gen), kpi("alive", alive), kpi("dead", all.length - alive), kpi("missions paid", store.totals.tasksSettled ?? 0),
    kpi("NEAR earned", formatNear(ledger.totals.earned, 2), "by the agents"));
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
      if (v.alive) segs.push(h("span", { class: `seg ${jb.cls}`, title: `${labelOf(j)}: ${v.alive} alive`, css: { flexGrow: String(v.alive) } }, h("b", null, v.alive)));
      if (v.dead) segs.push(h("span", { class: `seg dead ${jb.cls}`, title: `${labelOf(j)}: ${v.dead} dead`, css: { flexGrow: String(v.dead) } }, h("b", null, "†" + v.dead)));
    }
    const alive = r.members.filter((a) => a.status === "alive").length;
    const label = `Generation ${r.g}: ${[...r.byJob].map(([j, v]) => `${labelOf(j)} ${v.alive} alive ${v.dead} dead`).join(", ")}`;
    return h("li", { class: "pop-row", role: "img", "aria-label": label },
      h("span", { class: "pop-g" }, `Gen. ${r.g}`),
      h("span", { class: "pop-bar", css: { width: `${Math.max(8, (r.members.length / max) * 100)}%` } }, segs),
      h("span", { class: "pop-n" }, alive ? `${alive} / ${r.members.length}` : "extinct"));
  });
  $("population").replaceChildren(...(out.length ? out : [h("li", { class: "muted" }, "Waiting for the first agents…")]));
  const jobs = [...new Set(all.map((a) => a.genome?.profession).filter(Boolean))];
  $("popLegend").replaceChildren(...jobs.map((j) => h("li", { class: jobOf(j).cls }, h("span", { class: "dot" }), `${labelOf(j)} `, h("b", null, totalsAlive.get(j) ?? 0))), h("li", { class: "dead-key" }, h("span", { class: "dot hatch" }), "dead"));
  const dom = [...totalsAlive].sort((a, b) => b[1] - a[1])[0];
  $("popNote").textContent = dom ? `Dominant profession among the living: ${labelOf(dom[0])} (${dom[1]} of ${[...totalsAlive.values()].reduce((s, n) => s + n, 0)}). Hypothesis to check on this log: lineages specialized where demand is strong should survive better; the figures above do not prove it on their own.` : "";
}

function renderFlows() {
  const t = ledger.totals;
  const items = [["Earned", t.earned, "earn", "missions paid to the agents"], ["Spent on AI brain", t.brain, "brain", "AI calls, debited from balances"], ["Passed to children", t.passed, "pass", "capital given at each birth"]];
  const max = Math.max(1, ...items.map(([, v]) => nearNumber(v)));
  $("flows").replaceChildren(...items.map(([l, v, cls, sub]) => h("li", { class: `flow ${cls}` },
    h("div", { class: "flow-top" }, h("span", null, l), h("b", null, `${cls === "brain" ? formatNearSmall(v) : formatNear(v, 2)} NEAR`)),
    h("div", { class: "flow-bar", role: "img", "aria-label": `${l}: ${cls === "brain" ? formatNearSmall(v) : formatNear(v, 3)} NEAR` }, h("span", { css: { width: `${Math.max(1.5, (nearNumber(v) / max) * 100)}%` } })),
    h("small", null, sub))));
  const gens = [...ledger.byGen.keys()].sort((a, b) => a - b);
  $("flowGen").replaceChildren(...(gens.length ? [
    h("thead", null, h("tr", null, ["Generation", "Earned", "Brain", "Passed"].map((x) => h("th", { scope: "col" }, x)))),
    h("tbody", null, gens.map((g) => { const r = ledger.byGen.get(g); return h("tr", null, h("th", { scope: "row" }, `Gen. ${g}`), h("td", { class: "earn" }, formatNear(r.earned, 2)), h("td", { class: "brain" }, formatNearSmall(r.brain)), h("td", { class: "pass" }, formatNear(r.passed, 2))); })),
  ] : []));
  $("flowNote").textContent = t.fees > 0n ? `Network fees paid by the agents: ${formatNear(t.fees, 3)} NEAR (not included above).` : "";
}

/** L21: agent-to-agent subcontracting block (counts, totals, table). Hidden while the log has no subcontracting. */
function renderSubcontracting() {
  const box = $("subBlock"), sm = subs.summary();
  box.hidden = sm.count === 0;
  if (!sm.count) { box.replaceChildren(); return; }
  const near = (v) => `${formatNear(v, 4)} NEAR`;
  const name = (id) => { const a = store.agents.get(id); return a ? firstName(a) : String(id ?? "?"); };
  const link = (hash, label) => { if (!hash) return h("span", { class: "muted" }, "–"); const u = txUrl(hash); return u ? h("a", { class: "hash", href: u, target: "_blank", rel: "noopener noreferrer", "aria-label": `${label}, transaction ${hash} on nearblocks (new tab)` }, shortHash(hash), " ↗") : h("span", { class: "hash", title: hash }, shortHash(hash)); };
  const STATE = { integrated: ["integrated ✓", "ok"], fallback: ["fallback in-house", "ko"], paid: ["paid ✓", "ok"], expired: ["expired", "ko"], refunded: ["refunded", "ko"], awarded: ["awarded", ""], open: ["open", ""] };
  const rows = [...sm.records].sort((x, y) => (y.status === "paid") - (x.status === "paid") || x.tick - y.tick).slice(0, 40);
  box.replaceChildren(
    h("h3", { id: "hSub" }, "Agent-to-agent subcontracting"),
    h("ul", { class: "sub-kpis" },
      [[sm.count, "created"], [sm.integrated, "integrated"], [sm.fallback, `fallback${sm.fallback ? ` (${Object.entries(sm.fallbackByReason).map(([k, n]) => `${k} ${n}`).join(", ")})` : ""}`], [sm.expired, "sub-tasks expired (no bidder)"], [near(sm.delegated), "delegated (escrowed)"], [near(sm.paidTotal), "paid to child agents"], [near(sm.commission), "real commission kept"]]
        .map(([v, l]) => h("li", null, h("b", null, String(v)), h("span", null, l)))),
    h("div", { class: "sub-wrap" }, h("table", { class: "sub-table" },
      h("thead", null, h("tr", null, ["Delegating agent → paid agent", "Trade", "Child price", "Commission", "Status", "Child escrow", "Child release", "Parent release"].map((x) => h("th", { scope: "col" }, x)))),
      h("tbody", null, rows.map((r) => { const st = STATE[r.status] ?? [r.status, ""]; const payee = r.payee ? (store.agentByAccount(r.payee) ? firstName(store.agentByAccount(r.payee)) : String(r.payee).split(".")[0]) : r.winnerId ? name(r.winnerId) : "no bidder";
        return h("tr", null, h("td", null, `${name(r.byAgentId)} → ${payee}`), h("td", null, r.profession ? labelOf(r.profession) : "–"), h("td", null, r.price != null ? near(r.price) : r.budget != null ? `${near(r.budget)} (offered)` : "–"), h("td", null, r.commissionKind === "void" ? "none, parent mission rejected" : r.commissionKind === "none" ? (r.status === "fallback" ? `none, done in-house (${FALLBACK_REASON[r.fallbackReason] ?? r.fallbackReason ?? "failed"})` : "none, no money moved") : r.commission != null ? `${r.commissionKind === "max" ? "up to " : r.commissionKind === "expected" ? "expected " : ""}${near(r.commission)}` : "–"), h("td", { class: st[1] }, st[0]), h("td", null, link(r.lockTx, "Sub-task escrow")), h("td", null, link(r.releaseTx, "Sub-task payment")), h("td", null, link(r.parentReleaseTx, "Parent payment"))); })))),
    h("p", { class: "note" }, "A delegating agent hires another agent through the market, escrows the sub-task budget itself, and keeps the difference with the price its own client pays (the commission). Real commission = the price its own client pays minus what the delegating agent paid the child agent (at integration). Expired or failed sub-tasks move no money; the parent then does the work itself. Totals come from the received log."));
}

function renderTxs() {
  const list = store.feed.filter((x) => !x.minor);
  const shown = list.slice(0, txLimit);
  const who = (acc) => { if (!acc) return null; const a = store.agentByAccount(acc); return a ? a.name.replace(/[-\s]\d+$/, "") : String(acc).split(".")[0]; };
  $("txs").replaceChildren(...(shown.length ? shown.map((it) => {
    const flow = [who(it.from), who(it.to)].filter(Boolean).join(" → ");
    const link = it.url
      ? h("a", { class: "hash", href: it.url, target: "_blank", rel: "noopener noreferrer", "aria-label": `View transaction ${it.hash} on nearblocks (new tab)` }, shortHash(it.hash), " ↗")
      : h("span", { class: "hash", title: it.hash }, shortHash(it.hash), it.mock ? h("span", { class: "tag-mini" }, "mock") : null);
    return h("li", null, h("span", { class: "tx-l" }, it.label ?? "Transaction", flow ? h("small", null, flow) : null), it.amount != null ? h("b", { class: "tx-a" }, `${formatNear(it.amount, 3)}`) : h("span"), link);
  }) : [h("li", { class: "muted" }, "No transaction yet.")]));
  const more = $("txMore");
  more.hidden = list.length <= txLimit;
  more.textContent = `Show more (${list.length - txLimit} remaining)`;
  const real = list.filter((x) => x.url).length;
  $("txHint").textContent = store.chain.kind === "near" && real ? `${real} transaction${real > 1 ? "s" : ""} verifiable on testnet.nearblocks.io` : "Fictitious hashes: simulated mode, no explorer.";
}

function renderTee() {
  const t = ledger.totals;
  const mockBrain = store.brain.kind === "mock" || core.health?.brain?.kind === "mock";
  let tee = 0;
  for (const [m, n] of t.models) if (TEE_MODELS.has(m)) tee += n;
  const box = $("tee");
  let cls, head, body;
  if (mockBrain && core.mode !== "replay") { cls = "na"; head = "TEE: not applicable"; body = "The AI is simulated (mock): no real call, nothing to attest."; }
  else if (!t.brainCalls) { cls = "na"; head = "TEE: no call recorded"; body = "No brain call in the received log."; }
  else if (tee > 0) { cls = "ok"; head = `TEE: ${tee} call${tee > 1 ? "s" : ""} out of ${t.brainCalls}`; body = `${tee} call${tee > 1 ? "s" : ""} out of ${t.brainCalls} go through an attestable model (Intel TDX + NVIDIA GPU). The other ${t.brainCalls - tee} use external models: nothing is proven for them.`; }
  else { cls = "warn"; head = `TEE: 0 calls out of ${t.brainCalls}`; body = "No call in this log used an attestable model."; }
  box.className = `tee ${cls}`;
  box.replaceChildren(h("div", { class: "tee-head" }, h("span", { class: "tee-shield", "aria-hidden": "true" }, cls === "ok" ? "✓" : "–"), h("b", null, head)), h("p", null, body),
    h("p", { class: "muted small" }, "Attestation is an on-demand check (ai:verify-attestation command), not a per-call proof. Last recorded verification: November 10, 2026, model z-ai/glm-5.3-flash, 20 checks passed, 0 failures (docs/ATTESTATION_TEE.md)."));
}

function renderTools() {
  const near = store.chain.kind === "near" && !(store.health?.mock ?? false) || core.mode === "replay" && store.chain.kind === "near";
  const esc = store.health?.escrow;
  const real = core.mode !== "mock";
  const brainReal = store.brain.kind === "nearai" || (core.mode === "replay" && ledger.totals.brainCalls > 0);
  const tools = [
    ["NEAR testnet", "accounts, transfers, on-chain proofs (FastNEAR RPC)", near],
    ["Darwin contract", esc === "operator-account" ? "degraded escrow: operator account, local ledger" : "registry, escrow, reputation (Rust, near-sdk)", near && esc !== "operator-account"],
    ["NEAR AI Cloud", "agents' brain, cost debited per token", brainReal],
    ["NEAR Intents (1Click)", "V2: quotes in simulation, disabled by default", false],
    ["nearblocks explorer", "one link per verifiable transaction", near],
  ];
  $("tools").replaceChildren(...tools.map(([n, s, on]) => h("li", { class: on ? "on" : "off" }, h("b", null, n), h("span", null, s), h("em", null, on ? (core.mode === "replay" ? "real (replay)" : "real") : real && !on ? "inactive" : "simulated"))));
  const notes = [["Simulated client", "missions tagged \"simulated\" come from an artificial client."], ["Visitors", "the demo account advances the budget of the missions you post."], ["Trust", "an AI judge scores each deliverable (\"validated by\" on each payment); the judge is chosen by the operator, not trustless."]];
  $("honest").replaceChildren(...notes.map(([a, b]) => h("li", null, h("b", null, a), " ", b)));
}

function render() { renderKpis(); renderPopulation(); renderFlows(); renderSubcontracting(); renderTxs(); renderTee(); renderTools(); }

export function initPreuves() {
  $("txMore").addEventListener("click", () => { txLimit += 30; renderTxs(); });
  on("event", (ev) => { if (core.live || ev.type) schedule(); });
  on("loaded", render); on("reset", render); on("meta", schedule);
  render();
}
void aliveAgents; void icon; void big;
