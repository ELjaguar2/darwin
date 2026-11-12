// SSE real-time stream (D-008). Format of each message: `id: <seq>`, `event: <type>`, `data: <DarwinEvent JSON>`.
// Resume: `Last-Event-ID` header (or `?since=<seq>`). `: ping` comment every 15 s.
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { DarwinEvent, Journal } from "../shared/index.ts";

export const PING_MS = 15_000;
/** Beyond this, the client is too slow: we close, it resumes with Last-Event-ID. */
const MAX_QUEUE = 5_000;

export function parseSince(v: string | undefined): number {
  if (v === undefined || !/^\d{1,15}$/.test(v.trim())) return 0;
  return Number(v.trim());
}

export function sseHandler(journal: Journal & { subscribeReset?: (fn: () => void) => () => void }, opts: { pingMs?: number; onOpen?: () => () => void } = {}) {
  const pingMs = opts.pingMs ?? PING_MS;
  return (c: Context) => {
    const close = opts.onOpen?.();
    let since = parseSince(c.req.header("last-event-id") ?? c.req.query("since"));
    c.header("X-Accel-Buffering", "no");
    return streamSSE(c, async (stream) => {
      const queue: (DarwinEvent | "reset")[] = [];
      let closed = false;
      let wake: (() => void) | undefined;
      const stop = () => {
        closed = true;
        wake?.();
      };
      stream.onAbort(stop);
      // We subscribe BEFORE the replay: nothing is lost, duplicates are dropped via `lastSent`.
      const unsubscribe = journal.subscribe((ev) => {
        if (queue.length >= MAX_QUEUE) return stop();
        queue.push(ev);
        wake?.();
      });
      // Replay (L17): the replay restarts from zero; the client clears its display then receives events from seq 1.
      const unsubReset = journal.subscribeReset?.(() => {
        queue.length = 0;
        queue.push("reset");
        wake?.();
      });
      try {
        await stream.write("retry: 3000\n\n");
        if (since > journal.lastSeq) {
          // The server restarted (the simulation restarts from zero): the client's id no longer matches anything.
          await stream.writeSSE({ event: "reset", data: JSON.stringify({ lastSeq: journal.lastSeq }) });
          since = 0;
        }
        let lastSent = since;
        const resetNow = async () => {
          lastSent = 0;
          await stream.writeSSE({ event: "reset", data: JSON.stringify({ lastSeq: 0 }) });
        };
        const send = async (ev: DarwinEvent) => {
          if (ev.seq <= lastSent) return;
          lastSent = ev.seq;
          await stream.writeSSE({ id: String(ev.seq), event: ev.type, data: JSON.stringify(ev) });
        };
        for (const ev of journal.since(since, 1_000_000)) await send(ev);
        while (!closed) {
          while (queue.length && !closed) {
            const item = queue.shift()!;
            if (item === "reset") await resetNow();
            else await send(item);
          }
          if (closed) break;
          const woke = await new Promise<boolean>((resolve) => {
            const t = setTimeout(() => resolve(false), pingMs);
            wake = () => {
              clearTimeout(t);
              resolve(true);
            };
          });
          wake = undefined;
          if (!woke && !closed) await stream.write(": ping\n\n");
        }
      } catch {
        /* client parti : on nettoie simplement */
      } finally {
        unsubscribe();
        unsubReset?.();
        close?.();
      }
    });
  };
}
