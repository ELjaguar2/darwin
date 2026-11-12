// HTTP API (Hono): state reads, SSE stream, visitor form, administration, static frontend/.
// No business rule: everything goes through Market (postVisitorTask) and Engine. No route returns a secret.
import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import { getConnInfo } from "@hono/node-server/conninfo";
import { CATALOGUE, PROFESSIONS, formatNear, redactConfig, scaledPrice, type Task } from "../shared/index.ts";
import { MarketError, SIMULATED_BADGE, VISITOR_FUNDING_LABEL } from "../market/index.ts";
import { RateLimiter } from "./rate-limit.ts";
import { ReplayError } from "./replay.ts";
import { REPLAY_READ_ONLY_MESSAGE } from "./replay-runtime.ts";
import { redactText, safeErrorMessage } from "./redact.ts";
import { safeMime } from "./safe.ts";
import type { Runtime } from "./runtime.ts";
import { sseHandler, parseSince } from "./sse.ts";
import { buildLineage } from "./store.ts";

export const LOOPBACK = "127.0.0.1";
/** Cap on open tasks per IP (ARCHITECTURE §9 and §16). */
export const MAX_OPEN_TASKS_PER_IP = 10;
/** Global cap on open visitor tasks (SECURITE note L6: the market has none). */
export const MAX_OPEN_VISITOR_TASKS = 100;
const OPEN_STATUSES: ReadonlySet<Task["status"]> = new Set(["posted", "awarded", "submitted"]);
/** Public frontend/ files: / , index.html, favicon.svg, *.js, *.css at the root only. */
export const PUBLIC_STATIC = /^\/(?:index\.html|favicon\.svg|[A-Za-z0-9_-]+\.(?:js|css))?$/;
const FALLBACK_CSS = "body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}code{background:#8882;padding:0 .3em}";
const ID_RE = /^[a-z]-\d{1,9}$/;
const FILE_RE = /^[a-z0-9._-]{1,64}$/;

export const MIN_ADMIN_TOKEN_LENGTH = 24;

/** D-023 / R7: outside the loopback interface, the admin token is mandatory; any token is at least 24 characters (startup refused otherwise). */
export function assertSafeBinding(host: string, adminToken: string | undefined): void {
  if (host !== LOOPBACK && !adminToken) {
    throw new Error(`HOST=${host} requires DARWIN_ADMIN_TOKEN (mandatory whenever HOST is not ${LOOPBACK}): startup refused.`);
  }
  if (adminToken !== undefined && adminToken.length < MIN_ADMIN_TOKEN_LENGTH) {
    throw new Error(`DARWIN_ADMIN_TOKEN too short (minimum ${MIN_ADMIN_TOKEN_LENGTH} characters): startup refused.`);
  }
}

/** Accepted Host header values (anti DNS rebinding): loopback with or without a port, configured HOST, DARWIN_ALLOWED_HOSTS. */
export function allowedHostSet(host: string, port: number, extra: readonly string[]): Set<string> {
  const names = ["localhost", "127.0.0.1", "[::1]", host.toLowerCase(), ...extra].filter((h) => h !== "0.0.0.0" && h !== "::");
  const out = new Set<string>();
  for (const n of names) {
    out.add(n);
    const hasPort = /:\d+$/.test(n.replace(/^\[.*\]/, "")); // [::1] does not count as a port
    if (n !== "*" && !hasPort) out.add(`${n}:${port}`);
  }
  return out;
}

export interface AppOptions {
  /** Client address. Default: socket address (never X-Forwarded-For, which can be forged). */
  getIp?: (c: Context) => string;
  /** Frontend folder. Default: <root>/frontend. */
  frontendDir?: string;
  /** Rate limits (per IP and per minute). */
  limits?: { api?: number; postTask?: number; adminFailures?: number; streamsPerIp?: number; streamsTotal?: number };
  pingMs?: number;
  now?: () => number;
  /** Replay mode only (D-044): "open" (default) = playback control without a token; "locked" = admin token required. */
  replayControl?: "open" | "locked";
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

