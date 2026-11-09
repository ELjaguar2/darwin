import { describe, expect, it } from "vitest";
import { MockBrain, MockChain, createJournal, createRng, loadConfig, EVENT_TYPES, GenomeSchema, type Deps, type DarwinEvent } from "../shared/index.ts";
import { createEngine } from "./index.ts";
import { mutateGenome, createFounderGenome } from "./genome.ts";
import { StubMarket } from "./stub-market.ts";

async function run(seed: number, env: Record<string, string> = {}) {
  const config = loadConfig({ DARWIN_PRESET: "demo", DARWIN_SEED: String(seed), ...env });
  let t = 0;
  const now = () => new Date(Date.UTC(2026, 10, 9) + ++t);
  const chain = new MockChain({ now });
  const supply0 = chain.totalSupply();
  const journal = createJournal({ now });
  const deps: Deps = { config, chain, brain: new MockBrain(), journal, rng: createRng(seed), now };
  const engine = createEngine(deps, new StubMarket(deps), { autoRun: false });
  await engine.start();
  for (let i = 0; i < config.sim.maxTicks && engine.getState().running; i++) await engine.tick();
  const events = journal.since(0, 1e7);
  return { engine, events, chain, supply0 };
}
const norm = (evs: DarwinEvent[]) => evs.map(({ ts: _ts, ...e }) => e);

describe("simulation mock (preset demo)", () => {
  it("3 generations : naissances, travail, reproduction, morts, lettres", async () => {
    const t0 = Date.now();
    const { engine, events, chain, supply0 } = await run(42);
    const count = (ty: string) => events.filter((e) => e.type === ty).length;
    const s = engine.getState();
    console.log("calibrage", { ticks: s.tick, generations: s.generations, born: s.totals.born, dead: s.totals.dead, alive: s.totals.alive, settled: s.totals.tasksSettled, ms: Date.now() - t0 });
    expect(s.generations).toBeGreaterThanOrEqual(3);
    expect(count("agent.born")).toBeGreaterThan(s.generations);
    expect(count("agent.reproduced")).toBeGreaterThanOrEqual(2);
    expect(count("agent.died")).toBeGreaterThanOrEqual(1);
    expect(count("letter.written")).toBe(count("agent.reproduced"));
    expect(count("brain.charged")).toBeGreaterThan(0);
    expect(s.totals.tasksSettled).toBeGreaterThan(0);
    expect(s.agents.some((a) => a.tasksDone > 0 && BigInt(a.earned) > 0n)).toBe(true);
    // lettres : consultables, chaque enfant non fondateur a la sienne
    for (const a of s.agents.filter((x) => x.generation > 1)) expect(engine.getLetter(a.letterId!)?.toAgentId).toBe(a.id);
    // génomes valides, lignée conservée après la mort
    for (const a of s.agents) expect(() => GenomeSchema.parse(a.genome)).not.toThrow();
    const recs = await chain.listAgentRecords();
    expect(recs.length).toBe(s.totals.born);
    expect(recs.filter((r) => !r.alive).length).toBe(s.totals.dead);
    // catalogue respecté, seq sans trou, conservation de l'argent
    for (const e of events) expect(EVENT_TYPES).toContain(e.type);
    events.forEach((e, i) => expect(e.seq).toBe(i + 1));
    expect(chain.totalSupply()).toBe(supply0);
    expect(Date.now() - t0).toBeLessThan(15000);
  });

  it("déterministe par graine", async () => {
    const a = norm((await run(7)).events);
    const b = norm((await run(7)).events);
    expect(a).toEqual(b);
    const c = norm((await run(8)).events);
    expect(c).not.toEqual(a);
  });

  it("règlement groupé (settleEveryTicks=4) : mêmes invariants", async () => {
    const { engine, chain, supply0 } = await run(42, { DARWIN_SETTLE_EVERY_TICKS: "4" });
    expect(chain.totalSupply()).toBe(supply0);
    expect(engine.getState().generations).toBeGreaterThanOrEqual(2);
  });
});

describe("génome", () => {
  it("mutation bornée et rapportée", () => {
    const rng = createRng(1);
    const parent = createFounderGenome(rng, 0, ["mock/small", "mock/large"]);
    for (let i = 0; i < 200; i++) {
      const { genome, mutations } = mutateGenome(parent, rng, 1, 0.5, ["mock/small", "mock/large"]);
      expect(() => GenomeSchema.parse(genome)).not.toThrow();
      for (const [k, [before, after]] of Object.entries(mutations)) {
        expect(before).toBe((parent as Record<string, unknown>)[k]);
        expect(after).toBe((genome as Record<string, unknown>)[k]);
      }
    }
    expect(mutateGenome(parent, rng, 0, 0.5, ["mock/small"]).mutations).toEqual({});
  });
});
