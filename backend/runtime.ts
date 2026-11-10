// Composition root (D-010) : chain + brain + market + engine + journal dans un seul processus.
// Aucune règle métier ici : on branche les modules, le journal, la persistance et les plafonds.
import { readFileSync } from "node:fs";
import { NearChain, createChain, type CreateChainExtras } from "../accounts/index.ts";
import { createBrain, type Guardrails } from "../brain/index.ts";
import { createEngine } from "../engine/index.ts";
import { createMarket, type TaskMarket } from "../market/index.ts";
import {
  createJournal, createRng,
  type Bid, type Brain, type Chain, type Config, type DarwinEvent, type Deps, type Engine, type Journal,
} from "../shared/index.ts";
import { redactText, safeErrorMessage } from "./redact.ts";
import type { Store } from "./store.ts";

export interface RuntimeOptions {
  /** Persistance data/ (absente dans la plupart des tests). */
  store?: Store;
  now?: () => Date;
  /** false : le moteur n'a pas d'horloge (tests : `engine.tick()` à la main). */
  autoRun?: boolean;
  /** Tests : faux backend NEAR, etc. */
  chainExtra?: CreateChainExtras;
  brain?: Brain;
  log?: (msg: string) => void;
  /** Période d'écriture de l'instantané d'état (ms). */
  snapshotEveryMs?: number;
}

export interface Runtime {
  config: Config;
  journal: Journal;
  chain: Chain;
  brain: Brain;
  market: TaskMarket;
  engine: Engine;
  version: string;
  startedAt: string;
  /** Offres d'une tâche, reconstruites depuis le journal (le marché n'expose pas `getBid`). */
  bidsOf(taskId: string): Bid[];
  /** `chain.mode` de NearChain, sinon `mock`. */
  escrowMode(): "contract" | "operator-account";
  /** Vérifications de démarrage (testnet : RPC et compte maître). Lève une erreur claire sinon. */
  checkReady(): Promise<void>;
  /** Lance la simulation (fondateurs puis boucle). */
  startSim(): Promise<void>;
  /** Arrêt propre : moteur, dernier instantané. */
  shutdown(): Promise<void>;
}

