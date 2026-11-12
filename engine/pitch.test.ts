// Lot L18 : pitch d'enchère produit par l'agent (mock : déterministe sans appel IA ; réel : un appel cerveau débité, repli sûr).
import { describe, expect, it } from "vitest";
import {
  BrainError, MockBrain, MockChain, createJournal, createRng, detectLanguage, loadConfig,
  type Brain, type BrainRequest, type BrainResponse, type DarwinEvent, type Deps,
} from "../shared/index.ts";
import { createEngine } from "./index.ts";
import { StubMarket } from "./stub-market.ts";

/** Cerveau « réel » factice : même réponses que MockBrain, mais `kind: "nearai"` et un comportement réglable pour les appels `bid`. */
class FakeRealBrain implements Brain {
  readonly kind = "nearai" as const;
  readonly inner = new MockBrain();
  bidCalls = 0;
  constructor(private onBid: (req: BrainRequest) => string | Error) {}
  listModels() { return this.inner.listModels(); }
  defaultModel() { return this.inner.defaultModel(); }
  async complete(req: BrainRequest): Promise<BrainResponse> {
    if (req.purpose !== "bid") return this.inner.complete(req);
    this.bidCalls++;
    const r = this.onBid(req);
    if (r instanceof Error) throw r;
    const base = await this.inner.complete({ ...req, purpose: "letter" });
    return { ...base, text: r, mock: false };
  }
}

async function run(brain: Brain, ticks = 14) {
  const config = loadConfig({ DARWIN_PRESET: "demo", DARWIN_SEED: "42" });
  let t = 0;
  const now = () => new Date(Date.UTC(2026, 10, 12) + ++t);
  const chain = new MockChain({ now });
  const journal = createJournal({ now });
  const deps: Deps = { config, chain, brain, journal, rng: createRng(42), now };
  const engine = createEngine(deps, new StubMarket(deps), { autoRun: false });
  await engine.start();
  for (let i = 0; i < ticks && engine.getState().running; i++) await engine.tick();
  const events: DarwinEvent[] = journal.since(0, 1e7);
  const bids = events.filter((e) => e.type === "bid.placed").map((e) => (e.data as { bid: { pitch?: string; agentId: string } }).bid);
  return { events, bids };
}

describe("pitch d'enchère dans bid.placed", () => {
  it("mock : chaque offre porte un pitch (<= 240 car., une ligne, varié), sans aucun appel `bid` au cerveau", async () => {
    const brain = new MockBrain();
    const { events, bids } = await run(brain);
    expect(bids.length).toBeGreaterThan(3);
    for (const b of bids) {
      expect(b.pitch).toBeDefined();
      expect(b.pitch!.length).toBeLessThanOrEqual(240);
      expect(b.pitch).not.toMatch(/[\n\r<>`*]/);
    }
    expect(new Set(bids.map((b) => b.pitch)).size).toBeGreaterThanOrEqual(3);
    expect(events.some((e) => e.type === "brain.charged" && (e.data as { purpose: string }).purpose === "bid")).toBe(false);
  });

  it("mock : déterministe d'un run à l'autre", async () => {
    const a = (await run(new MockBrain())).bids.map((b) => b.pitch);
    const b = (await run(new MockBrain())).bids.map((b) => b.pitch);
    expect(a).toEqual(b);
  });

  it("réel : le pitch vient du cerveau, nettoyé, et l'appel est débité (brain.charged purpose bid)", async () => {
    const brain = new FakeRealBrain(() => "**I** deliver the logos for your shop on time and with care.\nExtra line <b>x</b>");
    const { events, bids } = await run(brain);
    expect(brain.bidCalls).toBeGreaterThan(0);
    expect(bids.every((b) => b.pitch!.startsWith("I deliver"))).toBe(true);
    expect(bids[0]!.pitch).not.toMatch(/[\n<>*]/);
    const charged = events.filter((e) => e.type === "brain.charged" && (e.data as { purpose: string }).purpose === "bid");
    expect(charged).toHaveLength(brain.bidCalls);
    expect(BigInt((charged[0]!.data as { cost: string }).cost)).toBeGreaterThan(0n);
  });

  it("réel : panne du cerveau ou réponse vide ou dans la mauvaise langue : repli déterministe (anglais), l'offre est quand même déposée", async () => {
    for (const reply of [new BrainError("TIMEOUT", "timeout"), "", "Je ferai le travail pour vous et je livrerai le résultat dans les délais que vous souhaitez pour cette tâche."]) {
      const { bids } = await run(new FakeRealBrain(() => reply));
      expect(bids.length).toBeGreaterThan(3);
      for (const b of bids) {
        expect(b.pitch!.length).toBeGreaterThan(10);
        expect(detectLanguage(b.pitch!)).not.toBe("fr");
      }
    }
  });

  it("réel : un pitch trop long est tronqué proprement à 240 caractères", async () => {
    const { bids } = await run(new FakeRealBrain(() => "I deliver careful work for your shop and your team. ".repeat(30)));
    for (const b of bids) { expect(b.pitch!.length).toBeLessThanOrEqual(240); expect(b.pitch!.endsWith("…")).toBe(true); }
  });
});
