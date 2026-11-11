// Démarrage du mode replay : `npm run replay`. Variables : DARWIN_REPLAY_FILE (défaut docs/preuves/run8-journal.jsonl),
// DARWIN_REPLAY_SPEED (défaut 5), DARWIN_REPLAY_LOOP (1 = recommence après une pause), DARWIN_REPLAY_MAX_GAP_MS, DARWIN_REPLAY_LABEL.
// Aucune clé n'est lue : les variables de secrets sont retirées de l'environnement passé à loadConfig.
import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../shared/index.ts";
import { assertSafeBinding, createApp } from "./app.ts";
import { safeErrorMessage } from "./redact.ts";
import { ReplayError, createReplay, loadReplayFile, parseSpeed, DEFAULT_MAX_GAP_MS } from "./replay.ts";
import { createReplayRuntime } from "./replay-runtime.ts";

export const DEFAULT_REPLAY_FILE = fileURLToPath(new URL("../docs/preuves/run8-journal.jsonl", import.meta.url));

/** Environnement du rejeu : mock forcé, aucun secret. */
export function replayEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env, DARWIN_MODE: "mock", DARWIN_CHAIN: "mock", DARWIN_BRAIN: "mock" };
  for (const k of Object.keys(out)) if (/(PRIVATE_KEY|API_KEY|JWT|SECRET)$/i.test(k)) delete out[k];
  return out;
}

const truthy = (v: string | undefined) => /^(1|true|yes|oui|on)$/i.test((v ?? "").trim());

export async function runReplayMode(io: { say: (m: string) => void; fail: (m: string, code?: number) => never }): Promise<void> {
  const { say, fail } = io;
  const env = process.env;
  let replay;
  let config;
  try {
    config = loadConfig(replayEnv(env));
    assertSafeBinding(config.server.host, config.server.adminToken);
    const file = resolve(env.DARWIN_REPLAY_FILE?.trim() || DEFAULT_REPLAY_FILE);
    const parsed = loadReplayFile(file);
    if (env.DARWIN_REPLAY_LABEL?.trim()) parsed.meta.label = env.DARWIN_REPLAY_LABEL.trim().slice(0, 200);
    const gap = env.DARWIN_REPLAY_MAX_GAP_MS?.trim();
    replay = createReplay(parsed, {
      speed: parseSpeed(env.DARWIN_REPLAY_SPEED?.trim() || 5),
      loop: truthy(env.DARWIN_REPLAY_LOOP),
      maxGapMs: gap && Number(gap) >= 0 ? Number(gap) : DEFAULT_MAX_GAP_MS,
      autoStart: false,
    });
  } catch (e) {
    return fail(e instanceof ReplayError ? e.message : safeErrorMessage(e), 2);
  }
  const rt = createReplayRuntime(config, replay);
  const app = createApp(rt);
  const { host, port } = config.server;
  const server = await new Promise<Server>((res, rej) => {
    const s = serve({ fetch: app.fetch, hostname: host, port }, () => res(s as Server));
    s.once("error", rej);
  }).catch((e: NodeJS.ErrnoException) => fail(e.code === "EADDRINUSE" ? `port ${port} déjà utilisé (changez PORT)` : safeErrorMessage(e)));

  const st = replay.status();
  say(`Darwin ${rt.version} : MODE REPLAY (${st.meta.events} événements de ${st.meta.file}, enregistrés le ${st.meta.recordedOn}, vitesse x${st.speed}${st.loop ? ", en boucle" : ""})`);
  say("aucune clé, aucun réseau NEAR, aucun appel IA : lecture seule");
  say(`écoute sur http://${host}:${port}  (flux : /api/stream, contrôle : /api/replay)`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    say(`${signal} reçu : arrêt...`);
    server.closeAllConnections?.();
    await rt.shutdown();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  await rt.startSim();
  say("rejeu démarré");
}
