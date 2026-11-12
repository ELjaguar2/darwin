// Flux temps réel SSE (D-008). Format de chaque message : `id: <seq>`, `event: <type>`, `data: <DarwinEvent JSON>`.
// Reprise : en-tête `Last-Event-ID` (ou `?since=<seq>`). Commentaire `: ping` toutes les 15 s.
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { DarwinEvent, Journal } from "../shared/index.ts";

export const PING_MS = 15_000;
/** Au-delà, le client est trop lent : on ferme, il reprend avec Last-Event-ID. */
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
      // On s'abonne AVANT le rejeu : rien ne se perd, les doublons sont écartés par `lastSent`.
      const unsubscribe = journal.subscribe((ev) => {
        if (queue.length >= MAX_QUEUE) return stop();
        queue.push(ev);
        wake?.();
      });
      // Replay (L17) : le rejeu repart de zéro ; le client vide son affichage puis reçoit les événements depuis seq 1.
      const unsubReset = journal.subscribeReset?.(() => {
        queue.length = 0;
        queue.push("reset");
        wake?.();
      });
      try {
        await stream.write("retry: 3000\n\n");
        if (since > journal.lastSeq) {
          // Le serveur a redémarré (la simulation repart de zéro) : l'identifiant du client ne correspond plus à rien.
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
