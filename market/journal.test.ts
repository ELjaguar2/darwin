// Lot L18 : le journal du marché porte le pitch (`bid.placed`) et le contenu public des livrables (`deliverable.produced`).
import { describe, expect, it } from "vitest";
import { CATALOGUE, MockBrain, MockChain, PROFESSIONS, createJournal, createRng, hashObject, loadConfig, parseNear, type Deps, type EventCatalog, type Profession } from "../shared/index.ts";
import { executeMessages } from "../brain/prompts.ts";
import { createMarket, simBudget, simTemplate } from "./index.ts";

const N = (s: string) => parseNear(s).toString();
const genome = { profession: "logo", model: "mock/small", askRatio: 0.7, risk: 0.5, reproThreshold: 2, generosity: 0.2, cooperation: 0.5, personality: "Sérieux." } as const;

async function setup() {
  const config = loadConfig({ DARWIN_PRICE_SCALE: "1", DARWIN_BID_WINDOW_TICKS: "1", DARWIN_TASK_DEADLINE_TICKS: "3" });
  const chain = new MockChain();
  const journal = createJournal();
  const brain = new MockBrain();
  const deps: Deps = { config, chain, brain, journal, rng: createRng(7), now: () => new Date("2026-11-12T00:00:00Z") };
  const market = createMarket(deps);
  for (const id of ["a-0001", "a-0002"]) {
    const r = await chain.createAccount({ label: id, initialFunding: N("5") });
    await chain.registerAgent({ agentId: id, accountId: r.accountId, parentId: null, generation: 1, genomeHash: hashObject(genome), genome, birthTick: 0 });
  }
  return { journal, brain, market };
}

async function cycle(profession: Profession, pitch?: string) {
  const s = await setup();
  const tpl = simTemplate(profession, createRng(3));
  const t = await s.market.postTask({ requester: { kind: "visitor", label: "Zoé" }, profession, title: tpl.title, prompt: tpl.prompt, budget: simBudget(profession, 0.5).toString() });
  await s.market.placeBid({ taskId: t.id, agentId: "a-0001", price: CATALOGUE[profession].nearPrice.toString(), etaTicks: 1, pitch });
  await s.market.step(1);
  const awarded = s.market.getTask(t.id)!;
  const res = await s.brain.complete({ agentId: "a-0001", purpose: "execute_task", model: "mock/small", messages: executeMessages(genome, awarded) });
  const r = await s.market.submitResult({ taskId: t.id, agentId: "a-0001", text: res.text });
  const events = s.journal.since(0, 10000);
  return { s, t, r, events };
}

describe("bid.placed : pitch assaini", () => {
  it("balisage et retours ligne retirés, tronqué à 240 caractères, présent dans l'événement ET dans l'offre", async () => {
    const { events } = await cycle("marketing", "**Super** pitch\n<b>gras</b> " + "bla ".repeat(100));
    const ev = events.find((e) => e.type === "bid.placed")!.data as EventCatalog["bid.placed"];
    expect(ev.bid.pitch).toBeDefined();
    expect(ev.bid.pitch!.length).toBeLessThanOrEqual(240);
    expect(ev.bid.pitch).not.toMatch(/[\n<>*]/);
    expect(ev.bid.pitch!.startsWith("Super pitch gras")).toBe(true);
  });
  it("sans pitch : champ absent (rétrocompatible)", async () => {
    const { events } = await cycle("marketing");
    const bid = (events.find((e) => e.type === "bid.placed")!.data as EventCatalog["bid.placed"]).bid;
    expect("pitch" in bid).toBe(false);
  });
});

describe("deliverable.produced : contenu public des fichiers", () => {
  for (const profession of PROFESSIONS) {
    it(`${profession} : files[] porte le contenu extrait (identique au livrable stocké), taille réelle, sans truncated`, async () => {
      const { events, s, t, r } = await cycle(profession);
      expect(r.validation.verdict).toBe("accepted");
      const d = s.market.getDeliverable(t.id)!;
      const ev = events.find((e) => e.type === "deliverable.produced")!.data as EventCatalog["deliverable.produced"];
      expect(ev.files.map((f) => f.name)).toEqual(d.files.map((f) => f.name));
      for (const [i, f] of ev.files.entries()) {
        expect(f.content).toBe(d.files[i]!.content);
        expect(f.bytes).toBe(Buffer.byteLength(d.files[i]!.content, "utf8"));
        expect(f.truncated).toBeUndefined();
      }
      // le contenu SVG du journal est celui déjà assaini : aucun script
      for (const f of ev.files) if (f.mime === "image/svg+xml") expect(f.content).not.toMatch(/<script|onload|onerror|javascript:/i);
      // le brouillon brut de l'agent n'est pas dans le journal
      expect(JSON.stringify(ev)).not.toContain("rawText");
    });
  }
});
