// Contrats entre modules (en plus de Chain/Brain). Chaque module exporte une fabrique `createX(deps)` qui renvoie ces interfaces.
// Frontières : engine -> market -> chain ; engine -> brain ; backend compose le tout. Voir docs/ARCHITECTURE.md §4.
import type { Journal } from "./bus.ts";
import type { Brain } from "./brain.ts";
import type { Chain } from "./chain.ts";
import type { Config } from "./config.ts";
import type { Yocto } from "./money.ts";
import type { Rng } from "./rng.ts";
import type { Agent, Bid, Letter, Profession, Requester, Task, Validation } from "./types.ts";

/** Dépendances injectées partout (aucun module ne construit lui-même Chain, Brain, Journal ni ne lit process.env). */
export interface Deps {
  config: Config;
  chain: Chain;
  brain: Brain;
  journal: Journal;
  rng: Rng;
  now: () => Date;
}

/** Marché des tâches (dev-marche, dossier market/). Lui seul parle au séquestre et à la réputation. */
export interface Market {
  /** Publie une tâche et ouvre les enchères. Les fonds du payeur sont verrouillés à l'attribution (lockEscrow). */
  postTask(input: { requester: Requester; profession: Profession; title: string; prompt: string; budget: Yocto; parentTaskId?: string }): Promise<Task>;
  placeBid(input: { taskId: string; agentId: string; price: Yocto; etaTicks: number; pitch?: string }): Promise<Bid>;
  /** Avance le marché d'un tick : clôture les enchères (attribue au meilleur prix/réputation), verrouille le séquestre, expire. */
  step(tick: number): Promise<void>;
  /** Remet le résultat du gagnant ; déclenche validation puis libération (avec preuve) ou remboursement. */
  submitResult(input: { taskId: string; agentId: string; text: string }): Promise<{ task: Task; validation: Validation }>;
  getTask(id: string): Task | undefined;
  listTasks(filter?: { status?: Task["status"]; profession?: Profession }): Task[];
  /** Tâches ouvertes aux offres pour une profession. */
  openTasks(profession?: Profession): Task[];
}

/** Instantané complet servi par GET /api/state (l'UI s'y initialise puis suit le flux SSE). */
export interface SimState {
  running: boolean;
  paused: boolean;
  tick: number;
  startedAt?: string;
  mode: "mock" | "testnet";
  chain: { kind: "mock" | "near"; masterId: string; contractId?: string };
  brain: { kind: "mock" | "nearai" };
  generations: number; // plus haute génération atteinte
  agents: Agent[]; // vivants et morts
  tasks: Task[]; // les N dernières
  letters: Letter[];
  lastSeq: number; // dernier événement pris en compte (pour reprendre le SSE sans trou)
  totals: { alive: number; dead: number; born: number; tasksSettled: number; totalBalance: Yocto };
}

/** Moteur d'évolution (dev-moteur-evolution, dossier engine/) : boucle de ticks, cycle de vie, économie des agents. */
export interface Engine {
  start(): Promise<void>; // crée les fondateurs puis lance la boucle (période config.sim.tickMs)
  pause(): void;
  resume(): void;
  stop(reason?: "manual"): Promise<void>;
  /** Exécute exactement un tick (utilisé par les tests : simulation sans horloge). */
  tick(): Promise<void>;
  getState(): SimState;
  getAgent(id: string): Agent | undefined;
  getLetter(id: string): Letter | undefined;
}

/** Module Intents (dev-intents, dossier intents/). V2 : jamais d'appel `dry:false` sans feu vert écrit. */
export interface Intents {
  readonly enabled: boolean;
  /** Seul appel autorisé par défaut : devis `dry:true`, aucune dépense. */
  quoteDry(input: { originAsset: string; destinationAsset: string; amountIn: string }): Promise<{ amountOut?: string; raw: unknown }>;
}
