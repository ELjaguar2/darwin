# ARCHITECTURE

> Owner: architect (`architecte`). Version L1 of 2026-11-09. Sources verified on 2026-11-09 (see `docs/DECISIONS.md` D-003 to D-019). In case of conflict between this document and the code in `shared/`, the code in `shared/` is authoritative and this document must be corrected the same day.
> Any developer must be able to start their work package from this document alone, in mock mode.

## 1. Principles

1. **Mock first**: `Chain` and `Brain` are interfaces; `MockChain` and `MockBrain` already exist in `shared/mock/`. Nothing depends on a key or on the network to run.
2. **A single source of history**: the event journal (§8). The web interface and the tests are rebuilt from it.
3. **Exact money**: yoctoNEAR as `bigint` / decimal string (D-012).
4. **Never credit without verified proof**: escrow is only released with an `accepted` proof (D-015).
5. **Directed dependencies**: `shared` <- everything; no module reads `process.env` (all receive `Config`); no business module imports `near-api-js`.
6. **Honesty**: everything simulated is labelled (`mock:true`, `simulated` client, `degraded` mode).

## 2. Stack (versions verified on 2026-11-09)

| Component | Choice | Version | Verification |
|---|---|---|---|
| Runtime | Node.js | 22 LTS (>= 22.12 mock; **>= 22.22.2 testnet**) | `engines` of near-api-js 7.4.0; docs.near.org/tools/near-api |
| Language | TypeScript strict | 6.0.3 | npm |
| HTTP server + SSE | Hono + `@hono/node-server` | 4.13.17 / 2.1.6 | npm, `npm audit` = 0 |
| Validation | zod | 4.6.7 | npm |
| Tests | vitest | 5.1.0 | npm |
| TS execution | tsx | 4.23.15 | npm |
| NEAR client | near-api-js (optional, dynamic) | 7.4.0 | npm `latest`; docs.near.org/tools/near-api (`Account`, `JsonRpcProvider`, `createSubAccount`, `transfer`, `callFunction`) |
| Contracts | Rust, `near-sdk` | 5.30.1 | crates.io; docs.near.org/smart-contracts/quickstart ("only official SDK") |
| Contract build | `cargo-near` | 0.23.0 | crates.io (the docs cite 0.16.1 as tested: dev-contrats confirms) |
| Testnet RPC | `https://test.rpc.fastnear.com` | — | docs.near.org/api/rpc/providers |
| AI | NEAR AI Cloud, `https://cloud-api.near.ai/v1` | OpenAI-compatible | SPECS C-01 to C-06 |
| Frontend | HTML + ES modules + CSS, no build | — | D-009 |

No database: state lives in memory in the engine, history in `data/journal.jsonl` (in V1 the simulation restarts from zero at every launch). No Docker needed.

Local constraint observed: `rustc`/`cargo` are not installed on the development machine. Mock mode does not need them; dev-contrats installs the toolchain (free) or enables the fallback D-016.

## 3. Overview

```
                       browser  (frontend/ : HTML + ES modules)
                          |  GET /api/state, POST /api/tasks      ^ SSE /api/stream
                          v                                       |
 +--------------------------------------------------------------------------+
 | backend/  (Hono)  composition root: builds Config, Chain, Brain,         |
 |                   Journal, Market, Engine; exposes REST + SSE + static   |
 +------+-------------------+----------------------+------------------------+
        |                   |                      |
   engine/  <----------->  market/               intents/ (V2, flag off)
   life cycle, ticks,      tasks, auctions,
   genome, economy         escrow, validation,
        |    |             reputation
        |    +--------------+
        v                   v
     brain/ (Brain)     accounts/ (Chain)  ---->  contracts/darwin (Rust, testnet)
     MockBrain          MockChain
     NearAiBrain        NearChain (near-api-js)
        ^                   ^
        +----  shared/  ----+   types, interfaces, mocks, config, journal, money
```

## 4. Modules and boundaries

