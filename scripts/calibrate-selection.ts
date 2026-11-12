// Balayage de graines du preset `selection` (parametres testnet, chaine et cerveau MOCK, aucun appel reel).
// Usage : npx tsx scripts/calibrate-selection.ts [--seeds 10] [--first 1] [--ticks 120] [--env KEY=VAL ...]
// Critere : generation maximale >= 3 ET au moins 1 mort, dans au moins 80 % des graines (docs/DECISIONS.md D-043).
import { createRuntime } from "../backend/runtime.ts";
import { loadConfig } from "../shared/index.ts";

const argv = process.argv.slice(2);
const opt = (name: string, def: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : def;
};
const extra: Record<string, string> = {};
argv.forEach((a, i) => {
  if (a === "--env") {
    const [k, ...v] = argv[i + 1]!.split("=");
    extra[k!] = v.join("=");
  }
});
const seeds = opt("seeds", 10);
const first = opt("first", 1);
const maxTicks = opt("ticks", 120);

let pass = 0;
let sumBorn = 0;
let sumDead = 0;
let sumGen = 0;
let sumG3 = 0;
let nG3 = 0;
const rows: string[] = [];
for (let s = first; s < first + seeds; s++) {
  const t0 = Date.now();
  const config = loadConfig({ DARWIN_MODE: "testnet", DARWIN_CHAIN: "mock", DARWIN_BRAIN: "mock", DARWIN_PRESET: "selection", DARWIN_SEED: String(s), ...extra });
  let t = 0;
  const rt = createRuntime(config, { autoRun: false, now: () => new Date(Date.UTC(2026, 10, 12) + ++t) });
  await rt.engine.start();
  let gen3Tick = 0;
  let firstDeath = 0;
  let n = 0;
  for (; n < maxTicks && rt.engine.getState().running; n++) {
    await rt.engine.tick();
    const st = rt.engine.getState();
    if (!gen3Tick && st.generations >= 3) gen3Tick = st.tick;
    if (!firstDeath && st.totals.dead > 0) firstDeath = st.tick;
  }
  const st = rt.engine.getState();
  const ok = st.generations >= 3 && st.totals.dead >= 1;
  if (ok) pass++;
  sumBorn += st.totals.born;
  sumDead += st.totals.dead;
  sumGen += st.generations;
  if (gen3Tick) {
    sumG3 += gen3Tick;
    nG3++;
  }
  rows.push(`seed ${String(s).padStart(3)} | gen ${st.generations} | nes ${String(st.totals.born).padStart(3)} | morts ${String(st.totals.dead).padStart(3)} | vivants ${String(st.totals.alive).padStart(2)} | gen3@${gen3Tick || "-"} | 1ere mort@${firstDeath || "-"} | ticks ${n} | ${Date.now() - t0} ms | ${ok ? "OK" : "ECHEC"}`);
  await rt.shutdown();
}
console.log(rows.join("\n"));
console.log(`\n${pass}/${seeds} graines valident le critere (gen >= 3 et >= 1 mort en <= ${maxTicks} ticks) ${pass / seeds >= 0.8 ? "=> OBJECTIF ATTEINT" : "=> insuffisant"}`);
console.log(`moyennes : naissances ${(sumBorn / seeds).toFixed(1)}, morts ${(sumDead / seeds).toFixed(1)} (ratio ${(sumDead / sumBorn).toFixed(2)}), generation ${(sumGen / seeds).toFixed(1)}, tick moyen de la generation 3 : ${nG3 ? (sumG3 / nG3).toFixed(0) : "-"} (${nG3}/${seeds} graines)`);
process.exit(0);
