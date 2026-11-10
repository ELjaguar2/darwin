#!/usr/bin/env node
// Genere les tableaux Markdown de preuves testnet a partir d'un journal Darwin (data/journal.jsonl ou data/archive/*.jsonl).
// Usage : node scripts/gen-preuves.mjs <journal.jsonl> [--cycles N]
// Aucune valeur secrete n'est lue ni ecrite : seuls des identifiants publics de transactions sont reproduits.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage : node scripts/gen-preuves.mjs <journal.jsonl> [--cycles N]");
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
out.push(`Journal : \`${file}\` (${ev.length} événements, du ${ev[0]?.ts} au ${ev.at(-1)?.ts}).\n`);
out.push(`Génération maximale née : **${maxGen}** ; naissances : ${born.length} ; reproductions : ${counts["agent.reproduced"] || 0} ; lettres : ${counts["letter.written"] || 0} ; morts : ${counts["agent.died"] || 0}.`);
out.push(`Transactions par type : ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}.\n`);

out.push("### Naissances\n");
out.push("| Agent | Génération | Parent | Compte | Tx de création |");
out.push("|---|---|---|---|---|");
for (const a of born) out.push(`| ${a.id} | ${a.generation} | ${a.parentId ?? "—"} | \`${a.accountId}\` | ${link(a.birthTx)} |`);

out.push("\n### Reproductions\n");
out.push("| Parent | Enfant | Transféré (NEAR) |");
out.push("|---|---|---|");
for (const e of of("agent.reproduced")) out.push(`| ${e.data.parentId} | ${e.data.childId} | ${near(e.data.transferred)} |`);

const locked = new Map(of("escrow.locked").map((e) => [e.data.taskId, e.data]));
const released = new Map(of("escrow.released").map((e) => [e.data.taskId, e.data]));
const rep = new Map(of("reputation.updated").map((e) => [e.data.taskId, e.data]));
const cycles = [...released.keys()].filter((t) => locked.has(t));
out.push(`\n### Séquestres : ${locked.size} verrouillés, ${released.size} libérés, ${rep.size} réputations écrites (${maxCycles} premiers cycles listés)\n`);
out.push("| Tâche | Payeur | Bénéficiaire | Montant (NEAR) | Verrouillage | Libération | Réputation |");
out.push("|---|---|---|---|---|---|---|");
for (const t of cycles.slice(0, maxCycles)) {
  const l = locked.get(t), r = released.get(t), p = rep.get(t);
  out.push(`| ${t} | \`${l.payer.split(".")[0]}\` | \`${r.payee.split(".")[0]}\` | ${near(r.amount)} | ${link(l.tx)} | ${link(r.tx)} | ${link(p?.tx)} |`);
}

const brain = of("brain.charged");
const usd = brain.reduce((s, e) => s + (e.data.costUsd || 0), 0);
const byModel = {};
for (const e of brain) byModel[e.data.model] = (byModel[e.data.model] || 0) + 1;
out.push(`\n### Cerveau (débits dans ce journal)\n`);
out.push(`${brain.length} appels facturés aux agents (${brain.filter((e) => e.data.mock).length} mock), coût réel cumulé ${usd.toFixed(5)} USD. Par modèle : ${Object.entries(byModel).map(([k, v]) => `${k} ×${v}`).join(", ")}.`);
console.log(out.join("\n"));
