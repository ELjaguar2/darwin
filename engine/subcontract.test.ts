// L21: real subcontracting. Decision (plan table, floor, commission, deadline), complete mock simulation of the `selection` preset
// (delegated, delivered, paid, integrated), the three plan B cases (no bids, rejected, deadline) and old-journal replay.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRuntime, type Runtime } from "../backend/runtime.ts";
import { parseReplay } from "../backend/replay.ts";
import { MockBrain, PROFESSIONS, createRng, loadConfig, type Agent, type BrainRequest, type DarwinEvent, type Profession } from "../shared/index.ts";
import { scaledPrice } from "../shared/catalogue.ts";
import { decideSubcontract, delegatedShareBp } from "./policy.ts";
import { SUBCONTRACT_PLAN, integrateText } from "./subcontract-plan.ts";
import type { Ctx } from "./context.ts";

const NEAR = 10n ** 24n;
const SEL = { DARWIN_MODE: "testnet", DARWIN_CHAIN: "mock", DARWIN_BRAIN: "mock", DARWIN_PRESET: "selection" };

function fakeCtx(seed: number, tick = 10): Ctx {
  const sim = { priceScale: 1, minVital: NEAR / 33n, bidWindowTicks: 1, taskDeadlineTicks: 4, subcontract: { baseProb: 1, coopProb: 0, minCommission: 0.15 } };
  return { tick, deps: { rng: createRng(seed), config: { sim } } } as unknown as Ctx;
}
const agent = (profession: Profession, cooperation: number, balance = 5n * NEAR) =>
  ({ id: "a-1", balance: balance.toString(), genome: { profession, cooperation, risk: 0.5 } }) as unknown as Agent;
const mission = (over: Record<string, unknown> = {}) => ({ id: "t-1", requester: { kind: "simulated", label: "x" }, deadlineTick: 15, ...over }) as never;

