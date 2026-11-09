// Persistance dans data/ (D-010, ARCHITECTURE §2) : journal JSONL append-only, instantané d'état, lignées.
// V1 : la simulation repart de zéro à chaque lancement ; les fichiers du lancement précédent sont conservés en `*.prev.*`.
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Agent, DarwinEvent, SimState } from "../shared/index.ts";
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
