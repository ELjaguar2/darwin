// Mode REPLAY (L17) : relit un journal de run réel (JSONL {seq,ts,tick,type,data}) et réémet ses événements dans le même flux
// SSE que le mode live, à vitesse réglable. Aucune chaîne, aucune IA, aucune clé : le seul effet est de lire un fichier.
// Le rejeu n'invente rien : l'état servi (/api/state, /api/tasks...) est la réduction des événements DÉJÀ émis, donc un client
// qui se connecte en cours de route voit exactement ce que voit un client présent depuis le début.
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { EVENT_TYPES, type Agent, type Bid, type DarwinEvent, type Deliverable, type Escrow, type EventCatalog, type Journal, type Letter, type MarketEvent, type SimState, type Task } from "../shared/index.ts";
import { redactText } from "./redact.ts";

export class ReplayError extends Error {
  constructor(public code: "REPLAY_FILE_MISSING" | "REPLAY_FILE_UNREADABLE" | "REPLAY_FILE_EMPTY" | "REPLAY_FILE_TOO_BIG" | "REPLAY_FILE_INVALID" | "REPLAY_BAD_SPEED", message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

export const MAX_REPLAY_BYTES = 200 * 1024 * 1024;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 100;
/** Un silence plus long que ceci dans le journal d'origine est raccourci à cette valeur (avant division par la vitesse). */
export const DEFAULT_MAX_GAP_MS = 8_000;

const KNOWN = new Set<string>(EVENT_TYPES);

export interface ReplayMeta {
  /** Nom du fichier (sans dossier). */
  file: string;
  events: number;
  /** Premier et dernier horodatage du journal d'origine (ISO). */
  startedAt: string;
  endedAt: string;
  /** Date UTC de l'enregistrement, `YYYY-MM-DD` (lue du premier événement, jamais codée en dur). */
  recordedOn: string;
  /** Durée réelle du run d'origine, en ms. */
  originalDurationMs: number;
  ticks: number;
  /** Lignes écartées (type inconnu) et renumérotation éventuelle : transparence sur la lecture du fichier. */
  skipped: number;
  renumbered: boolean;
  /** Valeurs de l'événement `sim.started` d'origine. */
  recorded: { mode?: string; preset?: string; chain?: string; brain?: string; seed?: number };
  /** Libellé facultatif imposé par l'opérateur (DARWIN_REPLAY_LABEL). */
  label?: string;
}

export interface ParsedReplay {
  events: DarwinEvent[];
  meta: ReplayMeta;
}

const fail = (code: ConstructorParameters<typeof ReplayError>[0], msg: string): never => {
  throw new ReplayError(code, msg);
};

/** Valide et normalise un journal JSONL. Erreurs : numéro de ligne et cause, jamais de contenu du fichier. */
export function parseReplay(text: string, fileName: string): ParsedReplay {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const events: DarwinEvent[] = [];
  let skipped = 0;
  let lastNonEmpty = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i]!.trim()) { lastNonEmpty = i; break; }
  let renumbered = false;
  let prevMs = -Infinity;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw) continue;
    const at = `${fileName}, ligne ${i + 1}`;
    let o: any;
    try {
      o = JSON.parse(raw);
    } catch {
      // dernière ligne tronquée (arrêt brutal pendant l'écriture) : tolérée ; ailleurs, le fichier est corrompu.
      if (i === lastNonEmpty && events.length > 0) { skipped++; continue; }
      return fail("REPLAY_FILE_INVALID", `journal invalide (${at}) : JSON illisible. Attendu : une ligne JSON {seq,ts,tick,type,data} par événement.`);
    }
    if (typeof o !== "object" || o === null || Array.isArray(o)) return fail("REPLAY_FILE_INVALID", `journal invalide (${at}) : objet JSON attendu.`);
    if (typeof o.type !== "string") return fail("REPLAY_FILE_INVALID", `journal invalide (${at}) : champ « type » manquant.`);
    const ms = typeof o.ts === "string" ? Date.parse(o.ts) : NaN;
    if (!Number.isFinite(ms)) return fail("REPLAY_FILE_INVALID", `journal invalide (${at}) : champ « ts » absent ou pas une date ISO.`);
    if (ms < prevMs) return fail("REPLAY_FILE_INVALID", `journal invalide (${at}) : horodatage antérieur à la ligne précédente.`);
    if (typeof o.tick !== "number" || !Number.isFinite(o.tick) || o.tick < 0) return fail("REPLAY_FILE_INVALID", `journal invalide (${at}) : champ « tick » absent ou invalide.`);
    if (o.data === undefined || o.data === null || typeof o.data !== "object" || Array.isArray(o.data)) return fail("REPLAY_FILE_INVALID", `journal invalide (${at}) : champ « data » (objet) manquant.`);
    if (!KNOWN.has(o.type)) { skipped++; continue; }
    prevMs = ms;
    const seq = events.length + 1;
    if (o.seq !== seq) renumbered = true; // le flux exige des seq sans trou (le frontend se resynchronise sinon)
    events.push({ seq, ts: o.ts, tick: o.tick, type: o.type, data: o.data } as DarwinEvent);
  }
  if (!events.length) return fail("REPLAY_FILE_EMPTY", `journal vide ou sans événement reconnu (${fileName}).`);
  const first = events[0]!;
  const last = events[events.length - 1]!;
  const started = events.find((e) => e.type === "sim.started") as DarwinEvent<"sim.started"> | undefined;
  const meta: ReplayMeta = {
    file: fileName,
    events: events.length,
    startedAt: first.ts,
    endedAt: last.ts,
    recordedOn: new Date(Date.parse(first.ts)).toISOString().slice(0, 10),
    originalDurationMs: Date.parse(last.ts) - Date.parse(first.ts),
    ticks: Math.max(...events.map((e) => e.tick)),
    skipped,
    renumbered,
    recorded: started ? { mode: started.data.mode, preset: started.data.preset, chain: started.data.chain, brain: started.data.brain, seed: started.data.seed } : {},
  };
  return { events, meta };
}

