// Replay mode startup: `npm run replay`. Variables: DARWIN_REPLAY_FILE (default docs/preuves/run8-journal.jsonl),
// DARWIN_REPLAY_SPEED (default 5), DARWIN_REPLAY_LOOP (1 = restart after a pause), DARWIN_REPLAY_MAX_GAP_MS, DARWIN_REPLAY_LABEL.
// No key is read: secret variables are removed from the environment passed to loadConfig.
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

/** Replay environment: mock forced, no secret. */
export function replayEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env, DARWIN_MODE: "mock", DARWIN_CHAIN: "mock", DARWIN_BRAIN: "mock" };
  for (const k of Object.keys(out)) if (/(PRIVATE_KEY|API_KEY|JWT|SECRET)$/i.test(k)) delete out[k];
  return out;
}

/** Error message if DARWIN_REPLAY_CONTROL=locked is requested without DARWIN_ADMIN_TOKEN, otherwise undefined. */
export function replayControlError(env: NodeJS.ProcessEnv, adminToken: string | undefined): string | undefined {
  const locked = /^locked$/i.test((env.DARWIN_REPLAY_CONTROL ?? "").trim());
  return locked && !adminToken
    ? "DARWIN_REPLAY_CONTROL=locked requires DARWIN_ADMIN_TOKEN (24 characters or more): without a token the control would stay open. Set the token, or empty DARWIN_REPLAY_CONTROL."
    : undefined;
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
    // Fail closed: "locked" without a token would leave the control open (the admin guard lets everything through without a token).
    const err = replayControlError(env, config.server.adminToken);
    if (err) throw new ReplayError("REPLAY_FILE_INVALID", err);
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
  const locked = /^locked$/i.test((env.DARWIN_REPLAY_CONTROL ?? "").trim());
  const app = createApp(rt, { replayControl: locked ? "locked" : "open" });
  const { host, port } = config.server;
  const server = await new Promise<Server>((res, rej) => {
    const s = serve({ fetch: app.fetch, hostname: host, port }, () => res(s as Server));
    s.once("error", rej);
  }).catch((e: NodeJS.ErrnoException) => fail(e.code === "EADDRINUSE" ? `port ${port} already in use (change PORT)` : safeErrorMessage(e)));

  const st = replay.status();
  say(`Darwin ${rt.version}: REPLAY MODE (${st.meta.events} events from ${st.meta.file}, recorded on ${st.meta.recordedOn}, speed x${st.speed}${st.loop ? ", looping" : ""})`);
  say("no key, no NEAR network, no AI call: read-only");
  say(`listening on http://${host}:${port}  (stream: /api/stream, control: /api/replay)`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    say(`${signal} received: shutting down...`);
    server.closeAllConnections?.();
    await rt.shutdown();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  await rt.startSim();
  say(locked
    ? "replay control locked (DARWIN_REPLAY_CONTROL=locked): admin token required"
    : "replay control (speed, pause) open to any visitor: shared speed; for a public demo, DARWIN_REPLAY_CONTROL=locked");
  say("replay started");
}
