// Persistance dans data/ (D-010, ARCHITECTURE §2) : journal JSONL append-only, instantané d'état, lignées.
// V1 : la simulation repart de zéro à chaque lancement ; les fichiers du lancement précédent sont conservés en `*.prev.*`.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROFESSIONS, type Agent, type DarwinEvent, type SimState } from "../shared/index.ts";
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
}

export function createStore(dir: string, log: (msg: string) => void = () => {}): Store {
  mkdirSync(dir, { recursive: true });
  const journalPath = join(dir, "journal.jsonl");
  const statePath = join(dir, "state.json");
  const lineagePath = join(dir, "lineage.json");
  for (const [p, prev] of [[journalPath, "journal.prev.jsonl"], [statePath, "state.prev.json"], [lineagePath, "lineage.prev.json"]] as const) {
    if (existsSync(p)) renameSync(p, join(dir, prev));
  }
  let failed = false;
  const fail = (what: string, e: unknown) => {
    if (failed) return;
    failed = true; // une seule alerte ; la simulation continue sans persistance
    log(`persistance désactivée (${what}) : ${redactText(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
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
    writeSnapshot(state) {
      if (failed) return;
      try {
        atomicWrite(statePath, JSON.stringify(state));
        atomicWrite(lineagePath, JSON.stringify({ generations: state.generations, nodes: buildLineage(state.agents) }));
      } catch (err) {
        fail("état", err);
      }
    },
  };
}

/** Erreur de relecture d'un état sauvegardé (message destiné à l'opérateur, sans secret). */
export class SavedStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedStateError";
  }
}

/**
 * Relit un `state.json` / `state.prev.json`. L16 : le catalogue de métiers a changé (writer, translator, summarizer, analyst, coder
 * supprimés au profit de logo, finance, architecture, marketing, translation, legal). Un état contenant d'anciens métiers est REJETÉ avec un
 * message clair (pas de migration : un ancien « writer » n'a pas d'équivalent fidèle). La V1 repart de zéro à chaque lancement (D-010).
 */
export function loadSavedState(path: string): SimState {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new SavedStateError(`état sauvegardé illisible (${path}) : ${redactText(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
  }
  const agents = (raw as { agents?: unknown } | null)?.agents;
  if (!Array.isArray(agents)) throw new SavedStateError(`état sauvegardé invalide (${path}) : champ "agents" absent`);
  const legacy = new Set<string>();
  for (const a of agents as { genome?: { profession?: unknown } }[]) {
    const p = a?.genome?.profession;
    if (typeof p !== "string" || !(PROFESSIONS as readonly string[]).includes(p)) legacy.add(String(p));
  }
  if (legacy.size > 0) {
    throw new SavedStateError(
      `état sauvegardé incompatible (${path}) : métiers obsolètes [${[...legacy].join(", ")}]. Métiers actuels : ${PROFESSIONS.join(", ")}. ` +
        "Supprimez ce fichier et relancez une simulation neuve.",
    );
  }
  return raw as SimState;
}
