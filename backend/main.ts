// Point d'entrée unique : `npm start` (mock), `npm run start:mock`, `npm run start:demo`, `npm run start:testnet`.
// Compose chain + brain + market + engine + journal, sert l'API, le flux SSE et frontend/, puis lance la simulation.
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
  console.error(`[darwin] ERREUR : ${msg}`);
  process.exit(code);
};

/** .env facultatif (Node >= 20.12) : ne remplace jamais une variable déjà définie dans l'environnement. */
function loadDotEnv() {
  try {
    process.loadEnvFile(".env");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") say("fichier .env illisible : ignoré");
  }
}

async function main() {
  const nodeV = process.versions.node;
  const tooOld = checkNodeVersion(nodeV, "mock").error;
  if (tooOld) return fail(tooOld, 2); // avant toute lecture de configuration
  loadDotEnv();
  // L17 : `npm run replay` (DARWIN_MODE=replay) relit un journal enregistré : aucune clé, aucune chaîne, aucune IA.
  if ((process.env.DARWIN_MODE ?? "").trim().toLowerCase() === "replay") return runReplayMode({ say, fail });
  let config;
  try {
    config = loadConfig();
    assertSafeBinding(config.server.host, config.server.adminToken); // R7 : jeton obligatoire hors 127.0.0.1
    const nv = checkNodeVersion(nodeV, config.mode);
    if (nv.error) return fail(nv.error, 2);
    if (nv.warning) console.warn(`[darwin] AVERTISSEMENT : ${nv.warning}`);
    const envErr = checkTestnetEnv(config);
    if (envErr) return fail(envErr, 2);
  } catch (e) {
    return fail(safeErrorMessage(e), 2);
  }

  const store = createStore(config.server.dataDir, (m) => console.error(`[darwin] ${m}`));
  let rt;
  try {
    rt = createRuntime(config, { store, log: say });
    await rt.checkReady(); // testnet : RPC joignable, réseau = testnet, compte maître existant
  } catch (e) {
    return fail(safeErrorMessage(e));
  }
  const app = createApp(rt);

  const { host, port } = config.server;
  const server = await new Promise<Server>((resolve, reject) => {
    const s = serve({ fetch: app.fetch, hostname: host, port }, () => resolve(s as Server));
    s.once("error", reject);
  }).catch((e: NodeJS.ErrnoException) => fail(e.code === "EADDRINUSE" ? `port ${port} déjà utilisé (changez PORT)` : safeErrorMessage(e)));

  say(`Darwin ${rt.version} : mode ${config.mode} (chaîne ${rt.chain.info().kind}, cerveau ${rt.brain.kind}, preset ${config.preset})`);
  say(`écoute sur http://${host}:${port}  (flux : /api/stream, santé : /api/health)`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    say(`${signal} reçu : arrêt propre...`);
    server.closeAllConnections?.();
    await rt.shutdown();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await rt.startSim();
    say("simulation démarrée");
  } catch (e) {
    console.error(`[darwin] ERREUR au démarrage de la simulation : ${safeErrorMessage(e)}`);
    await rt.shutdown();
    server.close();
    process.exit(1);
  }
}

main().catch((e) => fail(safeErrorMessage(e)));
