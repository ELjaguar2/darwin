// Evolution engine: tick loop (ARCHITECTURE contract §13). Depends only on the shared/ interfaces.
import {
  PROFESSIONS, type Agent, type Profession, type Deps, type Engine, type Letter, type Market, type SimState, type Task,
} from "../shared/index.ts";
import { CATALOGUE } from "../shared/catalogue.ts";
import { executeMessages } from "../brain/prompts.ts";
import { bal, type Ctx, type EngineOptions } from "./context.ts";
import { chargeBrain, debit, flushAll, resolveModel, syncBalances, warnOnce } from "./economy.ts";
import { canReproduce, createFounders, die, reproduce } from "./lifecycle.ts";
import { extractDeliverable } from "../market/deliverable.ts";
import { runChecks } from "../market/checks.ts";
import { SUBCONTRACT_PLAN, inHouseHeading, integrateText, subcontractHeading, type ChildBrief } from "./subcontract-plan.ts";
import { decideBid, decideSubcontract, estimateCost, reserve } from "./policy.ts";
import { makePitch } from "./pitch.ts";

export type { EngineOptions } from "./context.ts";
export { createFounderGenome, mutateGenome } from "./genome.ts";

const TASK_PROMPTS: Record<Profession, string> = {
  logo: "Create three SVG logo concepts for an online organic tea shop called \"Leaf\".",
  finance: "Analyse these figures: revenue 12,400, costs 9,800, stock 3,200, cash 1,500. Give three findings and one risk.",
  architecture: "Describe the architecture of a small meeting-room booking app: a short document and a Mermaid diagram.",
  marketing: "Write an 80-word hook for the launch of a neighbourhood coffee shop, warm tone.",
  translation: "Translate into English: \"La selección natural favorece a quienes se ganan la vida.\"",
  legal: "Prepare an 8-point checklist for the legal notices of an e-commerce website.",
};

/** A snapshot of the distribution by profession every N ticks (specialisation indicator). */
export const POPULATION_SNAPSHOT_EVERY = 5;

export function populationSnapshot(live: readonly Agent[], tick: number) {
  const zero = () => Object.fromEntries(PROFESSIONS.map((p) => [p, 0])) as Record<Profession, number>;
  const byProfession = zero();
  const byGeneration: Record<string, Record<Profession, number>> = {};
  for (const a of live) {
    byProfession[a.genome.profession]++;
    (byGeneration[String(a.generation)] ??= zero())[a.genome.profession]++;
  }
  return { tick, byProfession, byGeneration };
}

const ID_SORT = (a: Agent, b: Agent) => (a.id < b.id ? -1 : 1);