export function loadReplayFile(path: string): ParsedReplay {
  let size: number;
  try {
    size = statSync(path).size;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fail("REPLAY_FILE_MISSING", `journal de rejeu introuvable : ${path} (variable DARWIN_REPLAY_FILE).`);
    return fail("REPLAY_FILE_UNREADABLE", `journal de rejeu illisible : ${path}.`);
  }
  if (size > MAX_REPLAY_BYTES) return fail("REPLAY_FILE_TOO_BIG", `journal de rejeu trop gros (${size} octets, maximum ${MAX_REPLAY_BYTES}).`);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return fail("REPLAY_FILE_UNREADABLE", `journal de rejeu illisible : ${path} (est-ce un fichier ?).`);
  }
  return parseReplay(text, basename(path));
}

export function parseSpeed(v: unknown): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(/^x/i, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < MIN_SPEED || n > MAX_SPEED)
    return fail("REPLAY_BAD_SPEED", `vitesse de rejeu invalide (${String(v).slice(0, 20)}) : un nombre entre ${MIN_SPEED} et ${MAX_SPEED} (ex. 1, 5, 20).`);
  return n;
}

// ---------------------------------------------------------------------------------------------------------------------
// Réduction des événements émis -> état servi par l'API (présentation : aucune règle de moteur ni de marché ici).
// ---------------------------------------------------------------------------------------------------------------------

const MAX_TASKS = 200;
const big = (v: unknown): bigint => {
  try {
    return BigInt(v as string);
  } catch {
    return 0n;
  }
};

export interface MissionEvent { seq: number; ts: string; tick: number; type: string }
export interface Mission { taskId: string; title: string; profession: string; requester: string; status: string; events: MissionEvent[] }

export class ReplayState {
  tick = 0;
  running = false;
  paused = false;
  startedAt: string | undefined;
  recordedMode: string | undefined;
  lastSeq = 0;
  generations = 0;
  readonly agents = new Map<string, Agent>();
  readonly tasks = new Map<string, Task>();
  readonly letters = new Map<string, Letter>();
  readonly bids = new Map<string, Bid[]>();
  readonly escrows = new Map<string, Escrow>();
  readonly deliverables = new Map<string, Deliverable>();
  readonly deliverableMeta = new Map<string, EventCatalog["deliverable.produced"]>();
  readonly marketEvents = new Map<string, MarketEvent>();
  readonly missions = new Map<string, Mission>();
  population: EventCatalog["population.snapshot"] | undefined;
  tasksSettled = 0;