| Folder | Owner | Exports | May import | Must not |
|---|---|---|---|---|
| `shared/` | architect | types, `Chain`, `Brain`, `Market`, `Engine`, `Intents`, `Journal`, `Config`, `MockChain`, `MockBrain`, utilities (`money`, `rng`, `hash`) | `zod`, `node:crypto` | import another module; read `process.env` outside `loadConfig` |
| `contracts/darwin/` | dev-contrats | WASM contract (§10) | Rust only | be required by mock mode |
| `accounts/` | dev-comptes-wallets | `createChain(config): Chain`; `NearChain` | `shared`, `near-api-js` (dynamic import) | contain market or evolution logic; log a key |
| `brain/` | dev-cerveau-ia | `createBrain(config): Brain`; `NearAiBrain` (+ prompts) | `shared` | debit a balance (that is the engine's role); hard-code a model id without checking it via `/v1/models` |
| `market/` | dev-marche | `createMarket(deps): Market` | `shared` (hence `Chain` for escrow/reputation) | know the genome or the life cycle; call `Brain` to execute tasks |
| `engine/` | dev-moteur-evolution | `createEngine(deps, market): Engine`; genome, mutation, letter, metabolism | `shared`, `Market` interface | import `accounts/` or `brain/` directly (injection); emit an event outside the catalogue |
| `intents/` | dev-intents | `createIntents(config): Intents` (mock + 1Click `dry:true`) | `shared` | `dry:false`, deposit, mainnet signing; start if `INTENTS_ENABLED!=true` |
| `backend/` | dev-backend | `main.ts`, Hono app, SSE, journal persistence, launch scripts | everything (composition root) | contain business rules |
| `frontend/` | dev-frontend | static pages | HTTP/SSE only (never a TS import from other folders; types copied as JSDoc) | talk to the chain or the AI directly |
| `tests/e2e/` | qa | end-to-end scenarios (start the backend in mock) | everything | modify the code under test |
| `scripts/` | securite (`scan-secrets.*`), dev-backend (launch) | utility scripts | — | embed a secret |

Unit tests: next to the code (`engine/xxx.test.ts`, `market/xxx.test.ts`, `shared/shared.test.ts`), run by `npm test` (vitest finds all `*.test.ts`). E2E tests: `tests/e2e/*.test.ts`.

## 5. Final folder structure

```
Darwin/
  CLAUDE.md  README.md  LICENSE(*)  package.json  tsconfig.json  .env.example  .gitignore
  docs/            SPECS, CONFORMITE, ARCHITECTURE, DECISIONS, PLAN, STATUS, BESOINS_HUMAIN, SECURITE, ...
  shared/          index.ts money.ts rng.ts hash.ts types.ts events.ts chain.ts brain.ts bus.ts
                   config.ts modules.ts mock/{mock-chain.ts,mock-brain.ts} shared.test.ts     (done, L1)
  contracts/darwin/  Cargo.toml  src/{lib.rs,registry.rs,escrow.rs,reputation.rs}  tests/        (L3)
  accounts/        index.ts (createChain)  near-chain.ts  keys.ts                                 (L2)
  brain/           index.ts (createBrain)  near-ai-brain.ts  prompts.ts                            (L5)
  market/          index.ts (createMarket)  auction.ts  validation.ts  simulated-client.ts         (L6)
  engine/          index.ts (createEngine)  genome.ts  lifecycle.ts  economy.ts  policy.ts         (L4)
  intents/         index.ts (createIntents)  mock-intents.ts  oneclick.ts                          (L9)
  backend/         main.ts  app.ts  sse.ts  journal-store.ts  state.ts                             (L7)
  frontend/        index.html  app.js  tree.js  style.css                                          (L8)
  scripts/         scan-secrets.mjs  (+ launch scripts if needed)
  tests/e2e/       *.test.ts                                                                       (L12)
  data/            journal.jsonl (runtime, ignored by git)
```
(*) `LICENSE` is mandatory (SPECS L-02): the writer / project lead is responsible (MIT proposed).

Imports: always with the `.ts` extension (`import { X } from "../shared/index.ts"`). `tsconfig.json` covers all folders except `frontend/` and `contracts/`.

## 6. Interfaces

Everything is defined in `shared/` (compiled and tested code). Summary; the signature details are in the code.

### 6.1 `Chain` (`shared/chain.ts`)
- Accounts: `createAccount({label, initialFunding, fundFrom?})` -> sub-account `label.<master>`; `getBalance`; `transfer`; `closeAccount` (death: remaining balance returned to the beneficiary, account closed).
- Registry: `registerAgent` (genome + hash, lineage), `markAgentDead`, `getAgentRecord`, `listAgentRecords`: the lineage is kept after death.
- Escrow: `lockEscrow` -> `releaseEscrow` (proof mandatory, otherwise `ChainError PROOF_REQUIRED`) or `refundEscrow` (reasons `rejected` or `expired` only, like the contract).
- Reputation: `addReputation` (non-zero integer delta, |delta| <= 100; credit only after escrow released to that agent with `proofHash` = `resultHash`; penalty only after a refund; one write per task and agent, otherwise `REPUTATION_EXISTS`), `getReputation`. `MockChain` applies these rules (D-031).
- Notable error codes: `SPEND_CAP_EXCEEDED` (spending cap of `NearChain`, distinct from `INSUFFICIENT_FUNDS`).
- `AgentRecord.accountId` is the agent's paying account (costs, escrow) and beneficiary account (payments). `getEscrow(taskId)` returns `{taskId, payer, amount, status}` (D-030).
- Every write operation returns a `TxReceipt` (`hash`, `explorerUrl?`); errors are typed `ChainError`s.
- Implementations: `MockChain` (done; tested invariant: sum of accounts + escrows constant); `NearChain` (L2/L3). Single factory `createChain(config)` in `accounts/index.ts`.

### 6.2 `Brain` (`shared/brain.ts`)
- `listModels()` (ids + USD/Mtok prices, read from `GET /v1/models`), `defaultModel()`, `complete({agentId, purpose, model, messages, maxTokens})` -> `{text, usage, model, mock}`.
- The Brain debits nothing. The engine calls `costYocto(usage, price, nearUsdRate)` (`shared/money.ts`), emits `brain.charged` and debits the agent (D-013).
- `NearAiBrain`: `POST {NEARAI_BASE_URL}/chat/completions`, header `Authorization: Bearer ${NEARAI_API_KEY}`, `usage.completion_tokens_details.reasoning_tokens` (alias `reasoning_tokens`) must be read; if `/v1/models` does not have the gene's model: `BrainError UNKNOWN_MODEL`, fallback to `defaultModel()`. Without a key: `createBrain` returns `MockBrain`.

### 6.3 `Market`, `Engine`, `Intents` (`shared/modules.ts`)
- `Deps` = `{config, chain, brain, journal, rng, now}` injected into all factories.
- `Market`: `postTask`, `placeBid`, `step(tick)`, `submitResult` (validates, then releases or refunds), `getTask`, `listTasks`, `openTasks`.
- `Engine`: `start/pause/resume/stop`, `tick()` (one tick without a clock, for tests), `getState(): SimState`.
- `Intents`: `quoteDry` only.

### 6.3b Ownership of service accounts and time (D-027 to D-029)
- `chain.tx` in mock: `MockChain` has no journal; it is the engine (`createEngine(deps, market, { emitChainTx: true })`, type `EngineOptions`) that emits `chain.tx` for its transfers. The backend does not wrap `MockChain`. With `NearChain`, `accounts/` already emits: option set to false.
- (D-029) The market owns, creates and funds the `sim-client` and `visitors` accounts (`Chain.createAccount`, funding from the master, `funding.received` source `master`/`demo`). It infers the current tick from the last `step(tick)` or from the journal (no additional injected clock).
- Demo calibration: `nearUsdRate` = 0.01 so that the "model" gene weighs on the economy (one `mock/large` call ≈ 0.07 NEAR, `mock/small` ≈ 0.01 NEAR, against a metabolism of 0.08/tick). See D-028.

### 6.4 Division of labour agent <-> market
The agent (engine) decides: whether to bid, at what price (genome `askRatio` x budget, bounded by its estimated AI cost), to execute (`Brain` call, cost debited), to subcontract (create a child task via `Market.postTask` with `requester:{kind:"agent"}`). The market only knows agent identifiers and accounts.

## 7. Data schemas (`shared/types.ts`)

All JSON-serializable; amounts = `Yocto` (integer string).

| Object | Main fields |
|---|---|
| **Genome** | `profession` (writer, translator, summarizer, analyst, coder), `model`, `askRatio` [0.3-1] (asking price / budget), `risk` [0-1], `reproThreshold` [1.2-4] (multiple of birth capital), `generosity` [0-0.6] (share of extra capital given to the child), `cooperation` [0-1] (subcontracting), `personality` (system prompt). Validated by `GenomeSchema`, bounds in `GENOME_BOUNDS`. |
| **Agent** | `id` (a-0001), `name`, `accountId`, `generation`, `parentId`, `childrenIds`, `genome`, `status` (alive/dead), `birthTick/deathTick`, `bornAt/diedAt`, `causeOfDeath` (starvation/manual/reset), `birthCapital`, `balance`, `earned`, `spentBrain`, `reputation`, `tasksDone`, `letterId`, `birthTx`. |
| **Task** | `id` (t-0001), `requester` (`visitor` / `simulated` / `agent`), `parentTaskId?`, `profession`, `title`, `prompt`, `budget`, `status` (posted, awarded, submitted, settled, rejected, expired), `createdTick`, `biddingEndsTick`, `deadlineTick`, `winnerId`, `winningBidId`, `bidIds`, `escrowId`, `result{text,resultHash,submittedTick}`, `validation`. |
| **Bid** | `id`, `taskId`, `agentId`, `price`, `etaTicks`, `pitch?`, `tick`, `won?`. |
| **Escrow** | `id` (= taskId), `taskId`, `payer`, `payee?`, `amount`, `status` (locked/released/refunded), `lockTx`, `settleTx`, `proof{resultHash,verdict:"accepted",validator}`. |
| **Validation** | `verdict` (accepted/rejected), `score` [0-1], `validator` (`brain:<model>` / `rule:<name>` / `visitor`), `reason`, `resultHash`, `tick`. |
| **Letter** | `id` (l-0001), `fromAgentId`, `toAgentId`, `generation`, `text`, `model`, `mock`, `tick`, `createdAt`. |
| **DarwinEvent** | `{seq, ts, tick, type, data}` (§8). |
| **TaskInput** (visitor form, `TaskInputSchema`) | `title` 3-120, `prompt` 10-4000, `profession`, `budgetNear` (decimal, bounded by `DARWIN_TASK_BUDGET_MIN/MAX`), `requesterLabel`. |

Task award rule: award to the best score = lowest price, ties broken by reputation (details left to dev-marche, documented in `market/`).

## 8. Event catalogue (`shared/events.ts`, type `EventCatalog`)

Append-only journal, `seq` increasing without gaps. Adding a type requires modifying `EventCatalog` + `EVENT_TYPES` + this table.

| Type | Emitted by | Payload (`data`) |
|---|---|---|
| `sim.started` | engine | mode, preset, seed, chain, brain |
| `sim.paused` / `sim.resumed` | engine | — |
| `sim.stopped` | engine | reason (extinction/manual/max_ticks/error), generations |
| `sim.tick` | engine | alive, tasksOpen, totalBalance |
| `agent.born` | engine | full agent, parentId, birthTx |
| `agent.reproduced` | engine | parentId, childId, transferred, mutations (gene -> [before, after]) |
| `agent.died` | engine | agentId, cause, finalBalance, swept, sweptTo, tx |
| `letter.written` | engine | letter |
| `task.posted` | market | task |
| `bid.placed` | market | bid |
| `task.awarded` | market | taskId, bidId, winnerId, price, bids |
| `task.expired` | market | taskId, reason (no_bids/deadline/unfunded/winner_dead) |
| `escrow.locked` | market | taskId, payer, amount, tx |
| `task.submitted` | market | taskId, agentId, resultHash |
| `task.validated` | market | taskId, validation |
| `escrow.released` | market | taskId, payee, amount, tx |
| `escrow.refunded` | market | taskId, payer, amount, tx |
| `subcontract.created` | market | parentTaskId, childTaskId, byAgentId, profession?, budget?, parentPrice?, commission?, deadline? (optional since L21; commission = planned: parentPrice - budget, yocto; deadline = child deadline tick, strictly before the parent's) |
| `subcontract.integrated` | engine | parentTaskId, childTaskId, childAgentId, childProfession, childPrice, parentPrice, commission (yocto; REAL commission = parentPrice - childPrice). Emitted when the child's accepted deliverable is integrated in the parent's; the integrated section ("## Subcontracted to ...") is in `deliverable.produced.files[].content` of the parent |
| `subcontract.fallback` | engine | parentTaskId, childTaskId? (absent if the sub-task could not be posted), reason ("no_bids" \| "rejected" \| "deadline" \| "failed"), commission ("0": none earned). The parent did the part itself and delivered in time |
| `reputation.updated` | market | agentId, delta, total, taskId, tx |
| `brain.charged` | engine | agentId, purpose, model, promptTokens, completionTokens, reasoningTokens, cost, costUsd, nearUsdRate, priceSource (`models`/`mock`), mock, tx |
| `balance.changed` | engine | agentId, balance, delta, reason (metabolism/brain/task/birth/...) |
| `funding.received` | engine/backend | to, amount, source (master/faucet/demo), tx |
| `chain.tx` | accounts (NearChain, injected journal); engine in mock (`emitChainTx`, D-027) | kind, from, to, amount, hash, explorerUrl: feeds the UI "transaction feed" |
| `intents.quote` | intents | `dry:true` quote only |
| `system.warning` / `system.error` | all | code, message (never a secret) |

Rule: every event that touches money carries a `tx`/`hash` (mock or real) so that the UI shows the transaction feed.

## 9. Real time and API

**Stream: SSE** (D-008). `GET /api/stream`: `Content-Type: text/event-stream`; each message `id: <seq>`, `event: <type>`, `data: <DarwinEvent JSON>`; the `Last-Event-ID` header (or `?since=<seq>`) replays missed events; `: ping` comment every 15 s. Client-side initialisation: `GET /api/state` (`SimState.lastSeq`), then `EventSource` from `lastSeq`.

| Route | Role |
|---|---|
| `GET /api/health` | `{ok, mode, chain, brain, tick, escrow: "contract" \| "operator-account"}` (D-022) |
| `GET /api/config` | public configuration (`redactConfig`) |
| `GET /api/state` | full `SimState` |
| `GET /api/agents`, `/api/agents/:id` | agents (alive and dead), detail + lineage |
| `GET /api/lineage` | tree `{id, parentId, generation, status}` for the family tree |
| `GET /api/letters/:id`, `/api/agents/:id/letter` | parent -> child letter |
| `GET /api/tasks`, `/api/tasks/:id` | tasks, bids, escrow, validation |
| `POST /api/tasks` | visitor form; body = `TaskInput`; 201 + `Task`, 400 if invalid (zod errors), 429 beyond 10 open tasks per IP |
| `GET /api/events?since=&limit=` | paginated journal |
| `POST /api/sim/start|pause|resume|stop` | control; requires `Authorization: Bearer ${DARWIN_ADMIN_TOKEN}`; the token is MANDATORY whenever `HOST` is not `127.0.0.1` (startup refused otherwise, D-023) |
| `GET /*` | static `frontend/` |

The server listens on `127.0.0.1:3000` by default. No route returns a secret or the raw configuration.

## 10. NEAR contract `contracts/darwin` (Rust, near-sdk 5.30.1)

One contract, three modules, one operator (the master account). Minimal methods:
- Registry: `register_agent(record)`, `mark_dead(agent_id, death_tick, cause)`, views `get_agent`, `list_agents(from,limit)`.
- Escrow: `lock_escrow(task_id, payer)` payable (the deposit is received by the contract), `release_escrow(task_id, payee, proof)` (non-empty proof, verdict `accepted`), `refund_escrow(task_id, reason)`, view `get_escrow`.
- Reputation: `add_reputation(agent_id, task_id, delta, proof_hash)`, view `get_reputation`.
- Guard: only the operator and (for `lock_escrow`) the authorised payer call the write methods. NEP-297 JSON events for every write.
- Assumption to be confirmed by dev-contrats: the payer of `lock_escrow` is a sub-account held by the engine; the engine therefore signs for sub-accounts (keys generated by `accounts/`, stored outside the repository, never logged).

`Chain` -> contract mapping: `registerAgent` -> `register_agent`; `lockEscrow` -> `lock_escrow`; `releaseEscrow` -> `release_escrow`; `addReputation` -> `add_reputation`. `createAccount`, `transfer`, `closeAccount` are account actions (no contract).

## 11. Environment variables

Commented details in `.env.example`; default values in `shared/config.ts` (`loadConfig`). Secrets are marked SECRET and never appear in logs (`redactConfig`).

| Group | Variables |
|---|---|
| Mode | `DARWIN_MODE` (mock/testnet), `DARWIN_PRESET` (normal/demo), `DARWIN_CHAIN` (mock/near), `DARWIN_BRAIN` (mock/nearai), `DARWIN_SEED` |
| Server | `HOST`, `PORT`, `DARWIN_DATA_DIR`, `DARWIN_ADMIN_TOKEN` (SECRET, mandatory if `HOST` != `127.0.0.1`), `DARWIN_VISITOR_HOURLY_CAP_NEAR` (hourly cap of the demo account, in NEAR; read into `sim.visitorHourlyCap: bigint`, defaults: mock normal 20 / demo 30, testnet 0.5; D-025, D-026) |
| NEAR | `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_MASTER_ACCOUNT_ID`, `NEAR_MASTER_PRIVATE_KEY` (SECRET), `NEAR_CONTRACT_ID` |
| NEAR AI Cloud | `NEARAI_API_KEY` (SECRET), `NEARAI_BASE_URL`, `NEARAI_MODEL`, `NEARAI_TIMEOUT_MS` |
| Simulation | see §12 |
| Intents | `INTENTS_ENABLED`, `INTENTS_BASE_URL`, `INTENTS_JWT` (SECRET), `INTENTS_DRY_ONLY` |

Resolution (D-011): `mock` (default) = mock chain and brain. `testnet` = `near` chain (requires `NEAR_MASTER_ACCOUNT_ID` and `NEAR_MASTER_PRIVATE_KEY`, otherwise a clear error at startup and a line in `docs/BESOINS_HUMAIN.md`); `nearai` brain if `NEARAI_API_KEY`, otherwise mock + `system.warning`.

## 12. Simulation parameters

Target: **3 complete generations in 3 to 5 minutes** with `DARWIN_PRESET=demo` (mock). Amounts in NEAR, durations in ticks. Defaults (mock); the testnet table is in `shared/config.ts`.

| Variable | normal | demo | Role |
|---|---|---|---|
| `DARWIN_TICK_MS` | 1000 | 400 | real duration of a tick |
| `DARWIN_FOUNDERS` | 4 | 4 | founders (generation 1) |
| `DARWIN_MAX_POPULATION` | 24 | 16 | population cap (no births beyond) |
| `DARWIN_MAX_TICKS` | 0 (infinite) | 900 | automatic stop (900 x 0.4 s = 6 min) |
| `DARWIN_BIRTH_CAPITAL` | 10 | 10 | birth capital |
| `DARWIN_METABOLISM` | 0.05 | 0.08 | cost of living per tick |
| `DARWIN_MIN_VITAL` | 1 | 1.5 | below this balance: death |
| `DARWIN_REPRO_COOLDOWN_TICKS` | 20 | 10 | minimum delay between two children |
| `DARWIN_SIM_CLIENT_RATE` | 1.2 | 1.5 | simulated tasks per tick (expectation) |
| `DARWIN_TASK_BUDGET_MIN/MAX` | 0.5 / 2 | 0.5 / 2.5 | task budgets |
| `DARWIN_BID_WINDOW_TICKS` | 2 | 1 | auction duration |
| `DARWIN_TASK_DEADLINE_TICKS` | 8 | 5 | execution deadline |
| `DARWIN_MUTATION_RATE` / `_SD` | 0.3 / 0.15 | 0.4 / 0.2 | mutation per gene / relative amplitude |
| `DARWIN_NEAR_USD_RATE` | 3 | 0.01 (D-028) | USD per NEAR to convert the AI cost |
| `DARWIN_MAX_TOKENS_PER_CALL` | 400 | 300 | token cap per AI call |
| `DARWIN_SETTLE_EVERY_TICKS` | 1 | 1 | batching of on-chain debits (4 on testnet) |
| `DARWIN_VISITOR_HOURLY_CAP_NEAR` | 20 | 30 | hourly cap of the `visitors` account (testnet: 0.5); 429 beyond |

Intended order of magnitude (to be calibrated by dev-moteur with QA): a founder with no income dies in about (10 - 1.5) / 0.08 = 106 ticks; an agent earning on average more than 0.08 + AI cost per tick reaches the reproduction threshold (`reproThreshold` x capital) before tick 60; the 3rd generation is born before tick 300. If calibration fails, adjust the presets (file `shared/config.ts`), not the engine.

Testnet: deliberately tiny amounts (capital 0.2-0.3 NEAR), slow ticks (3-4 s), batched debits; the faucet limits the total available (https://near-faucet.io). No amount is fixed from memory regarding the quantity supplied: dev-comptes documents what the faucet actually gives.

## 13. One tick loop (behaviour contract of the engine)

1. Metabolism: `DARWIN_METABOLISM` debited from each living agent (to the master account; batched if `settleEveryTicks > 1`, logical balance = on-chain balance minus pending debts).
2. Simulated client: draws `Poisson(simClientRatePerTick)` tasks (uniform budget, random profession), `Market.postTask` with `requester:{kind:"simulated"}`. Visitor tasks arrive via `POST /api/tasks`.
3. Auctions: each free living agent of the right profession decides whether to bid (`placeBid`); `Market.step(tick)` awards.
4. Execution: the winner calls `Brain.complete` (cost debited, `brain.charged` event), then `Market.submitResult`. With a probability tied to `cooperation`, it subcontracts part of the work.
5. Validation and payment: inside `submitResult` (proof -> `releaseEscrow`, `addReputation`) or refund.
6. Reproduction: if balance >= `reproThreshold` x `birthCapital`, population < max, cooldown elapsed: child (mutation, capital = `birthCapital` + `generosity` x surplus, `Chain.createAccount` + `registerAgent`), then letter via `Brain` (`letter.written`).
7. Death: logical balance < `minVital`: `markAgentDead`, `closeAccount` to the master, `agent.died`. If no one is left alive: `sim.stopped(extinction)`.
8. `sim.tick`.

All random draws go through `Deps.rng` (seed `DARWIN_SEED`): in mock, two runs with the same seed give the same journal (apart from timestamps).

## 14. Launch commands

| Need | Command | Expected |
|---|---|---|
| Install | `npm install` | no key required |
| Run in mock | `npm start` | page at http://127.0.0.1:3000 (work package L7; script defined in `package.json`) |
| Quick mock demo | `npm run start:demo` | 3 generations in a few minutes |
| Tests | `npm test` | vitest, all green (11 tests already in place in `shared/`) |
| Types | `npm run typecheck` | `tsc --noEmit` with no error |
| Testnet | copy `.env.example` to `.env`, fill in `NEAR_MASTER_ACCOUNT_ID`, `NEAR_MASTER_PRIVATE_KEY`, optionally `NEARAI_API_KEY`, then `npm run start:testnet` | Node >= 22.22.2 required |
| Contract build | `npm run contracts:build` | requires Rust + `cargo-near`; unnecessary in mock |
| Secret scan | `npm run scan-secrets` | security work package script |

The `start*` scripts point to `backend/main.ts`, created in work package L7: before L7 they fail (expected).

## 15. Intents (V2, outside V1)

`intents/` (work package L9): `types.ts`, `base.ts`, `oneclick.ts` (complete 1Click client: `GET /v0/tokens`, `POST /v0/quote` with `dry:true` then `dry:false`, `POST /v0/deposit/submit`, `GET /v0/status`), `guard.ts` (locks), `proof.ts` (deposit proof), `mock-intents.ts`, `demo.ts` (CLI: `tokens`, `dry`, `run`, `status`), `intents.test.ts`. Human procedure: `intents/DEMO_MAINNET.md`. Mainnet only (Intents has no testnet); the code never signs, the human sends the deposit from their wallet.

Locks: `INTENTS_ENABLED=false` by default; `dry:false` and `deposit/submit` refused as long as `INTENTS_DRY_ONLY` is not `false` (and written green light in `docs/BESOINS_HUMAIN.md`); an identical `dry:true` quote is mandatory before `dry:false`; cap of 5 USD per operation (`maxUsd`); optional partner key `INTENTS_JWT` (header `X-API-Key`, never logged).

Deposit proof: `verifyDeposit` only issues a proof if `/v0/status` reports `SUCCESS` and cross-checks OUR quote (correlationId, deposit address, recipient, assets, `amountOut >= minAmountOut`, destination hash present, no refund). A credit is only possible once per deposit and never without a proof issued by `verifyDeposit`. No interaction with V1.

## 16. Cross-cutting quality and security

- No module writes a secret into a log, an event or an HTTP response (`redactConfig`, error messages without keys).
- The journal is public by nature (shown in the UI): never put in it a key, a visitor's full system prompt or an e-mail address.
- User input: validated by zod (`TaskInputSchema`); texts escaped on the frontend side (never `innerHTML` on agent or visitor content).
- Limits: 4000 characters per task prompt, 10 open tasks per IP, `maxTokensPerCall`.

## 17. Points to be validated (specs guardian) and risks

Questions 1 to 5 settled by the guardian on 2026-11-09 (Opinion L1, `docs/CONFORMITE.md`); decisions D-020 to D-025.

1. **On-chain AI cost (D-013): ACCEPTED WITH CONDITIONS (D-020).** The NEAR debit = representation, not a payment to NEAR AI Cloud. `brain.charged` carries `costUsd`, `nearUsdRate`, `priceSource`; unknown price = error (`assertValidPrice`), never a silent cost of 0; mock calls are labelled `mock:true`.
2. **Reasoning tokens (C-05): HARDENED RULE (D-021).** `billable = max(completion, total - prompt, reasoning, 0)` (`shared/money.ts`, tested). Still to be verified on a real response (dev-cerveau, L5); may slightly overestimate.
3. **Escrow trust model (D-015): ACCEPTED, mandatory disclosure (D-024).** `validator` and `resultHash` journalled, UI "validated by".
4. **Visitor tasks funded by the demo (D-014): ACCEPTED WITH CONDITIONS (D-025).** `funding.received.source = "demo"`; hourly cap on the `visitors.<master>` account.
5. **Rust toolchain absent (D-016): FALLBACK ONLY, deadline 2026-11-11 23:59 UTC (D-022).** Degraded mode: permanent badge, `/api/health.escrow`.
6. **Node >= 22.22.2 for testnet (D-005)**: to be announced in the README (J-01: the AI judge must be able to run at least the mock on Node 22.12+).
7. **Faucet and testnet explorer URL**: not verified here (`ChainInfo.explorerBase` left empty); dev-comptes verifies and documents them.
8. **LICENSE (L-02)** absent from the repository; outside the architect's scope, to be entrusted to the writer.
9. **Earlier finding**: several coordination files have corrupted encoding (D-019); to be fixed by the project lead.
