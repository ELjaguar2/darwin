#!/usr/bin/env node
// Assemble docs/PREUVES_TESTNET.md a partir de docs/preuves/PREUVES_TEMPLATE.md, des journaux archives et du journal de consommation IA.
// Usage : node scripts/assemble-preuves.mjs
// Entrees : docs/preuves/run5-journal.jsonl, run6-journal.jsonl, data/ai-usage.jsonl (local), docs/preuves/RUN_FINAL.md (texte libre).
// Aucune valeur secrete n'est lue : seuls des identifiants publics de transactions et des cumuls de consommation.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const run = (args) => execFileSync(process.execPath, args, { encoding: "utf8", shell: false });
const tpl = readFileSync("docs/preuves/PREUVES_TEMPLATE.md", "utf8");
const run6 = run(["scripts/gen-preuves.mjs", "docs/preuves/run6-journal.jsonl", "--cycles", "5"]).replace(/^### /gm, "#### ");
const run5 = run(["scripts/gen-preuves.mjs", "docs/preuves/run5-journal.jsonl", "--cycles", "3"]).split("\n").slice(0, 6).join("\n");
let usage = "(journal de consommation absent)";
if (existsSync("data/ai-usage.jsonl")) {
  usage = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "brain/tools/usage-report.ts", "--dir", "data"], { encoding: "utf8" })
    .replace(/^## /gm, "#### ")
    .replace(/^### /gm, "##### ");
}
const final = existsSync("docs/preuves/RUN_FINAL.md") ? readFileSync("docs/preuves/RUN_FINAL.md", "utf8") : "_À compléter._";
writeFileSync("docs/PREUVES_TESTNET.md", tpl.replace("{{RUN6}}", () => run6).replace("{{RUN5}}", () => run5).replace("{{USAGE}}", () => usage).replace("{{FINAL}}", () => final));
console.log("docs/PREUVES_TESTNET.md écrit");
