# backend/ (lot L7)

Darwin's composition root: **a single process** that assembles `accounts/` (Chain), `brain/` (Brain), `market/`, `engine/` and the journal, then exposes an HTTP API (Hono), the SSE real-time stream and the static files of `frontend/`. No business rule here.

## Run

| Command | Effect |
|---|---|
| `npm start` / `npm run start:mock` | full mock, no key (`start:mock` forces `DARWIN_MODE=mock`) |
| `npm run start:demo` | mock, `demo` preset (3 generations in a few minutes) |
| `npm run start:testnet` | testnet: requires `NEAR_MASTER_ACCOUNT_ID` and `NEAR_MASTER_PRIVATE_KEY` (Node >= 22.22.2); `nearai` brain if `NEARAI_API_KEY` is set |

Page: <http://127.0.0.1:3000>. A `.env` file at the root is read if present (`process.loadEnvFile`), never overriding a variable already defined. Stop: Ctrl+C (graceful shutdown: engine stopped, debts settled, last snapshot written).

At startup: `loadConfig` -> refusal if `HOST` is not `127.0.0.1` without `DARWIN_ADMIN_TOKEN` (D-023, R7) -> in testnet `NearChain.checkReady()` (testnet RPC reachable, master account exists; otherwise a clear error and exit) -> HTTP listen -> `engine.start()` (founders then tick loop).

## Wiring (`runtime.ts`)

- `journal` = `createJournal`: every event is appended to `data/journal.jsonl`; `system.warning/error` messages are masked (`ed25519:`, `Bearer`, `sk-`, JWT) before any subscriber.
- `chain.tx`: with `NearChain`, the backend's `onTx` emits `chain.tx`; in mock `onTx` is never called and the engine emits (`emitChainTx`, D-027): a single emitter, no duplicate (tested).
- `onWarning` of `NearChain` and of the brain -> `system.warning`. Testnet without `NEARAI_API_KEY`: mock brain + `system.warning BRAIN_NO_KEY` (D-011).
- AI caps: `NEARAI_MAX_USD_PER_RUN` / `NEARAI_MAX_USD_PER_HOUR` (USD, optional, > 0) passed to `createBrain` (`guardrails.maxUsdPerRun/maxUsdPerHour`); absent = brain defaults (2 and 1 USD).
- Escrow: `/api/health.escrow` = `"contract"` only if `NearChain` has a `NEAR_CONTRACT_ID`, otherwise `"operator-account"` (degraded, D-022), **including in mock** (`mock: true` says so separately).

## Routes

Errors: `{"error":{"code","message", ...}}`. All amounts are yoctoNEAR strings. No route returns a secret or the raw config.

