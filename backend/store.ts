// Persistence in data/ (D-010, ARCHITECTURE §2): append-only JSONL journal, state snapshot, lineages.
// V1: the simulation restarts from zero on each launch; files from the previous launch are kept as `*.prev.*`.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { PROFESSIONS, type Agent, type DarwinEvent, type Deliverable, type SimState } from "../shared/index.ts";
import { redactText } from "./redact.ts";

export interface LineageNode {
  id: string;
  parentId: string | null;
  generation: number;
  status: Agent["status"];
  name: string;
  profession: string;
  model: string;
  birthTick: number;
  deathTick?: number;
  causeOfDeath?: Agent["causeOfDeath"];
  balance: string;
  childrenIds: string[];
}

export function buildLineage(agents: readonly Agent[]): LineageNode[] {
  return agents.map((a) => ({
    id: a.id, parentId: a.parentId, generation: a.generation, status: a.status, name: a.name,
    profession: a.genome.profession, model: a.genome.model, birthTick: a.birthTick, deathTick: a.deathTick,
    causeOfDeath: a.causeOfDeath, balance: a.balance, childrenIds: a.childrenIds,
  }));
}

export interface Store {
  readonly dir: string;
  appendEvent(e: DarwinEvent): void;
  writeSnapshot(state: SimState): void;
  /** L16: writes `deliverables/<taskId>/<file>` + `meta.json` (never outside the data folder). */
  saveDeliverable(d: Deliverable): void;
}

/** Task ids and file names accepted on disk (anti path traversal). */
export const SAFE_TASK_ID = /^[a-z]-\d{1,9}$/;
export const SAFE_FILE_NAME = /^[a-z0-9._-]{1,64}$/;

export function createStore(dir: string, log: (msg: string) => void = () => {}): Store {
  mkdirSync(dir, { recursive: true });
  // Deliverables: those of the previous launch move to `deliverables.prev/`. The simulation restarts from zero and task ids are replayed:
  // we do not reload them (we would serve another task's deliverable).
  const delivDir = join(dir, "deliverables");
  if (existsSync(delivDir)) {
    rmSync(join(dir, "deliverables.prev"), { recursive: true, force: true });
    renameSync(delivDir, join(dir, "deliverables.prev"));
  }
  const delivRoot = resolve(delivDir) + sep;
  const journalPath = join(dir, "journal.jsonl");
  const statePath = join(dir, "state.json");
  const lineagePath = join(dir, "lineage.json");
  for (const [p, prev] of [[journalPath, "journal.prev.jsonl"], [statePath, "state.prev.json"], [lineagePath, "lineage.prev.json"]] as const) {
    if (existsSync(p)) renameSync(p, join(dir, prev));
  }
  let failed = false;
  const fail = (what: string, e: unknown) => {
    if (failed) return;
    failed = true; // a single alert; the simulation continues without persistence
    log(`persistence disabled (${what}): ${redactText(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
  };
  const atomicWrite = (path: string, data: string) => {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  };
  return {
    dir,
    appendEvent(e) {
      if (failed) return;
      try {
        appendFileSync(journalPath, redactText(JSON.stringify(e)) + "\n");
      } catch (err) {
        fail("journal", err);
      }
    },
    saveDeliverable(d) {
      if (failed) return;
      try {
        if (!SAFE_TASK_ID.test(d.taskId)) throw new Error("invalid task id");
        const taskDir = resolve(delivDir, d.taskId);
        if (!(taskDir + sep).startsWith(delivRoot)) throw new Error("path outside the data folder");
        mkdirSync(taskDir, { recursive: true });
        for (const f of d.files) {
          if (!SAFE_FILE_NAME.test(f.name) || f.name === "meta.json") throw new Error("invalid file name");
          writeFileSync(join(taskDir, f.name), f.content);
        }
        const { files, rawText: _raw, ...meta } = d;
        const listed = files.map((f) => ({ name: f.name, mime: f.mime, bytes: Buffer.byteLength(f.content) }));
        writeFileSync(join(taskDir, "meta.json"), JSON.stringify({ ...meta, files: listed }, null, 2));
      } catch (err) {
        fail("deliverables", err);
      }
    },
    writeSnapshot(state) {
      if (failed) return;
      try {
        atomicWrite(statePath, JSON.stringify(state));
        atomicWrite(lineagePath, JSON.stringify({ generations: state.generations, nodes: buildLineage(state.agents) }));
      } catch (err) {
        fail("state", err);
      }
    },
  };
}

/** Error reading back a saved state (message for the operator, no secret). */
export class SavedStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedStateError";
  }
}

/**
  * Reads back a `state.json` / `state.prev.json`. L16: the profession catalogue changed (writer, translator, summarizer, analyst, coder
  * removed in favour of logo, finance, architecture, marketing, translation, legal). A state containing old professions is REJECTED with a
  * clear message (no migration: an old "writer" has no faithful equivalent). V1 restarts from zero on each launch (D-010).
 */
export function loadSavedState(path: string): SimState {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new SavedStateError(`saved state unreadable (${path}): ${redactText(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
  }
  const agents = (raw as { agents?: unknown } | null)?.agents;
  if (!Array.isArray(agents)) throw new SavedStateError(`saved state invalid (${path}): "agents" field missing`);
  const legacy = new Set<string>();
  for (const a of agents as { genome?: { profession?: unknown } }[]) {
    const p = a?.genome?.profession;
    if (typeof p !== "string" || !(PROFESSIONS as readonly string[]).includes(p)) legacy.add(String(p));
  }
  if (legacy.size > 0) {
    throw new SavedStateError(
      `saved state incompatible (${path}): obsolete professions [${[...legacy].join(", ")}]. Current professions: ${PROFESSIONS.join(", ")}. ` +
        "Delete this file and start a fresh simulation.",
    );
  }
  return raw as SimState;
}
