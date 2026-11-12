#!/usr/bin/env node
// Assembles docs/PREUVES_TESTNET.md from docs/preuves/PREUVES_TEMPLATE.md, the archived journals and the AI consumption journal.
// Usage: node scripts/assemble-preuves.mjs
// Inputs: docs/preuves/run5-journal.jsonl, run6-journal.jsonl, data/ai-usage.jsonl (local), docs/preuves/RUN_FINAL.md (free text).
// No secret value is read: only public transaction identifiers and consumption totals.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const run = (args) => execFileSync(process.execPath, args, { encoding: "utf8", shell: false });
const tpl = readFileSync("docs/preuves/PREUVES_TEMPLATE.md", "utf8");
const run6 = run(["scripts/gen-preuves.mjs", "docs/preuves/run6-journal.jsonl", "--cycles", "5"]).replace(/^### /gm, "#### ");
const run5 = run(["scripts/gen-preuves.mjs", "docs/preuves/run5-journal.jsonl", "--cycles", "3"]).split("\n").slice(0, 6).join("\n");
let usage = "(consumption journal missing)";
if (existsSync("data/ai-usage.jsonl")) {
  usage = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "brain/tools/usage-report.ts", "--dir", "data"], { encoding: "utf8" })
    .replace(/^## /gm, "#### ")
    .replace(/^### /gm, "##### ");
}
const run8 = run(["scripts/gen-preuves.mjs", "docs/preuves/run8-journal.jsonl", "--cycles", "5"]).replace(/^### /gm, "#### ");
const final = (existsSync("docs/preuves/RUN_FINAL.md") ? readFileSync("docs/preuves/RUN_FINAL.md", "utf8") : "_To be completed._").replace("{{RUN8}}", () => run8);
writeFileSync("docs/PREUVES_TESTNET.md", tpl.replace("{{RUN6}}", () => run6).replace("{{RUN5}}", () => run5).replace("{{USAGE}}", () => usage).replace("{{FINAL}}", () => final));
console.log("docs/PREUVES_TESTNET.md written");