  private mission(taskId: string, ev: DarwinEvent) {
    const m = this.missions.get(taskId);
    if (m) m.events.push({ seq: ev.seq, ts: ev.ts, tick: ev.tick, type: ev.type });
    return m;
  }

  apply(ev: DarwinEvent): void {
    this.lastSeq = ev.seq;
    this.tick = Math.max(this.tick, ev.tick);
    const d = ev.data as any;
    const task = (id: string) => this.tasks.get(id);
    switch (ev.type) {
      case "sim.started": this.running = true; this.paused = false; this.startedAt = ev.ts; this.recordedMode = d.mode; break;
      case "sim.paused": this.paused = true; break;
      case "sim.resumed": this.paused = false; break;
      case "sim.stopped": this.running = false; this.generations = Math.max(this.generations, d.generations ?? 0); break;
      case "agent.born": {
        const a = structuredClone(d.agent) as Agent;
        a.childrenIds = a.childrenIds ?? [];
        this.agents.set(a.id, a);
        this.generations = Math.max(this.generations, a.generation);
        const p = d.parentId ? this.agents.get(d.parentId) : undefined;
        if (p && !p.childrenIds.includes(a.id)) p.childrenIds.push(a.id);
        break;
      }
      case "agent.reproduced": { const p = this.agents.get(d.parentId); if (p) (p as any).lastReproTick = ev.tick; break; }
      case "agent.died": {
        const a = this.agents.get(d.agentId);
        if (a) { a.status = "dead"; a.causeOfDeath = d.cause; a.deathTick = ev.tick; a.diedAt = ev.ts; a.balance = "0"; }
        break;
      }
      case "letter.written": {
        const l = structuredClone(d.letter) as Letter;
        this.letters.set(l.id, l);
        const c = this.agents.get(l.toAgentId);
        if (c) c.letterId = l.id;
        break;
      }
      case "balance.changed": { const a = this.agents.get(d.agentId); if (a) a.balance = d.balance; break; }
      case "brain.charged": { const a = this.agents.get(d.agentId); if (a) a.spentBrain = (big(a.spentBrain) + big(d.cost)).toString(); break; }
      case "reputation.updated": {
        const a = this.agents.get(d.agentId);
        if (a) a.reputation = d.total;
        if (d.taskId) this.mission(d.taskId, ev);
        break;
      }
      case "task.posted": {
        const t = structuredClone(d.task) as Task;
        t.bidIds = t.bidIds ?? [];
        this.tasks.set(t.id, t);
        if (this.tasks.size > MAX_TASKS) {
          const k = this.tasks.keys().next().value as string;
          this.tasks.delete(k); this.bids.delete(k); this.escrows.delete(k);
        }
        if (t.requester.kind === "visitor") {
          this.missions.set(t.id, { taskId: t.id, title: t.title, profession: t.profession, requester: t.requester.label, status: t.status, events: [] });
          this.mission(t.id, ev);
        }
        break;
      }
      case "bid.placed": {
        const b = structuredClone(d.bid) as Bid;
        const list = this.bids.get(b.taskId) ?? [];
        list.push(b);
        this.bids.set(b.taskId, list);
        const t = task(b.taskId);
        if (t && !t.bidIds.includes(b.id)) t.bidIds.push(b.id);
        this.mission(b.taskId, ev);
        break;
      }
      case "task.awarded": {
        const t = task(d.taskId);
        if (t) { t.status = "awarded"; t.winnerId = d.winnerId; t.winningBidId = d.bidId; }
        const b = this.bids.get(d.taskId)?.find((x) => x.id === d.bidId);
        if (b) b.won = true;
        this.mission(d.taskId, ev);
        break;
      }
      case "task.expired": { const t = task(d.taskId); if (t) t.status = "expired"; this.mission(d.taskId, ev); break; }
      case "escrow.locked": {
        const t = task(d.taskId);
        if (t) t.escrowId = d.taskId;
        this.escrows.set(d.taskId, { id: d.taskId, taskId: d.taskId, payer: d.payer, amount: d.amount, status: "locked", lockTx: d.tx });
        this.mission(d.taskId, ev);
        break;
      }
      case "task.submitted": {
        const t = task(d.taskId);
        if (t) { t.status = "submitted"; t.result = { text: "", resultHash: d.resultHash, submittedTick: ev.tick }; }
        this.mission(d.taskId, ev);
        break;
      }
      case "task.validated": { const t = task(d.taskId); if (t) t.validation = structuredClone(d.validation); this.mission(d.taskId, ev); break; }
      case "escrow.released": {
        const t = task(d.taskId);
        if (t) t.status = "settled";
        const e = this.escrows.get(d.taskId);
        if (e) { e.status = "released"; e.payee = d.payee; e.settleTx = d.tx; }
        for (const a of this.agents.values()) if (a.accountId === d.payee) { a.tasksDone += 1; a.earned = (big(a.earned) + big(d.amount)).toString(); }
        this.tasksSettled++;
        this.mission(d.taskId, ev);
        break;
      }
      case "escrow.refunded": {
        const t = task(d.taskId);
        if (t && t.status !== "expired") t.status = "rejected";
        const e = this.escrows.get(d.taskId);
        if (e) { e.status = "refunded"; e.settleTx = d.tx; }
        this.mission(d.taskId, ev);
        break;
      }
      case "deliverable.produced": {
        this.deliverableMeta.set(d.taskId, d);
        // Un journal plus riche peut embarquer le contenu des fichiers (champ `content`) : alors le livrable est servi.
        if (Array.isArray(d.files) && d.files.every((f: any) => typeof f?.name === "string" && typeof f?.mime === "string" && typeof f?.content === "string")) {
          const v = task(d.taskId)?.validation;
          this.deliverables.set(d.taskId, {
            taskId: d.taskId, profession: d.profession, agentId: d.agentId, files: d.files.map((f: any) => ({ name: f.name, mime: f.mime, content: f.content })),
            rawText: "", resultHash: d.resultHash, productionCostUsd: d.productionCostUsd, judgeCostUsd: d.judgeCostUsd, createdAt: ev.ts, verdict: v?.verdict, score: v?.score,
          });
        }
        this.mission(d.taskId, ev);
        break;
      }
      case "market.event": if (d.event?.id) this.marketEvents.set(d.event.id, structuredClone(d.event)); break;
      case "population.snapshot": this.population = structuredClone(d); break;
      default: break;
    }
    if (ev.type === "task.validated" || ev.type === "escrow.released" || ev.type === "escrow.refunded" || ev.type === "task.expired" || ev.type === "task.awarded") {
      const m = this.missions.get(d.taskId);
      const t = m ? task(d.taskId) : undefined;
      if (m && t) m.status = t.status;
    }
  }

