// Event journal: append-only, numbered, with subscription. In-memory implementation;
// dev-backend adds JSONL persistence (data/journal.jsonl) via `onAppend` and SSE via `subscribe`.
import type { DarwinEvent, EventInput, EventType } from "./events.ts";

export interface Journal {
  /** Appends an event, gives it seq/ts/tick, notifies subscribers, returns it. */
  emit<T extends EventType>(e: EventInput<T>): DarwinEvent<T>;
  /** Events with seq > sinceSeq (SSE replay / reconnection). */
  since(sinceSeq: number, limit?: number): DarwinEvent[];
  subscribe(fn: (e: DarwinEvent) => void): () => void;
  readonly lastSeq: number;
  /** Current tick used when the caller does not supply one. */
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
          /* a failing subscriber does not block the journal */
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