export function createEngine(deps: Deps, market: Market, options: EngineOptions = {}): Engine {
  const ctx: Ctx = {
    deps, market, agents: new Map(), letters: new Map(), models: [], defaultModel: "",
    emitChainTx: options.emitChainTx ?? deps.chain.info().kind === "mock",
    tick: 0, nextAgent: Math.max(0, Math.floor(options.agentSeqStart ?? 0)), nextLetter: 0, lastRepro: new Map(), pending: new Map(), attempted: new Set(), warned: new Set(),
  };
  const { config, journal, rng } = deps;
  const { sim } = config;
  let running = false;
  let paused = false;
  let stopped = false;
  let startedAt: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticking = false;
  const stats = { tasksSettled: 0 };
  const bidsPlaced = new Set<string>();
  /** L21: missions whose agent waits for its sub-task (state machine: awarded -> own part -> sub-task posted -> waiting -> integration -> submission). */
  interface SubJob { parentId: string; agentId: string; childId: string; childProfession: Profession; ownText: string; parentPrice: bigint; budget: bigint; brief: ChildBrief }
  const jobs = new Map<string, SubJob>();
  const wonPrices = new Map<string, bigint>(); // agentId|taskId -> price of the bid placed (= winning price once awarded)

  // The engine learns earnings and reputation through the journal (market events), never by crediting itself.
  journal.subscribe((e) => {
    if (e.type === "escrow.released") {
      const a = [...ctx.agents.values()].find((x) => x.accountId === e.data.payee || x.id === e.data.payee);
      if (a) {
        a.earned = (BigInt(a.earned) + BigInt(e.data.amount)).toString();
        a.tasksDone++;
      }
      stats.tasksSettled++;
    } else if (e.type === "reputation.updated") {
      const a = ctx.agents.get(e.data.agentId);
      if (a) a.reputation = e.data.total;
    }
  });

  const alive = () => [...ctx.agents.values()].filter((a) => a.status === "alive").sort(ID_SORT);
  const generations = () => Math.max(0, ...[...ctx.agents.values()].map((a) => a.generation));

  async function poisson(lambda: number): Promise<number> {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng.next();
    } while (p > L && k < 10);
    return k - 1;
  }

  async function simulatedClient() {
    if (options.simulatedClient) {
      try {
        await options.simulatedClient.tick(ctx.tick);
      } catch (e) {
        warnOnce(ctx, "POST_TASK_FAILED", (e as Error).message);
      }
      return;
    }
    const n = await poisson(sim.simClientRatePerTick);
    const span = sim.taskBudgetMax - sim.taskBudgetMin;
    for (let i = 0; i < n; i++) {
      const profession = rng.pick(PROFESSIONS);
      const budget = sim.taskBudgetMin + (BigInt(Math.floor(rng.next() * 1_000_000)) * span) / 1_000_000n;
      try {
        await market.postTask({
          requester: { kind: "simulated", label: "Simulated client" }, profession,
          title: `${profession} mission (tick ${ctx.tick})`, prompt: TASK_PROMPTS[profession]!, budget: budget.toString(),
        });
      } catch (e) {
        warnOnce(ctx, "POST_TASK_FAILED", (e as Error).message);
      }
    }
  }

  /** Budgets promised to sub-tasks by the agent's running jobs (not spendable). */
  const committedOf = (agentId: string) => [...jobs.values()].filter((j) => j.agentId === agentId).reduce((s, j) => s + j.budget, 0n);

  /** A free agent bids on at most one open task (the most profitable for it). */
  async function bidding() {
    const open = market.openTasks();
    const busy = new Set<string>();
    for (const t of market.listTasks()) {
      if (t.winnerId && (t.status === "awarded" || t.status === "submitted") && !jobs.has(t.id)) busy.add(t.winnerId);
    }
    for (const a of alive()) {
      if (busy.has(a.id)) continue;
      let best: { task: Task; price: bigint; etaTicks: number } | null = null;
      for (const t of open) {
        if (bidsPlaced.has(`${a.id}|${t.id}`)) continue;
        const d = decideBid(ctx, a, t, committedOf(a.id));
        if (d && (!best || d.price > best.price)) best = { task: t, ...d };
      }
      if (!best) continue;
      bidsPlaced.add(`${a.id}|${best.task.id}`);
      wonPrices.set(`${a.id}|${best.task.id}`, best.price);
      try {
        const pitch = await makePitch(ctx, a, best.task, best.price);
        await market.placeBid({ taskId: best.task.id, agentId: a.id, price: best.price.toString(), etaTicks: best.etaTicks, ...(pitch ? { pitch } : {}) });
      } catch (e) {
        warnOnce(ctx, "BID_FAILED", (e as Error).message);
      }
    }
  }

  async function execute(a: Agent, t: Task) {
    ctx.attempted.add(t.id);
    try {
      const price = resolveModel(ctx, a);
      const resp = await deps.brain.complete({
        agentId: a.id, purpose: "execute_task", model: price.id, maxTokens: Math.max(sim.maxTokensPerCall, CATALOGUE[t.profession].maxOutputTokens),
        messages: executeMessages(a.genome, { title: t.title, prompt: t.prompt, profession: t.profession }),
      });
      await chargeBrain(ctx, a, "execute_task", resp, price);
      const wonPrice = wonPrices.get(`${a.id}|${t.id}`);
      // At most ONE running subcontract per agent, and only if its own part already passes the market's checks
      // (otherwise the mission would be rejected whatever the child does: certain loss of the child's price).
      const hasJob = [...jobs.values()].some((j) => j.agentId === a.id);
      const d = wonPrice !== undefined && !hasJob ? decideSubcontract(ctx, a, t, wonPrice, committedOf(a.id)) : null;
      if (d && !passesChecks(a, t, resp.text)) {
        warnOnce(ctx, "SUBCONTRACT_SKIPPED", `${t.id}: own part fails the profession checks, not delegating`);
        await market.submitResult({ taskId: t.id, agentId: a.id, text: resp.text });
        return;
      }
      if (d) {
        // Real subcontracting: the own part is done, the sub-task brief is derived from the mission and from this partial result.
        const brief = SUBCONTRACT_PLAN[a.genome.profession].brief(t.id, { title: t.title, prompt: t.prompt, ownText: resp.text });
        const job: SubJob = { parentId: t.id, agentId: a.id, childId: "", childProfession: d.profession, ownText: resp.text, parentPrice: wonPrice!, budget: d.budget, brief };
        try {
          const child = await market.postTask({
            requester: { kind: "agent", agentId: a.id }, profession: d.profession, parentTaskId: t.id,
            title: brief.title, prompt: brief.prompt, budget: d.budget.toString(), deadlineTick: d.deadlineTick,
          });
          job.childId = child.id;
          jobs.set(t.id, job);
          return; // the mission is submitted later, by advanceJobs
        } catch (e) {
          warnOnce(ctx, "SUBCONTRACT_FAILED", (e as Error).message);
          await concludeJob(a, t, job, undefined, "failed");
          return;
        }
      }
      await market.submitResult({ taskId: t.id, agentId: a.id, text: resp.text });
    } catch (e) {
      warnOnce(ctx, "EXECUTION_FAILED", `${t.id}: ${(e as Error).message}`);
    }
  }

  /** True if the text passes the market's deterministic checks for the mission's profession (same functions as the judge's rule). */
  function passesChecks(a: Agent, t: Task, text: string): boolean {
    try {
      return text.length <= 20_000 && runChecks(t, extractDeliverable(t, a.id, text)).ok;
    } catch {
      return false;
    }
  }

  /** Extra AI call of the parent for the part that was not subcontracted (plan B). Bounded: one call, debited from the agent, reserve respected. */
  async function doInHouse(a: Agent, job: SubJob): Promise<string | null> {
    try {
      const cap = Math.max(sim.maxTokensPerCall, CATALOGUE[job.childProfession].maxOutputTokens); // the cap actually requested below
      if (bal(a) - estimateCost(ctx, a, { prompt: job.brief.prompt } as Task, cap) < reserve(ctx, a)) return null;
      const price = resolveModel(ctx, a);
      const resp = await deps.brain.complete({
        agentId: a.id, purpose: "execute_task", model: price.id, maxTokens: Math.max(sim.maxTokensPerCall, CATALOGUE[job.childProfession].maxOutputTokens),
        messages: executeMessages(a.genome, { title: job.brief.title, prompt: job.brief.prompt, profession: job.childProfession }),
      });
      await chargeBrain(ctx, a, "execute_task", resp, price);
      return resp.text;
    } catch (e) {
      warnOnce(ctx, "INHOUSE_FAILED", `${job.parentId}: ${(e as Error).message}`);
      return null;
    }
  }

  /** Forgets the bid prices of a concluded job (memory: they are no longer needed). */
  function purgePrices(job: SubJob) {
    wonPrices.delete(`${job.agentId}|${job.parentId}`);
    if (job.childId) for (const k of [...wonPrices.keys()]) if (k.endsWith(`|${job.childId}`)) wonPrices.delete(k);
  }

  /**
   * Ends a subcontract and submits the mission, ALWAYS (the client is never penalised):
   * - child delivered and paid (reason undefined): integration in a "Subcontracted to <name> (<profession>)" section, `subcontract.integrated`;
   * - otherwise: `subcontract.fallback` (commission 0), the parent does the part itself ("Done in-house (...)" section) or adds nothing.
   */
  async function concludeJob(a: Agent, t: Task, job: SubJob, child: Task | undefined, failure?: "no_bids" | "rejected" | "deadline" | "failed") {
    try {
      await concludeJobInner(a, t, job, child, failure);
    } finally {
      purgePrices(job);
    }
  }

  async function concludeJobInner(a: Agent, t: Task, job: SubJob, child: Task | undefined, failure?: "no_bids" | "rejected" | "deadline" | "failed") {
    let reason = failure;
    let text = job.ownText;
    const ownOk = passesChecks(a, t, job.ownText);
    if (!reason && child) {
      const childText = child.result?.text;
      const childAgent = child.winnerId ? ctx.agents.get(child.winnerId) : undefined;
      const childPrice = child.winnerId ? wonPrices.get(`${child.winnerId}|${child.id}`) : undefined;
      const candidate = childText ? integrateText(t.profession, job.ownText, subcontractHeading(childAgent?.name ?? child.winnerId ?? "agent", child.profession), childText) : undefined;
      if (candidate && childPrice !== undefined && child.winnerId && (!ownOk || passesChecks(a, t, candidate))) {
        text = candidate;
        journal.emit({
          type: "subcontract.integrated",
          data: {
            parentTaskId: t.id, childTaskId: child.id, childAgentId: child.winnerId, childProfession: child.profession,
            childPrice: childPrice.toString(), parentPrice: job.parentPrice.toString(), commission: (job.parentPrice - childPrice).toString(),
          },
        });
      } else reason = "failed";
    }
    if (reason) {
      journal.emit({ type: "subcontract.fallback", data: { parentTaskId: t.id, ...(job.childId ? { childTaskId: job.childId } : {}), reason, commission: "0" } });
      // A child already `submitted` (verdict pending) at the integration limit: no extra AI call, the mission goes out with the own part alone.
      const extra = child?.status === "submitted" ? null : await doInHouse(a, job);
      if (extra) {
        const candidate = integrateText(t.profession, job.ownText, inHouseHeading(reason), extra);
        if (!ownOk || passesChecks(a, t, candidate)) text = candidate;
      }
    }
    await market.submitResult({ taskId: t.id, agentId: a.id, text });
  }

  /** Each tick: missions waiting for their sub-task are integrated (delivered) or fall back (expired, rejected, too late). */
  async function advanceJobs() {
    for (const job of [...jobs.values()]) {
      const t = market.getTask(job.parentId);
      const a = ctx.agents.get(job.agentId);
      if (!t || t.status !== "awarded" || !a || a.status !== "alive") {
        jobs.delete(job.parentId); // the market handles the expiry of the mission; nothing to deliver
        continue;
      }
      const child = market.getTask(job.childId);
      let failure: "no_bids" | "rejected" | "deadline" | "failed" | undefined;
      if (!child) failure = "failed";
      else if (child.status === "settled") failure = undefined;
      else if (child.status === "rejected") failure = "rejected";
      else if (child.status === "expired") failure = child.winnerId ? "deadline" : "no_bids";
      else if (ctx.tick >= t.deadlineTick) failure = "deadline"; // last safe tick: deliver now
      else continue;
      jobs.delete(job.parentId);
      try {
        await concludeJob(a, t, job, child, failure);
      } catch (e) {
        warnOnce(ctx, "EXECUTION_FAILED", `${t.id}: ${(e as Error).message}`);
      }
    }
  }

  async function executions() {
    for (const t of market.listTasks({ status: "awarded" })) {
      if (ctx.attempted.has(t.id) || !t.winnerId) continue;
      const a = ctx.agents.get(t.winnerId);
      if (a && a.status === "alive") await execute(a, t);
    }
    await advanceJobs(); // after the loop: a sub-task awarded and settled during this tick is integrated in the same tick
  }

  async function finish(reason: "extinction" | "manual" | "max_ticks" | "error") {
    if (stopped) return;
    stopped = true;
    running = false;
    if (timer) clearTimeout(timer);
    try {
      await flushAll(ctx, true);
    } catch (e) {
      warnOnce(ctx, "FLUSH_FAILED", (e as Error).message);
    }
    journal.emit({ type: "sim.stopped", data: { reason, generations: generations() } });
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    ctx.tick++;
    journal.setTick(ctx.tick);
    // 1. metabolism
    for (const a of alive()) await debit(ctx, a, sim.metabolism, "metabolism");
    await syncBalances(ctx);
    // 2. simulated client, 3. bidding and awarding
    await simulatedClient();
    await bidding();
    await market.step(ctx.tick);
    // 4-5. execution, validation and payment (inside submitResult)
    await executions();
    await syncBalances(ctx);
    // 6. reproduction
    for (const a of alive()) if (canReproduce(ctx, a)) await reproduce(ctx, a);
    // 7. batched settlement then death
    await flushAll(ctx);
    for (const a of alive()) if (bal(a) < sim.minVital) await die(ctx, a, "starvation");
    // 8. snapshot
    const live = alive();
    if (ctx.tick % POPULATION_SNAPSHOT_EVERY === 0) journal.emit({ type: "population.snapshot", data: populationSnapshot(live, ctx.tick) });
    journal.emit({
      type: "sim.tick",
      data: {
        alive: live.length, tasksOpen: market.openTasks().length,
        totalBalance: live.reduce((s, a) => s + bal(a), 0n).toString(),
      },
    });
    if (live.length === 0) await finish("extinction");
    else if (sim.maxTicks > 0 && ctx.tick >= sim.maxTicks) await finish("max_ticks");
  }

  function schedule() {
    if (!running || stopped) return;
    timer = setTimeout(async () => {
      if (!paused && !ticking) {
        ticking = true;
        try {
          await tick();
        } catch (e) {
          journal.emit({ type: "system.error", data: { code: "TICK_FAILED", message: (e as Error).message } });
          await finish("error");
        } finally {
          ticking = false;
        }
      }
      schedule();
    }, sim.tickMs);
  }

  return {
    async start() {
      if (running || stopped) return;
      running = true;
      startedAt = deps.now().toISOString();
      const info = deps.chain.info();
      journal.emit({ type: "sim.started", data: { mode: config.mode, preset: config.preset, seed: config.seed, chain: info.kind, brain: deps.brain.kind } });
      ctx.models = (await deps.brain.listModels()).filter((m) => m.verified);
      ctx.defaultModel = await deps.brain.defaultModel();
      await createFounders(ctx);
      if (options.autoRun ?? true) schedule();
    },
    pause() {
      if (!running || paused) return;
      paused = true;
      journal.emit({ type: "sim.paused", data: {} });
    },
    resume() {
      if (!running || !paused) return;
      paused = false;
      journal.emit({ type: "sim.resumed", data: {} });
    },
    async stop() {
      await finish("manual");
    },
    tick,
    getState(): SimState {
      const info = deps.chain.info();
      const all = [...ctx.agents.values()];
      const live = all.filter((a) => a.status === "alive");
      return {
        running, paused, tick: ctx.tick, startedAt, mode: config.mode,
        chain: { kind: info.kind, masterId: info.masterId, contractId: info.contractId },
        brain: { kind: deps.brain.kind }, generations: generations(),
        agents: structuredClone(all), tasks: market.listTasks().slice(-50), letters: structuredClone([...ctx.letters.values()]),
        lastSeq: journal.lastSeq,
        totals: {
          alive: live.length, dead: all.length - live.length, born: all.length, tasksSettled: stats.tasksSettled,
          totalBalance: live.reduce((s, a) => s + bal(a), 0n).toString(),
        },
      };
    },
    getAgent: (id) => ctx.agents.get(id),
    getLetter: (id): Letter | undefined => ctx.letters.get(id),
  };
}
