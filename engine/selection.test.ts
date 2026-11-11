// Garde-fou de calibrage (D-043) : le preset `selection` (parametres testnet, chaine et cerveau mock) atteint la generation 3
// avec au moins une mort dans au moins 4 graines sur 5. Reproductible : `npx tsx scripts/calibrate-selection.ts`.
import { describe, expect, it } from "vitest";
import { createRuntime } from "../backend/runtime.ts";
import { loadConfig } from "../shared/index.ts";

describe("calibrage du preset selection (mock)", () => {
  it("generation 3 et au moins une mort dans >= 4 graines sur 5 (120 ticks)", async () => {
    let ok = 0;
    for (const seed of [101, 102, 103, 104, 105]) {
      const config = loadConfig({ DARWIN_MODE: "testnet", DARWIN_CHAIN: "mock", DARWIN_BRAIN: "mock", DARWIN_PRESET: "selection", DARWIN_SEED: String(seed) });
      let t = 0;
      const rt = createRuntime(config, { autoRun: false, now: () => new Date(Date.UTC(2026, 10, 12) + ++t) });
      await rt.engine.start();
      for (let i = 0; i < 120 && rt.engine.getState().running; i++) await rt.engine.tick();
      const s = rt.engine.getState();
      if (s.generations >= 3 && s.totals.dead >= 1) ok++;
      await rt.shutdown();
    }
    expect(ok).toBeGreaterThanOrEqual(4);
  }, 60000);
});