| Route | Response |
|---|---|
| `GET /api/health` | `{ok, version, mode, chain:{kind,masterId,contractId?}, brain:{kind}, escrow, mock, tick, running, paused, startedAt, visitors:{spentLastHour, hourlyCap}}` |
| `GET /api/config` | public config (mode, preset, chain, brain, sim, intents.enabled) without secrets |
| `GET /api/state` | full `SimState` (`lastSeq` = stream resume point) + `population` (last `population.snapshot` `{tick, byProfession, byGeneration}`, absent before the 1st tick) |
| `GET /api/population` | `{population: {tick, byProfession, byGeneration} \| null}` |
| `GET /api/catalogue` | `{priceScale, tick, professions[{profession,label,refUsd,nearPrice (yocto, x priceScale),nearPriceNear,deliverable,files[],rubric[{id,description,weight}],acceptScore}], events[active MarketEvents]}` |
| `GET /api/tasks/:id/deliverable` | `{taskId, profession, agentId, files[{name,mime,content}], resultHash, productionCostUsd, judgeCostUsd, createdAt, verdict?, score?}` (without `rawText`); 404 `UNKNOWN_DELIVERABLE` |
| `GET /api/tasks/:id/deliverable/:file[?download=1]` | raw content, the file's `Content-Type`, `nosniff`, `CSP default-src 'none'; style-src 'unsafe-inline'; sandbox`; `attachment` if `download=1`; 400 if the name does not match `^[a-z0-9._-]{1,64}$`, 404 if it is not in the deliverable |
| `GET /api/agents?status=alive\|dead` | `{agents}` |
| `GET /api/agents/:id` | `{agent, ancestors[], children[], letterReceived?, lettersWritten[], tasks[]}` |
| `GET /api/agents/:id/letter`, `GET /api/letters/:id` | `{letter}` (404 for a founder) |
| `GET /api/lineage` | `{generations, roots[], nodes[{id,parentId,generation,status,name,profession,model,birthTick,deathTick?,causeOfDeath?,balance,childrenIds}]}` |
| `GET /api/tasks?status=&profession=&limit=` | `{tasks}`; each task = `Task` + `badge` (the market's `SIMULATED_BADGE` and `VISITOR_FUNDING_LABEL` labels, or `"subcontracting"`) + `validatedBy` ("validated by: ...") |
| `GET /api/tasks/:id` | `{task, bids[], escrow?}` |
| `POST /api/tasks` | visitor form (see below) |
| `GET /api/events?since=&limit=` | `{events[], lastSeq}` (limit <= 1000) |
| `GET /api/stream` | SSE (see below) |
| `POST /api/sim/start\|pause\|resume\|stop` | admin; `{ok, running, paused, tick}`; 409 if the state does not allow it (a stopped simulation does not restart: restart the process) |
| `GET /*` | static `frontend/`; without `frontend/index.html`, a minimal fallback page (raw state, self-refreshing) |

### `POST /api/tasks`

JSON body (`Content-Type: application/json`, 16 KB max): `{title (3-120), prompt (10-4000), profession, budgetNear ("1.5" or number), requesterLabel}` (`TaskInputSchema`). `201` + task (+ `Location` header).

| Status | Case |
|---|---|
| 400 | invalid JSON or fields, budget out of bounds (`INVALID_INPUT`, `BUDGET_OUT_OF_RANGE`) |
| 413 / 415 | body too large / not JSON |
| 429 | `TOO_MANY_OPEN_TASKS` (10 open tasks per IP), `VISITOR_CAP_EXCEEDED` (hourly cap of the demo account, D-025), `MARKET_BUSY` (100 open visitor tasks in total), `RATE_LIMITED` (6 submissions/min/IP); `Retry-After` provided |
| 503 | `SIM_NOT_RUNNING`; `VALIDATION_PENDING` = **non-fatal waiting state** (`retryable:true`, `Retry-After: 5`, nothing is journalled as an error) |
| other | `MarketError.httpStatus` as is; unknown error = 500 without detail |

An IP's open tasks = statuses `posted`, `awarded`, `submitted`. The IP is the socket's (X-Forwarded-For is ignored because it can be forged: behind a proxy or a tunnel, all IPs merge, see "Remaining").

### SSE stream `GET /api/stream`

Each message: `id: <seq>`, `event: <type>` (e.g. `agent.born`, `chain.tx`), `data: <DarwinEvent JSON>` = `{seq, ts, tick, type, data}`. The types are those of `shared/events.ts`; the client subscribes by type with `addEventListener(type, ...)` (named events do not go through `onmessage`). Resume: `EventSource` sends `Last-Event-ID` by itself; you can also pass `?since=<seq>`. Client-side sequence: `GET /api/state`, then `new EventSource("/api/stream?since=" + state.lastSeq)`. `: ping` comment every 15 s. Special `event: reset` (`data: {"lastSeq":n}`, without `id`) if the client resumes with an id greater than the journal (the server restarted, the simulation restarts from zero): the client clears its display, the replay from the start follows. A client that is too slow (queue > 5000) is disconnected and resumes with `Last-Event-ID`. Caps: 8 streams per IP, 300 in total.

## Administration and security

- `POST /api/sim/*` routes: `Authorization: Bearer <DARWIN_ADMIN_TOKEN>` (constant-time comparison, 10 failures/min/IP then 429). Without a configured token, they are open **only** because the server listens on 127.0.0.1 only.
- **Anti DNS rebinding**: the `Host` header must be `localhost`, `127.0.0.1` or `[::1]` (with or without a port), the configured `HOST`, or a name listed in `DARWIN_ALLOWED_HOSTS` (comma-separated list, e.g. the name of a demo tunnel; `*` disables the check). Otherwise 403 `FORBIDDEN_HOST`, on all routes (read, write, SSE, static). With `HOST=0.0.0.0`, set `DARWIN_ALLOWED_HOSTS` to the public name.
- **Admin token**: 24 characters minimum whenever it is set (startup refused otherwise); mandatory if `HOST` is not `127.0.0.1`.
- Anti-CSRF: any non-GET request carrying an `Origin` header different from `Host` is refused (403).
- Rate limiting: 240 requests/min/IP on `/api/*` (SSE stream excluded).
- Headers: `Content-Security-Policy` (`default-src 'self'`, same-origin scripts and connections only: **the frontend must load no external resource and no inline script**), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on the API. Hidden files (`.xxx`) are never served.
- The journal is public: the backend adds nothing secret to it.

## Persistence (`data/`, git-ignored)

`journal.jsonl` (one event per line, append-only), `state.json` (`SimState` snapshot, rewritten every 2 s if the journal moved, atomically), `lineage.json` (`{generations, nodes}`). V1: the simulation restarts from zero on each launch; files from the previous launch are kept as `journal.prev.jsonl`, `state.prev.json`, `lineage.prev.json`. If a write fails, persistence is disabled with a single alert and the simulation continues. `accounts/` writes its own files (`keys/`, ledger, archive) in the same folder.

Deliverables: no `deliverable.zip` (no compression dependency added, D-042). Each deliverable is written to `data/deliverables/<taskId>/<file>` + `meta.json` (validated names, never outside the folder). The next launch moves this folder to `deliverables.prev/` and does not reload it: the simulation restarts from zero and task ids are replayed. Deliverables are therefore served by the API only for the current launch.

## Tests

`backend/backend.test.ts` (vitest + `app.request`, engine without a clock: `engine.tick()` by hand): reads, visitor submission and all error codes, administration, R7, SSE (resume, reset, ping, cap), persistence, testnet with a fake NEAR backend (`checkReady`, `chain.tx`, escrow), brain caps, masking.

## Remaining / known limits

- No `reset` route (restart the process): `Engine` does not expose one.
- **Proxy / tunnel (`trust proxy` option not implemented)**: behind a reverse proxy, the IP seen is the proxy's, so the per-IP caps (10 open tasks, 6 submissions/min, 8 streams, 240 requests/min, admin failures) become global: acceptable for a demo, the demo account's hourly cap and the global cap of 100 tasks bound the spending anyway. For a real option, a variable (e.g. `DARWIN_TRUST_PROXY`) would be needed in `shared/config.ts` and `X-Forwarded-For` would only be read if the socket comes from the proxy; not done because without a variable one cannot tell a trusted proxy from a client forging the header.
- The full journal stays in memory (`shared/bus.ts`): enough for the `demo` preset (900 ticks); in endless `normal` it grows without bound.
- Graceful shutdown verified by test (`shutdown()`) but not by signal on Windows (Node does not emit SIGINT there on a `kill`).
- Testnet mode has only been exercised with the fake NEAR backend (no key or network in this environment).

## Replay mode (L17): replaying a real run

`npm run replay` re-reads a run journal (JSONL `{seq,ts,tick,type,data}`) and re-emits its events in the **same stream** (`/api/stream`, SSE) as live mode, at the original run's pacing divided by the speed. No key, no NEAR network, no AI call: the process only reads a file. The `explorerUrl`s of the `chain.tx` are those of the real run (nearblocks links to real transactions).

| Variable | Default | Effect |
|---|---|---|
| `DARWIN_MODE=replay` | set by `npm run replay` | enables the mode (secrets removed from the environment read) |
| `DARWIN_REPLAY_FILE` | `docs/preuves/run8-journal.jsonl` | journal to replay (run8, run9c, ...); invalid file = exit with the offending line |
| `DARWIN_REPLAY_SPEED` | `5` | x1, x5, x20... (0.25 to 100) |
| `DARWIN_REPLAY_LOOP` | `0` | `1`: restarts 5 s after the end (the stream sends `event: reset`) |
| `DARWIN_REPLAY_MAX_GAP_MS` | `8000` | a longer silence in the original journal is shortened to this value (before dividing by the speed) |
| `DARWIN_REPLAY_CONTROL` | `open` | `locked`: the `/api/replay/speed\|pause\|resume\|restart` routes require `DARWIN_ADMIN_TOKEN`. **Public multi-visitor demo: the speed is shared, run with `locked`** |
| `DARWIN_REPLAY_LABEL` | (journal date) | replaces the banner text |

No CLI argument: `DARWIN_REPLAY_SPEED=20 DARWIN_REPLAY_FILE=docs/preuves/run9b-journal.jsonl npm run replay` (in PowerShell: `$env:DARWIN_REPLAY_SPEED=20; npm run replay`). The page is at <http://127.0.0.1:3000>.

**API.** Same surface as live (`/api/state`, `/api/events`, `/api/tasks`, `/api/agents`, `/api/lineage`, `/api/letters/:id`, `/api/stream`...), served by the reduction of the events already emitted: a client arriving midway receives `/api/state` with the exact `lastSeq`, then the stream from `lastSeq`, with no gap. Additions:

| Route | Role |
|---|---|
| `GET /api/health` | `mode: "replay"` and `replay: {phase: playing\|paused\|ended, speed, loop, position, total, rounds, meta}`; `meta = {file, events, startedAt, endedAt, recordedOn (YYYY-MM-DD read from the 1st event), originalDurationMs, ticks, skipped, renumbered, recorded:{mode,preset,chain,brain,seed}, label?}` |
| `GET /api/state` | same with `mode: "replay"` and `replay` |
| `GET /api/replay` | the `replay` object above |
| `POST /api/replay/speed` `{speed}`, `/pause`, `/resume`, `/restart` | playback control; **no token by default** (D-044, even if `DARWIN_ADMIN_TOKEN` is set); with `DARWIN_REPLAY_CONTROL=locked`, `Authorization: Bearer` required; 400 `REPLAY_BAD_SPEED` |
| `GET /api/replay/missions` | visitor missions: `{missions:[{taskId,title,profession,requester,status,events:[DarwinEvent]}]}`, events in order (chat thread) |
| `POST /api/tasks`, `POST /api/sim/*` | **403 `REPLAY_READ_ONLY`** (refused before any validation; no chain/AI write exists in this mode) |

End of replay: `phase: "ended"` (the last state stays displayed); `POST /api/replay/restart` or `DARWIN_REPLAY_LOOP=1` restart from zero, connected clients receive `event: reset` (the frontend clears its display) then the events from `seq: 1`.

**Journal validation** (`backend/replay.ts`): one JSON line per event with a known `type`, increasing ISO `ts`, numeric `tick`, object `data`. Otherwise a clear error with the line number; unknown type = line skipped (counted in `meta.skipped`); truncated last line tolerated; `seq` renumbered 1..N if needed (`meta.renumbered`) because the stream requires gap-free `seq`s. `system.warning/error` are masked a second time (`redact.ts`).

### Events of a visitor mission (chat thread)

The journal of a visitor mission (`task.posted` with `requester.kind: "visitor"`) chains the following, all recognisable by `data.taskId` (except `task.posted`: `data.task.id`, and `bid.placed`: `data.bid.taskId`):

| Order | Event | Useful content for a chat thread |
|---|---|---|
| 1 | `task.posted` | `task`: title, instruction (`prompt`), profession, budget, `requester.label` (the visitor) |
| 2 | `bid.placed` (0..n) | `bid`: `agentId`, `price`, `etaTicks`, `pitch?` (L18: a sales sentence, one line, <= 240 characters, no markup, truncated at a word with "…"; absent from the run5 to run9b journals) |
| 3 | `task.awarded` or `task.expired` | winner, price, number of bids; or expiry reason |
| 4 | `escrow.locked` | `payer`, `amount`, `tx` (nearblocks link via the `chain.tx` with the same hash) |
| 5 | `brain.charged`, `deliverable.produced` | the agent's AI cost (`purpose: "bid"` for the pitch in real mode, `"execute_task"` for the work); produced files `files[] = {name, mime, bytes, content?, truncated?}` (L18): `bytes` = real UTF-8 size of the complete file, `content` = text, already-sanitised SVG or Markdown, **PUBLIC**, capped at 24,000 characters per file and 64,000 per deliverable (`truncated: true` if cut). The run5 to run9b journals only have name/mime/size: `GET /api/tasks/:id/deliverable` then answers 404 in replay; with `content` on all files it is served (`{taskId, profession, agentId, files:[{name,mime,content,truncated?}], resultHash, ..., verdict, score}`). Real order: `task.validated`, then `deliverable.produced`, then `escrow.released`. `/api/state` and `/api/tasks` carry neither list pitch nor content; only `/api/stream`, `/api/events`, `/api/replay/missions` and the deliverable endpoint do |
| 6 | `task.submitted` | `resultHash` |
| 7 | `task.validated` | `validation`: `verdict`, `score`, `validator`, `reason` |
| 8 | `escrow.released` (accepted) or `escrow.refunded` (rejected) + `reputation.updated` | payment `payee`/`amount`/`tx`, reputation change |

Run8 contains no visitor mission (simulated clients only); run9a/run9b do (rejected/expired missions, journal placed in `docs/preuves/`).
