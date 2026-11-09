// API HTTP (Hono) : lecture de l'état, flux SSE, formulaire visiteur, administration, statique frontend/.
// Aucune règle métier : tout passe par Market (postVisitorTask) et Engine. Aucune route ne renvoie de secret.
import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import { getConnInfo } from "@hono/node-server/conninfo";
import { redactConfig, type Task } from "../shared/index.ts";
import { MarketError, SIMULATED_BADGE, VISITOR_FUNDING_LABEL } from "../market/index.ts";
import { RateLimiter } from "./rate-limit.ts";
import { safeErrorMessage } from "./redact.ts";
import type { Runtime } from "./runtime.ts";
import { sseHandler, parseSince } from "./sse.ts";
import { buildLineage } from "./store.ts";

export const LOOPBACK = "127.0.0.1";
/** Plafond de tâches ouvertes par IP (ARCHITECTURE §9 et §16). */
export const MAX_OPEN_TASKS_PER_IP = 10;
/** Plafond global de tâches de visiteurs ouvertes (note SECURITE L6 : le marché n'en a pas). */
export const MAX_OPEN_VISITOR_TASKS = 100;
const OPEN_STATUSES: ReadonlySet<Task["status"]> = new Set(["posted", "awarded", "submitted"]);
const ID_RE = /^[a-z]-\d{1,9}$/;

export const MIN_ADMIN_TOKEN_LENGTH = 24;

/** D-023 / R7 : hors boucle locale, le jeton d'administration est obligatoire ; tout jeton fait au moins 24 caractères (démarrage refusé sinon). */
export function assertSafeBinding(host: string, adminToken: string | undefined): void {
  if (host !== LOOPBACK && !adminToken) {
    throw new Error(`HOST=${host} exige DARWIN_ADMIN_TOKEN (obligatoire dès que HOST n'est pas ${LOOPBACK}) : démarrage refusé.`);
  }
  if (adminToken !== undefined && adminToken.length < MIN_ADMIN_TOKEN_LENGTH) {
    throw new Error(`DARWIN_ADMIN_TOKEN trop court (minimum ${MIN_ADMIN_TOKEN_LENGTH} caractères) : démarrage refusé.`);
  }
}

/** Valeurs d'en-tête Host acceptées (anti rebond DNS) : boucle locale avec ou sans port, HOST configuré, DARWIN_ALLOWED_HOSTS. */
export function allowedHostSet(host: string, port: number, extra: readonly string[]): Set<string> {
  const names = ["localhost", "127.0.0.1", "[::1]", host.toLowerCase(), ...extra].filter((h) => h !== "0.0.0.0" && h !== "::");
  const out = new Set<string>();
  for (const n of names) {
    out.add(n);
    const hasPort = /:\d+$/.test(n.replace(/^\[.*\]/, "")); // [::1] ne compte pas comme un port
    if (n !== "*" && !hasPort) out.add(`${n}:${port}`);
  }
  return out;
}

export interface AppOptions {
  /** Adresse du client. Défaut : adresse de la socket (jamais X-Forwarded-For, falsifiable). */
  getIp?: (c: Context) => string;
  /** Dossier du frontend. Défaut : <racine>/frontend. */
  frontendDir?: string;
  /** Limites de débit (par IP et par minute). */
  limits?: { api?: number; postTask?: number; adminFailures?: number; streamsPerIp?: number; streamsTotal?: number };
  pingMs?: number;
  now?: () => number;
}

const defaultIp = (c: Context): string => {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
};

const digest = (s: string) => createHash("sha256").update(s).digest();

export function taskView(t: Task) {
  const badge = t.requester.kind === "visitor" ? VISITOR_FUNDING_LABEL : t.requester.kind === "simulated" ? SIMULATED_BADGE : "sous-traitance";
  return { ...t, badge, validatedBy: t.validation?.validator };
}

function errBody(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, ...extra } };
}

