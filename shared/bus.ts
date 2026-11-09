// Journal d'événements : append-only, numéroté, avec abonnement. Implémentation en mémoire ;
// dev-backend ajoute la persistance JSONL (data/journal.jsonl) via `onAppend` et le SSE via `subscribe`.
import type { DarwinEvent, EventInput, EventType } from "./events.ts";

export interface Journal {
  /** Ajoute un événement, lui donne seq/ts/tick, notifie les abonnés, le renvoie. */
  emit<T extends EventType>(e: EventInput<T>): DarwinEvent<T>;
  /** Événements avec seq > sinceSeq (rejeu SSE / reconnexion). */
  since(sinceSeq: number, limit?: number): DarwinEvent[];
  subscribe(fn: (e: DarwinEvent) => void): () => void;
  readonly lastSeq: number;
  /** Tick courant utilisé quand l'appelant n'en fournit pas. */
  setTick(tick: number): void;
}

export function createJournal(opts?: { now?: () => Date; onAppend?: (e: DarwinEvent) => void; startSeq?: number }): Journal {
  const now = opts?.now ?? (() => new Date());
  const events: DarwinEvent[] = [];
  const subs = new Set<(e: DarwinEvent) => void>();
  let seq = opts?.startSeq ?? 0;
  let tick = 0;
  return {
    emit(e) {
      const ev = { seq: ++seq, ts: now().toISOString(), tick: e.tick ?? tick, type: e.type, data: e.data } as DarwinEvent;
      events.push(ev);
      opts?.onAppend?.(ev);
      for (const fn of subs) {
        try {
          fn(ev);
        } catch {
          /* un abonné défaillant ne bloque pas le journal */
        }
      }
      return ev as never;
    },
    since: (s, limit = 1000) => events.filter((e) => e.seq > s).slice(0, limit),
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    get lastSeq() {
      return seq;
    },
    setTick(t) {
      tick = t;
    },
  };
}
