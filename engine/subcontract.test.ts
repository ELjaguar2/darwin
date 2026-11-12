// L21: subcontracting = different child profession, budget >= floor of that profession, commission >= 15%, cooperation monotone;
// complete mock simulation of the `selection` preset where child tasks are awarded, validated and paid.
import { describe, expect, it } from "vitest";
import { createRuntime } from "../backend/runtime.ts";
import { PROFESSIONS, createRng, loadConfig, type Agent, type Profession } from "../shared/index.ts";
import { scaledPrice } from "../shared/catalogue.ts";
import { decideSubcontract, delegatedShareBp, MIN_KEEP_BP } from "./policy.ts";
import type { Ctx } from "./context.ts";

const NEAR = 10n ** 24n;
function fakeCtx(seed: number, scale = 1): Ctx {
  return { deps: { rng: createRng(seed), config: { sim: { priceScale: scale, minVital: NEAR / 33n } } } } as unknown as Ctx;
}
function agent(profession: Profession, cooperation: number, balance = 5n * NEAR): Agent {
  return { id: "a-1", balance: balance.toString(), genome: { profession, cooperation, risk: 0.5 } } as unknown as Agent;
}

describe("decideSubcontract (L21)", () => {
  it("different profession, budget >= child floor, strictly below the price, commission >= 15%", () => {
    let n = 0;
    for (const own of PROFESSIONS) {
      for (const price of [NEAR / 25n, NEAR / 12n, NEAR / 10n]) {
        for (let seed = 1; seed <= 60; seed++) {
          const d = decideSubcontract(fakeCtx(seed), agent(own, 1), price);
          if (!d) continue;
          n++;
          expect(d.profession).not.toBe(own);
          expect(d.budget).toBeGreaterThanOrEqual(scaledPrice(d.profession, 1));
          expect(d.budget).toBeLessThan(price);
          expect(d.commission).toBe(price - d.budget);
          expect(d.commission * 10000n).toBeGreaterThanOrEqual(price * MIN_KEEP_BP);
        }
      }
    }
    expect(n).toBeGreaterThan(20);
  });

  it("no subcontracting when no floor leaves a commission, or when it would dip under the reserve", () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(decideSubcontract(fakeCtx(seed), agent("logo", 1), scaledPrice("translation", 1))).toBeNull();
      expect(decideSubcontract(fakeCtx(seed), agent("logo", 1, NEAR / 33n), NEAR / 10n)).toBeNull();
    }
  });

  it("the delegated share grows with cooperation (the commission shrinks)", () => {
    let prev = 0n;
    for (let c = 0; c <= 1.0001; c += 0.1) {
      const s = delegatedShareBp(c);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(10000n - s).toBeGreaterThanOrEqual(MIN_KEEP_BP);
      prev = s;
    }
    expect(delegatedShareBp(1)).toBeGreaterThan(delegatedShareBp(0));
  });
});

describe("subcontracting in mock simulation, preset selection (L21)", () => {
  it("at least 3 child tasks awarded, validated and paid, commission journalled", async () => {
    let awarded = 0, paid = 0, withCommission = 0;
    for (const seed of [101, 102, 103]) {
      const config = loadConfig({ DARWIN_MODE: "testnet", DARWIN_CHAIN: "mock", DARWIN_BRAIN: "mock", DARWIN_PRESET: "selection", DARWIN_SEED: String(seed) });
      let t = 0;
      const rt = createRuntime(config, { autoRun: false, now: () => new Date(Date.UTC(2026, 10, 12) + ++t) });
      await rt.engine.start();
      for (let i = 0; i < 120 && rt.engine.getState().running; i++) await rt.engine.tick();
      const ev = rt.journal.since(0, 1_000_000);
      const subs = ev.filter((e) => e.type === "subcontract.created").map((e) => e.data as any);
      const ids = new Set(subs.map((s) => s.childTaskId));
      for (const s of subs) {
        if (s.commission !== undefined) {
          withCommission++;
          expect(BigInt(s.commission)).toBe(BigInt(s.parentPrice) - BigInt(s.budget));
          expect(BigInt(s.budget)).toBeGreaterThanOrEqual(scaledPrice(s.profession, 1));
        }
        const parent = rt.market.getTask(s.parentTaskId)!;
        expect(rt.market.getTask(s.childTaskId)!.profession).not.toBe(parent.profession);
      }
      awarded += ev.filter((e) => e.type === "task.awarded" && ids.has((e.data as any).taskId)).length;
      paid += ev.filter((e) => e.type === "escrow.released" && ids.has((e.data as any).taskId)).length;
      await rt.shutdown();
    }
    expect(withCommission).toBeGreaterThanOrEqual(3);
    expect(awarded).toBeGreaterThanOrEqual(3);
    expect(paid).toBeGreaterThanOrEqual(3);
  }, 120000);
});