function publicConfig(rt: Runtime): unknown {
  const c = redactConfig(rt.config) as Record<string, any>;
  return {
    mode: c.mode, preset: c.preset, chain: c.chain, brain: c.brain, seed: c.seed, sim: c.sim,
    near: { network: c.near.network, masterAccountId: c.near.masterAccountId, contractId: c.near.contractId },
    nearai: { model: c.nearai.model },
    intents: { enabled: c.intents.enabled, dryOnly: c.intents.dryOnly },
  };
}

export function createApp(rt: Runtime, opts: AppOptions = {}): Hono {
  const { config, journal, engine, market } = rt;
  assertSafeBinding(config.server.host, config.server.adminToken);
  const adminToken = config.server.adminToken;
  const getIp = opts.getIp ?? defaultIp;
  const now = opts.now ?? Date.now;
  const lim = { api: 240, postTask: 6, adminFailures: 10, streamsPerIp: 8, streamsTotal: 300, ...opts.limits };
  const apiLimiter = new RateLimiter(lim.api, 60_000, now);
  const postLimiter = new RateLimiter(lim.postTask, 60_000, now);
  const adminFailLimiter = new RateLimiter(lim.adminFailures, 60_000, now);

  const app = new Hono();

  // ---- en-têtes de sécurité et anti-CSRF ----
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    if (c.req.path.startsWith("/api/") && !c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
  });
  // Anti rebond DNS : l'en-tête Host doit être un nom attendu (routes de lecture, SSE, écriture, statique).
  const hosts = allowedHostSet(config.server.host, config.server.port, config.server.allowedHosts);
  const reqHost = (c: Context) => new URL(c.req.url).host.toLowerCase();
  app.use("*", async (c, next) => {
    if (!hosts.has("*") && !hosts.has(reqHost(c))) return c.json(errBody("FORBIDDEN_HOST", "hôte non autorisé (voir DARWIN_ALLOWED_HOSTS)"), 403);
    await next();
  });
  const sameOrigin: MiddlewareHandler = async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const origin = c.req.header("origin");
      if (origin) {
        let host = "";
        try {
          host = new URL(origin).host;
        } catch {
          /* origine illisible : refusée plus bas */
        }
        if (!host || host !== reqHost(c)) return c.json(errBody("FORBIDDEN_ORIGIN", "origine non autorisée"), 403);
      }
    }
    await next();
  };
  app.use("/api/*", sameOrigin);

  // ---- limitation de débit générale (le flux SSE a son propre plafond de connexions) ----
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/stream") return next();
    const r = apiLimiter.hit(getIp(c));
    if (!r.ok) {
      c.header("Retry-After", String(r.retryAfterSec));
      return c.json(errBody("RATE_LIMITED", "trop de requêtes, réessayez dans un instant"), 429);
    }
    await next();
  });

  // ---- état en cache (le clone de SimState coûte ; le journal dit quand il change) ----
  let cache: { seq: number; state: ReturnType<typeof engine.getState> } | undefined;
  const state = () => {
    if (!cache || cache.seq !== journal.lastSeq) cache = { seq: journal.lastSeq, state: engine.getState() };
    return cache.state;
  };

  // ---- lecture ----
  app.get("/api/health", (c) => {
    const s = engine.getState();
    return c.json({
      ok: true,
      version: rt.version,
      mode: config.mode,
      chain: { kind: rt.chain.info().kind, masterId: rt.chain.info().masterId, contractId: rt.chain.info().kind === "mock" ? undefined : rt.chain.info().contractId },
      brain: { kind: rt.brain.kind },
      escrow: rt.escrowMode(), // D-022 : "operator-account" = séquestre dégradé (sans contrat), y compris en mock
      mock: config.chain === "mock" || config.brain === "mock",
      tick: s.tick,
      running: s.running,
      paused: s.paused,
      startedAt: rt.startedAt,
      visitors: { spentLastHour: market.visitorSpentLastHour().toString(), hourlyCap: market.visitorHourlyCap().toString() },
    });
  });
  app.get("/api/config", (c) => c.json(publicConfig(rt)));
  app.get("/api/state", (c) => c.json(state()));

  app.get("/api/agents", (c) => {
    const status = c.req.query("status");
    const agents = state().agents.filter((a) => (status === "alive" || status === "dead" ? a.status === status : true));
    return c.json({ agents });
  });
  app.get("/api/agents/:id", (c) => {
    const id = c.req.param("id");
    const agent = ID_RE.test(id) ? engine.getAgent(id) : undefined;
    if (!agent) return c.json(errBody("UNKNOWN_AGENT", "agent inconnu"), 404);
    const s = state();
    const byId = new Map(s.agents.map((a) => [a.id, a]));
    const ancestors: string[] = [];
    for (let p = agent.parentId; p && ancestors.length < 100; p = byId.get(p)?.parentId ?? null) ancestors.push(p);
    return c.json({
      agent,
      ancestors,
      children: agent.childrenIds,
      letterReceived: agent.letterId ? engine.getLetter(agent.letterId) : undefined,
      lettersWritten: s.letters.filter((l) => l.fromAgentId === id),
      tasks: s.tasks.filter((t) => t.winnerId === id).map(taskView),
    });
  });
  const letterOfAgent = (c: Context) => {
    const id = c.req.param("id") ?? "";
    const agent = ID_RE.test(id) ? engine.getAgent(id) : undefined;
    const letter = agent?.letterId ? engine.getLetter(agent.letterId) : undefined;
    return letter ? c.json({ letter }) : c.json(errBody("UNKNOWN_LETTER", "pas de lettre pour cet agent (fondateur ou inconnu)"), 404);
  };
  app.get("/api/agents/:id/letter", letterOfAgent);
  app.get("/api/letters/:id", (c) => {
    const id = c.req.param("id");
    const letter = ID_RE.test(id) ? engine.getLetter(id) : undefined;
    return letter ? c.json({ letter }) : c.json(errBody("UNKNOWN_LETTER", "lettre inconnue"), 404);
  });
  app.get("/api/lineage", (c) => {
    const s = state();
    const nodes = buildLineage(s.agents);
    return c.json({ generations: s.generations, roots: nodes.filter((n) => n.parentId === null).map((n) => n.id), nodes });
  });

  app.get("/api/tasks", (c) => {
    const status = c.req.query("status");
    const profession = c.req.query("profession");
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit")) || 100));
    const tasks = market
      .listTasks()
      .filter((t) => (!status || t.status === status) && (!profession || t.profession === profession))
      .slice(-limit)
      .map(taskView);
    return c.json({ tasks });
  });
  app.get("/api/tasks/:id", (c) => {
    const id = c.req.param("id");
    const task = ID_RE.test(id) ? market.getTask(id) : undefined;
    if (!task) return c.json(errBody("UNKNOWN_TASK", "tâche inconnue"), 404);
    return c.json({ task: taskView(task), bids: rt.bidsOf(id), escrow: market.getEscrow(id) });
  });

  app.get("/api/events", (c) => {
    const since = parseSince(c.req.query("since"));
    const limit = Math.min(1000, Math.max(1, Number(c.req.query("limit")) || 200));
    return c.json({ events: journal.since(since, limit), lastSeq: journal.lastSeq });
  });

  // ---- flux temps réel ----
  const streamsByIp = new Map<string, number>();
  let streamsTotal = 0;
  const sse = (ip: string) =>
    sseHandler(journal, {
      pingMs: opts.pingMs,
      onOpen: () => {
        streamsTotal++;
        streamsByIp.set(ip, (streamsByIp.get(ip) ?? 0) + 1);
        return () => {
          streamsTotal--;
          const n = (streamsByIp.get(ip) ?? 1) - 1;
          if (n <= 0) streamsByIp.delete(ip);
          else streamsByIp.set(ip, n);
        };
      },
    });
  app.get("/api/stream", (c) => {
    const ip = getIp(c);
    if (streamsTotal >= lim.streamsTotal || (streamsByIp.get(ip) ?? 0) >= lim.streamsPerIp) {
      c.header("Retry-After", "10");
      return c.json(errBody("TOO_MANY_STREAMS", "trop de flux ouverts"), 429);
    }
    return sse(ip)(c);
  });

  // ---- publication d'une tâche par un visiteur ----
  const openByIp = new Map<string, (string | symbol)[]>(); // id de tâche, ou jeton de réservation en cours de publication
  const isOpen = (x: string | symbol) => (typeof x === "symbol" ? true : OPEN_STATUSES.has(market.getTask(x)?.status as Task["status"]));
  const openCount = (ip: string) => {
    const kept = (openByIp.get(ip) ?? []).filter(isOpen);
    if (kept.length) openByIp.set(ip, kept);
    else openByIp.delete(ip);
    return kept;
  };
  const openVisitorTasks = () => market.listTasks().filter((t) => t.requester.kind === "visitor" && OPEN_STATUSES.has(t.status)).length;

  app.post("/api/tasks", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json(errBody("PAYLOAD_TOO_LARGE", "corps trop volumineux (16 Ko max)"), 413) }), async (c) => {
    const ip = getIp(c);
    const r = postLimiter.hit(ip);
    if (!r.ok) {
      c.header("Retry-After", String(r.retryAfterSec));
      return c.json(errBody("RATE_LIMITED", "trop de publications, réessayez dans un instant"), 429);
    }
    if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json"))
      return c.json(errBody("UNSUPPORTED_MEDIA_TYPE", "Content-Type application/json requis"), 415);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errBody("INVALID_JSON", "corps JSON invalide"), 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return c.json(errBody("INVALID_INPUT", "objet JSON attendu"), 400);
    const input = { ...(body as Record<string, unknown>) };
    if (typeof input.budgetNear === "number" && Number.isFinite(input.budgetNear)) input.budgetNear = input.budgetNear.toFixed(6).replace(/\.?0+$/, "");

    if (!engine.getState().running) return c.json(errBody("SIM_NOT_RUNNING", "la simulation n'est pas en cours : aucune tâche ne sera traitée", { retryable: false }), 503);
    if (openCount(ip).length >= MAX_OPEN_TASKS_PER_IP)
      return c.json(errBody("TOO_MANY_OPEN_TASKS", `${MAX_OPEN_TASKS_PER_IP} tâches ouvertes au maximum par visiteur : attendez qu'une soit réglée`), 429);
    if (openVisitorTasks() >= MAX_OPEN_VISITOR_TASKS) {
      c.header("Retry-After", "30");
      return c.json(errBody("MARKET_BUSY", "trop de tâches de visiteurs en attente, réessayez plus tard"), 429);
    }

    const reservation = Symbol("pending");
    openByIp.set(ip, [...openCount(ip), reservation]);
    const release = () => openByIp.set(ip, (openByIp.get(ip) ?? []).filter((x) => x !== reservation));
    try {
      const task = await market.postVisitorTask(input);
      openByIp.set(ip, (openByIp.get(ip) ?? []).map((x) => (x === reservation ? task.id : x)));
      c.header("Location", `/api/tasks/${task.id}`);
      return c.json(taskView(task), 201);
    } catch (e) {
      release();
      if (e instanceof MarketError) {
        const status = e.httpStatus;
        if (e.code === "VALIDATION_PENDING") {
          // État d'attente, pas une panne : le marché réessaiera ; le client peut interroger la tâche plus tard.
          c.header("Retry-After", "5");
          return c.json(errBody(e.code, e.message, { retryable: true }), 503);
        }
        if (status === 429) c.header("Retry-After", "60");
        return c.json(errBody(e.code, e.message), status as 400 | 403 | 404 | 409 | 429 | 500 | 503);
      }
      console.error(`POST /api/tasks : ${safeErrorMessage(e)}`);
      return c.json(errBody("INTERNAL", "erreur interne"), 500);
    }
  });

  // ---- administration (jeton) ----
  const admin: MiddlewareHandler = async (c, next) => {
    if (adminToken) {
      const ip = getIp(c);
      const b = adminFailLimiter.blocked(ip);
      if (b.blocked) {
        c.header("Retry-After", String(b.retryAfterSec));
        return c.json(errBody("RATE_LIMITED", "trop d'échecs d'authentification"), 429);
      }
      const m = /^Bearer\s+(.+)$/i.exec(c.req.header("authorization") ?? "");
      if (!m || !timingSafeEqual(digest(m[1]!.trim()), digest(adminToken))) {
        adminFailLimiter.hit(ip);
        c.header("WWW-Authenticate", "Bearer");
        return c.json(errBody("UNAUTHORIZED", "jeton d'administration requis"), 401);
      }
    }
    await next();
  };
  const simInfo = () => {
    const s = engine.getState();
    return { running: s.running, paused: s.paused, tick: s.tick };
  };
  app.post("/api/sim/start", admin, async (c) => {
    if (engine.getState().running) return c.json(errBody("ALREADY_RUNNING", "simulation déjà en cours"), 409);
    try {
      await rt.startSim();
    } catch (e) {
      return c.json(errBody("START_FAILED", safeErrorMessage(e)), 500);
    }
    if (!engine.getState().running) return c.json(errBody("NOT_RESTARTABLE", "simulation terminée : relancer le processus"), 409);
    return c.json({ ok: true, ...simInfo() });
  });
  app.post("/api/sim/pause", admin, (c) => {
    const before = engine.getState();
    if (!before.running || before.paused) return c.json(errBody("INVALID_STATE", "rien à mettre en pause"), 409);
    engine.pause();
    return c.json({ ok: true, ...simInfo() });
  });
  app.post("/api/sim/resume", admin, (c) => {
    const before = engine.getState();
    if (!before.running || !before.paused) return c.json(errBody("INVALID_STATE", "la simulation n'est pas en pause"), 409);
    engine.resume();
    return c.json({ ok: true, ...simInfo() });
  });
  app.post("/api/sim/stop", admin, async (c) => {
    if (!engine.getState().running) return c.json(errBody("INVALID_STATE", "simulation non démarrée ou déjà arrêtée"), 409);
    await engine.stop();
    return c.json({ ok: true, ...simInfo() });
  });

  app.all("/api/*", (c) => c.json(errBody("NOT_FOUND", "route inconnue"), 404));

  // ---- statique frontend/ (un autre agent y travaille) ----
  const frontendDir = opts.frontendDir ?? fileURLToPath(new URL("../frontend", import.meta.url));
  const hasFrontend = existsSync(join(frontendDir, "index.html"));
  app.use("*", async (c, next) => {
    if (c.req.path.split("/").some((seg) => seg.startsWith("."))) return c.text("Not found", 404); // jamais de fichiers cachés
    await next();
    if (c.res.status === 200 && !c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-cache");
  });
  if (hasFrontend) app.use("*", serveStatic({ root: frontendDir }));
  app.get("/", (c) => {
    const s = engine.getState();
    const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    return c.html(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5"><title>Darwin</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}code{background:#8882;padding:0 .3em}</style></head>
<body><h1>Darwin</h1>
<p>Le serveur tourne (mode <strong>${esc(config.mode)}</strong>, cerveau <strong>${esc(rt.brain.kind)}</strong>). L'interface graphique n'est pas installée dans ce dossier (<code>frontend/</code>) : voici l'état brut.</p>
<ul><li>Tick : ${esc(s.tick)} ${s.running ? (s.paused ? "(en pause)" : "(en cours)") : "(arrêtée)"}</li>
<li>Agents vivants : ${esc(s.totals.alive)}, morts : ${esc(s.totals.dead)}, générations : ${esc(s.generations)}</li>
<li>Tâches réglées : ${esc(s.totals.tasksSettled)}</li></ul>
<p>API : <a href="/api/health">/api/health</a>, <a href="/api/state">/api/state</a>, <a href="/api/lineage">/api/lineage</a>, <a href="/api/tasks">/api/tasks</a>, flux <a href="/api/stream">/api/stream</a>. Cette page se rafraîchit toute seule.</p>
</body></html>`);
  });

  app.notFound((c) => c.text("Not found", 404));
  app.onError((e, c) => {
    console.error(`erreur non gérée : ${safeErrorMessage(e)}`);
    return c.json(errBody("INTERNAL", "erreur interne"), 500);
  });
  return app;
}
