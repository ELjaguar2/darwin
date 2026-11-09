// Moteur d'évolution : boucle de ticks (contrat ARCHITECTURE §13). Dépend uniquement des interfaces de shared/.
import {
  PROFESSIONS, type Agent, type Deps, type Engine, type Letter, type Market, type SimState, type Task,
} from "../shared/index.ts";
import { bal, type Ctx, type EngineOptions } from "./context.ts";
import { chargeBrain, debit, flushAll, resolveModel, syncBalances, warnOnce } from "./economy.ts";
import { canReproduce, createFounders, die, reproduce } from "./lifecycle.ts";
import { decideBid, decideSubcontract } from "./policy.ts";

export type { EngineOptions } from "./context.ts";
export { createFounderGenome, mutateGenome } from "./genome.ts";

const TASK_PROMPTS: Record<string, string> = {
  writer: "Rédige un court paragraphe d'accroche pour une boutique en ligne de thé.",
  translator: "Traduis en anglais : « La sélection naturelle favorise ceux qui gagnent leur vie. »",
  summarizer: "Résume en deux phrases : l'économie des agents autonomes sur blockchain.",
  analyst: "Analyse en trois points les risques d'un agent qui dépense plus qu'il ne gagne.",
  coder: "Écris une fonction qui renvoie la somme des éléments d'un tableau.",
};

const ID_SORT = (a: Agent, b: Agent) => (a.id < b.id ? -1 : 1);

export function createEngine(deps: Deps, market: Market, options: EngineOptions = {}): Engine {
  const ctx: Ctx = {
    deps, market, agents: new Map(), letters: new Map(), models: [], defaultModel: "",
    emitChainTx: options.emitChainTx ?? deps.chain.info().kind === "mock",
    tick: 0, nextAgent: 0, nextLetter: 0, lastRepro: new Map(), pending: new Map(), attempted: new Set(), warned: new Set(),
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

  // Le moteur apprend les gains et la réputation par le journal (événements du marché), jamais en créditant lui-même.
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
    const n = await poisson(sim.simClientRatePerTick);
    const span = sim.taskBudgetMax - sim.taskBudgetMin;
    for (let i = 0; i < n; i++) {
      const profession = rng.pick(PROFESSIONS);
      const budget = sim.taskBudgetMin + (BigInt(Math.floor(rng.next() * 1_000_000)) * span) / 1_000_000n;
      try {
        await market.postTask({
          requester: { kind: "simulated", label: "Client simulé" }, profession,
          title: `Mission ${profession} (tick ${ctx.tick})`, prompt: TASK_PROMPTS[profession]!, budget: budget.toString(),
        });
      } catch (e) {
        warnOnce(ctx, "POST_TASK_FAILED", (e as Error).message);
      }
    }
  }

  /** Un agent libre enchérit sur au plus une tâche ouverte (la plus rentable pour lui). */
  async function bidding() {
    const open = market.openTasks();
    const busy = new Set<string>();
    for (const t of market.listTasks()) {
      if (t.winnerId && (t.status === "awarded" || t.status === "submitted")) busy.add(t.winnerId);
    }
    for (const a of alive()) {
      if (busy.has(a.id)) continue;
      let best: { task: Task; price: bigint; etaTicks: number } | null = null;
      for (const t of open) {
        if (bidsPlaced.has(`${a.id}|${t.id}`)) continue;
        const d = decideBid(ctx, a, t);
        if (d && (!best || d.price > best.price)) best = { task: t, ...d };
      }
      if (!best) continue;
      bidsPlaced.add(`${a.id}|${best.task.id}`);
      try {
        await market.placeBid({ taskId: best.task.id, agentId: a.id, price: best.price.toString(), etaTicks: best.etaTicks });
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
        agentId: a.id, purpose: "execute_task", model: price.id, maxTokens: sim.maxTokensPerCall,
        messages: [{ role: "system", content: a.genome.personality }, { role: "user", content: t.prompt }],
      });
      await chargeBrain(ctx, a, "execute_task", resp, price);
      const sub = decideSubcontract(ctx, a, BigInt(t.budget));
      if (sub !== null) {
        try {
          await market.postTask({
            requester: { kind: "agent", agentId: a.id }, profession: rng.pick(PROFESSIONS), parentTaskId: t.id,
            title: `Sous-traitance de ${t.id}`, prompt: t.prompt, budget: sub.toString(),
          });
        } catch (e) {
          warnOnce(ctx, "SUBCONTRACT_FAILED", (e as Error).message);
        }
      }
      await market.submitResult({ taskId: t.id, agentId: a.id, text: resp.text });
    } catch (e) {
      warnOnce(ctx, "EXECUTION_FAILED", `${t.id} : ${(e as Error).message}`);
    }
  }

  async function executions() {
    for (const t of market.listTasks({ status: "awarded" })) {
      if (ctx.attempted.has(t.id) || !t.winnerId) continue;
      const a = ctx.agents.get(t.winnerId);
      if (a && a.status === "alive") await execute(a, t);
    }
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
    // 1. métabolisme
    for (const a of alive()) await debit(ctx, a, sim.metabolism, "metabolism");
    await syncBalances(ctx);
    // 2. client simulé, 3. enchères et attribution
    await simulatedClient();
    await bidding();
    await market.step(ctx.tick);
    // 4-5. exécution, validation et paiement (dans submitResult)
    await executions();
    await syncBalances(ctx);
    // 6. reproduction
    for (const a of alive()) if (canReproduce(ctx, a)) await reproduce(ctx, a);
    // 7. règlement groupé puis mort
    await flushAll(ctx);
    for (const a of alive()) if (bal(a) < sim.minVital) await die(ctx, a, "starvation");
    // 8. instantané
    const live = alive();
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