  snapshot(info: { mode: SimState["mode"]; chain: SimState["chain"]; brain: SimState["brain"] }): SimState {
    const agents = [...this.agents.values()];
    const alive = agents.filter((a) => a.status === "alive");
    const total = alive.reduce((s, a) => s + big(a.balance), 0n);
    return structuredClone({
      running: this.running, paused: this.paused, tick: this.tick, startedAt: this.startedAt,
      ...info,
      generations: this.generations,
      agents,
      tasks: [...this.tasks.values()],
      letters: [...this.letters.values()],
      lastSeq: this.lastSeq,
      totals: { alive: alive.length, dead: agents.length - alive.length, born: agents.length, tasksSettled: this.tasksSettled, totalBalance: total.toString() },
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Lecteur : horloge de rejeu, journal « émis jusqu'ici », contrôles.
// ---------------------------------------------------------------------------------------------------------------------

export type ReplayPhase = "playing" | "paused" | "ended";

export interface ReplayStatus {
  mode: "replay";
  phase: ReplayPhase;
  speed: number;
  loop: boolean;
  /** Événements déjà émis / total. */
  position: number;
  total: number;
  /** Nombre de passages complets déjà terminés. */
  rounds: number;
  maxGapMs: number;
  meta: ReplayMeta;
}

export interface ReplayJournal extends Journal {
  /** Appelé quand le rejeu repart de zéro (le flux envoie alors `event: reset` aux clients connectés). */
  subscribeReset(fn: () => void): () => void;
}

export interface ReplayOptions {
  speed?: number;
  loop?: boolean;
  maxGapMs?: number;
  /** Pause entre la fin et le nouveau départ quand `loop` (ms, non divisée par la vitesse). */
  loopPauseMs?: number;
  autoStart?: boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

export interface Replay {
  readonly journal: ReplayJournal;
  readonly state: ReplayState;
  readonly meta: ReplayMeta;
  status(): ReplayStatus;
  start(): void;
  pause(): void;
  resume(): void;
  setSpeed(v: unknown): number;
  restart(): void;
  stop(): void;
  /** Événements émis jusqu'ici (pour les tests). */
  emitted(): readonly DarwinEvent[];
}

const sanitize = (ev: DarwinEvent): DarwinEvent => {
  if (ev.type !== "system.warning" && ev.type !== "system.error") return ev;
  const d = ev.data as { code: string; message: string };
  return { ...ev, data: { ...d, message: redactText(String(d.message ?? "")) } } as DarwinEvent;
};

export function createReplay(parsed: ParsedReplay, opts: ReplayOptions = {}): Replay {
  const { events, meta } = parsed;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const maxGapMs = opts.maxGapMs ?? DEFAULT_MAX_GAP_MS;
  const loopPauseMs = opts.loopPauseMs ?? 5_000;
  let speed = parseSpeed(opts.speed ?? 5);
  const loop = opts.loop ?? false;

  let emitted: DarwinEvent[] = [];
  let state = new ReplayState();
  let phase: ReplayPhase = "paused";
  let timer: unknown;
  let rounds = 0;
  let tickHint = 0;
  const subs = new Set<(e: DarwinEvent) => void>();
  const resetSubs = new Set<() => void>();

  const journal: ReplayJournal = {
    emit() {
      throw new Error("journal en lecture seule (mode replay) : aucune écriture possible");
    },
    since: (s, limit = 1000) => emitted.slice(Math.max(0, s), Math.max(0, s) + limit),
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    get lastSeq() {
      return emitted.length;
    },
    setTick(t) {
      tickHint = t;
    },
    subscribeReset(fn) {
      resetSubs.add(fn);
      return () => resetSubs.delete(fn);
    },
  };

  const clear = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };
  const gapBefore = (i: number) => (i === 0 ? 0 : Math.min(maxGapMs, Math.max(0, Date.parse(events[i]!.ts) - Date.parse(events[i - 1]!.ts))));

  const schedule = () => {
    clear();
    if (phase !== "playing") return;
    const i = emitted.length;
    if (i >= events.length) {
      phase = "ended";
      if (loop) timer = setTimer(() => restart(), loopPauseMs);
      return;
    }
    timer = setTimer(() => {
      timer = undefined;
      if (phase !== "playing") return;
      const ev = sanitize(events[emitted.length]!);
      state.apply(ev);
      emitted.push(ev);
      tickHint = ev.tick;
      for (const fn of subs) {
        try {
          fn(ev);
        } catch {
          /* un abonné défaillant ne bloque pas le rejeu */
        }
      }
      schedule();
    }, gapBefore(i) / speed);
  };

  function restart() {
    clear();
    if (phase === "ended") rounds++;
    emitted = [];
    state = new ReplayState();
    (replay as { state: ReplayState }).state = state;
    for (const fn of resetSubs) {
      try {
        fn();
      } catch {
        /* idem */
      }
    }
    phase = "playing";
    schedule();
  }

  const replay: Replay = {
    journal,
    state,
    meta,
    status: () => ({ mode: "replay", phase, speed, loop, position: emitted.length, total: events.length, rounds, maxGapMs, meta }),
    start() {
      if (phase === "paused" && emitted.length === 0) { phase = "playing"; schedule(); }
    },
    pause() {
      if (phase !== "playing") return;
      phase = "paused";
      clear();
    },
    resume() {
      if (phase !== "paused") return;
      phase = "playing";
      schedule();
    },
    setSpeed(v) {
      speed = parseSpeed(v);
      if (phase === "playing") schedule(); // le prochain événement part avec la nouvelle vitesse
      return speed;
    },
    restart,
    stop() {
      clear();
      phase = phase === "ended" ? "ended" : "paused";
      subs.clear();
    },
    emitted: () => emitted,
  };
  void tickHint;
  if (opts.autoStart !== false) replay.start();
  return replay;
}
