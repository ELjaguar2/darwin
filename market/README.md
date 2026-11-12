# market/: task market (lot L6, English since L19)

`createMarket(deps, opts)` returns a `Market` (`shared/modules.ts`) plus `postVisitorTask`, `getEscrow`, `accountIds`, `visitorSpentLastHour`, `visitorHourlyCap`. It depends only on `shared/` (Chain, Brain, Journal, Config); everything works with `MockChain` and `MockBrain`.

## Language (L19)
Everything the market generates or displays is English: catalogue titles, descriptions and rubrics, simulated-client templates and market-event titles, judge and production prompts (each ends with "Always answer in English."), check messages, rejection reasons, error messages, mock pitches. The target language of a translation defaults to English, even for a task written in French (an explicit "into French" is honoured; any other named language is not checked). Pitches must be English (`pitchLanguageOk`).

**Protocol values left as they are** (read by the frontend, the backend and journal/replay tests):
- API badges are English since L19: `"simulated"` (`SIMULATED_BADGE`), `"subcontracting"` (`SUBCONTRACT_BADGE`), `"Visitor (funded by the demo account)"` (`VISITOR_FUNDING_LABEL`). They are computed by the backend from `requester.kind` (never stored in the journal). The former French values (`"simulé"`, `"sous-traitance"`, `"Visiteur (financé par le compte de démo)"`) are still recognised through `LEGACY_BADGES` and `badgeLabelOf(badge)` / `BADGE_LABELS`.
- Deliverable file names `analyse.md`, `texte.md`, `traduction.md`, `checklist.md` (and `logo-N.svg`, `architecture.md`, `schema.mmd`), validator ids (`rule:*`, `brain:*`, `visitor`), error and event codes, rejection codes (`no_bids`, `deadline`).
- The simulated client label prefix is display-only and is now `Simulated client` (`SIMULATED_LABEL_PREFIX`); the legacy `Client simulé` prefix is still recognised (`LEGACY_SIMULATED_LABEL_PREFIX`). The protocol marker is `requester.kind = "simulated"`.
- Rubric criterion ids are now English (`originality`, `fidelity`, `fit`, `hook`, ...); the judge verdict parser accepts `reason=` and the legacy `raison=`.

## Cycle
`postTask` -> `placeBid` -> `step(tick)` (close, award, `lockEscrow`) -> execution by the agent (engine) -> `submitResult` (validation, then `releaseEscrow` with proof, or `refundEscrow`) -> `addReputation`.
Events emitted: `task.posted`, `bid.placed`, `task.awarded`, `escrow.locked`, `task.submitted`, `task.validated`, `escrow.released`, `escrow.refunded`, `task.expired`, `subcontract.created`, `reputation.updated`, `funding.received` (market accounts), `brain.charged` (judge), `system.warning`.

## Award
Lowest price; tie: best reputation (`Chain.getReputation`), then shortest announced delay, then oldest bid. Deterministic. Bids from dead agents are ignored. One bid per agent; price in ]0, budget]; an agent cannot bid on its own subcontracting chain (requester or ancestor).

## Escrow
- Locked amount = **price of the winning bid** (at most the budget), locked at award, paid once to the winner.
- Release: only with a recorded `accepted` verdict whose `resultHash` matches the submitted result, after checking that the on-chain escrow matches (amount, payer). Proof = `{resultHash, verdict:"accepted", validator}` produced by the operator, **not cryptographically verified**.
- Refund: only on `rejected` (recorded rejection verdict) or `expired` (no usable bid, deadline passed, winner dead). An internal check refuses any other case.
- Interrupted payment (chain error): the task stays `submitted` with its validation; `step` resumes it. Payee dead before payment: refund, task `expired`.
- If the payer cannot lock: `system.warning` `ESCROW_LOCK_FAILED`, task expired (reason `no_bids`, no dedicated reason in the catalogue).

## Trust model (to be repeated in the root README)
The operator is the validation oracle: a rule or model chosen by the operator; the system is **not** trustless. `task.validated` journals `validator` ("validated by: <validator>") and `resultHash`. The validator is never the paid agent nor the subcontracting agent (a validator named like them or `agent:*` is refused). Default: composite judge = base rule (`rule:basic`, floor) then AI judge (`brain:<model>`). **Fail closed**: with a real brain (`brain.kind !== "mock"`), if the judge is unavailable (outage, 30 calls/minute cap = `RATE_LIMITED`, unreadable reply), nothing is released: `system.warning` `JUDGE_UNAVAILABLE`, `submitResult` throws `MarketError VALIDATION_PENDING` (503) and the task stays `submitted` without validation. Each `step` retries; after `deadlineTick + validationGraceTicks` (default `taskDeadlineTicks`) the task expires and the escrow is refunded, without reputation penalty for the agent. Only mock mode allows falling back on the base rule (flagged). A rejection by the base rule does not need the judge. Client validation is possible through `clientValidator` (`validator: "visitor"`). The judge cost is charged to the **treasury** (`brain.charged` with `agentId: "treasury"`), never to the winning agent; it is not debited on-chain (journal accounting).

