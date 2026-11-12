#!/usr/bin/env node
// Generates the Markdown testnet proof tables from a Darwin journal (data/journal.jsonl or data/archive/*.jsonl).
// Usage: node scripts/gen-preuves.mjs <journal.jsonl> [--cycles N]
// No secret value is read or written: only public transaction identifiers are reproduced.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/gen-preuves.mjs <journal.jsonl> [--cycles N]");
  process.exit(2);
}
const ci = process.argv.indexOf("--cycles");
const maxCycles = ci >= 0 ? Number(process.argv[ci + 1]) : 5;
const EXPLORER = "https://testnet.nearblocks.io/txns/";
const ev = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const link = (h) => (h ? `[\`${h.slice(0, 8)}…\`](${EXPLORER}${h})` : "—");
const near = (y) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(4);
const of = (t) => ev.filter((e) => e.type === t);

const counts = {};
for (const e of ev) counts[e.type] = (counts[e.type] || 0) + 1;
const kinds = {};
for (const e of of("chain.tx")) kinds[e.data.kind] = (kinds[e.data.kind] || 0) + 1;
const born = of("agent.born").map((e) => e.data.agent);
const maxGen = Math.max(0, ...born.map((a) => a.generation));

const out = [];
out.push(`Journal: \`${file}\` (${ev.length} events, from ${ev[0]?.ts} to ${ev.at(-1)?.ts}).\n`);
out.push(`Maximum generation born: **${maxGen}**; births: ${born.length}; reproductions: ${counts["agent.reproduced"] || 0}; letters: ${counts["letter.written"] || 0}; deaths: ${counts["agent.died"] || 0}.`);
out.push(`Transactions by type: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}.\n`);

out.push("### Births\n");
out.push("| Agent | Generation | Parent | Account | Creation tx |");
out.push("|---|---|---|---|---|");
for (const a of born) out.push(`| ${a.id} | ${a.generation} | ${a.parentId ?? "—"} | \`${a.accountId}\` | ${link(a.birthTx)} |`);

out.push("\n### Reproductions\n");
out.push("| Parent | Child | Transferred (NEAR) |");
out.push("|---|---|---|");
for (const e of of("agent.reproduced")) out.push(`| ${e.data.parentId} | ${e.data.childId} | ${near(e.data.transferred)} |`);

out.push("\n### Deaths\n");
out.push("| Agent | Cause | Final balance (NEAR) | Recovered by the master (NEAR) | Closing tx |");
out.push("|---|---|---|---|---|");
for (const e of of("agent.died")) out.push(`| ${e.data.agentId} | ${e.data.cause} | ${near(e.data.finalBalance)} | ${near(e.data.swept)} | ${link(e.data.tx)} |`);
const markDead = of("chain.tx").filter((e) => e.data.kind === "mark_dead").map((e) => link(e.data.hash));
if (markDead.length) out.push(`\nDeath recorded in the contract registry (\`mark_dead\`): ${markDead.join(", ")}.`);

const locked = new Map(of("escrow.locked").map((e) => [e.data.taskId, e.data]));
const released = new Map(of("escrow.released").map((e) => [e.data.taskId, e.data]));
const rep = new Map(of("reputation.updated").map((e) => [e.data.taskId, e.data]));
const cycles = [...released.keys()].filter((t) => locked.has(t));
out.push(`\n### Escrows: ${locked.size} locked, ${released.size} released, ${rep.size} reputations written (first ${maxCycles} cycles listed)\n`);
out.push("| Task | Payer | Beneficiary | Amount (NEAR) | Lock | Release | Reputation |");
out.push("|---|---|---|---|---|---|---|");
for (const t of cycles.slice(0, maxCycles)) {
  const l = locked.get(t), r = released.get(t), p = rep.get(t);
  out.push(`| ${t} | \`${l.payer.split(".")[0]}\` | \`${r.payee.split(".")[0]}\` | ${near(r.amount)} | ${link(l.tx)} | ${link(r.tx)} | ${link(p?.tx)} |`);
}

const brain = of("brain.charged");
const usd = brain.reduce((s, e) => s + (e.data.costUsd || 0), 0);
const byModel = {};
for (const e of brain) byModel[e.data.model] = (byModel[e.data.model] || 0) + 1;
out.push(`\n### Brain (debits in this journal)\n`);
out.push(`${brain.length} calls billed to the agents (${brain.filter((e) => e.data.mock).length} mock), cumulative real cost ${usd.toFixed(5)} USD. By model: ${Object.entries(byModel).map(([k, v]) => `${k} ×${v}`).join(", ")}.`);
console.log(out.join("\n"));
