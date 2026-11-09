import { describe, expect, it } from "vitest";
import { ChainError, MockBrain, MockChain, createJournal, createRng, loadConfig, type AgentRecord, type Deps } from "../shared/index.ts";
import { createEngine } from "./index.ts";
import { StubMarket } from "./stub-market.ts";

class FlakyChain extends MockChain {
  failSettle = false;
  failRegisterFor = new Set<string>();
  async transfer(args: Parameters<MockChain["transfer"]>[0]) {
    if (this.failSettle && args.memo === "settle") throw new ChainError("RPC_ERROR", "transfert refusé (test)");
    return super.transfer(args);
  }
  async registerAgent(r: Omit<AgentRecord, "alive" | "deathTick" | "cause">) {
    if (this.failRegisterFor.has(r.agentId)) throw new ChainError("RPC_ERROR", "registre indisponible (test)");
    return super.registerAgent(r);
  }
}

function setup(env: Record<string, string>, chain: FlakyChain) {
  const config = loadConfig({ DARWIN_PRESET: "demo", DARWIN_SEED: "5", DARWIN_SIM_CLIENT_RATE: "0", ...env });
  const journal = createJournal();
  const deps: Deps = { config, chain, brain: new MockBrain(), journal, rng: createRng(5), now: () => new Date(0) };
  return { config, journal, engine: createEngine(deps, new StubMarket(deps), { autoRun: false }) };
}

describe("robustesse face aux échecs de la chaîne", () => {
  it("règlement groupé : un transfert échoué ne fait pas disparaître la dette", async () => {
    const chain = new FlakyChain();
    const { config, engine } = setup({ DARWIN_SETTLE_EVERY_TICKS: "4" }, chain);
    await engine.start();
    chain.failSettle = true;
    for (let i = 1; i <= 3; i++) await engine.tick();
    await expect(engine.tick()).rejects.toThrow(); // tick 4 : le règlement échoue
    chain.failSettle = false;
    for (let i = 5; i <= 8; i++) await engine.tick(); // tick 8 : règlement réussi
    const m = config.sim.metabolism;
    for (const a of engine.getState().agents) {
      const onChain = BigInt(await chain.getBalance(a.accountId));
      expect(onChain).toBe(config.sim.birthCapital - 8n * m); // aucune dette perdue
      expect(BigInt(a.balance)).toBe(onChain);
    }
  });

  it("échec de registerAgent : naissance annulée, fonds rapatriés, system.warning", async () => {
    const chain = new FlakyChain();
    chain.failRegisterFor.add("a-0002");
    const { config, journal, engine } = setup({}, chain);
    const supply = chain.totalSupply();
    const master0 = BigInt(await chain.getBalance(chain.masterId));
    await engine.start();
    const s = engine.getState();
    expect(s.agents.map((a) => a.id)).toEqual(["a-0001", "a-0003", "a-0004", "a-0005"].slice(0, s.agents.length));
    expect(s.agents.some((a) => a.id === "a-0002")).toBe(false);
    expect(s.agents.length).toBe(config.sim.founders - 1);
    expect(journal.since(0).some((e) => e.type === "system.warning" && e.data.code === "BIRTH_ABORTED")).toBe(true);
    expect(chain.totalSupply()).toBe(supply);
    expect(BigInt(await chain.getBalance(chain.masterId))).toBe(master0 - BigInt(s.agents.length) * config.sim.birthCapital);
    await expect(chain.getBalance(`a-0002.${chain.masterId}`)).rejects.toThrow(); // compte orphelin clos
  });
});