## Accounts owned by the market
The market creates and funds (from the master, on first need then top-ups) two sub-accounts: `visitors.<master>` (`funding.received` `source: "demo"`) and `sim-client.<master>` (`source: "master"`). The paying account of a visitor task is always `visitors`: the caller does not choose it. Subcontract tasks are paid by the requesting agent's account (registry `Chain.getAgentRecord`).

## Visitors and simulated client
- Visitor label: badge `"Visitor (funded by the demo account)"` (`VISITOR_FUNDING_LABEL`): the operator's test funds, not the visitor's money.
- Hourly spending cap of the visitors account: sum of published budgets over a sliding 60 min; beyond it `MarketError VISITOR_CAP_EXCEEDED` (`httpStatus` 429). Value: `opts.visitorHourlyCap`, else `config.sim.visitorHourlyCap` if `shared` adds it (`DARWIN_VISITOR_HOURLY_CAP_NEAR`), else 10 x max budget. The 10 open tasks per IP remain the backend's job.
- `postVisitorTask(input)`: validates `TaskInputSchema`, bounds `taskBudgetMin/Max` (400).
- **Simulated** client (`createSimulatedClient(deps, market).tick(tick)`): Poisson draw (`simClientRatePerTick`), varied tasks per profession with English titles and prompts, `requester.kind = "simulated"`, label always prefixed `Simulated client`, badge `"simulated"`. Never presented as a real client.
- Visitor text: never in a `system` message. `taskMessages(task, personality)` (for the engine) and `judgeMessages` put it as JSON in a `user` message.

## Subcontracting
`postTask` with `requester: {kind:"agent"}` and `parentTaskId`: the parent must be `awarded` with this agent as winner; budget **strictly below** the parent's winning price (the agent keeps the margin); max depth 2. Emits `subcontract.created`. The parent's result does not wait for the child's.

## Current tick
The market keeps the highest tick seen in `step(tick)` or in journal events (subscription). Delays: `biddingEndsTick = tick + bidWindowTicks`, `deadlineTick = biddingEndsTick + taskDeadlineTicks`; expiry when `tick > deadlineTick`.

## Reputation
Accepted +1, rejected -2, missed deadline -2 (`opts.reputationDeltas`). Each adjustment carries a proof (`resultHash` or expiry hash) and is applied once per task and agent.

## Tests
`market/market.test.ts`: full cycle with conservation of funds, price tie, subcontracting (margin, self-dealing), rejection, expiry without bids, deadline exceeded, failing or forbidden validator, resumed payment, hourly cap 429, market accounts, simulated client, message isolation, AI judge. `market/freelance.test.ts`: catalogue, extraction, checks, per-profession cycle, market events, minimum price, and the L19 English tests (templates, prompts, labels, badges, language target).

## Real freelance (L16)

Catalogue: `shared/catalogue.ts` (6 professions, floor `nearPrice`, `rubric`, `acceptScore`, instructions, `maxOutputTokens`, `demandWeight`); prices sourced in `docs/CATALOGUE_FREELANCE.md`. Decisions D-037 to D-041.

- **Minimum price**: `postTask` refuses (visitor or simulated client) a budget < `CATALOGUE[profession].nearPrice` (`BUDGET_OUT_OF_RANGE`, clear message). Subcontracting is not concerned (budget < winning price).
- **Deliverable**: `extractDeliverable(task, agentId, rawText, costs)`: logo = exactly 3 svg blocks -> `logo-1..3.svg`; architecture -> `architecture.md` + `schema.mmd`; finance -> `analyse.md`; marketing -> `texte.md`; translation -> `traduction.md`; legal -> `checklist.md`. SVGs are sanitised by REJECTION (`sanitizeSvg`). `market.getDeliverable(taskId)` / `listDeliverables()` (in memory, lost on restart). Event `deliverable.produced` `{taskId, profession, agentId, files:[{name,mime,bytes,content?}], productionCostUsd, judgeCostUsd, resultHash}`, emitted after the verdict.
- **Judges**: `professionRule()` (`rule:<profession>`, deterministic checks of `checks.ts`) then `brainJudge` with the profession rubric (score per criterion, weighted score >= `acceptScore`). The `createMarket` default composes them. Rejection = refund (tested for the 6 professions). The judge cost is charged to the treasury and reported in `judgeCostUsd`. The judge system prompt (`JUDGE_SYSTEM`) is English and ends with "Always answer in English.".
- **Market events**: `createMarketEvents` -> `market.event` `{event: MarketEvent}` (English titles); `createSimulatedClient(deps, market).events` exposes the active events for the interface.
- **Mock**: `MockBrain` produces a valid deliverable per profession and scores 0.8 per criterion; a deliberately bad deliverable is rejected by the deterministic checks.
- **Escrow security review (L16)**: no payment path modified; release still requires a recorded `accepted` verdict with an identical `resultHash`; deliverable extraction has no effect on money (an unexpected error emits `DELIVERABLE_FAILED`, settlement continues as before); an agent's SVG content is only kept sanitised (rejected otherwise); the backend must serve it with a strict `Content-Type`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, and the frontend must display it in `<img>` (never inline in the DOM). L19 changed only language, no money path.