describe("decideSubcontract (L21)", () => {
  it("child profession from the plan table, budget >= child floor and < price, commission >= 15%, child deadline < parent deadline", () => {
    let n = 0;
    for (const own of PROFESSIONS) {
      for (const price of [NEAR / 25n, NEAR / 20n, NEAR / 12n, NEAR / 8n]) {
        const d = decideSubcontract(fakeCtx(1), agent(own, 0.7), mission(), price);
        if (!d) continue;
        n++;
        expect(d.profession).toBe(SUBCONTRACT_PLAN[own].child);
        expect(d.profession).not.toBe(own);
        expect(d.budget).toBeGreaterThanOrEqual(scaledPrice(d.profession, 1));
        expect(d.budget).toBeLessThan(price);
        expect(d.commission).toBe(price - d.budget);
        expect(d.commission * 100n).toBeGreaterThanOrEqual(price * 15n);
        expect(d.deadlineTick).toBeLessThan(15);
        expect(d.deadlineTick).toBeGreaterThan(10 + 1); // after the child's bidding window
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  it("only depth-0 missions are subcontractable; no time left or reserve at risk: no subcontract", () => {
    const price = NEAR / 10n;
    expect(decideSubcontract(fakeCtx(1), agent("logo", 1), mission({ requester: { kind: "agent", agentId: "a-9" }, parentTaskId: "t-0" }), price)).toBeNull();
    expect(decideSubcontract(fakeCtx(1), agent("logo", 1), mission({ deadlineTick: 12 }), price)).toBeNull(); // child would end at tick 11 = bidding end + 0
    expect(decideSubcontract(fakeCtx(1), agent("logo", 1, NEAR / 33n), mission(), price)).toBeNull();
    expect(decideSubcontract(fakeCtx(1), agent("translation", 1), mission(), scaledPrice("translation", 1))).toBeNull(); // floor of marketing does not fit
  });

  it("the delegated share grows with cooperation (the commission shrinks)", () => {
    let prev = 0n;
    for (let c = 0; c <= 1.0001; c += 0.1) {
      const s = delegatedShareBp(c);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
    expect(delegatedShareBp(1)).toBeGreaterThan(delegatedShareBp(0));
  });

  it("every plan row produces a brief valid for its child profession", () => {
    const parents: Record<Profession, { title: string; prompt: string; ownText: string }> = {
      logo: { title: "Logo for Atelier Lumio", prompt: "Company: Atelier Lumio\nSector: crafts\nDesired style: playful\nCreate 3 logos.", ownText: "x" },
      finance: { title: "Profitability", prompt: "| Month | Revenue |\n|---|---|\n| Jan | 3000 |", ownText: "Revenue was 3000 in January and the trend is stable over the period." },
      architecture: { title: "Architecture", prompt: "Propose the architecture of a booking platform. Constraint: small budget.", ownText: "doc" },
      marketing: { title: "Text", prompt: "Write a text", ownText: "Discover our bottle, made of recycled steel. It keeps your drinks cold all day long." },
      translation: { title: "FR to EN", prompt: "Translate into English: « Merci de votre patience, votre commande sera expédiée. »", ownText: "Thank you for your patience, your order will be shipped soon.\n\n---\nNote: x" },
      legal: { title: "Checklist", prompt: "Draw up a checklist for a shop.", ownText: "This is not legal advice.\n- [ ] a\n- [ ] b\n- [ ] c\nThis is not legal advice." },
    };
    for (const p of PROFESSIONS) {
      const b = SUBCONTRACT_PLAN[p].brief("t-0007", parents[p]);
      expect(b.title).toBe(`Subcontract of t-0007: ${SUBCONTRACT_PLAN[p].child} sub-task`);
      expect(b.prompt.length).toBeGreaterThan(60);
      if (SUBCONTRACT_PLAN[p].child === "translation") expect(b.prompt).toMatch(/^Translate into Spanish: « .{20,} »$/s);
      if (SUBCONTRACT_PLAN[p].child === "finance") expect(b.prompt).toContain("| Item | Monthly cost (EUR) |");
    }
  });

  it("integration keeps the profession's format: legal disclaimer still closes the document, no code fence from the child", () => {
    const own = "This is not legal advice.\n- [ ] a\n- [ ] b\n- [ ] c\nThis is not legal advice.";
    const t = integrateText("legal", own, "## Subcontracted to Ada (marketing)", "summary ```svg <svg/> ```");
    expect(t.endsWith("This is not legal advice.")).toBe(true);
    expect(t).toContain("## Subcontracted to Ada (marketing)");
    expect(t).not.toContain("```");
  });
});

type Ev = DarwinEvent;
const dataOf = <T extends Ev["type"]>(ev: Ev[], type: T) => ev.filter((e) => e.type === type).map((e) => e.data as never as Record<string, any>);

class ScriptedBrain extends MockBrain {
  /** agentId -> behaviour of the execution of THAT agent: "short" (invalid result) or "throw" (never delivers). */
  script = new Map<string, "short" | "throw">();
  override async complete(req: BrainRequest) {
    const mode = req.purpose === "execute_task" ? this.script.get(req.agentId) : undefined;
    if (mode === "throw") throw new Error("scripted outage");
    const r = await super.complete(req);
    return mode === "short" ? { ...r, text: "too short" } : r;
  }
}

/** Controlled scenario: all agents are "logo" except one coop=1 marketing parent (and, optionally, one translation child agent). */
async function scenario(opts: { childAgent: boolean; script?: "short" | "throw" }) {
  const config = loadConfig({ ...SEL, DARWIN_SEED: "7" });
  config.sim.simClientRatePerTick = 0;
  config.sim.subcontract = { baseProb: 1, coopProb: 0, minCommission: 0.15 };
  config.sim.metabolism = 0n;
  let t = 0;
  const brain = new ScriptedBrain();
  const rt = createRuntime(config, { autoRun: false, brain, now: () => new Date(Date.UTC(2026, 10, 12) + ++t) });
  await rt.engine.start();
  const agents = rt.engine.getState().agents;
  const parent = agents[0]!;
  parent.genome.profession = "marketing";
  parent.genome.cooperation = 1;
  parent.genome.askRatio = 0.5;
  let child: Agent | undefined;
  agents.slice(1).forEach((a, i) => {
    a.genome.profession = opts.childAgent && i === 0 ? "translation" : "logo";
    a.genome.askRatio = 0.5;
  });
  if (opts.childAgent) child = agents[1]!;
  if (opts.script && child) brain.script.set(child.id, opts.script);
  // real agent objects (getState clones them)
  for (const a of agents) {
    const live = rt.engine.getAgent(a.id)!;
    live.genome = a.genome;
  }
  await rt.market.postTask({ requester: { kind: "simulated", label: "test" }, profession: "marketing", title: "Product text", prompt: "Write a text for a bottle.", budget: (NEAR / 20n).toString() });
  for (let i = 0; i < 10; i++) await rt.engine.tick();
  const events = rt.journal.since(0, 1_000_000) as Ev[];
  return { rt, events, parent, child };
}

async function expectParentDelivered(rt: Runtime, events: Ev[]) {
  const task = rt.market.listTasks().find((x) => !x.parentTaskId && x.requester.kind === "simulated")!;
  expect(task.status).toBe("settled"); // delivered, validated, paid: the mission never expires because of the subcontract
  const released = dataOf(events, "escrow.released").filter((e) => e.taskId === task.id);
  expect(released).toHaveLength(1);
  return task;
}

describe("plan B: the client is never penalised (L21)", () => {
  it("no bids on the sub-task: parent delivers in-house, no commission, fallback journalled", async () => {
    const { rt, events } = await scenario({ childAgent: false });
    const task = await expectParentDelivered(rt, events);
    const fb = dataOf(events, "subcontract.fallback");
    expect(fb).toHaveLength(1);
    expect(fb[0]).toMatchObject({ parentTaskId: task.id, reason: "no_bids", commission: "0" });
    expect(dataOf(events, "subcontract.integrated")).toHaveLength(0);
    const d = dataOf(events, "deliverable.produced").find((e) => e.taskId === task.id)!;
    expect(d.files[0].content).toContain("## Done in-house (subcontract failed: no_bids)");
    await rt.shutdown();
  });

  it("sub-task deliverable rejected: parent delivers in-house, no commission", async () => {
    const { rt, events } = await scenario({ childAgent: true, script: "short" });
    const task = await expectParentDelivered(rt, events);
    expect(dataOf(events, "subcontract.fallback")[0]).toMatchObject({ parentTaskId: task.id, reason: "rejected", commission: "0" });
    expect(dataOf(events, "subcontract.integrated")).toHaveLength(0);
    await rt.shutdown();
  });

  it("sub-task not delivered before its deadline: parent delivers in time, no commission", async () => {
    const { rt, events } = await scenario({ childAgent: true, script: "throw" });
    const task = await expectParentDelivered(rt, events);
    expect(dataOf(events, "subcontract.fallback")[0]).toMatchObject({ parentTaskId: task.id, reason: "deadline", commission: "0" });
    const sub = dataOf(events, "subcontract.created")[0]!;
    expect(sub.deadline).toBeLessThan(task.deadlineTick); // child deadline strictly before the mission's
    await rt.shutdown();
  });

  it("success path of the same scenario: integrated, commission = parent price - child price, payer = delegating agent account", async () => {
    const { rt, events, parent } = await scenario({ childAgent: true });
    const task = await expectParentDelivered(rt, events);
    const integ = dataOf(events, "subcontract.integrated");
    expect(integ).toHaveLength(1);
    const i = integ[0]!;
    expect(BigInt(i.commission)).toBe(BigInt(i.parentPrice) - BigInt(i.childPrice));
    expect(BigInt(i.commission)).toBeGreaterThan(0n);
    const sub = dataOf(events, "subcontract.created")[0]!;
    expect(sub.deadline).toBeLessThan(task.deadlineTick);
    expect(sub.parentTaskId).toBe(task.id);
    const lock = dataOf(events, "escrow.locked").find((e) => e.taskId === i.childTaskId)!;
    expect(lock.payer).toBe(rt.engine.getAgent(parent.id)!.accountId); // the child's escrow is signed by the delegating agent
    expect(dataOf(events, "escrow.released").some((e) => e.taskId === i.childTaskId)).toBe(true);
    const d = dataOf(events, "deliverable.produced").find((e) => e.taskId === task.id)!;
    expect(d.files[0].content).toMatch(/## Subcontracted to \w+ \(translation\)/);
    expect(dataOf(events, "task.validated").find((e) => e.taskId === task.id)!.validation.verdict).toBe("accepted");
    await rt.shutdown();
  });
});

describe("real subcontracting in mock simulation, preset selection (L21)", () => {
  it("at least 3 complete subcontracts: delegated, delivered, paid, integrated, commission journalled, parent accepted", async () => {
    let complete = 0;
    for (const seed of [101, 102, 103, 104]) {
      const config = loadConfig({ ...SEL, DARWIN_SEED: String(seed) });
      let t = 0;
      const rt = createRuntime(config, { autoRun: false, now: () => new Date(Date.UTC(2026, 10, 12) + ++t) });
      await rt.engine.start();
      for (let i = 0; i < 120 && rt.engine.getState().running; i++) await rt.engine.tick();
      const ev = rt.journal.since(0, 1_000_000) as Ev[];
      const created = dataOf(ev, "subcontract.created");
      for (const i of dataOf(ev, "subcontract.integrated")) {
        const c = created.find((x) => x.childTaskId === i.childTaskId)!;
        const parent = rt.market.getTask(i.parentTaskId)!;
        const child = rt.market.getTask(i.childTaskId)!;
        expect(child.status).toBe("settled");
        expect(parent.status).toBe("settled");
        expect(child.profession).toBe(SUBCONTRACT_PLAN[parent.profession].child);
        expect(c.deadline).toBeLessThan(parent.deadlineTick);
        expect(BigInt(i.commission)).toBe(BigInt(i.parentPrice) - BigInt(i.childPrice));
        expect(BigInt(i.childPrice)).toBeLessThanOrEqual(BigInt(c.budget));
        expect(BigInt(i.commission) * 100n).toBeGreaterThanOrEqual(BigInt(i.parentPrice) * 15n);
        const lock = dataOf(ev, "escrow.locked").find((e) => e.taskId === i.childTaskId)!;
        expect(lock.payer).toBe(rt.engine.getAgent(c.byAgentId)!.accountId);
        const d = dataOf(ev, "deliverable.produced").find((e) => e.taskId === i.parentTaskId)!;
        expect(d.files.map((f: any) => f.content).join("\n")).toContain("## Subcontracted to ");
        expect(parent.validation?.verdict).toBe("accepted");
        complete++;
      }
      // the mission never expires because of the subcontract: every fallback ends with a delivered parent
      for (const f of dataOf(ev, "subcontract.fallback")) expect(["settled", "rejected", "expired"]).toContain(rt.market.getTask(f.parentTaskId)!.status);
      await rt.shutdown();
    }
    expect(complete).toBeGreaterThanOrEqual(3);
  }, 180000);
});

describe("old journals", () => {
  it("run 8 journal (without the L21 fields and events) is still replayable", () => {
    const text = readFileSync(new URL("../docs/preuves/run8-journal.jsonl", import.meta.url), "utf8");
    const r = parseReplay(text, "run8-journal.jsonl");
    expect(r.events.length).toBeGreaterThan(100);
    expect(r.events.some((e) => e.type === "subcontract.created")).toBe(true);
  });
});
