# TESTNET PROOFS — what actually ran

> Runs before 2026-11-12 were generated in French (agent letters, pitches, deliverables); journals under docs/preuves are historical traces and are not modified.
>
> Updated 2026-11-12: §8 = run 8 of 2026-11-10 (generation 3 and deaths), §10 = logo validation of 2026-11-11, §11 = summary of runs 9a and 9b of 2026-11-11, §12 = sha256 fingerprints of the proof journals, §13 = English output validation of 2026-11-12, §14 = run 9c of 2026-11-12 (generation 3 again, two visitor-path missions paid), §15 = run 10 of 2026-11-12 (real subcontracting). Rule: only what appears here with a transaction identifier, a journal or a reproducible command is **proven**. Everything else is stated as not proven. Explorer: `https://testnet.nearblocks.io/txns/<hash>` (nearblocks, testnet). No mainnet spending, nothing is published. This file is generated from `docs/preuves/PREUVES_TEMPLATE.md` and the journals by `node scripts/assemble-preuves.mjs` (the generator scripts emit some table headers in French; the committed English file was translated by hand).

## 1. Honest summary

| Item | Status |
|---|---|
| Testnet master account created with the official CLI (`sponsor-by-faucet-service`) | **Proven** (§2) |
| Rust contract deployed and initialised on testnet | **Proven** (§3) |
| Escrows locked then released by the contract, with proof, and reputation written | **Proven** (§5) |
| Real NEAR AI Cloud brain, consumption traced | **Proven** (§6) |
| TEE attestation of a response, verified end to end | **Proven for one model, on demand** (§7) |
| Generation 2 on the real chain (5 reproductions and 5 letters in a single run) | **Proven** (§4) |
| Generation 3 in a real run | **Proven in two separate runs**: run 8 (previous version of the preset, 59 ticks: generation 3, 12 births, 8 reproductions; §8) and run 9c (current preset `selection`, 43 ticks: generation 3, 16 births, 10 reproductions; §14). Two observations, not a guarantee |
| Death of an agent on testnet | **Proven**: 7 deaths by starvation in run 8 (§8) and 4 in run 9c (§14), `mark_dead` and account closing with transactions |
| A task from the visitor path accepted and paid on testnet | **Proven in run 9c** (§14): 2 missions (marketing, logo), escrow locked then released, hashes given. **Limits**: both were typed into the interface by an automated browser on the developer's behalf (not by an external human visitor); the payer is the operator's demo account `visitors.<master>`, not the visitor |
| A logo delivered, accepted and paid on testnet | **Proven in run 9c** (§14): task `t-9975887`, 3 SVGs, judge score 0.73, release `6FCjxzUN…`. One logo, one sample |
| Subcontracting between agents on testnet | **Proven at run 8** (3 child escrows locked by the delegating agent's account and released; result not integrated) **and at run 10** (child delivered, judged, paid, **integrated into the parent's deliverable**, parent accepted and paid by the simulated client: 3 complete cases, commission earned 0.0576 NEAR; 2 refused logo parents where the delegator lost the child price; 1 in-house fallback; §15). **Not awarded in run 9c** (18 created, no bid: price-floor bug, fixed by L21, §14). One 21-minute run at run 10, simulated client only |
| `refund_escrow` on testnet | **Proven** (§8, §11): task `t-5003` rejected by the judge, `rejected` refund by the contract, reputation penalty −2; visitor logo orders refunded the same way in run 9b (§11); 7 refunds after rejections in run 9c (§14) |
| Agents' function-call keys | **Proven in run 8**: key added in the creation transaction, 0 warnings, 2 keys verified on the chain (failed in runs 5 to 7, fixed) |
| NEAR Intents, mainnet | **Never executed** (no spending) |

## 2. Master account

