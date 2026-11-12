// Analysis of real run journals (read-only): genes vs survival/reproduction, subcontracting vs earnings, letters.
// Usage: node scripts/analyze-findings.mjs <journal.jsonl> [--json]
import { readFileSync } from "node:fs";
const file = process.argv[2];
const L = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const near = (y) => Number(BigInt(y || "0") / 10n ** 18n) / 1e6;
const A = {};
for (const e of L) {
  if (e.type === "agent.born") {
    const a = e.data.agent;
    A[a.id] = { id: a.id, gen: a.generation, parent: a.parentId, g: a.genome, bornTick: e.tick, died: null, children: [], earned: 0, brainUsd: 0, bids: 0, wins: 0, paidTasks: 0, subcontracts: 0, childPaid: 0, commission: 0, bidRatios: [] };
  }
}
const acct = (a) => String(a).split(".")[0];
let lastTick = 0;
const tasks = {};
for (const e of L) {
  lastTick = Math.max(lastTick, e.tick || 0);
  const d = e.data;
  if (e.type === "agent.died" && A[d.agentId]) A[d.agentId].died = e.tick;
  if (e.type === "agent.reproduced" && A[d.parentId]) A[d.parentId].children.push(d.childId);
  if (e.type === "task.posted") tasks[d.task.id] = d.task;
  if (e.type === "brain.charged" && A[d.agentId]) A[d.agentId].brainUsd += d.costUsd || 0;
  if (e.type === "bid.placed") {
    const b = d.bid;
    if (A[b.agentId]) {
      A[b.agentId].bids++;
      const t = tasks[b.taskId];
      if (t && BigInt(t.budget) > 0n) A[b.agentId].bidRatios.push(Number((BigInt(b.price) * 1000n) / BigInt(t.budget)) / 1000);
    }
  }
  if (e.type === "task.awarded" && A[d.winnerId]) A[d.winnerId].wins++;
  if (e.type === "escrow.released" && A[acct(d.payee)]) { A[acct(d.payee)].earned += near(d.amount); A[acct(d.payee)].paidTasks++; }
}
for (const e of L) {
  if (e.type === "subcontract.created" && A[e.data.byAgentId]) A[e.data.byAgentId].subcontracts++;
  if (e.type === "escrow.locked" && A[acct(e.data.payer)] && tasks[e.data.taskId] && tasks[e.data.taskId].requester.kind === "agent") A[acct(e.data.payer)].childPaid += near(e.data.amount);
  if (e.type === "subcontract.integrated") {
    const c = L.find((x) => x.type === "subcontract.created" && x.data.childTaskId === e.data.childTaskId);
    const del = c && A[c.data.byAgentId];
    const rel = L.some((x) => x.type === "escrow.released" && x.data.taskId === e.data.parentTaskId);
    if (del && rel) del.commission += near(e.data.commission);
  }
}
const agents = Object.values(A);
for (const a of agents) {
  a.cls = a.died != null ? "dead" : a.children.length ? "alive+reproduced" : "alive,no child";
  a.life = (a.died != null ? a.died : lastTick) - a.bornTick;
  a.net = a.earned - a.childPaid;
  a.meanBid = a.bidRatios.length ? a.bidRatios.reduce((s, x) => s + x, 0) / a.bidRatios.length : null;
}
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const f = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "-");
const out = { file, lastTick, n: agents.length };
out.classes = ["dead", "alive+reproduced", "alive,no child"].map((c) => {
  const s = agents.filter((a) => a.cls === c);
  return { cls: c, n: s.length, askRatio: mean(s.map((a) => a.g.askRatio)), risk: mean(s.map((a) => a.g.risk)), reproThreshold: mean(s.map((a) => a.g.reproThreshold)), generosity: mean(s.map((a) => a.g.generosity)), cooperation: mean(s.map((a) => a.g.cooperation)), earned: mean(s.map((a) => a.earned)), brainUsd: mean(s.map((a) => a.brainUsd)), bids: mean(s.map((a) => a.bids)), wins: mean(s.map((a) => a.wins)) };
});
const byModel = {};
for (const a of agents) { const r = (byModel[a.g.model] ??= { n: 0, dead: 0, repro: 0, earned: 0, brainUsd: 0, life: 0 }); r.n++; r.dead += a.died != null ? 1 : 0; r.repro += a.children.length > 0 ? 1 : 0; r.earned += a.earned; r.brainUsd += a.brainUsd; r.life += a.life; }
out.byModel = byModel;
const byProf = {};
for (const a of agents) { const r = (byProf[a.g.profession] ??= { n: 0, dead: 0, repro: 0, earned: 0, wins: 0 }); r.n++; r.dead += a.died != null ? 1 : 0; r.repro += a.children.length > 0 ? 1 : 0; r.earned += a.earned; r.wins += a.wins; }
out.byProf = byProf;
const grp = (s) => ({ n: s.length, earned: mean(s.map((a) => a.earned)), net: mean(s.map((a) => a.net)), paidTasks: mean(s.map((a) => a.paidTasks)), dead: s.filter((a) => a.died != null).length, repro: s.filter((a) => a.children.length).length, coop: mean(s.map((a) => a.g.cooperation)), childPaid: s.reduce((x, a) => x + a.childPaid, 0), commission: s.reduce((x, a) => x + a.commission, 0) });
out.subcontract = { delegators: grp(agents.filter((a) => a.subcontracts > 0)), others: grp(agents.filter((a) => a.subcontracts === 0)) };
const sorted = [...agents].sort((a, b) => a.g.cooperation - b.g.cooperation);
const half = Math.floor(sorted.length / 2);
out.coopSplit = { low: grp(sorted.slice(0, half)), high: grp(sorted.slice(half)) };
const pc = agents.filter((a) => a.parent && A[a.parent]).map((a) => {
  const p = A[a.parent];
  return { child: a.id, parent: p.id, dAsk: a.g.askRatio - p.g.askRatio, dRisk: a.g.risk - p.g.risk, dCoop: a.g.cooperation - p.g.cooperation, sameProf: a.g.profession === p.g.profession, sameModel: a.g.model === p.g.model, childMeanBid: a.meanBid, parentMeanBid: p.meanBid, childDead: a.died != null, childEarned: a.earned, parentEarned: p.earned };
});
out.parentChild = pc;
const letters = L.filter((e) => e.type === "letter.written").map((e) => e.data.letter);
out.letters = letters.map((l) => ({ from: l.fromAgentId, to: l.toAgentId, len: l.text.length, model: l.model, mock: l.mock, text: l.text }));
out.agents = agents.map((a) => ({ id: a.id, gen: a.gen, prof: a.g.profession, model: a.g.model, ask: a.g.askRatio, risk: a.g.risk, thr: a.g.reproThreshold, gener: a.g.generosity, coop: a.g.cooperation, cls: a.cls, life: a.life, earned: a.earned, net: a.net, brainUsd: a.brainUsd, wins: a.wins, bids: a.bids, subs: a.subcontracts, meanBid: a.meanBid, children: a.children.length }));
if (process.argv.includes("--json")) { console.log(JSON.stringify(out)); process.exit(0); }
console.log(`# ${file} (last tick ${lastTick}, ${agents.length} agents)`);
console.log("class | n | askRatio | risk | reproThr | generosity | coop | earned NEAR | brain USD | bids | wins");
for (const c of out.classes) console.log([c.cls, c.n, f(c.askRatio), f(c.risk), f(c.reproThreshold), f(c.generosity), f(c.cooperation), f(c.earned, 4), f(c.brainUsd, 5), f(c.bids, 1), f(c.wins, 1)].join(" | "));
console.log("model | n | dead | reproduced | earned | brainUsd | mean life ticks");
for (const [m, r] of Object.entries(byModel)) console.log([m, r.n, r.dead, r.repro, f(r.earned, 4), f(r.brainUsd, 5), f(r.life / r.n, 1)].join(" | "));
console.log("profession | n | dead | reproduced | earned | wins");
for (const [m, r] of Object.entries(byProf)) console.log([m, r.n, r.dead, r.repro, f(r.earned, 4), r.wins].join(" | "));
console.log("subcontract delegators:", JSON.stringify(out.subcontract.delegators));
console.log("subcontract others:", JSON.stringify(out.subcontract.others));
console.log("coop low half:", JSON.stringify(out.coopSplit.low));
console.log("coop high half:", JSON.stringify(out.coopSplit.high));
console.log("parent->child n=", pc.length, "mean |dAsk|", f(mean(pc.map((x) => Math.abs(x.dAsk)))), "same profession", pc.filter((x) => x.sameProf).length, "same model", pc.filter((x) => x.sameModel).length);
console.log("letters", letters.length, "mean len", f(mean(letters.map((l) => l.text.length)), 0), "models", [...new Set(letters.map((l) => l.model))].join(","));
