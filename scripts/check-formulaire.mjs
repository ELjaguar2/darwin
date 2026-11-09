// Verifie que le champ `idea` de docs/FORMULAIRE.md fait 20 a 2000 caracteres (HACKATHON.md, S-02).
// Usage : node scripts/check-formulaire.mjs
import { readFileSync } from "node:fs";

const file = new URL("../docs/FORMULAIRE.md", import.meta.url);
const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const m = text.match(/<!-- idea:start -->\n```text\n([\s\S]*?)\n```\n<!-- idea:end -->/);
if (!m) {
  console.error("Bloc idea introuvable (marqueurs idea:start / idea:end).");
  process.exit(2);
}
const idea = m[1];
const n = [...idea].length;
console.log(`idea : ${n} caracteres (limites 20 a 2000)`);
if (n < 20 || n > 2000) {
  console.error("HORS LIMITES");
  process.exit(1);
}
console.log("OK");
