// Faux backend de développement pour le frontend (lot L8). Node >= 18, aucune dépendance.
// Rejoue un journal d'événements plausible, conforme au catalogue de shared/events.ts, sur les mêmes routes
// que docs/ARCHITECTURE.md §9. NE CONTIENT AUCUNE LOGIQUE DU PRODUIT : c'est un générateur de données de test.
//
// Usage : node frontend/dev/fake-server.mjs [--port=3000] [--tick=400] [--seed=7] [--testnet] [--degraded]
//                                           [--max-ticks=900] [--no-sim] [--task-status=503]
//   --testnet      mode "testnet" : chain "near", hashes réels-like + explorerUrl testnet.nearblocks.io
//   --degraded     /api/health.escrow = "operator-account" (séquestre dégradé)
//   --no-sim       n'émet aucun événement (état vide)
//   --task-status  force le statut de réponse de POST /api/tasks (503, 429, 400) pour tester l'UI
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const PORT = Number(args.port ?? process.env.PORT ?? 3000);
const TICK_MS = Number(args.tick ?? 400);
const MAX_TICKS = Number(args["max-ticks"] ?? 900);
const TESTNET = !!args.testnet;
const DEGRADED = !!args.degraded;
const FORCE_TASK_STATUS = args["task-status"] ? Number(args["task-status"]) : 0;
const HOST = args.host ?? "127.0.0.1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = TESTNET ? "darwin-demo.testnet" : "master.mock";
const YOCTO = 10n ** 24n;
const near = (x) => BigInt(Math.round(x * 1e6)) * (YOCTO / 1000000n);
const nearNum = (y) => Number(BigInt(y) / (YOCTO / 1000000n)) / 1e6;

// ---- RNG déterministe ----
let s = Number(args.seed ?? 7) >>> 0;
const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join("");