- Account: `darwin-master-7k2.testnet`, created on 2026-11-10 by the testnet faucet with `near account create-account sponsor-by-faucet-service darwin-master-7k2.testnet autogenerate-new-keypair --signature-scheme ed25519 save-to-legacy-keychain network-config testnet create` (near-cli-rs 0.31.1).
- Creation transaction: [`5SiBQfZp…`](https://testnet.nearblocks.io/txns/5SiBQfZpuCzJcUGgLBhcRWYB5Ad8LvBi5qMyzYDjVAi4) (10 testnet NEAR received).
- The private key is in `.env` (ignored by git) and in the CLI's local credentials folder. It is not in the repository: `node scripts/scan-secrets.mjs --no-history` clean, and a search for the exact value in tracked files: 0 occurrences.

## 3. Contract

- Contract account: `darwin-contract-7k2.testnet`, created by the faucet: [`DMmmRkir…`](https://testnet.nearblocks.io/txns/DMmmRkirNdreqTY68SroCm9Uv1hUP9csqNSZNrMmxMcQ).
- Deployment + call `new {"operator":"darwin-master-7k2.testnet"}`: [`EAiE25tj…`](https://testnet.nearblocks.io/txns/EAiE25tjN2LmZkxbNekigvHT4rw6eJsmmMi3vqY9mpxb), 36 Tgas, fee 0.0036 NEAR.
- 469,113-byte WASM built with `cargo build --target wasm32-unknown-unknown --release` (Rust 1.99.1), **not** with `cargo near build`. The NEAR runtime accepted and executed it. No reproducible build.
- Command actually used: `near contract deploy darwin-contract-7k2.testnet use-file <wasm> with-init-call new json-args '{"operator":"darwin-master-7k2.testnet"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send` (`sign-with-legacy-keychain` instead of `sign-with-keychain` in `contracts/deploy-testnet.sh`).
- Independent read-only verification (`near contract call-function as-read-only`, 2026-11-10): `agents_count` = 32 registered agents; `get_escrow t-4001` = `status: released`, payer `sim-client`, beneficiary `a-0602`, proof `verdict: accepted`, validator `brain:gemini-2.5-flash-lite`, `result_hash 7dd629b9…`; `get_reputation a-0602` = 7; `get_agent a-0604` = generation 2, parent `a-0602`, alive.
- Trust limit: the operator (master account) is the validation oracle; the judge is an external model (non-TEE).

## 4. Generation 2 on the real chain

Several real runs took place on 2026-11-10; agent ids change at every run (`a-0101…`, …, `a-0701…`, then `a-214953…` in run 8, automatic shift). **Run 8 (§8) is the most complete: generation 3 and deaths.** Journals kept: `docs/preuves/run5-journal.jsonl` and `docs/preuves/run6-journal.jsonl` (Darwin events, public transaction hashes, no secret). Tables generated by `node scripts/gen-preuves.mjs <journal>`.

### Run 6 (the most complete: 8 births, 5 reproductions, 26 escrow cycles)

{{RUN6}}

### Run 5 (summary)

{{RUN5}}

## 5. Escrows and reputation

The run 6 "Escrows" table gives, for each task, the lock transaction (`lock_escrow`, deposit attached by the payer), the release transaction (`release_escrow` with proof) and the reputation write (`add_reputation`). The 26 cycles of run 6 and the 30 of run 5 are complete (locked, released, reputation) in the journals. The payer is the `sim-client` account: a **simulated** client, labelled, funded from the master account. In runs 5 to 8 no task from the visitor path was paid; the two that were paid are the two missions of run 9c (§14), paid by the operator's demo account.

## 6. NEAR AI Cloud: real consumption

Source: `data/ai-usage.jsonl` (one line per real call: `usage` tokens x price from `GET /v1/model/list`), table regenerated by `npm run ai:usage-report -- --dir data`. This journal is local (ignored by git); the table below is its dated copy.

{{USAGE}}

- Global cap: clean stop at 8 EUR (`DARWIN_AI_BUDGET_EUR_STOP`), total budget 10 EUR. **The cap was never approached.**
- These figures are our **local accounting**: the platform's real invoice was not re-read on cloud.near.ai, to be checked by the human.
- The judge's calls (`validate`, model `google/gemini-2.5-flash-lite`, agent `treasury`) are counted in the global budget and journalled (`brain.charged`, agent `treasury`); they are **not debited from agents**, by design. The `JUDGE_COST_UNKNOWN` warning of runs 5 to 7 is fixed (0 in run 8).

## 7. TEE attestation

Executed on 2026-11-10 on `z-ai/glm-5.3-flash`: 20 checks PASS, 0 FAIL, 0 SKIP (Intel TDX quote of the gateway and of the model, TCB status `UpToDate`, NVIDIA NRAS GPU proof true, valid ECDSA signature of the response; negative test: one added byte makes verification fail). Attested response id: `1c1ea6068280496f8ef8d050c98dbe6d`, signer `0x3b753b4406613c5e70ae640508632b600424fa0c`. Command: `npm run ai:verify-attestation -- --model z-ai/glm-5.3-flash --save-evidence data/attestation-glm`, then `-- --offline data/attestation-glm`. Method and **limits** (a single model; no attestation per simulation call; no TLS binding; no measurement allowlist): `docs/ATTESTATION_TEE.md`.

## 8. Final run

{{FINAL}}

## 9. Incidents encountered (useful for what follows)

| Run | Finding | Cause | Fix |
|---|---|---|---|
| 1 | stop at tick 11 | public fastnear RPC: HTTP 429 | slower ticks |
| 2 | stop at tick 2 | `rpc.testnet.near.org` answers 429 "deprecated" | back to fastnear |
| 3 | escrows refused | task ids `t-0001…` already in the contract (contract panic on `ESCROW_EXISTS`) | `DARWIN_TASK_SEQ_START` |
| 3 | `ESCROW_LOCK_FAILED` | `sim-client` account underfunded (price without gas or storage reserve) | funding margin 0.2 NEAR (`fundingMargin`) |
| 4 | stop at tick 18 | 429 | retries with increasing delay (`accounts/near-backend.ts`) |
| 5 | no stop, slow generation 2 | earnings 0.02 to 0.08 NEAR against 0.004 metabolism per tick | economy tuned via environment variables |
| 6 | no stop, no more births | population capped at 8 by the demo preset | `DARWIN_MAX_POPULATION=14` |
| all | id collision at restart | contract accounts and registry persist | `DARWIN_AGENT_SEQ_START`; **since run 8, automatic shift** (clock) |
| 5 to 7 | `FC_KEY_NOT_ADDED` | limited key added afterwards, the RPC did not yet see the new account's key | key added in the creation transaction (run 8: 0 failures) |
| 5 to 7 | `JUDGE_COST_UNKNOWN` | prefix of the served model differs from the catalogue identifier | price looked up on the requested identifier (run 8: 0) |
| 9c | 18 subcontracting tasks created, 0 awarded | no bid on the agents' child tasks: the child budget was below the child profession's price floor (D-047) | fixed by L21 (D-047, D-048); real subcontracting proven in run 10 (§15) |
| 9c | `BRAIN_EMPTY_TEXT` x24 | empty answers, `finish_reason=length` (reasoning tokens exhausted), mostly DeepSeek-V4.1-Flash and gpt-5-nano | not fixed; no effect on the two visitor missions' payments |

Run 8 and run 9c settings: `DARWIN_PRESET=selection` alone (run 9c: see §14). Runs 6 and 7 settings: `DARWIN_PRESET=demo`, `DARWIN_TICK_MS=10000`, `DARWIN_BIRTH_CAPITAL=0.1`, `DARWIN_METABOLISM=0.002`, `DARWIN_MIN_VITAL=0.02`, `DARWIN_REPRO_COOLDOWN_TICKS=5`, `DARWIN_SIM_CLIENT_RATE=1.5`, `DARWIN_MAX_POPULATION=14` (run 7 only), Node 22.23.4, RPC `https://test.rpc.fastnear.com`.

## 10. Logo validation by a real NEAR AI call (L17, track C)

Date: 2026-11-11 (22:32 UTC). **A single real call** (no second one), `npm run ai:logo-validation` (`brain/tools/logo-validation.ts`). Real code path: `executeMessages` (instructions from the `logo` catalogue), `max_tokens` = `max(sim.maxTokensPerCall, CATALOGUE.logo.maxOutputTokens)` = 3000 as in `engine/index.ts`, safeguards and budget of `NearAiBrain`, then `extractDeliverable` and `runChecks` of the market. Brief: "Logo for Atelier Lumio" (fictional company, lighting sector, warm and minimal style). Model: `Qwen/Qwen3.6-35B-A3B-FP8` (allowlist, live catalogue price, `verified=true`: 0.17 USD/M input, 1.10 USD/M output). Worst case computed before the call: 0.00339 USD for a per-call cap of 0.05 USD.

| Check | Result |
|---|---|
| `finish_reason` | `stop` (not `length`); `max_tokens` sent: 3000 |
| Tokens (`usage`) | prompt 424, completion 788 (of which reasoning 0), total 1212 |
| Cost | 0.000939 USD (about 0.00085 EUR at 1.10), i.e. 0.3% of the per-call cap; AI budget cumulative after the call: 0.0412 USD |
| ```svg blocks | exactly 3 (408, 416 and 491 characters) |
| XML parser (Python `xml.etree`, independent of the repository code) | 3 well-formed documents, `svg` root with xmlns, `viewBox="0 0 256 256"`, 5 elements each |
| Active content | no script, foreignObject, image, `on*=`, external href or `url()` (independent regex check and `sanitizeSvg`) |
| `extractDeliverable` and `runChecks` (rule `rule:logo`) | accepted: 3 distinct SVGs, no mark from `BRANDS_TO_AVOID` |
| Truncation caused by the cost cap | no: 788 tokens produced out of 3000 allowed, cost cap never reached |

**Verdict: VALIDATED** for the production + extraction + deterministic checks path. Cause of the run 9b truncation: `max_tokens` capped at 300 in the `selection` preset of the 9a/9b journals (400 in the normal preset; `maxTokensPerCall`) for a deliverable of 3 SVGs; fixed by the hard cap `maxTokensHardCap` (commit 7cb869d), confirmed here (788 tokens suffice, 3.8x margin). No additional fix was needed.

Reservations: (1) a single sample, a single model; a wordier or reasoning model may consume more (the reasoning models in the allowlist are throttled by `extraBody`). (2) Modest quality: the text between blocks reuses the literal template "Idee du logo" instead of an idea sentence, with no effect on extraction. (3) The AI judge (originality, relevance rubric) was not called here: only the deterministic checks are validated. (4) This model's prices are those of the catalogue of the day, not a frozen value.

Files: `docs/preuves/logo-validation/` (`reponse-brute.txt` raw model response, `logo-1.svg` to `logo-3.svg` extracted, `meta.json` usage/cost/`finish_reason`/response identifier). Neither key nor authorization header is written. Test without network: `brain/l17-logo.test.ts` replays this real response through extraction and checks.

## 11. Runs 9a and 9b: logo orders, all rejected by the format check (factual summary of the journals)

Date: 2026-11-11 (UTC), NEAR testnet, `mode=testnet`, `preset=selection` (version of the time), `chain=near`, `brain=nearai`, seed 42. Sources: `docs/preuves/run9a-journal.jsonl` (270 events, 00:49:30 to 00:54:39 UTC, 14 ticks) and `docs/preuves/run9b-journal.jsonl` (377 events, 00:56:41 to 01:03:51 UTC, 19 ticks). This summary only reports what is readable in these two journals. Both runs stopped by **extinction** (`sim.stopped`, `reason: extinction`, `generations: 1`): no birth beyond the founders (4 in 9a, 6 in 9b), no generation 2. They neither contradict nor improve on run 8 (§8).

| | Run 9a | Run 9b |
|---|---|---|
| Founders, deaths | 4, 4 deaths (tick 14) | 6, 6 deaths (ticks 14, 14, 14, 14, 17, 19) |
| Validation verdicts | **7 rejected** (`rule:logo`), 0 accepted | **2 accepted** (`brain:gemini-2.5-flash-lite`, marketing and translation texts, payer: simulated client), **7 rejected** (6 `rule:logo`, 1 `rule:architecture`) |
| Escrows | 7 locked, **7 refunded**, 0 released | 9 locked, 2 released, 7 refunded |
| "Visitor" logo orders (`visitors.darwin-master-7k2.testnet`) | 3 posted: 1 rejected then refunded (`t-8669702`, lock `9SGVgFKxwV4bsRE82oRToib4j7eFZKMtWh1pyR4EKFYR`, refund `A8jjAF4B9zp9ogPtPmbeNQcxgNAFYGgU2B12q2ngUEzX`), **2 expired with no bid** (`t-8669704`, `t-8669719`) | 1 posted, rejected then refunded (`t-8674013`, lock `AMQEHEDN96FtFpupFJKrcYvMZckdGiq99UDHhkDUQVBP`, refund `BkQM1xYYcxzbP5KaEEivwDN1ea2XsoeZmVTEPBLTFj9f`); a visitor order for writing a LinkedIn post (`t-8674030`) expired with no bid |
| Reason for logo rejection | "exactly 3 ```svg blocks expected, 0 found" (sometimes 1) | same |
| AI calls debited (`brain.charged`) | 7, all production, 300 output tokens each, total 0.00285 USD (local accounting) | 11 (9 production, 2 validation), total 0.00333 USD (local accounting) |

To remember:
- **No logo was delivered, accepted or paid on testnet** in these two runs. The only payments of run 9b (2 escrows released, `t-8674011` and `t-8674012`) concern text deliverables ordered by the **simulated client**, not by a visitor.
- The visitor's logo order in run 9b (`t-8674013`) did follow the path: lock from `visitors.<master>`, rejection by the format rule, refund by the contract. It is proof of a real refused case, not of a successful case.
- Cause of the rejection: the model's output was truncated and did not contain the 3 expected SVG blocks. §10 attributes it to an output token cap that was too low, fixed afterwards (commit `7cb869d`) then validated by an isolated real call (§10). **Nuance**: §10 cites a cap of 400; in these journals each production call stops at exactly 300 output tokens (value of the `selection` preset of the time). The cap has since been raised; the fix was then exercised in a full run (run 9c, §14: 15 logo tasks judged, 11 accepted).
- Bids: 7 (`bid.placed`) in 9a and 9 in 9b, very few compared with the 92 of run 8; both runs died out in generation 1 (extinction), the pattern that `docs/RUN_9C.md` §0 and §4 asks to watch for. Count discrepancy with `docs/RUN_9C.md` §0: `docs/RUN_9C.md` §0 gave an earlier version with 6 founders for 9a; `run9a-journal.jsonl` only contains 4 (`agent.born`: 4, `agent.died`: 4), as in the table above; the journals are authoritative.
- Verifiable: `https://testnet.nearblocks.io/txns/<hash>` with the hashes above; the full hashes of the other events are in the journals.

## 12. sha256 fingerprints of the proof journals

The "real testnet run" banner of the interface is deduced from the `chain` field of the journal itself: a hand-edited journal would be labelled "real". These fingerprints make it possible to check that a file is identical to the one published (the only proof of the transactions remains their hash on `testnet.nearblocks.io`). Computed on the repository files as of 2026-11-12.

| File | sha256 |
|---|---|
| `docs/preuves/run5-journal.jsonl` | `7b2218013c9a59eaf6c4a137438023f3edf1263f5fe4c1011fde7e78df367cef` |
| `docs/preuves/run6-journal.jsonl` | `4acc398b036ab7da18680533dfe58e5ec6aeafb9e6d4232daae8a486100be84f` |
| `docs/preuves/run7-journal.jsonl` | `af255a9f0a037baba87b24cbb5be04f318144f0ec459ffcd50d9989d3214c486` |
| `docs/preuves/run8-journal.jsonl` | `9647d982663bc2493a2ecf562d17837ef7ad1d32b9169bbf704afcedf3ba2110` |
| `docs/preuves/run9a-journal.jsonl` | `b82aa257e853b076a01501c92b40319b6a4503a3f5977cb6998a94ff0a6628fb` |
| `docs/preuves/run9b-journal.jsonl` | `fdb06603b6571207bcf11fc2b175826c798d85a61906829c83efdaffaf7dbf69` |
| `docs/preuves/run9c-journal.jsonl` | `a54065a5399152fbe3f440a8dc699150da8e7e4636d075548efa42fa3c9af618` |
| `docs/preuves/run10-subcontracting-journal.jsonl` | `42fc7d54d83f9db54e05fab0adbee5d6a1af14b11e589eb249e6f525d88a9f20` |

Verification (from the repository root):

```bash
sha256sum docs/preuves/*.jsonl          # Linux, macOS, Git Bash
# PowerShell: Get-FileHash -Algorithm SHA256 docs/preuves/*.jsonl
```

The values must be identical to those in the table. A line-ending conversion at checkout (`core.autocrlf`) changes the fingerprint: clone with `git -c core.autocrlf=false clone ...` in case of doubt.

## 13. English output validation (2026-11-12)

Goal: check, through the real code path, that the production model answers in English after the L19 switch. Command: `npm run ai:english-validation` (`--dry` computes the worst-case cost without any chat call). Code path: `NearAiBrain` via `createBrain` (same guardrails, budget and caps as the engine), engine prompt builders (`letterRequestMessages` of `engine/lifecycle.ts`, `bidMessages` + `sanitizePitch` + `pitchLanguageOk` of `engine/pitch.ts`, `executeMessages` + market `extractDeliverable` + `runChecks`), `ENGLISH_RULE` included. Model: `google/gemini-2.5-flash-lite` (default model of the brain, price verified in the catalogue: 0.1 / 0.4 USD per million tokens in / out). 3 real calls, no judge call. Raw answers (no secret): `docs/preuves/english-validation/{letter,pitch,deliverable}.json`; offline replay: `brain/english-validation.test.ts`.

| Output | Input | finish_reason | Tokens (prompt / completion) | Cost (USD) | Language check |
|---|---|---|---|---|---|
| Parent -> child letter | English genome personality | `stop` | 81 / 138 | 0.000063 | English: 14 English function words, 0 French word, no accent |
| Bid pitch | task written in **French** (worst case) | `stop` | 266 / 14 | 0.000032 | English, `pitchLanguageOk` = true, 0 French word |
| Marketing deliverable | order written in **French** | `stop` | 314 / 57 | 0.000054 | English, extraction OK (`texte.md`, 261 chars), `runChecks` ok = true |

Total: 0.00015 USD (worst case computed before the calls: 0.00063 USD).

Excerpts: letter "My dearest Blaise, Welcome to the world! Even with 0.5 NEAR to start, and having already completed 7 tasks ..."; pitch "Your cozy neighborhood escape awaits! Come savor our new cappuccino today."; deliverable "A cozy corner of your neighborhood. Discover your new favorite spot at our charming local cafe. ..."

Notes: (1) the generic heuristic `looksEnglish` requires 2 English function words, which a one-sentence pitch may not contain; the pitch is therefore judged with `englishVerdict(text, short)` (1 function word, zero French word, no accent) plus the engine's own `pitchLanguageOk`. (2) Only the default model was tested; a genome may carry another model (gene), which this validation does not cover. (3) The judge (`validateMessages`) was not called (outside the budget); its prompt carries the English rule (`brain/l19-english.test.ts`).

## 14. Run 9c (2026-11-12): current preset on testnet, generation 3, two visitor-path missions paid

**Objective**: validate on testnet the recalibrated preset `selection` (6 founders, one per profession) and produce the showcase replay journal. Launched by the human in a separate terminal (`docs/RUN_9C.md`). **All generated content in this run is in English** (bid pitches, deliverables, letters, console messages, task titles); runs 8, 9a and 9b are in French.

**Settings**: `DARWIN_PRESET=selection` alone (6 founders: logo, finance, architecture, marketing, translation, legal), `npm run start:testnet`, seed 42 (journal `sim.started`: `mode=testnet`, `chain=near`, `brain=nearai`). Node 22.17.1 and the testnet RPC were reported by the operator and are **not recorded in the journal**; Node 22.17.1 is below the `>= 22.22.2` the README states for testnet mode (`near-api-js` 7.4.0): to be re-checked, not explained here. No `system.warning` other than `BRAIN_EMPTY_TEXT` (see limits): no RPC 429 warning.

**Result (2026-11-12, 13:06:26Z to 13:59:38Z, 53 minutes, paused at tick 43)**: **generation 3 reached** (`a-249411`, son of `a-249407`, born at tick 40), **16 births** (6 founders, 9 children of generation 2, 1 of generation 3), **10 reproductions**, 10 parent-to-child letters, **4 deaths by starvation** (`a-249400` tick 33, `a-249398` tick 35, `a-249403` tick 40, `a-249404` tick 42), accounts closed and `mark_dead` recorded. 113 bids, **all with a pitch**. 78 escrows locked (76 by the simulated client `sim-client.<master>`, 2 by `visitors.<master>`), 68 released, 7 refunded (7 rejections: 4 logo by the AI judge, 3 legal by the deterministic rule "must close with the disclaimer"), 75 reputations written. 75 deliverables, **all with their content recorded** (translation 23, logo 15, legal 15, architecture 8, finance 8, marketing 6). 75 validations: 68 accepted, 7 rejected. Journal: 2525 events, sha256 in §12. The simulation was paused (`sim.paused`, tick 43) and the process stopped by the operator.

**On-chain checks**: every hash cited below can be opened on `https://testnet.nearblocks.io/txns/<hash>`. The master balance went from about 11.91 NEAR (top-up of 2026-11-12, see `docs/STATUS.md`) to about 10.14 NEAR after the run, as read by the project lead over RPC (**not in the journal**, not re-checked here).

**AI consumption** (journal `brain.charged`, 270 events, 0 mock, local accounting): 198 calls debited from agents (113 bids, 75 deliverables, 10 letters), 0.0564 USD; 72 judge calls booked to the treasury and **not** debited from agents, 0.0092 USD; total **0.0656 USD**. Cumulative budget file `data/ai-budget.json` (local, ignored by git): 0.111 USD since the start of the project, as read by the project lead. The platform invoice was not re-read.

### The two visitor-path missions (paid on testnet)

| | Mission 1 | Mission 2 |
|---|---|---|
| Task | `t-9975872`, marketing: "Write a 3-sentence product pitch for an organic bakery in Rennes" | `t-9975887`, logo: "Design a logo for an organic bakery in Rennes, warm artisanal style" |
| Posted / awarded | tick 8 (13:11:44Z) / tick 11, budget 0.024 NEAR, 1 bid | tick 13 (13:15:34Z) / tick 16, budget 0.045 NEAR, 2 bids |
| Winner | `a-249400` | `a-249397` |
| Deliverable | `text.md`, 414 bytes, content recorded | `logo-1.svg`, `logo-2.svg`, `logo-3.svg` (1069, 642, 545 bytes), content recorded |
| Verdict | accepted, **score 1.00**, validator `brain:gemini-2.5-flash-lite` | accepted, **score 0.73** (threshold 0.6), same validator; the judge calls the originality "moderate" |
| Payer (escrow) | `visitors.darwin-master-7k2.testnet` | `visitors.darwin-master-7k2.testnet` |
| Lock | [`6bCF32vu…`](https://testnet.nearblocks.io/txns/6bCF32vuLycjNcpd6frX5He1GnGwQn14dg3JSNymtchD) | [`J4iD9Fan…`](https://testnet.nearblocks.io/txns/J4iD9FansSQ8RU7K5YFnRQBNhNoSrnde679t2GuNMVxE) |
| Release | [`BaQvifz8…`](https://testnet.nearblocks.io/txns/BaQvifz8YN97MndiygDe88uyCsAKWLbCRianJBe4gYZd) | [`6FCjxzUN…`](https://testnet.nearblocks.io/txns/6FCjxzUNtrYR1SHSjJDeMDXB7jVDenEbJSfkANwJn6sZ) |
| Reputation (+1) | [`FtV9Fzup…`](https://testnet.nearblocks.io/txns/FtV9FzupAd1Av83sxC4Fs6G5J5cpPHU4GadoFeKKFWkD) | [`CdeEUyFR…`](https://testnet.nearblocks.io/txns/CdeEUyFR8gndovCt4n4njyxhHwSjBXJL6vT4ytv9vF4b) |

**How these two missions were entered (read this).** They were typed into the interface (the mission bar of the Mission tab) by an **automated browser (Playwright, headless) on the developer's behalf**: the first during a video-recording session that was interrupted (out of memory), the second with a lightweight browser without video. They are **not** missions from an external human visitor. The payer is the operator's demo account `visitors.darwin-master-7k2.testnet`, not the person typing. The agents, the auctions, the judging and the payments are real (testnet).

### Limits of run 9c (honest)

- **Subcontracting between agents: 18 created, 0 awarded.** The journal has 18 `subcontract.created` events; each child task (posted by an agent) received no bid and expired (`task.expired`, reason `no_bids`: 18 of the 26 expired tasks; the other 8 are simulated-client tasks that also got no bid). Run 8 had 11 subcontracting tasks, of which 3 were awarded and released. The cause was the L16 price floor (child budget below the child profession's floor, D-047); it was fixed by lot L21 and real subcontracting was proven in run 10 (§15).
- **`BRAIN_EMPTY_TEXT` x24** (`system.warning`): empty answers with `finish_reason=length` (reasoning tokens exhausted), from `deepseek-ai/DeepSeek-V4.1-Flash-1017` (16), `openai/gpt-5-nano` (7) and `anthropic/claude-haiku-5-5` (1). No effect on the payments of the two visitor missions; the impact on the other tasks was not analysed.
- **The payer of most tasks is the simulated client** (88 of 108 tasks posted, 76 of 78 escrows locked); 18 tasks were subcontracting (none awarded) and 2 were the visitor-path missions above.
- **A single execution, a single seed**: generation 3 at tick 40 is an observation, not a guarantee. Dead agents died of starvation with balances of 0.028 to 0.030 NEAR (minimum vital 0.03).
- Of 15 logo tasks judged, 11 were accepted and 4 rejected by the AI judge (scores 0.00 to 0.44; one delivered a single logo instead of 3). The visitor logo scored 0.73 with "moderate" originality per the judge; this does not establish logo quality in general.
- Costs are local accounting; the NEAR AI Cloud invoice was not re-read.

Journal: `docs/preuves/run9c-journal.jsonl` (2525 events, from 2026-11-12T13:06:26.466Z to 2026-11-12T13:59:38.164Z). Tables below generated by `node scripts/gen-preuves.mjs docs/preuves/run9c-journal.jsonl` (the "Brain" line of the generator counts the 72 judge calls among the "billed to the agents"; see the split above).

Maximum generation born: **3**; births: 16; reproductions: 10; letters: 10; deaths: 4.
Transactions by type: create_account 16, register_agent 16, escrow_lock 78, escrow_release 68, add_reputation 75, transfer 179, escrow_refund 7, mark_dead 4, close_account 4.

#### Births

| Agent | Generation | Parent | Account | Creation tx |
|---|---|---|---|---|
| a-249397 | 1 | — | `a-249397.darwin-master-7k2.testnet` | [`AjrN5WZu…`](https://testnet.nearblocks.io/txns/AjrN5WZuxPubzkicZfhUPBLXgUXPJVXb1Rf4PM5X1jmy) |
| a-249398 | 1 | — | `a-249398.darwin-master-7k2.testnet` | [`CYRFe8c6…`](https://testnet.nearblocks.io/txns/CYRFe8c6qbN5o1D33eiMUuDqdW2NbtaoNTcUPt1rZbUm) |
| a-249399 | 1 | — | `a-249399.darwin-master-7k2.testnet` | [`xWiEUvC5…`](https://testnet.nearblocks.io/txns/xWiEUvC57aES5qW4y3aHTQor2Fqi5zc8rbs3oJQpH4M) |
| a-249400 | 1 | — | `a-249400.darwin-master-7k2.testnet` | [`8v5DTq8k…`](https://testnet.nearblocks.io/txns/8v5DTq8kG7yktGRpvWuwyvETSTn3zchDbDTxxTRMJNb8) |
| a-249401 | 1 | — | `a-249401.darwin-master-7k2.testnet` | [`GJANZJF2…`](https://testnet.nearblocks.io/txns/GJANZJF2G54ur5EfoHF9hyAjnYKhbn4DHHRCRjrLPyVR) |
| a-249402 | 1 | — | `a-249402.darwin-master-7k2.testnet` | [`JEA1Zarh…`](https://testnet.nearblocks.io/txns/JEA1Zarh8ZgoCgRwMP9SgvH7AzniNgBwteZMxkhRDT6C) |
| a-249403 | 2 | a-249399 | `a-249403.darwin-master-7k2.testnet` | [`7Z4JZyTg…`](https://testnet.nearblocks.io/txns/7Z4JZyTgnWssD97hnQdi6wpPNb1PmfZv6pTYpZvPkJ7L) |
| a-249404 | 2 | a-249397 | `a-249404.darwin-master-7k2.testnet` | [`2kboPnAo…`](https://testnet.nearblocks.io/txns/2kboPnAojwRiUF2QxaH4htou5M7M4dMDV1zGgLaS4jcD) |
| a-249405 | 2 | a-249400 | `a-249405.darwin-master-7k2.testnet` | [`9LLkteet…`](https://testnet.nearblocks.io/txns/9LLkteetK91T6tzQHmb8J3UNaNXzyhBwDdmm46Fdrtu1) |
| a-249406 | 2 | a-249402 | `a-249406.darwin-master-7k2.testnet` | [`DyAzprPd…`](https://testnet.nearblocks.io/txns/DyAzprPdDwG1mz6jybafxCfnHbYKPXiDz3zBPnmbQjRv) |
| a-249407 | 2 | a-249398 | `a-249407.darwin-master-7k2.testnet` | [`8L6Cfbdw…`](https://testnet.nearblocks.io/txns/8L6CfbdwmeePNKMEUzDPtVn73VxhDYqdfQCgjAfiXGp6) |
| a-249408 | 2 | a-249402 | `a-249408.darwin-master-7k2.testnet` | [`92EyNgZY…`](https://testnet.nearblocks.io/txns/92EyNgZYwYu6BBexcUK2AFYtgWi31GjzhyjHxfD7c3vR) |
| a-249409 | 2 | a-249397 | `a-249409.darwin-master-7k2.testnet` | [`8GqtRHkv…`](https://testnet.nearblocks.io/txns/8GqtRHkv9fsMk1zKfH97G5GjjaLVW4ofMSzsAG3Gr6YX) |
| a-249410 | 2 | a-249399 | `a-249410.darwin-master-7k2.testnet` | [`GFucgDU5…`](https://testnet.nearblocks.io/txns/GFucgDU54UhWF5pEDeQg7HFL4bmsN18P4Q8x87Ad2LDP) |
| a-249411 | 3 | a-249407 | `a-249411.darwin-master-7k2.testnet` | [`9mTBbK1v…`](https://testnet.nearblocks.io/txns/9mTBbK1vMmKvgMxNWF6yPfm2Wg8zH44hjxdKKQZtHgvc) |
| a-249412 | 2 | a-249402 | `a-249412.darwin-master-7k2.testnet` | [`DQahVm4Q…`](https://testnet.nearblocks.io/txns/DQahVm4QRiMvLmh1xESJ376guW2rDdWxUfKe3VrVDjnM) |

#### Reproductions

| Parent | Child | Transferred (NEAR) |
|---|---|---|
| a-249399 | a-249403 | 0.1203 |
| a-249397 | a-249404 | 0.1241 |
| a-249400 | a-249405 | 0.1207 |
| a-249402 | a-249406 | 0.1209 |
| a-249398 | a-249407 | 0.1261 |
| a-249402 | a-249408 | 0.1208 |
| a-249397 | a-249409 | 0.1258 |
| a-249399 | a-249410 | 0.1204 |
| a-249407 | a-249411 | 0.1254 |
| a-249402 | a-249412 | 0.1294 |

#### Deaths

| Agent | Cause | Final balance (NEAR) | Recovered by the master (NEAR) | Closing tx |
|---|---|---|---|---|
| a-249400 | starvation | 0.0278 | 0.0277 | [`DrdaY9Sv…`](https://testnet.nearblocks.io/txns/DrdaY9Sv7wdLZ51nuL4rU4magyzh7d9VUrWJhMC4PqxQ) |
| a-249398 | starvation | 0.0299 | 0.0299 | [`J2s7pALT…`](https://testnet.nearblocks.io/txns/J2s7pALT8LpiGtjjAtgaPeTDdBoTuypEMSBocCnsQTfq) |
| a-249403 | starvation | 0.0287 | 0.0287 | [`9tBMxGmA…`](https://testnet.nearblocks.io/txns/9tBMxGmAr8SWyKvksu36Y57NtGniGtEUJhdnmqDhiiVv) |
| a-249404 | starvation | 0.0291 | 0.0291 | [`G9X8iC76…`](https://testnet.nearblocks.io/txns/G9X8iC763W4c27EjWjkhqaphA2QNoUtRwAhohfZ9US7Z) |

Death recorded in the contract registry (`mark_dead`): [`Cfw4TRsP…`](https://testnet.nearblocks.io/txns/Cfw4TRsP2yq6g2f98eYGR3dJnJhb4y7KRhcoJ2tzBWpm), [`Ct7Cf5e4…`](https://testnet.nearblocks.io/txns/Ct7Cf5e4LBwhVTb9vBg31WEQ19CEPZoC7rrtNoYUYQuS), [`4VQSi7yi…`](https://testnet.nearblocks.io/txns/4VQSi7yiMeSkyoHTqpczviif9F5tQtBZvjf2HMXAhqNR), [`FVAQWLMa…`](https://testnet.nearblocks.io/txns/FVAQWLMapCfRNPrpbaDd2WgoLd8sXjPi35jiNBW2AqfC).

#### Escrows: 78 locked, 68 released, 75 reputations written (first 5 cycles listed)

| Task | Payer | Beneficiary | Amount (NEAR) | Lock | Release | Reputation |
|---|---|---|---|---|---|---|
| t-9975859 | `sim-client` | `a-249401` | 0.0120 | [`5ABu1usX…`](https://testnet.nearblocks.io/txns/5ABu1usXkKpesevHuWceGZMkG4jxJS3xRuKwwNRwmbML) | [`u9ogVWpL…`](https://testnet.nearblocks.io/txns/u9ogVWpLFk3W1XET5Djbdm1VR5nTiygXcv6i6GpmuPu) | [`DkBiWjXz…`](https://testnet.nearblocks.io/txns/DkBiWjXzDa4kmtb4kNCWUHNmcZdjBvZDrSYxwXwggTev) |
| t-9975860 | `sim-client` | `a-249397` | 0.0450 | [`2VVc7qQX…`](https://testnet.nearblocks.io/txns/2VVc7qQXkKCyDefQt3qktPSgf2Xsc9coiNuWrbrq8xNp) | [`Bu9Pa9RH…`](https://testnet.nearblocks.io/txns/Bu9Pa9RHH3yqdcq5B27NCrz7DdsimBxn2xSd8PUVDb3G) | [`Cp1oCkHD…`](https://testnet.nearblocks.io/txns/Cp1oCkHDtvTn3AyHwfzoeq4PLMpaAx3EuQUULcFhhV4K) |
| t-9975861 | `sim-client` | `a-249397` | 0.0450 | [`E3EUeigj…`](https://testnet.nearblocks.io/txns/E3EUeigjdPo2U1DWrpT6FHNxtod1LtU67sJhbKHe5BiL) | [`5KAMLFv6…`](https://testnet.nearblocks.io/txns/5KAMLFv64x1CwWpRpTxcba1XRrjUb62wCQz6qiNZXzZq) | [`HZwJX4aM…`](https://testnet.nearblocks.io/txns/HZwJX4aM3f5fZd2M6hn5z5xbLDtavpWxX8rWB6whBGhC) |
| t-9975864 | `sim-client` | `a-249399` | 0.0606 | [`51KNzDsp…`](https://testnet.nearblocks.io/txns/51KNzDsp6dP5b4qmcsF6k2wBuQymXmCV4KngKhtZEQWz) | [`2ojVKvSV…`](https://testnet.nearblocks.io/txns/2ojVKvSV75RwHQm2shyjF8ELMXvG8aSA5tWt9T3PRszb) | [`FXKnYhSV…`](https://testnet.nearblocks.io/txns/FXKnYhSVcBnN6jHZe2N5fYmVUPLjUw8xi1tduMxjBChJ) |
| t-9975865 | `sim-client` | `a-249402` | 0.0450 | [`5TAuFEfV…`](https://testnet.nearblocks.io/txns/5TAuFEfVhbgNjByHsuumKW8fCCqY4wyhMqmGsz7Q9Ux5) | [`DgH2C6pV…`](https://testnet.nearblocks.io/txns/DgH2C6pV4vchCd8Pn8pPnHUBqARthgk6EKcJmLZZAkqY) | [`DvrYMTH5…`](https://testnet.nearblocks.io/txns/DvrYMTH5vyApZGspUM4zWUt9ghxdZ9bpfjQ4fwbMUwK6) |

#### Brain (debits in this journal)

270 calls billed to the agents (0 mock), cumulative real cost 0.06560 USD. By model: gpt-5-nano-2025-08-07 ×91, Qwen/Qwen3.6-35B-A3B-FP8 ×66, gemini-2.5-flash-lite ×72, deepseek-ai/DeepSeek-V4.1-Flash-1017 ×28, claude-haiku-5-5 ×13.

## 15. Run 10 — real subcontracting (2026-11-12)

Goal: prove on NEAR testnet, with the real AI, that an agent can delegate part of a mission to an agent of another profession, pay it from its own account, **integrate the child's deliverable into its own** and be paid by the client (decision D-048, procedure `docs/RUN_SUBCONTRACT.md`). Source: `docs/preuves/run10-subcontracting-journal.jsonl` (1090 events, sha256 in §12). The table below is generated from the journal by `node scripts/subcontract-proof.mjs docs/preuves/run10-subcontracting-journal.jsonl` (read-only), which also checks automatically, for every integrated subcontract, that the payer of the child escrow lock is the account of the delegating agent (18 of 18 checks passed).

### Settings and results

| Item | Value (from the journal unless stated) |
|---|---|
| Launch, pause | Started 2026-11-12 14:08:38 UTC (first event 14:08:39), paused at tick 21 at 14:29:29 UTC: about **21 minutes** of simulation |
| Mode | `sim.started`: `mode=testnet`, `preset=selection`, seed 42, `chain=near`, `brain=nearai`; branch `lot/L21-integration`; Node 22.17.1 (a version warning at startup, normal run) |
| Population | 9 births (6 founders, then 2 in generation 2 and 1 in generation 3), 3 reproductions (`agent.reproduced`, 3 `letter.written`), **0 deaths** |
| Market | 44 tasks posted (38 from the simulated client, 6 sub-tasks posted by agents, **0 visitor order**), 42 bids, 40 escrows locked, 32 released, 7 refunded; 39 verdicts (33 accepted, 6 rejected) |
| NEAR AI Cloud | 124 calls debited (`brain.charged`, none mock), total **0.029 USD** by our local accounting (platform invoice not re-read) |
| Master account | about 10.14 then 8.88 NEAR, measured by the project lead through the RPC (not recorded in the journal) |
| Warnings | 8 `BRAIN_EMPTY_TEXT` (model reasoning exhausted the output budget), 1 `EXECUTION_FAILED` (NEAR AI timeout of 60 s on `t-10013220`) |
| Subcontracting events | 6 `subcontract.created`, 5 `subcontract.integrated`, 1 `subcontract.fallback` (`no_bids`) |

### The six subcontracts (generated table, amounts in NEAR)

| Parent -> child | Professions | Delegating agent | Agent paid | Parent price | Child price | Commission planned | Commission earned | Classification, parent verdict |
|---|---|---|---|---|---|---|---|---|
| `t-10013202` -> `t-10013206` | architecture -> finance | Lina (`a-250332`) | Kepler (`a-250331`) | 0.0606 | 0.0360 | 0.0246 | **0.0246** | **complete** (parent accepted and paid), accepted 1.00 |
| `t-10013212` -> `t-10013215` | legal -> marketing | Orion (`a-250335`) | Mendel (`a-250333`) | 0.0450 | 0.0240 | 0.0210 | **0.0210** | **complete**, accepted 1.00 |
| `t-10013233` -> `t-10013236` | marketing -> translation | Pasteur (`a-250336`) | Nora (`a-250334`) | 0.0240 | 0.0120 | 0.0120 | **0.0120** | **complete**, accepted 1.00 |
| `t-10013204` -> `t-10013207` | logo -> marketing | Jules (`a-250330`) | Mendel (`a-250333`) | 0.0450 | 0.0240 | 0.0210 | 0 | integrated but parent rejected (no commission, delegator lost the child price), rejected 0.00, parent refunded to the client |
| `t-10013217` -> `t-10013222` | logo -> marketing | Jules (`a-250330`) | Pasteur (`a-250336`) | 0.0450 | 0.0240 | 0.0210 | 0 | integrated but parent rejected (same), rejected 0.35, parent refunded |
| `t-10013221` -> `t-10013223` | logo -> marketing | Jules (`a-250330`) | none | 0.0450 | none | 0 | 0 | fallback (`no_bids`, in-house, no commission); accepted 0.60, paid |

Commission actually earned: **0.0576 NEAR** in total (0.0246 + 0.0210 + 0.0120), only on parents accepted and paid. Paid to child agents: **0.1200 NEAR** (5 children: 0.036 + 0.024 + 0.024 + 0.024 + 0.012). The "planned" commission of the two refused parents is the `commission` field of their `subcontract.integrated` event (parent price minus child price): it was never collected.

### Transactions (open `https://testnet.nearblocks.io/txns/<hash>`)

| Parent | Child escrow lock (payer = the delegating agent's account, `kind` escrow lock) | Child release (payee = child agent) | Parent release (payee = delegating agent) |
|---|---|---|---|
| `t-10013202` (complete) | `DGHrebeg5unrzVX1MUtoh5mCR9kTwaojXfL71BLzKqKr` (payer `a-250332`) | `H963jPSg1iSEebXrT4E77Jok2Q7YdCHrtaN9GptmrGqD` | `CcB5xsLwPfGHZb3dvet3t4HFDGammn4M2paSK8Kdbe13` |
| `t-10013212` (complete) | `J9PHjfwPSAvHAGMYwt9gDVqCxwqWwM71VU6zhJRpUFaw` (payer `a-250335`) | `HfrDpvh8WiuSJTzk3gn98DCt2RYN5WpwrD92Ek84RA3N` | `ExNGxULfixSmmzFhgcbordvTWXh7wfrcMVJXVugPtrSp` |
| `t-10013233` (complete) | `A5YKzx8fR4Ac8y4QLYP5fbyRFfHgA5eEsKi2NZFztbbF` (payer `a-250336`) | `BqxbPxwj9XxCrbxyX2itwnZ9aHBCNHsJdWHku5U1iBh1` | `64ZeiECd9ztBns9StK67ps7h6dqGL3AA5Mb1iJpkWHJo` |
| `t-10013204` (parent rejected) | `DbPiXJtuXt9QSvfyhz63WMvMNYKTNy626uqGKwBhsPgv` (payer `a-250330`) | `H21BGGwCoMuoG3y4Tei52j9WhchRJzEvS9Z3So9unWyU` | none (parent refund to the client `35sy5DN619gUfTFU9cqBkj6aToxxqGr2yqv7y761rRVe`) |
| `t-10013217` (parent rejected) | `Eyv427JtZyGQkLX84cvUf1opDbnuU2sx4qEHpXEaQwT4` (payer `a-250330`) | `FMus6RnRYV8BL2gKVTBLd2iGmwXMzcd98eqPVf6DFe5a` | none (parent refunded) |
| `t-10013221` (fallback) | none (sub-task `t-10013223` expired with no bid) | none | `HrpDeK9tuq9eaSQpzUbeKgLZJ6r2VWRWbWa8UzfCHsaa` |

In the five integrated cases the parent's `deliverable.produced` event contains a section `## Subcontracted to <first name> (<profession>)` followed by the child's text: Kepler (finance) in `architecture.md` of `t-10013202`, Mendel (marketing) twice, Nora (translation) and Pasteur (marketing) once each (for the logo parents it is the file `subcontracted.md`, next to `logo-1.svg` to `logo-3.svg`). The plan B parent `t-10013221` has a `subcontracted.md` with `## Done in-house (subcontract failed: no_bids)`.

### Honest limits

- **One run, about 21 minutes, no death**: it proves the subcontracting path, not the long-term selection. Three reproductions, generation 3 reached, nothing more is claimed about survival.
- **All parent missions came from the simulated client** (`sim-client.<master>`); no visitor order in this run. The economy remains subsidised.
- **The child is not negotiated**: its brief is built from templates (`engine/subcontract-plan.ts`), and the child's price is its normal auction price.
- **Logo refusals** (two different cases; no fix before the deadline, code freeze). Of the 25 logo validations of runs 9c and 10, 10 were refusals (4 in 9c, 6 in run 10), mostly ordinary quality refusals (0.35 to 0.58). (1) **Unexplained**: "only 1 logo proposal instead of 3" on deliverables that contain 3 SVG files, by the small judge (`gemini-2.5-flash-lite`, input not journalled): `t-9975954` (run 9c, 0.00, no subcontracting) and `t-10013204` (run 10, 0.00, subcontracted parent); not attributed to subcontracting. (2) **Brief not matched**: `t-10013209` (run 10, not subcontracted, 0.00): the simulated client's brief combined `Company: Golden Oven Bakery` with `Sector: consulting`; the agent drew for consulting, the judge refused expecting a bakery; the client was protected (refund tx `8KZH5VSG2Kuzp7tKotF9w2RTfDGqTFoubp8DojZzSbYm`). The post-run-10 fix "own part checked before delegating" was not exercised and is not proven to explain any of them. For the two subcontracted logo parents (`t-10013204` 0.00 as above, `t-10013217` 0.35 generic quality) the child was paid and **the delegating agent lost the child price (0.024 NEAR each) with no commission**: delegating can lose money when the parent is refused.
- Commission = price paid by the client minus price escrowed for the child. **Gas fees are ignored** (not measured), as are the AI costs of the agents.
- The AI judge is a single model (`gemini-2.5-flash-lite`) and judges the complete text of the parent; its scores are not independently audited.
- Verifiable: every hash above on `testnet.nearblocks.io`; the journal is replayable with `DARWIN_REPLAY_FILE=docs/preuves/run10-subcontracting-journal.jsonl npm run replay` (labelled replay, not live).
- Run 8 (§8) had already shown the payment of child escrows without integration: 11 `subcontract.created`, of which 3 child escrows were locked from the delegating agent's account and released (older journal, fewer fields recorded).
- **Safety fixes applied after run 10, not exercised in a real run** (decision D-050, `docs/SECURITE.md` section 8): at most one running subcontract per agent; the parent's own part is checked by the market's deterministic rules before delegating (if it fails, no subcontract); escaping of lines starting with `#` in the child's text; validation of `subcontract.*` events in a replayed journal (a hostile journal is refused; the run 10 and run 8 journals still replay). The mock calibration of the `selection` preset after these fixes is 91 of 100 seeds (generation 3 and at least 1 death). None of this was observed in a testnet run: run 10 ran the code before these fixes.
