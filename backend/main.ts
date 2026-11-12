// Single entry point: `npm start` (mock), `npm run start:mock`, `npm run start:demo`, `npm run start:testnet`.
// Composes chain + brain + market + engine + journal, serves the API, the SSE stream and frontend/, then runs the simulation.
import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { loadConfig } from "../shared/index.ts";
import { assertSafeBinding, createApp } from "./app.ts";
import { safeErrorMessage } from "./redact.ts";
import { createRuntime } from "./runtime.ts";
import { checkNodeVersion, checkTestnetEnv } from "./startup.ts";
import { createStore } from "./store.ts";
import { runReplayMode } from "./replay-main.ts";

const say = (msg: string) => console.log(`[darwin] ${msg}`);
const fail = (msg: string, code = 1): never => {
  console.error(`[darwin] ERROR: ${msg}`);
  process.exit(code);
};

/** Optional .env (Node >= 20.12): never overrides a variable already set in the environment. */
function loadDotEnv() {
  try {
    process.loadEnvFile(".env");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") say("unreadable .env file: ignored");
  }
}

async function main() {
  const nodeV = process.versions.node;
  const tooOld = checkNodeVersion(nodeV, "mock").error;
  if (tooOld) return fail(tooOld, 2); // before reading any configuration
  loadDotEnv();
  // L17: `npm run replay` (DARWIN_MODE=replay) replays a recorded journal: no key, no chain, no AI.
  if ((process.env.DARWIN_MODE ?? "").trim().toLowerCase() === "replay") return runReplayMode({ say, fail });
  let config;
  try {
    config = loadConfig();
    assertSafeBinding(config.server.host, config.server.adminToken); // R7: token mandatory outside 127.0.0.1
    const nv = checkNodeVersion(nodeV, config.mode);
    if (nv.error) return fail(nv.error, 2);
    if (nv.warning) console.warn(`[darwin] WARNING: ${nv.warning}`);
    const envErr = checkTestnetEnv(config);
    if (envErr) return fail(envErr, 2);
  } catch (e) {
    return fail(safeErrorMessage(e), 2);
  }

  const store = createStore(config.server.dataDir, (m) => console.error(`[darwin] ${m}`));
  let rt;
  try {
    rt = createRuntime(config, { store, log: say });
    await rt.checkReady(); // testnet: RPC reachable, network = testnet, master account exists
  } catch (e) {
    return fail(safeErrorMessage(e));
  }
  const app = createApp(rt);

  const { host, port } = config.server;
  const server = await new Promise<Server>((resolve, reject) => {
    const s = serve({ fetch: app.fetch, hostname: host, port }, () => resolve(s as Server));
    s.once("error", reject);
  }).catch((e: NodeJS.ErrnoException) => fail(e.code === "EADDRINUSE" ? `port ${port} already in use (change PORT)` : safeErrorMessage(e)));

  say(`Darwin ${rt.version}: mode ${config.mode} (chain ${rt.chain.info().kind}, brain ${rt.brain.kind}, preset ${config.preset})`);
  say(`listening on http://${host}:${port}  (stream: /api/stream, health: /api/health)`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    say(`${signal} received: graceful shutdown...`);
    server.closeAllConnections?.();
    await rt.shutdown();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await rt.startSim();
    say("simulation started");
  } catch (e) {
    console.error(`[darwin] ERROR starting the simulation: ${safeErrorMessage(e)}`);
    await rt.shutdown();
    server.close();
    process.exit(1);
  }
}

main().catch((e) => fail(safeErrorMessage(e)));