const PROFS = ["logo", "finance", "architecture", "marketing", "translation", "legal"];
// Catalogue de test (valeurs recopiées de shared/catalogue.ts : prix plancher en NEAR, seuil 0,6).
const CAT = {
  logo: ["Logo", 150, 0.045, "3 propositions de logo originales au format SVG."],
  finance: ["Analyse financière", 120, 0.036, "Note d'analyse financière structurée en Markdown."],
  architecture: ["Architecture logicielle", 200, 0.06, "Document d'architecture en Markdown avec un schéma Mermaid."],
  marketing: ["Rédaction marketing", 80, 0.024, "Texte marketing prêt à publier."],
  translation: ["Traduction", 40, 0.012, "Traduction fidèle du texte fourni."],
  legal: ["Checklist juridique", 150, 0.045, "Checklist juridique informative (pas un avis juridique)."],
};
const RUBRIC = [{ id: "pertinence", description: "Répond à la consigne", weight: 0.4 }, { id: "qualite", description: "Qualité et clarté", weight: 0.35 }, { id: "format", description: "Respect du format demandé", weight: 0.25 }];
const catalogue = () => ({ professions: PROFS.map((id) => ({ id, label: CAT[id][0], refUsd: CAT[id][1], nearPrice: near(CAT[id][2]).toString(), deliverable: CAT[id][3], rubric: RUBRIC, acceptScore: 0.6 })), activeEvents: marketEvents.filter((e) => e.startTick <= tick && tick < e.endTick) });
const marketEvents = [];
const deliverables = new Map();
const EVENT_TITLES = [["logo", 3, "Salon des startups : tout le monde veut un logo"], ["legal", 3, "Nouvelle réglementation : ruée sur les checklists"], ["translation", 0.3, "Les traducteurs automatiques font chuter la demande"], ["finance", 3, "Clôture trimestrielle : analyses recherchées"], ["marketing", 0.3, "Budgets pub gelés"]];
function logoSvg(i, name) {
  const hue = [210, 150, 330][i % 3];
  const evil = i === 1 ? '<script>window.__pwned = 1; document.title = "PWNED";</script><rect width="1" height="1" onload="window.__pwned = 2"/>' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="hsl(${hue} 60% 94%)"/><circle cx="100" cy="90" r="52" fill="hsl(${hue} 70% 45%)"/><path d="M60 140 Q100 170 140 140" stroke="hsl(${hue} 70% 25%)" stroke-width="8" fill="none"/><text x="100" y="188" text-anchor="middle" font-size="16" font-family="sans-serif">${name}</text>${evil}</svg>`;
}
function makeDeliverable(t, w, ok, resultHash) {
  const files = [];
  if (t.profession === "logo") for (let i = 0; i < 3; i++) files.push({ name: `logo-${i + 1}.svg`, mime: "image/svg+xml", content: logoSvg(i, "<b>x</b>" && "Atelier " + (i + 1)) });
  else if (t.profession === "architecture") {
    files.push({ name: "architecture.md", mime: "text/markdown", content: `# Architecture : ${t.title}\n\n## Contexte\nService **web** avec une base \`postgres\` et une file de messages.\n\n## Composants\n- API REST (Node)\n- Worker asynchrone\n- Base de données\n\n| Composant | Rôle |\n|---|---|\n| API | Reçoit les requêtes |\n| Worker | Traite la file |\n\n<img src=x onerror="window.__pwned=3"> et <script>window.__pwned=4</script> doivent rester du texte.\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n` });
    files.push({ name: "schema.mmd", mime: "text/vnd.mermaid", content: "graph TD\n  Client --> API\n  API --> DB[(Postgres)]\n  API --> Queue\n  Queue --> Worker" });
  } else files.push({ name: "livrable.md", mime: "text/markdown", content: `## ${CAT[t.profession][0]}\n\nRéponse rédigée par ${w.name} pour « ${t.title} ».\n\n1. Point un\n2. Point deux\n\n> ${t.profession === "legal" ? "Ceci n'est pas un avis juridique." : "Fin du livrable."}` });
  const d = { taskId: t.id, profession: t.profession, agentId: w.id, files, rawText: "", resultHash, productionCostUsd: 0.0012 + rnd() * 0.004, judgeCostUsd: 0.0004 + rnd() * 0.001, createdAt: new Date().toISOString() };
  deliverables.set(t.id, d);
  emit("deliverable.produced", { taskId: t.id, profession: t.profession, agentId: w.id, files: files.map((f) => ({ name: f.name, mime: f.mime, bytes: f.content.length })), productionCostUsd: d.productionCostUsd, judgeCostUsd: d.judgeCostUsd, resultHash });
  return d;
}
function snapshot() {
  const byProfession = Object.fromEntries(PROFS.map((p) => [p, 0])), byGeneration = {};
  for (const a of alive()) { byProfession[a.genome.profession]++; (byGeneration[a.generation] ??= Object.fromEntries(PROFS.map((p) => [p, 0])))[a.genome.profession]++; }
  return { tick, byProfession, byGeneration };
}
const NAMES = ["Ada", "Blaise", "Clara", "Darwin", "Emma", "Faraday", "Gaia", "Hugo", "Iris", "Jules", "Kepler", "Lina", "Mendel", "Nora", "Orion", "Pasteur", "Quark", "Rosalind", "Sagan", "Tesla", "Ulysse", "Vera", "Wallace", "Xena"];
const MODELS = ["mock/small", "mock/large"];
const PERSONALITIES = ["Je suis méticuleux : je préfère perdre une enchère que livrer du travail bâclé.", "Je casse les prix pour survivre, puis j'optimise.", "Je partage mes gains : la tribu avant l'individu.", "Prudent, je garde une réserve avant de risquer un enfant."];
const TITLES = { logo: ["Logo pour une boulangerie", "Logo d'une app de randonnée"], finance: ["Analyser un jeu de ventes trimestriel", "Comparer trois offres de prêt"], architecture: ["Architecture d'une app de réservation", "Découper un monolithe en services"], marketing: ["Fiche produit pour une gourde", "Texte d'accroche newsletter"], translation: ["Traduire un paragraphe FR vers EN", "Traduire une notice en espagnol"], legal: ["Checklist de conformité RGPD", "Checklist pour une association"] };

// ---- État ----
const journal = [];
const clients = new Set();
const agents = new Map();
const tasks = new Map();
const letters = new Map();
const bidsByTask = new Map();
const escrows = new Map();
let tick = 0, running = !args["no-sim"], paused = false, stopped = false, stopReason = null, counters = { a: 0, t: 0, b: 0, l: 0 }, nameIdx = 0;
const visitorOpenByIp = new Map();
let visitorSpentWindow = 0;
const pipeline = [];

const txHash = () => (TESTNET ? hex(44) : "mock_" + hex(44));
const explorer = (h) => (TESTNET ? `https://testnet.nearblocks.io/txns/${h}` : undefined);

