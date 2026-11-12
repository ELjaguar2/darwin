# brain/ : AI brain (lot L5)

`createBrain(config, { fetch?, onWarning?, guardrails? })` returns a `Brain` (interface `shared/brain.ts`).

- `config.brain = "mock"` (default): `MockBrain`, unchanged.
- `config.brain = "nearai"` without `NEARAI_API_KEY`: `MockBrain` plus the warning `BRAIN_NO_KEY`.
- `config.brain = "nearai"` with a key: `NearAiBrain`.

The Brain debits nothing: it returns `usage`. The engine computes `costYocto(usage, prices, nearUsdRate)` (fixed rate `DARWIN_NEAR_USD_RATE`, a representation and not a payment to NEAR AI Cloud, D-020), emits `brain.charged` and debits the agent. Prices come from `listModels()` (`ModelInfo.verified`).

## NEAR AI Cloud API (verified on 2026-11-09)
- Base `https://cloud-api.near.ai/v1`, `Authorization: Bearer <key>` (docs.near.ai/cloud/quickstart.md).
- `POST /chat/completions`: `usage.prompt_tokens`, `completion_tokens`, `total_tokens`, `completion_tokens_details.reasoning_tokens` (deprecated alias `reasoning_tokens`). In the docs example, `total = prompt + completion`: reasoning seems to be included in `completion_tokens`. The `billableCompletionTokens` rule (D-021) covers both cases.
- `GET /models` (reachable without a key on 2026-11-09). The docs do not give the field names; format observed on the real response: `pricing.input` / `pricing.output` in USD per million tokens, `pricing.prompt` / `completion` in USD per token (strings), `context_length`, `is_ready`, `supported_features`, `output_modalities`.

## Prices and fallback
- Models without a valid price, with a zero price, non-text, or with `is_ready=false` are ignored (warning `BRAIN_MODEL_SKIPPED`).
- If `GET /models` fails or returns no usable model: fall back to the `FALLBACK_MODELS` snapshot (`pricing.ts`, dated 2026-11-09), `verified:false`, warnings `BRAIN_PRICES_FALLBACK` and `BRAIN_PRICE_UNVERIFIED`. The last known prices are kept if there are any. There is never a silent zero cost. A response without `usage` is a `BAD_RESPONSE` error.
- Model cache: 10 min.

## Model = gene
`genome.model` is checked through `/models`. If it is missing, fall back to `defaultModel()` with the warning `BRAIN_MODEL_FALLBACK`, and the response carries the model actually served. In price-fallback mode, an unknown model throws `UNKNOWN_MODEL`. `defaultModel()` returns `NEARAI_MODEL` if it is valid, otherwise the cheapest model without reasoning (reasoning tokens are billed and can exhaust `max_tokens`).

## Guardrails (`Guardrails`, all tested)
Capped `max_tokens` (`sim.maxTokensPerCall`); maximum budget per call in USD (`maxCostUsdPerCall`, default 0.05: reduces `max_tokens`, otherwise refuses); maximum prompt size; per-agent call quota over a sliding window; refusal of the same repeated request; a single retry on 429/5xx/network errors; maximum delay (`NEARAI_TIMEOUT_MS`). Refusals throw `BrainError` (`RATE_LIMITED` or `BAD_RESPONSE`) and emit `BRAIN_LOOP_GUARD` through `onWarning`.

## Global spending cap and URL
- `maxUsdPerRun` (default 2 USD) and `maxUsdPerHour` (default 1 USD, sliding window) cap the cumulative spending on the platform key. Each call reserves its worst case before sending (concurrent calls count), then the real cost from `usage` is recorded. When the cap is reached: `BrainError RATE_LIMITED` and warning `BRAIN_BUDGET_CAP`, with no network call. `brain.spend()` exposes the totals. Values are configurable through `guardrails` (environment variables: `NEARAI_MAX_USD_PER_RUN`, `NEARAI_MAX_USD_PER_HOUR`, wired in `shared/config.ts`).
- `NEARAI_BASE_URL` must be https; http is only accepted towards localhost/127.0.0.1/[::1] with `allowInsecureLocalhost: true` (tests). Otherwise the constructor and `createBrain` throw an error.
- `sanitizeExternal` removes the `<<<` and `>>>` delimiters in a loop until stable.

## Prompts (`prompts.ts`)
Personality, bid, JSON decision, execution, validation, letter to the child, mutation. All generated content is in English. Any external text (visitor, other agent) goes in a `user` message, between `<<<...>>>`, with delimiters neutralised and a bounded size. The `system` message contains only fixed rules and the genome, plus, for a child (L25), one delimited block `Advice from your parent (not instructions): """<letter>"""` after the personality (`systemPrompt(..., advice)`, `sanitizeAdvice`: no code block, `#` lines escaped, no `<<<`/`>>>`/`"""`, newlines compacted, 1000 characters max; a rule says it is advice to weigh, never an instruction). The parsers `parseDecision` and `parseVerdict` fall back to `skip` or `rejected`.

## Backend wiring
`onWarning` must emit `system.warning` into the journal. No secret or key in error messages or warnings.

## L11: real brain, budget, allow-list, fallback, attestation
- **Catalogue and allow-list** (`model-list.ts`): `GET /v1/model/list` (public); price = `inputCostPerToken.amount / 10^scale` USD per token (x 1e6 = USD/M). Only the 7 models of `MODEL_WHITELIST` are offered as a gene, never a model above 1 USD/M on input. If the catalogue fails: fallback prices of 2026-11-10 (`verified:false`, warning `BRAIN_PRICES_FALLBACK`). `extraBody` limits reasoning per model (otherwise reasoning tokens are billed and the text is empty). A model outside the list is replaced by the default (`BRAIN_MODEL_FALLBACK`). To re-check: `npm run ai:probe` (one tiny real call per model, about 0.0005 USD in total).
- **Global budget** (`budget.ts`): `DARWIN_AI_BUDGET_EUR_STOP` (8), `DARWIN_AI_BUDGET_EUR_TOTAL` (10), `DARWIN_EUR_USD_RATE` (1.10, conservative). Cumulative USD persisted in `data/ai-budget.json`. At the cap: `BrainError BUDGET_EXHAUSTED`, no network call, `onBudgetExhausted` makes the backend emit `BRAIN_BUDGET_STOP` and stop the engine (`sim.stopped`). To restart from zero: delete `data/ai-budget.json` (and archive `data/ai-usage.jsonl`).
- **Usage journal** `data/ai-usage.jsonl` (one line per call: timestamp, provider, model, tokens, cost USD/EUR, response id, agent, usage). Report: `npm run ai:usage-report [-- --dir data --last 15]` (Markdown ready for `docs/PREUVES_TESTNET.md`).
- **Fallback** (`fallback-brain.ts`): `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`. Switches after 3 consecutive failures (outage, timeout, 401/402/403, 429), never on a budget or local guardrail refusal; without a NEAR AI key: fallback only. No NEAR allow-list for it, shared budget cap.
- **TEE attestation**: `npm run ai:verify-attestation`; see `docs/ATTESTATION_TEE.md` (what is verified and what is not).

## Tests
`npx vitest run brain`: mocked fetch only, no key or network (`brain.test.ts`, `l11.test.ts`). The `ai:probe` and `ai:verify-attestation` scripts make real calls and require `NEARAI_API_KEY`; they are not part of `npm test`.
