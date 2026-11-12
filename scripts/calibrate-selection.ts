// Seed sweep of the `selection` preset (testnet parameters, MOCK chain and brain, no real call).
// Usage: npx tsx scripts/calibrate-selection.ts [--seeds 10] [--first 1] [--ticks 120] [--env KEY=VAL ...]
// Criterion: maximum generation >= 3 AND at least 1 death, in at least 80% of the seeds (docs/DECISIONS.md D-043).
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
  rows.push(`seed ${String(s).padStart(3)} | gen ${st.generations} | born ${String(st.totals.born).padStart(3)} | dead ${String(st.totals.dead).padStart(3)} | alive ${String(st.totals.alive).padStart(2)} | gen3@${gen3Tick || "-"} | 1st death@${firstDeath || "-"} | ticks ${n} | ${Date.now() - t0} ms | ${ok ? "OK" : "FAIL"}`);
  await rt.shutdown();
}
console.log(rows.join("\n"));
console.log(`\n${pass}/${seeds} seeds meet the criterion (gen >= 3 and >= 1 death within <= ${maxTicks} ticks) ${pass / seeds >= 0.8 ? "=> TARGET MET" : "=> insufficient"}`);
console.log(`averages: births ${(sumBorn / seeds).toFixed(1)}, deaths ${(sumDead / seeds).toFixed(1)} (ratio ${(sumDead / sumBorn).toFixed(2)}), generation ${(sumGen / seeds).toFixed(1)}, mean tick of generation 3: ${nG3 ? (sumG3 / nG3).toFixed(0) : "-"} (${nG3}/${seeds} seeds)`);
process.exit(0);