export function readVersion(): string {
  try {
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const v = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof v === "string" ? v : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Décalage de départ des numéros d'agents et de tâches. Sur une vraie chaîne, les sous-comptes et le registre du contrat
 * persistent d'un run à l'autre : repartir de 1 provoquerait « Compte déjà existant » ou ESCROW_EXISTS. Sans variable
 * explicite, on part donc d'un nombre croissant avec l'horloge (secondes depuis le 2026-11-01 x `perSecond`) : deux runs
 * espacés de quelques minutes ne se chevauchent pas, sans lecture du registre. Mock : 0 (ids lisibles, tests stables).
 */
export function idOffset(envName: string, chainKind: string, perSecond: number, now: () => Date, env: NodeJS.ProcessEnv = process.env): number {
  const explicit = env[envName];
  if (explicit !== undefined && explicit !== "") return Math.max(0, Math.floor(Number(explicit)) || 0);
  if (chainKind === "mock") return 0;
  const seconds = Math.max(0, (now().getTime() - Date.UTC(2026, 10, 1)) / 1000);
  return Math.floor(seconds * perSecond);
}

export function createRuntime(config: Config, opts: RuntimeOptions = {}): Runtime {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const store = opts.store;

  // Journal : persistance JSONL + masquage des messages d'erreur avant tout abonné (SSE comprise).
  const journal = createJournal({
    now,
    onAppend: (ev: DarwinEvent) => {
      if (ev.type === "system.warning" || ev.type === "system.error") ev.data.message = redactText(ev.data.message);
      store?.appendEvent(ev);
    },
  });
  const warn = (code: string, message: string) => {
    journal.emit({ type: "system.warning", data: { code, message: redactText(message).slice(0, 300) } });
  };

  // Chaîne : en testnet NearChain émet chain.tx via onTx ; en mock c'est le moteur (emitChainTx, D-027), donc pas d'onTx en double.
  const chain = createChain(config, {
    ...opts.chainExtra,
    onTx: (r, d) => {
      journal.emit({ type: "chain.tx", data: { kind: r.kind, from: d.from, to: d.to, amount: d.amount, hash: r.hash, explorerUrl: r.explorerUrl } });
    },
    onWarning: (code, message) => warn(code, message),
  });
  const emitChainTx = chain.info().kind === "mock";

  // Cerveau : plafonds USD globaux (clé de plateforme = crédit réel). On ne passe que les valeurs définies (défauts du cerveau sinon).
  const guardrails: Partial<Guardrails> = {};
  if (config.nearai.maxUsdPerRun !== undefined) guardrails.maxUsdPerRun = config.nearai.maxUsdPerRun;
  if (config.nearai.maxUsdPerHour !== undefined) guardrails.maxUsdPerHour = config.nearai.maxUsdPerHour;
  if (config.mode === "testnet" && config.brain === "mock" && !config.nearai.apiKey) {
    warn("BRAIN_NO_KEY", "NEARAI_API_KEY absente : cerveau mock (IA simulée, appels étiquetés mock)");
  }
  // Budget IA global atteint : arrêt propre de la simulation (le moteur finit son tick, règle les dettes, émet sim.stopped).
  let stopEngine: (() => void) | undefined;
  const brain = opts.brain ?? createBrain(config, {
    onWarning: (w) => warn(w.code, w.message), guardrails,
    onBudgetExhausted: (i) => {
      warn("BRAIN_BUDGET_STOP", `budget IA atteint (${i.spentEur.toFixed(2)} EUR, arrêt à ${i.stopEur} EUR) : arrêt propre de la simulation`);
      setImmediate(() => stopEngine?.());
    },
  });

  const deps: Deps = { config, chain, brain, journal, rng: createRng(config.seed), now };
  const market = createMarket(deps, { taskSeqStart: idOffset("DARWIN_TASK_SEQ_START", chain.info().kind, 10, now), fundingMargin: chain.info().kind === "mock" ? 0n : 200_000_000_000_000_000_000_000n });
  const engine = createEngine(deps, market, { emitChainTx, autoRun: opts.autoRun ?? true, agentSeqStart: idOffset("DARWIN_AGENT_SEQ_START", chain.info().kind, 0.25, now) });
  stopEngine = () => { void engine.stop().catch(() => {}); };

  // Index des offres (le journal fait foi pour l'historique).
  const bids = new Map<string, Bid[]>();
  let dirty = false;
  journal.subscribe((e) => {
    dirty = true;
    if (e.type === "bid.placed") {
      const list = bids.get(e.data.bid.taskId) ?? [];
      list.push(e.data.bid);
      bids.set(e.data.bid.taskId, list);
    }
  });

  const snapshot = () => {
    if (!store || !dirty) return;
    dirty = false;
    store.writeSnapshot(engine.getState());
  };
  const timer = store ? setInterval(snapshot, opts.snapshotEveryMs ?? 2000) : undefined;
  timer?.unref();

  const startedAt = now().toISOString();
  let down = false;
  return {
    config, journal, chain, brain, market, engine, startedAt, version: readVersion(),
    bidsOf: (taskId) => bids.get(taskId) ?? [],
    escrowMode: () => (chain instanceof NearChain && chain.mode === "contract" ? "contract" : "operator-account"),
    async checkReady() {
      if (chain instanceof NearChain) {
        try {
          await chain.checkReady();
        } catch (e) {
          throw new Error(`Démarrage testnet impossible : ${safeErrorMessage(e)}`);
        }
      }
    },
    async startSim() {
      await engine.start();
    },
    async shutdown() {
      if (down) return;
      down = true;
      if (timer) clearInterval(timer);
      try {
        if (engine.getState().running) await engine.stop();
      } catch (e) {
        log(`arrêt du moteur : ${safeErrorMessage(e)}`);
      }
      dirty = true;
      snapshot();
    },
  };
}