  // ---- security headers and anti-CSRF ----
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
    if (!c.res.headers.has("Content-Security-Policy")) // deliverables set their own strict CSP
      c.header(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
    if (c.req.path.startsWith("/api/") && !c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
  });
  // Anti DNS rebinding: the Host header must be an expected name (read routes, SSE, write, static).
  const hosts = allowedHostSet(config.server.host, config.server.port, config.server.allowedHosts);
  const reqHost = (c: Context) => new URL(c.req.url).host.toLowerCase();
  app.use("*", async (c, next) => {
    if (!hosts.has("*") && !hosts.has(reqHost(c))) return c.json(errBody("FORBIDDEN_HOST", "host not allowed (see DARWIN_ALLOWED_HOSTS)"), 403);
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
          /* unreadable origin: rejected below */
        }
        if (!host || host !== reqHost(c)) return c.json(errBody("FORBIDDEN_ORIGIN", "origin not allowed"), 403);
      }
    }
    await next();
  };
  app.use("/api/*", sameOrigin);

  // ---- replay (L17): every write is cleanly refused, before validation, rate limiting or the market ----
  if (rt.replay) {
    app.use("/api/*", async (c, next) => {
      const p = c.req.path;
      if (c.req.method !== "GET" && c.req.method !== "HEAD" && (p === "/api/tasks" || p.startsWith("/api/sim/")))
        return c.json(errBody("REPLAY_READ_ONLY", REPLAY_READ_ONLY_MESSAGE, { mode: "replay" }), 403);
      await next();
    });
  }

  // ---- general rate limiting (the SSE stream has its own connection cap) ----
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/stream") return next();
    const r = apiLimiter.hit(getIp(c));
    if (!r.ok) {
      c.header("Retry-After", String(r.retryAfterSec));
      return c.json(errBody("RATE_LIMITED", "too many requests, try again in a moment"), 429);
    }
    await next();
  });

  // ---- cached state (cloning SimState is costly; the journal says when it changes) ----
  let cache: { seq: number; state: ReturnType<typeof engine.getState> } | undefined;
  const state = () => {
    if (!cache || cache.seq !== journal.lastSeq) cache = { seq: journal.lastSeq, state: engine.getState() };
    return cache.state;
  };

  // ---- reads ----
  app.get("/api/health", (c) => {
    const s = engine.getState();
    return c.json({
      ok: true,
      version: rt.version,
      mode: config.mode,
      chain: { kind: rt.chain.info().kind, masterId: rt.chain.info().masterId, contractId: rt.chain.info().kind === "mock" ? undefined : rt.chain.info().contractId },
      brain: { kind: rt.brain.kind },
      escrow: rt.escrowMode(), // D-022: "operator-account" = degraded escrow (no contract), including in mock
      mock: config.chain === "mock" || config.brain === "mock",
      tick: s.tick,
      running: s.running,
      paused: s.paused,
      startedAt: rt.startedAt,
      replay: rt.replay?.status(), // L17: present only in replay mode (permanent frontend banner)
      visitors: { spentLastHour: market.visitorSpentLastHour().toString(), hourlyCap: market.visitorHourlyCap().toString() },
    });
  });
  app.get("/api/config", (c) => c.json(publicConfig(rt)));
  app.get("/api/state", (c) => c.json({ ...state(), population: rt.lastPopulation(), replay: rt.replay?.status() }));
  app.get("/api/population", (c) => c.json({ population: rt.lastPopulation() ?? null }));

  // ---- profession catalogue (visitor form) + active market events ----
  app.get("/api/catalogue", (c) => {
    const scale = config.sim.priceScale;
    const professions = PROFESSIONS.map((p) => {
      const s = CATALOGUE[p];
      const price = scaledPrice(p, scale);
      return {
        profession: p, label: s.label, refUsd: s.refUsd,
        nearPrice: price.toString(), nearPriceNear: formatNear(price, 6),
        deliverable: s.deliverable, files: s.files, rubric: s.rubric, acceptScore: s.acceptScore,
      };
    });
    return c.json({ priceScale: scale, tick: engine.getState().tick, professions, events: rt.activeMarketEvents() });
  });

  app.get("/api/agents", (c) => {
    const status = c.req.query("status");
    const agents = state().agents.filter((a) => (status === "alive" || status === "dead" ? a.status === status : true));
    return c.json({ agents });
  });
  app.get("/api/agents/:id", (c) => {
    const id = c.req.param("id");
    const agent = ID_RE.test(id) ? engine.getAgent(id) : undefined;
    if (!agent) return c.json(errBody("UNKNOWN_AGENT", "unknown agent"), 404);
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
    return letter ? c.json({ letter }) : c.json(errBody("UNKNOWN_LETTER", "no letter for this agent (founder or unknown)"), 404);
  };
  app.get("/api/agents/:id/letter", letterOfAgent);
  app.get("/api/letters/:id", (c) => {
    const id = c.req.param("id");
    const letter = ID_RE.test(id) ? engine.getLetter(id) : undefined;
    return letter ? c.json({ letter }) : c.json(errBody("UNKNOWN_LETTER", "unknown letter"), 404);
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
    if (!task) return c.json(errBody("UNKNOWN_TASK", "unknown task"), 404);
    return c.json({ task: taskView(task), bids: rt.bidsOf(id), escrow: market.getEscrow(id) });
  });

  // ---- deliverables (L16): read-only, agent content served with strict types and locked-down CSP ----
  const deliverableOf = (c: Context) => {
    const id = c.req.param("id") ?? "";
    return ID_RE.test(id) ? market.getDeliverable(id) : undefined;
  };
  app.get("/api/tasks/:id/deliverable", (c) => {
    const d = deliverableOf(c);
    if (!d) return c.json(errBody("UNKNOWN_DELIVERABLE", "no deliverable for this task"), 404);
    const { rawText: _raw, ...pub } = d;
    return c.json({ ...pub, files: d.files.map((f) => ({ name: f.name, mime: safeMime(f.mime), content: redactText(f.content), ...(f.truncated ? { truncated: true } : {}) })) });
  });
  app.get("/api/tasks/:id/deliverable/:file", (c) => {
    const file = c.req.param("file") ?? "";
    if (!FILE_RE.test(file)) return c.json(errBody("INVALID_FILE", "invalid file name"), 400);
    const d = deliverableOf(c);
    const f = d?.files.find((x) => x.name === file);
    if (!f) return c.json(errBody("UNKNOWN_DELIVERABLE", "unknown deliverable or file"), 404);
    const type = safeMime(f.mime);
    c.header("Content-Type", type.startsWith("text/") ? `${type}; charset=utf-8` : type);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    if (c.req.query("download") === "1") c.header("Content-Disposition", `attachment; filename="${file}"`);
    return c.body(redactText(f.content));
  });

  app.get("/api/events", (c) => {
    const since = parseSince(c.req.query("since"));
    const limit = Math.min(1000, Math.max(1, Number(c.req.query("limit")) || 200));
    return c.json({ events: journal.since(since, limit), lastSeq: journal.lastSeq });
  });

  // ---- real-time stream ----
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
      return c.json(errBody("TOO_MANY_STREAMS", "too many open streams"), 429);
    }
    return sse(ip)(c);
  });

  // ---- task publication by a visitor ----
  const openByIp = new Map<string, (string | symbol)[]>(); // task id, or reservation token while publishing
  const isOpen = (x: string | symbol) => (typeof x === "symbol" ? true : OPEN_STATUSES.has(market.getTask(x)?.status as Task["status"]));
  const openCount = (ip: string) => {
    const kept = (openByIp.get(ip) ?? []).filter(isOpen);
    if (kept.length) openByIp.set(ip, kept);
    else openByIp.delete(ip);
    return kept;
  };
  const openVisitorTasks = () => market.listTasks().filter((t) => t.requester.kind === "visitor" && OPEN_STATUSES.has(t.status)).length;

  app.post("/api/tasks", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json(errBody("PAYLOAD_TOO_LARGE", "body too large (16 KB max)"), 413) }), async (c) => {
    const ip = getIp(c);
    const r = postLimiter.hit(ip);
    if (!r.ok) {
      c.header("Retry-After", String(r.retryAfterSec));
      return c.json(errBody("RATE_LIMITED", "too many submissions, try again in a moment"), 429);
    }
    if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json"))
      return c.json(errBody("UNSUPPORTED_MEDIA_TYPE", "Content-Type application/json requis"), 415);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errBody("INVALID_JSON", "invalid JSON body"), 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return c.json(errBody("INVALID_INPUT", "JSON object expected"), 400);
    const input = { ...(body as Record<string, unknown>) };
    // the form warns that everything is public; a secret pasted by mistake is masked before entering the market
    if (typeof input.title === "string") input.title = redactText(input.title);
    if (typeof input.prompt === "string") input.prompt = redactText(input.prompt);
    if (typeof input.budgetNear === "number" && Number.isFinite(input.budgetNear)) input.budgetNear = input.budgetNear.toFixed(6).replace(/\.?0+$/, "");

    if (!engine.getState().running) return c.json(errBody("SIM_NOT_RUNNING", "the simulation is not running: no task will be processed", { retryable: false }), 503);
    if (openCount(ip).length >= MAX_OPEN_TASKS_PER_IP)
      return c.json(errBody("TOO_MANY_OPEN_TASKS", `at most ${MAX_OPEN_TASKS_PER_IP} open tasks per visitor: wait for one to be settled`), 429);
    if (openVisitorTasks() >= MAX_OPEN_VISITOR_TASKS) {
      c.header("Retry-After", "30");
      return c.json(errBody("MARKET_BUSY", "too many visitor tasks pending, try again later"), 429);
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
          // Waiting state, not a failure: the market will retry; the client can poll the task later.
          c.header("Retry-After", "5");
          return c.json(errBody(e.code, e.message, { retryable: true }), 503);
        }
        if (status === 429) c.header("Retry-After", "60");
        return c.json(errBody(e.code, e.message), status as 400 | 403 | 404 | 409 | 429 | 500 | 503);
      }
      console.error(`POST /api/tasks : ${safeErrorMessage(e)}`);
      return c.json(errBody("INTERNAL", "internal error"), 500);
    }
  });

  // ---- administration (token) ----
  const admin: MiddlewareHandler = async (c, next) => {
    if (adminToken) {
      const ip = getIp(c);
      const b = adminFailLimiter.blocked(ip);
      if (b.blocked) {
        c.header("Retry-After", String(b.retryAfterSec));
        return c.json(errBody("RATE_LIMITED", "too many authentication failures"), 429);
      }
      const m = /^Bearer\s+(.+)$/i.exec(c.req.header("authorization") ?? "");
      if (!m || !timingSafeEqual(digest(m[1]!.trim()), digest(adminToken))) {
        adminFailLimiter.hit(ip);
        c.header("WWW-Authenticate", "Bearer");
        return c.json(errBody("UNAUTHORIZED", "admin token required"), 401);
      }
    }
    await next();
  };
  const simInfo = () => {
    const s = engine.getState();
    return { running: s.running, paused: s.paused, tick: s.tick };
  };
  app.post("/api/sim/start", admin, async (c) => {
    if (engine.getState().running) return c.json(errBody("ALREADY_RUNNING", "simulation already running"), 409);
    try {
      await rt.startSim();
    } catch (e) {
      return c.json(errBody("START_FAILED", safeErrorMessage(e)), 500);
    }
    if (!engine.getState().running) return c.json(errBody("NOT_RESTARTABLE", "simulation finished: restart the process"), 409);
    return c.json({ ok: true, ...simInfo() });
  });
  app.post("/api/sim/pause", admin, (c) => {
    const before = engine.getState();
    if (!before.running || before.paused) return c.json(errBody("INVALID_STATE", "nothing to pause"), 409);
    engine.pause();
    return c.json({ ok: true, ...simInfo() });
  });
  app.post("/api/sim/resume", admin, (c) => {
    const before = engine.getState();
    if (!before.running || !before.paused) return c.json(errBody("INVALID_STATE", "the simulation is not paused"), 409);
    engine.resume();
    return c.json({ ok: true, ...simInfo() });
  });
  app.post("/api/sim/stop", admin, async (c) => {
    if (!engine.getState().running) return c.json(errBody("INVALID_STATE", "simulation not started or already stopped"), 409);
    await engine.stop();
    return c.json({ ok: true, ...simInfo() });
  });

  // ---- replay mode (L17): read-only, playback control through /api/replay/* ----
  if (rt.replay) {
    const replay = rt.replay;
    app.get("/api/replay", (c) => c.json(replay.status()));
    // Visitor mission threads: for each mission, its events in order (see backend/README, "Event catalogue").
    app.get("/api/replay/missions", (c) => {
      const all = new Map(journal.since(0, 1_000_000).map((e) => [e.seq, e]));
      return c.json({
        missions: [...replay.state.missions.values()].map((m) => ({ ...m, events: m.events.map((e) => all.get(e.seq) ?? e) })),
      });
    });
    // D-044: replay has no write power; control open by default, token required if DARWIN_REPLAY_CONTROL=locked.
    const replayGuard: MiddlewareHandler = opts.replayControl === "locked" ? admin : async (_c, next) => { await next(); };
    const ctl = (name: string, run: (body: Record<string, unknown>) => void) =>
      app.post(`/api/replay/${name}`, bodyLimit({ maxSize: 1024, onError: (c) => c.json(errBody("PAYLOAD_TOO_LARGE", "body too large (1 KB max)"), 413) }), replayGuard, async (c) => {
        let body: Record<string, unknown> = {};
        try {
          const j = await c.req.json();
          if (typeof j === "object" && j !== null && !Array.isArray(j)) body = j;
        } catch {
          /* optional body */
        }
        try {
          run(body);
        } catch (e) {
          if (e instanceof ReplayError) return c.json(errBody(e.code, e.message), 400);
          throw e;
        }
        return c.json(replay.status());
      });
    ctl("speed", (b) => replay.setSpeed(b.speed));
    ctl("pause", () => replay.pause());
    ctl("resume", () => replay.resume());
    ctl("restart", () => replay.restart());
  }

  app.all("/api/*", (c) => c.json(errBody("NOT_FOUND", "unknown route"), 404));

  // Legacy interface: /classique -> /?classique (same behaviour as the frontend/dev mock server)
  app.get("/classique", (c) => c.redirect("/?classique", 302));

  // ---- static frontend/ (another agent works on it) ----
  const frontendDir = opts.frontendDir ?? fileURLToPath(new URL("../frontend", import.meta.url));
  const hasFrontend = existsSync(join(frontendDir, "index.html"));
  app.use("*", async (c, next) => {
    if (c.req.path.split("/").some((seg) => seg.startsWith("."))) return c.text("Not found", 404); // never hidden files
    await next();
    if (c.res.status === 200 && !c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-cache");
  });
  // Allow-list: the page, its scripts and stylesheets, the icon (files at the root of frontend/). No dev/, screens/, .md, etc.
  const staticFiles = serveStatic({ root: frontendDir });
  if (hasFrontend) app.use("*", (c, next) => (PUBLIC_STATIC.test(c.req.path) ? staticFiles(c, next) : next()));
  app.get("/_fallback.css", (c) => c.body(FALLBACK_CSS, 200, { "Content-Type": "text/css; charset=utf-8" }));
  app.get("/", (c) => {
    const s = engine.getState();
    const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    return c.html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5"><title>Darwin</title>
<link rel="stylesheet" href="/_fallback.css"></head>
<body><h1>Darwin</h1>
<p>The server is running (mode <strong>${esc(config.mode)}</strong>, brain <strong>${esc(rt.brain.kind)}</strong>). The graphical interface is not installed in this folder (<code>frontend/</code>): here is the raw state.</p>
<ul><li>Tick: ${esc(s.tick)} ${s.running ? (s.paused ? "(paused)" : "(running)") : "(stopped)"}</li>
<li>Agents alive: ${esc(s.totals.alive)}, dead: ${esc(s.totals.dead)}, generations: ${esc(s.generations)}</li>
<li>Tasks settled: ${esc(s.totals.tasksSettled)}</li></ul>
<p>API: <a href="/api/health">/api/health</a>, <a href="/api/state">/api/state</a>, <a href="/api/lineage">/api/lineage</a>, <a href="/api/tasks">/api/tasks</a>, stream <a href="/api/stream">/api/stream</a>. This page refreshes itself.</p>
</body></html>`);
  });

  app.notFound((c) => c.text("Not found", 404));
  app.onError((e, c) => {
    console.error(`unhandled error: ${safeErrorMessage(e)}`);
    return c.json(errBody("INTERNAL", "internal error"), 500);
  });
  return app;
}