function emit(type, data) {
  const ev = { seq: journal.length + 1, ts: new Date().toISOString(), tick, type, data };
  journal.push(ev);
  const msg = `id: ${ev.seq}\nevent: ${type}\ndata: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(msg);
  return ev;
}
function chainTx(kind, from, to, amount) {
  const hash = txHash();
  emit("chain.tx", { kind, from, to, amount: amount?.toString(), hash, explorerUrl: explorer(hash) });
  return hash;
}
function acct(a) { return `${a.name.toLowerCase()}-${a.id.slice(2)}.${MASTER}`; }
function setBalance(a, delta, reason, quiet = false) {
  a.balance = (BigInt(a.balance) + delta).toString();
  emit("balance.changed", { agentId: a.id, balance: a.balance, delta: delta.toString(), reason });
}
const alive = () => [...agents.values()].filter((a) => a.status === "alive");

function newGenome(parent) {
  const m = (v, lo, hi, sd) => clamp(v + (rnd() - 0.5) * 2 * sd, lo, hi);
  if (!parent) return { profession: pick(PROFS), model: pick(MODELS), askRatio: 0.45 + rnd() * 0.5, risk: rnd(), reproThreshold: 1.4 + rnd() * 1.8, generosity: rnd() * 0.5, cooperation: rnd(), personality: pick(PERSONALITIES) };
  const g = { ...parent.genome }, mut = {};
  const tweak = (k, lo, hi, sd) => { if (rnd() < 0.4) { const nv = +m(g[k], lo, hi, sd).toFixed(3); mut[k] = [g[k], nv]; g[k] = nv; } };
  tweak("askRatio", 0.3, 1, 0.15); tweak("risk", 0, 1, 0.2); tweak("reproThreshold", 1.2, 4, 0.4); tweak("generosity", 0, 0.6, 0.15); tweak("cooperation", 0, 1, 0.2);
  if (rnd() < 0.15) { const nm = pick(MODELS); if (nm !== g.model) { mut.model = [g.model, nm]; g.model = nm; } }
  if (rnd() < 0.12) { const np = pick(PROFS); if (np !== g.profession) { mut.profession = [g.profession, np]; g.profession = np; } }
  return { genome: g, mut };
}

function spawn(parent, capital, genome) {
  const id = "a-" + String(++counters.a).padStart(4, "0");
  const a = {
    id, name: NAMES[nameIdx++ % NAMES.length] + (nameIdx > NAMES.length ? " " + Math.ceil(nameIdx / NAMES.length) : ""),
    generation: parent ? parent.generation + 1 : 1, parentId: parent?.id ?? null, childrenIds: [], genome, status: "alive",
    birthTick: tick, bornAt: new Date().toISOString(), birthCapital: capital.toString(), balance: capital.toString(),
    earned: "0", spentBrain: "0", reputation: 0, tasksDone: 0, lastChild: tick,
  };
  a.accountId = acct(a);
  agents.set(id, a);
  if (parent) parent.childrenIds.push(id);
  return a;
}
const pub = (a) => { const { lastChild, ...r } = a; return r; };

function birth(parent, capital, genome, mut) {
  const a = spawn(parent, capital, genome);
  const tx = chainTx("create_account", MASTER, a.accountId, capital);
  a.birthTx = tx;
  emit("agent.born", { agent: pub(a), parentId: parent?.id ?? null, birthTx: tx });
  if (!parent) emit("funding.received", { to: a.accountId, amount: capital.toString(), source: "master", tx });
  return a;
}

function reproduce(p) {
  const bc = near(10);
  const surplus = BigInt(p.balance) - bc;
  const give = bc + BigInt(Math.floor(Number(surplus) * p.genome.generosity * 0.25));
  const { genome, mut } = newGenome(p);
  const tx = chainTx("transfer", p.accountId, "child", give);
  setBalance(p, -give, "birth");
  const child = birth(p, give, genome, mut);
  p.lastChild = tick;
  emit("agent.reproduced", { parentId: p.id, childId: child.id, transferred: give.toString(), mutations: mut });
  const lid = "l-" + String(++counters.l).padStart(4, "0");
  const text = `Mon cher ${child.name},\n\nJe te transmets ${nearNum(give).toFixed(2)} NEAR et mon métier de ${p.genome.profession}. ${p.genome.personality}\n\nVoici ce que j'ai appris : les enchères trop gourmandes restent sans réponse, et l'IA coûte cher quand on choisit ${p.genome.model}. Surveille ton solde à chaque tick, car le métabolisme ne dort jamais. ${Object.keys(mut).length ? "J'ai laissé quelques mutations en toi (" + Object.keys(mut).join(", ") + ") : à toi de voir si elles te servent." : "Je n'ai pas muté ton génome : fais mieux que moi."}\n\nSois utile, sois sobre. Si tu dois mourir, que ce soit en laissant une lignée.\n\n— ${p.name}`;
  const letter = { id: lid, fromAgentId: p.id, toAgentId: child.id, generation: child.generation, text, model: p.genome.model, mock: !TESTNET, tick, createdAt: new Date().toISOString() };
  letters.set(lid, letter);
  child.letterId = lid;
  emit("letter.written", { letter });
}

function die(a, cause = "starvation") {
  a.status = "dead"; a.deathTick = tick; a.diedAt = new Date().toISOString(); a.causeOfDeath = cause;
  const swept = BigInt(a.balance);
  const tx = chainTx("delete_account", a.accountId, MASTER, swept);
  emit("agent.died", { agentId: a.id, cause, finalBalance: a.balance, swept: swept.toString(), sweptTo: MASTER, tx });
  setBalance(a, -swept, "death");
}

// ---- Marché ----
function postTask(requester, budget, profession, title, prompt) {
  const id = "t-" + String(++counters.t).padStart(4, "0");
  const t = { id, requester, profession, title, prompt, budget: budget.toString(), status: "posted", createdTick: tick, biddingEndsTick: tick + 1, deadlineTick: tick + 5, bidIds: [] };
  tasks.set(id, t);
  emit("task.posted", { task: { ...t } });
  pipeline.push({ id, stage: "bidding", at: tick + 1 });
  // enchères immédiates des agents vivants de la profession
  for (const a of alive().filter((x) => x.genome.profession === profession)) {
    if (rnd() < 0.5 + a.genome.risk * 0.4) {
      const bid = { id: "b-" + String(++counters.b).padStart(4, "0"), taskId: id, agentId: a.id, price: near(nearNum(budget) * a.genome.askRatio).toString(), etaTicks: 1 + Math.floor(rnd() * 3), pitch: pick(["Livraison soignée.", "Prix serré, résultat net.", "Je connais ce type de mission."]), tick };
      t.bidIds.push(bid.id);
      (bidsByTask.get(id) ?? bidsByTask.set(id, []).get(id)).push(bid);
      emit("bid.placed", { bid });
    }
  }
  return t;
}

function stepTask(p) {
  const t = tasks.get(p.id);
  const bids = bidsByTask.get(p.id) ?? [];
  if (p.stage === "bidding") {
    const live = bids.filter((b) => agents.get(b.agentId)?.status === "alive");
    if (!live.length) { t.status = "expired"; emit("task.expired", { taskId: t.id, reason: "no_bids" }); return true; }
    live.sort((x, y) => Number(BigInt(x.price) - BigInt(y.price)) || agents.get(y.agentId).reputation - agents.get(x.agentId).reputation);
    const w = live[0]; w.won = true; t.winnerId = w.agentId; t.winningBidId = w.id; t.status = "awarded"; t.escrowId = t.id;
    emit("task.awarded", { taskId: t.id, bidId: w.id, winnerId: w.agentId, price: w.price, bids: live.length });
    const payer = t.requester.kind === "visitor" ? "visitors." + MASTER : t.requester.kind === "simulated" ? "sim-client." + MASTER : agents.get(t.requester.agentId)?.accountId;
    const tx = chainTx("lock_escrow", payer, DEGRADED ? "escrow." + MASTER : "darwin." + MASTER, BigInt(w.price));
    escrows.set(t.id, { id: t.id, taskId: t.id, payer, amount: w.price, status: "locked", lockTx: tx });
    emit("escrow.locked", { taskId: t.id, payer, amount: w.price, tx });
    p.stage = "work"; p.at = tick + (w.etaTicks > 1 ? 1 : 0) + 1; return false;
  }
  if (p.stage === "work") {
    const w = agents.get(t.winnerId);
    if (!w || w.status !== "alive") { t.status = "expired"; emit("task.expired", { taskId: t.id, reason: "winner_dead" }); const e = escrows.get(t.id); const tx = chainTx("refund_escrow", "escrow", e.payer, BigInt(e.amount)); e.status = "refunded"; emit("escrow.refunded", { taskId: t.id, payer: e.payer, amount: e.amount, tx }); return true; }
    // coût IA
    const large = w.genome.model === "mock/large";
    const cost = near((large ? 0.07 : 0.012) * (0.8 + rnd() * 0.5));
    const pt = 180 + Math.floor(rnd() * 200), ct = 120 + Math.floor(rnd() * 250);
    const btx = chainTx("transfer", w.accountId, "brain." + MASTER, cost);
    emit("brain.charged", { agentId: w.id, purpose: "execute_task", model: w.genome.model, promptTokens: pt, completionTokens: ct, reasoningTokens: 0, cost: cost.toString(), costUsd: nearNum(cost) * 0.01, nearUsdRate: 0.01, priceSource: "mock", mock: !TESTNET, tx: btx });
    w.spentBrain = (BigInt(w.spentBrain) + cost).toString();
    setBalance(w, -cost, "brain");
    const text = `Résultat de « ${t.title} » (simulation). ${w.name} a rédigé une réponse structurée en trois parties : contexte, proposition, prochaines étapes.`;
    const resultHash = hex(64);
    t.result = { text, resultHash, submittedTick: tick }; t.status = "submitted";
    emit("task.submitted", { taskId: t.id, agentId: w.id, resultHash });
    const ok = rnd() < 0.86;
    const dl = makeDeliverable(t, w, ok, resultHash);
    const validator = rnd() < 0.5 ? "brain:" + w.genome.model : "rule:non-vide-et-pertinent";
    t.validation = { verdict: ok ? "accepted" : "rejected", score: ok ? 0.7 + rnd() * 0.3 : 0.1 + rnd() * 0.3, validator, reason: ok ? "Réponse conforme à la demande." : "Hors sujet par rapport à la consigne.", resultHash, tick };
    dl.verdict = t.validation.verdict; dl.score = t.validation.score;
    emit("task.validated", { taskId: t.id, validation: t.validation });
    const e = escrows.get(t.id);
    if (ok) {
      const price = BigInt(e.amount);
      const tx = chainTx("release_escrow", DEGRADED ? "escrow." + MASTER : "darwin." + MASTER, w.accountId, price);
      e.status = "released"; e.settleTx = tx; e.payee = w.accountId; t.status = "settled";
      emit("escrow.released", { taskId: t.id, payee: w.accountId, amount: e.amount, tx });
      w.earned = (BigInt(w.earned) + price).toString(); w.tasksDone++; w.reputation += 5;
      setBalance(w, price, "task");
      emit("reputation.updated", { agentId: w.id, delta: 5, total: w.reputation, taskId: t.id, tx: DEGRADED ? undefined : txHash() });
      if (t.requester.kind === "visitor") visitorOpenByIp.forEach((v, k) => visitorOpenByIp.set(k, Math.max(0, v - 1)));
    } else {
      const tx = chainTx("refund_escrow", DEGRADED ? "escrow." + MASTER : "darwin." + MASTER, e.payer, BigInt(e.amount));
      e.status = "refunded"; t.status = "rejected";
      emit("escrow.refunded", { taskId: t.id, payer: e.payer, amount: e.amount, tx });
      w.reputation -= 3; emit("reputation.updated", { agentId: w.id, delta: -3, total: w.reputation, taskId: t.id });
      visitorOpenByIp.forEach((v, k) => visitorOpenByIp.set(k, Math.max(0, v - 1)));
    }
    // sous-traitance occasionnelle
    if (rnd() < w.genome.cooperation * 0.12 && t.requester.kind !== "agent") {
      const child = postTask({ kind: "agent", agentId: w.id }, near(0.4), pick(PROFS), "Sous-traitance : " + pick(TITLES[pick(PROFS)]), "Sous-tâche confiée par " + w.name + ".");
      emit("subcontract.created", { parentTaskId: t.id, childTaskId: child.id, byAgentId: w.id });
    }
    return true;
  }
  return true;
}

function tickOnce() {
  tick++;
  const live = alive();
  // métabolisme
  for (const a of live) { const m = near(0.08); a.balance = (BigInt(a.balance) - m).toString(); }
  // balance.changed regroupé pour ne pas inonder (1 par agent et par tick, comme le vrai moteur)
  for (const a of live) emit("balance.changed", { agentId: a.id, balance: a.balance, delta: (-near(0.08)).toString(), reason: "metabolism" });
  // client simulé
  const n = rnd() < 0.5 ? 1 : rnd() < 0.5 ? 2 : 0;
  for (let i = 0; i < n; i++) {
    const prof = pick(PROFS);
    postTask({ kind: "simulated", label: "Client simulé" }, near(0.5 + rnd() * 2), prof, pick(TITLES[prof]), "Tâche artificielle générée par le client simulé.");
  }
  // pipeline
  for (const p of [...pipeline]) if (p.at <= tick) { if (stepTask(p)) pipeline.splice(pipeline.indexOf(p), 1); }
  // reproduction puis mort
  for (const a of alive()) {
    const thr = near(a.genome.reproThreshold * 10 * 0.9);
    if (BigInt(a.balance) >= thr && alive().length < 16 && tick - a.lastChild >= 10) reproduce(a);
  }
  for (const a of alive()) if (BigInt(a.balance) < near(1.5)) die(a);
  if (tick % 9 === 3) { const [profession, demandMultiplier, title] = EVENT_TITLES[marketEvents.length % EVENT_TITLES.length]; const ev = { id: "e-" + String(marketEvents.length + 1).padStart(4, "0"), title, profession, demandMultiplier, startTick: tick, endTick: tick + 6 }; marketEvents.push(ev); emit("market.event", { event: ev }); }
  emit("population.snapshot", snapshot());
  const av = alive();
  const total = av.reduce((x, a) => x + BigInt(a.balance), 0n);
  emit("sim.tick", { alive: av.length, tasksOpen: [...tasks.values()].filter((t) => t.status === "posted" || t.status === "awarded").length, totalBalance: total.toString() });
  if (!av.length) return stop("extinction");
  if (MAX_TICKS && tick >= MAX_TICKS) return stop("max_ticks");
}
function stop(reason) { stopped = true; running = false; stopReason = reason; emit("sim.stopped", { reason, generations: Math.max(0, ...[...agents.values()].map((a) => a.generation)) }); }

// --garbage : injecte des messages SSE malformés (hors journal) pour tester la robustesse du client.
let garbageN = 0;
function garbage() {
  const frames = [
    "event: agent.born\ndata: null\n\n", "event: balance.changed\ndata: 42\n\n", "event: sim.tick\ndata: {pas du json\n\n",
    'event: sim.tick\ndata: ["x"]\n\n', 'event: type.inconnu\ndata: {"seq":5,"type":"type.inconnu","data":{}}\n\n',
    'event: balance.changed\ndata: {"seq":3,"type":"balance.changed","data":{"agentId":"a-0001","balance":"abc","delta":"1.5x","reason":"task"}}\n\n',
    'event: agent.born\ndata: {"seq":4,"type":"agent.born","data":{"agent":null}}\n\n',
    'event: escrow.released\ndata: {"seq":1e99,"type":"escrow.released","data":{}}\n\n',
  ];
  garbageN++;
  for (const c of clients) { for (const f of frames) c.write(f); if (garbageN % 60 === 0) c.write('event: sim.tick\ndata: {"seq":99999999,"ts":"x","tick":1,"type":"sim.tick","data":{}}\n\n'); }
}

function start() {
  emit("sim.started", { mode: TESTNET ? "testnet" : "mock", preset: "demo", seed: Number(args.seed ?? 7), chain: TESTNET ? "near" : "mock", brain: TESTNET ? "nearai" : "mock" });
  if (!TESTNET) emit("system.warning", { code: "MOCK_MODE", message: "Chaîne et IA simulées en mémoire." });
  if (DEGRADED) emit("system.warning", { code: "ESCROW_DEGRADED", message: "Séquestre dégradé : compte piloté par l'opérateur, sans contrat." });
  emit("funding.received", { to: "visitors." + MASTER, amount: near(30).toString(), source: "demo", tx: chainTx("transfer", MASTER, "visitors." + MASTER, near(30)) });
  for (let i = 0; i < 4; i++) birth(null, near(10), newGenome(null));
  // garantit la diversité des métiers parmi les fondateurs
  [...agents.values()].forEach((a, i) => { a.genome.profession = PROFS[i % PROFS.length]; });
  setInterval(() => { if (running && !paused) tickOnce(); if (args.garbage) garbage(); }, TICK_MS);
}

// ---- HTTP ----
const state = () => ({
  running, paused, tick, mode: TESTNET ? "testnet" : "mock",
  chain: { kind: TESTNET ? "near" : "mock", masterId: MASTER, contractId: DEGRADED || !TESTNET ? undefined : "darwin." + MASTER },
  brain: { kind: TESTNET ? "nearai" : "mock" },
  generations: Math.max(0, ...[...agents.values()].map((a) => a.generation)),
  agents: [...agents.values()].map(pub), tasks: [...tasks.values()].slice(-40).map(withBadge), letters: [...letters.values()],
  lastSeq: journal.length, populationSnapshot: snapshot(),
  totals: { alive: alive().length, dead: agents.size - alive().length, born: agents.size, tasksSettled: [...tasks.values()].filter((t) => t.status === "settled").length, totalBalance: alive().reduce((x, a) => x + BigInt(a.balance), 0n).toString() },
});
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'";
/** Forme d'erreur du vrai backend : {error:{code,message,retryable?}} (+ issues de validation pour 400). */
function normErr(code, body) {
  if (code < 400 || (body && typeof body.error === "object")) return body;
  const c = String(body?.error ?? "error").toUpperCase();
  const retryable = code === 429 || code === 503;
  return { error: { code: code === 503 && FORCE_TASK_STATUS === 503 ? "VALIDATION_PENDING" : c, message: body?.message ?? body?.issues?.map((i) => i.message).join(" ; ") ?? "Erreur", retryable: retryable || undefined, issues: body?.issues } };
}
const badgeOf = (r) => (r.kind === "simulated" ? "simulé" : r.kind === "visitor" ? "Visiteur (financé par le compte de démo)" : "sous-traitance");
const withBadge = (t) => ({ ...t, badge: badgeOf(t.requester), validatedBy: t.validation?.validator });
const send = (res, code, body, headers = {}) => { body = normErr(code, body); if (body && body.id && body.requester) body = withBadge(body); res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }); res.end(JSON.stringify(body)); };

function readBody(req) { return new Promise((ok) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e5) req.destroy(); }); req.on("end", () => ok(b)); }); }

function postTaskHandler(req, res, raw) {
  const ip = req.socket.remoteAddress ?? "?";
  if (FORCE_TASK_STATUS === 503 || stopped) return send(res, 503, { error: "unavailable", message: stopped ? "La simulation est arrêtée." : "Simulation indisponible." }, { "Retry-After": "5" });
  if (FORCE_TASK_STATUS === 429) return send(res, 429, { error: "rate_limited", message: "Plafond horaire du compte de démonstration atteint." }, { "Retry-After": "120" });
  let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "invalid_json", message: "Corps JSON invalide." }); }
  const issues = [];
  const str = (k, lo, hi) => { const v = body[k]; if (typeof v !== "string" || v.length < lo || v.length > hi) issues.push({ path: [k], message: `${k} : ${lo} à ${hi} caractères requis` }); };
  str("title", 3, 120); str("prompt", 10, 4000);
  if (!PROFS.includes(body.profession ?? "logo")) issues.push({ path: ["profession"], message: "profession inconnue" });
  if (typeof body.budgetNear !== "string" || !/^\d+(\.\d{1,6})?$/.test(body.budgetNear)) issues.push({ path: ["budgetNear"], message: "budgetNear : décimal en NEAR (ex. 0.05)" });
  else if (CAT[body.profession] && Number(body.budgetNear) < CAT[body.profession][2]) issues.push({ path: ["budgetNear"], message: `budget trop bas : minimum ${CAT[body.profession][2]} NEAR pour ${CAT[body.profession][0]}` });
  else if (Number(body.budgetNear) > 5) issues.push({ path: ["budgetNear"], message: "budgetNear hors bornes (maximum 5)" });
  if (FORCE_TASK_STATUS === 400 && !issues.length) issues.push({ path: ["title"], message: "erreur forcée pour test" });
  if (issues.length) return send(res, 400, { error: "invalid_input", issues });
  if ((visitorOpenByIp.get(ip) ?? 0) >= 10) return send(res, 429, { error: "too_many_open_tasks", message: "10 tâches ouvertes maximum par IP." }, { "Retry-After": "30" });
  visitorOpenByIp.set(ip, (visitorOpenByIp.get(ip) ?? 0) + 1);
  const t = postTask({ kind: "visitor", label: String(body.requesterLabel ?? "visiteur").slice(0, 60) }, near(Number(body.budgetNear)), body.profession ?? "logo", body.title, body.prompt);
  send(res, 201, t);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  try {
    if (p === "/api/stream") {
      let since = Number(req.headers["last-event-id"] ?? url.searchParams.get("since") ?? 0) || 0;
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.write("retry: 1500\n\n");
      if (since > journal.length) res.write(`event: reset\ndata: ${JSON.stringify({ lastSeq: journal.length })}\n\n`), (since = 0); // serveur redémarré : rejeu complet
      for (const ev of journal) if (ev.seq > since) res.write(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 15000);
      req.on("close", () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (p === "/api/health") return send(res, 200, { ok: true, mode: TESTNET ? "testnet" : "mock", mock: !TESTNET, chain: { kind: TESTNET ? "near" : "mock" }, brain: { kind: TESTNET ? "nearai" : "mock" }, tick, escrow: DEGRADED || !TESTNET ? "operator-account" : "contract", visitors: { spentLastHour: "0", hourlyCap: near(30).toString() } });
    if (p === "/api/config") return send(res, 200, { mode: TESTNET ? "testnet" : "mock", preset: "demo", tickMs: TICK_MS, visitorHourlyCapNear: 30, taskBudgetMin: "0.5", taskBudgetMax: "2.5" });
    if (p === "/api/state") return send(res, 200, state());
    if (p === "/api/catalogue" && !args["no-catalogue"]) return send(res, 200, catalogue());
    let dm;
    if ((dm = p.match(/^\/api\/tasks\/([\w-]+)\/deliverable(?:\/([\w.-]+))?$/)) && !args["no-catalogue"]) {
      const d = deliverables.get(dm[1]);
      if (!d) return send(res, 404, { error: { code: "UNKNOWN_DELIVERABLE", message: "pas de livrable" } });
      if (!dm[2]) return send(res, 200, d);
      const f = d.files.find((x) => x.name === dm[2]);
      if (!f) return send(res, 404, { error: { code: "UNKNOWN_FILE", message: "fichier inconnu" } });
      res.writeHead(200, { "Content-Type": f.mime + "; charset=utf-8", "Content-Disposition": url.searchParams.get("download") ? `attachment; filename="${f.name}"` : "inline", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
      return res.end(f.content);
    }
    if (p === "/api/agents") return send(res, 200, { agents: [...agents.values()].map(pub) });
    let m;
    if ((m = p.match(/^\/api\/agents\/([\w-]+)\/letter$/))) { const a = agents.get(m[1]); const l = a && letters.get(a.letterId); return l ? send(res, 200, { letter: l }) : send(res, 404, { error: "not_found" }); }
    if ((m = p.match(/^\/api\/agents\/([\w-]+)$/))) { const a = agents.get(m[1]); return a ? send(res, 200, pub(a)) : send(res, 404, { error: "not_found" }); }
    if (p === "/api/lineage") return send(res, 200, [...agents.values()].map((a) => ({ id: a.id, parentId: a.parentId, generation: a.generation, status: a.status })));
    if ((m = p.match(/^\/api\/letters\/([\w-]+)$/))) { const l = letters.get(m[1]); return l ? send(res, 200, { letter: l }) : send(res, 404, { error: "not_found" }); }
    if (p === "/api/tasks" && req.method === "POST") return postTaskHandler(req, res, await readBody(req));
    if (p === "/api/tasks") return send(res, 200, { tasks: [...tasks.values()].map(withBadge) });
    if ((m = p.match(/^\/api\/tasks\/([\w-]+)$/))) { const t = tasks.get(m[1]); return t ? send(res, 200, { task: withBadge(t), bids: bidsByTask.get(t.id) ?? [], escrow: escrows.get(t.id) }) : send(res, 404, { error: "not_found" }); }
    if (p === "/api/events") { const since = Number(url.searchParams.get("since") ?? 0), limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 200)); return send(res, 200, { events: journal.filter((e) => e.seq > since).slice(0, limit), lastSeq: journal.length }); }
    if (p.startsWith("/api/")) return send(res, 404, { error: "not_found" });
    // statique
    let f = path.join(ROOT, p === "/" ? "index.html" : p);
    if (!f.startsWith(ROOT) || f.includes(path.sep + "dev" + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f)] ?? "application/octet-stream", "Cache-Control": "no-store", "Content-Security-Policy": CSP });
      res.end(buf);
    });
  } catch (e) { send(res, 500, { error: "internal", message: String(e?.message ?? e) }); }
});

if (!args["no-listen"]) {
  server.listen(PORT, HOST, () => console.log(`[fake-server] http://${HOST}:${PORT}  (tick ${TICK_MS} ms, ${TESTNET ? "testnet" : "mock"}${DEGRADED ? ", séquestre dégradé" : ""}) : FAUX BACKEND DE DEV`));
  start();
}
