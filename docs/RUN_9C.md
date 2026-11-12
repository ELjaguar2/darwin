# Run 9c — real showcase run (testnet)

> Prepared on 2026-11-12 (commands and variable names re-checked against `shared/config.ts` and `backend/` on 2026-11-12). Launched **by the human**, in a separate terminal, with no background observer.
> Goals: (1) validate in real conditions the recalibrated `selection` preset (D-043, calibrated in mock only); (2) produce the showcase replay journal: bid pitches and deliverable contents recorded (D-045), at least one visitor order taken through to payment.
> No mainnet green light is involved. Everything is testnet.
> **All generated content in this run is in English** (bid pitches, deliverables, letters, console messages, task titles), unlike runs 8, 9a and 9b, which were in French. The AI cost per bid is slightly higher with the English prompts (a little more input and output text per call), so read the cost estimate in section 3 as a lower bound.

## 0. What we know from previous runs (so as not to tell ourselves stories)

| Run | Preset | Result |
|---|---|---|
| 8 | `selection` (4 founders, capital 0.1, metabolism 0.005, client 1.5/tick) | Generation 3, 12 births, 7 deaths, 65 escrows, 92 bids, 138 AI calls (0.0149 USD), 59 ticks (39 min) |
| 9a | 4 founders (journal: 4 births), L16 professions | Extinction in generation 1 (4 births, 4 deaths at tick 14), only 7 bids, logos rejected |
| 9b | 6 founders, 6 professions | Extinction in generation 1 (6 deaths at tick 19), only 9 bids, 7 rejections (logos) |

Since 9b: hard `max_tokens` cap for deliverables (7cb869d), mock calibration D-043 (capital 0.12, metabolism 0.0035, client 2/tick), bid pitch in real conditions (D-045, **one AI call per bid**). The logo was validated by an isolated real call (docs/PREUVES_TESTNET.md §10), not in a full run.
**Main risk: another extinction in generation 1** (few bids, income too low). The mock gives a 92% success rate; reality is harder (latency, judge rejections).

## 1. Before launching (checklist)

1. Final code merged into `main` (security and guardian reviews done), then:
   ```powershell
   cd <repository>
   git checkout main
   npm ci
   npm test        # must be green
   ```
2. `.env`: real `.env` present with the **new** master key (rotation of 2026-11-11), valid `NEARAI_API_KEY`, `NEAR_RPC_URL` (one or more providers, comma-separated, to limit 429s). `INTENTS_ENABLED=false`.
3. **Master account balance** `darwin-master-7k2.testnet`: 1.909 NEAR on 2026-11-12 (after the acceptance test). Estimated need below: **top up to have at least 8 NEAR**.
   ```powershell
   curl.exe -s -X POST https://test.rpc.fastnear.com -H "Content-Type: application/json" -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"darwin-master-7k2.testnet\"}}'
   ```
   The `amount` field is in yoctoNEAR (1 NEAR = 10^24). Top up via the usual testnet faucet (the one from previous runs, which gave 10 NEAR).
4. Backup: startup renames `data/journal.jsonl`, `state.json` and `lineage.json` to `*.prev` (and **overwrites** the old `journal.prev`). Copy first:
   ```powershell
   Copy-Item -Recurse data "data-backup-$(Get-Date -Format yyyyMMdd-HHmm)"
   ```
5. AI budget: `data/ai-budget.json` cumulative ≈ 0.05 USD, stop cap 8 EUR: ample.
6. Close the other Darwin servers (port 3000 free).

## 2. Exact command

In a separate PowerShell terminal:
```powershell
cd <repository>
$env:DARWIN_PRESET = "selection"
$env:DARWIN_ADMIN_TOKEN = "<random-string-of-24-characters-or-more>"   # optional, used to pause cleanly
npm run start:testnet
```
No other tuning variable (as in run 8). Ids are shifted automatically. The page is at http://127.0.0.1:3000 (check that the header shows **NEAR TESTNET**, not MOCK or REPLAY). A tick lasts about 1 real minute.

Recommended course during the run:
- **Ticks 1 to 8**: let the 6 founders be born. Check the Mission page (agent cards) and the Proof tab (nearblocks links).
- **Around tick 8-10, if >= 5 agents are alive**: place a visitor order from the mission box ("Describe your mission…") on the Mission tab. First a **marketing or a translation** task (professions already proven in real conditions), budget 1 NEAR. Then, once the first is paid, **a logo** (that is what proves the corrected token cap). The profession must have a living agent, otherwise the order expires with no bids (as happened to the visitor orders of runs 9a and 9b): look at the profession icons on the agent cards before ordering. The budget box is pre-filled with the profession's minimum price (shown under the field), so you can send it as is.
- **Stop** when: generation 3 reached **and** at least one death **and** at least one visitor order paid; or at 90 minutes at most; or early stop (below).

## 3. Cost estimate

**AI (NEAR AI Cloud).** Run 8: 138 calls, 0.0149 USD. Each real bid adds a call of ~120 output tokens (measured at acceptance with the French prompts: 13 calls = 0.0046 USD, i.e. ~0.0004 USD per call; the English prompts cost a bit more per bid, not re-measured). For 150 to 300 bids: 0.06 to 0.12 USD. Expected total for the run: **0.1 to 0.25 USD**, i.e. less than 0.25 EUR against an 8 EUR cap. AI cost is not an issue; monitoring focuses on the **economic health of the agents** (the pitch is debited from each agent, including the losers).

**NEAR (testnet, no value).** Run 8: gross outflows from the master account ≈ 2.9 NEAR (1.23 for accounts, 1.70 to fund the simulated client), of which ~0.2 came back via account closing. For 9c: founders 6 × 0.12 = 0.72; up to 18 agents; simulated client at 2 tasks/tick instead of 1.5 (+33%); duration up to 90 ticks; visitor orders <= 1 NEAR each. **Gross estimate: 5 to 7 NEAR.** Current balance 1.909 -> **top up by at least 6 NEAR** (target >= 8). If the balance falls below 1 NEAR during the run, pause and stop.

## 4. What to monitor (and what to do)

| Signal | Where | Threshold / action |
|---|---|---|
| Early extinction | Mission tab / Lineage tab | >= 3 deaths out of 6 before tick 20 with no reproduction at all = the pattern of runs 9a/9b -> pause, keep the journal, fall back to the run 8 replay for the video |
| Bids | Mission page feed, `bid.placed` | there should be several bids per task (run 8: ~0.8 bid/task). 9a/9b had almost none |
| Pitches | `bid.placed.bid.pitch` | present on (almost) all bids; watch for `PITCH_FALLBACK` (ok if rare) |
| Logos | `task.validated`, `deliverable.produced` | `finish_reason` not truncated; a repeated `rule:logo` rejection = model problem, note which one |
| Deliverables | `deliverable.produced.files[].content` | all files carry `content` (otherwise the replay does not serve the deliverable); `truncated` rare |
| RPC 429 | `system.warning`, terminal console | retries are normal; serial failures = change `NEAR_RPC_URL` |
| `BRAIN_EMPTY_TEXT` | `system.warning` | seen once on `openai/gpt-5-nano` (empty response, `finish_reason=length`); if frequent, note the model |
| AI budget | `data/ai-budget.json` | must stay at a few cents |
| Master balance | RPC (command §1.3) | pause if < 1 NEAR |
| Visitor order | Mission feed | escrow -> deliverable -> verdict -> "paid ✓" with link; a rejection followed by a refund remains a valid proof, to be described as such |
| Memory / size | task manager, size of `data/journal.jsonl` | deliverable contents grow the journal (<= 64 KB per deliverable) |

## 5. Stopping and recovering the journal

```powershell
curl.exe -X POST http://127.0.0.1:3000/api/sim/pause -H "Authorization: Bearer <your-token>"
```
(without a token defined, the same command without the header). Then `Ctrl+C` in the run's terminal. **Before any other startup**:
```powershell
Copy-Item data\journal.jsonl docs\preuves\run9c-journal.jsonl
```
Check that it contains no key or token: `npm run scan-secrets -- --no-history`.

Replay of the showcase journal:
```powershell
$env:DARWIN_REPLAY_FILE = "docs/preuves/run9c-journal.jsonl"
npm run replay
```

## 6. After the run (to be done by the team)

1. `node scripts/gen-preuves.mjs docs/preuves/run9c-journal.jsonl` then complete `docs/PREUVES_TESTNET.md`: run 9c section with settings, exact result (even in case of failure), transaction hashes, AI cost (`data/ai-budget.json`), master balance before/after.
2. Connect the journal to the replay (`DARWIN_REPLAY_FILE`), check the Mission tab in replay: pitches and deliverables are displayed, "Replay" banner present.
3. Align README, FORMULAIRE, VIDEO_SCRIPT and POST_X with what **actually** ran. If the run did not reach generation 3, promise nothing: the video relies on run 8 (generation 3 proven) and the 9c journal is only cited for what it proves.

## 7. Fallback

If 9c fails (extinction, RPC outage, budget) before 12:00 UTC on 13 November: keep the run 8 replay as the demo, remove the run 9c mentions from the video and the post, and the logo stays "next step" in the README (it is only validated by the isolated real call of track C).

## 8. Result of run 9c

<!-- RUN9C-RESULT:BEGIN -->
**Run 9c was executed on 2026-11-12** (real NEAR testnet, real NEAR AI Cloud brain, preset `selection` alone, 6 founders: logo, finance, architecture, marketing, translation, legal). Started 13:06:26Z, paused by the operator at tick 43 at about 13:59Z (about 53 minutes). Journal `docs/preuves/run9c-journal.jsonl`: 2525 events (13:06:26Z to 13:59:38Z), sha256 `A54065A5399152FBE3F440A8DC699150DA8E7E4636D075548EFA42FA3C9AF618`. Full tables and hashes: `docs/PREUVES_TESTNET.md` section 14.

- **Evolution**: generation 3 reached (`a-249411` at tick 40), 16 births (6 founders and 10 children), 10 reproductions, 10 parent-to-child letters, 4 deaths by starvation (`a-249400` tick 33, `a-249398` tick 35, `a-249403` tick 40, `a-249404` tick 42). The extinction of runs 9a and 9b did not recur in this execution (one run, one seed: not a guarantee).
- **Market**: 113 bids, all with a pitch; 78 escrows locked, 68 released, 7 refunded (4 logo rejections by the AI judge, 3 legal rejections by the deterministic disclaimer rule); 26 tasks expired without a bid; 75 validations (68 accepted, 7 rejected); 75 deliverables, all with their content recorded (translation 23, logo 15, legal 15, architecture 8, finance 8, marketing 6).
- **Two visitor-path missions paid**: `t-9975872` (marketing, 0.024 NEAR, won by `a-249400`, judge score 1.00, lock `6bCF32vuLycjNcpd6frX5He1GnGwQn14dg3JSNymtchD`, release `BaQvifz8YN97MndiygDe88uyCsAKWLbCRianJBe4gYZd`) and `t-9975887` (logo, 0.045 NEAR, won by `a-249397`, 3 complete SVGs, judge score 0.73, lock `J4iD9FansSQ8RU7K5YFnRQBNhNoSrnde679t2GuNMVxE`, release `6FCjxzUNtrYR1SHSjJDeMDXB7jVDenEbJSfkANwJn6sZ`). **How they were entered**: typed into the interface (mission bar of the Mission tab) by an automated browser (Playwright, headless) **on the developer's behalf**, the first during a video-recording session that was interrupted (out of memory), the second with a lightweight browser without video. They are not missions from an external human visitor, and the payer is the operator's demo account `visitors.darwin-master-7k2.testnet`. Agents, auctions, judging and payments are real.
- **Brain**: 270 calls (198 debited from agents, 72 judge calls booked to the treasury), about 0.0656 USD for the run (local accounting; the cumulative budget file reads 0.111 USD). 24 `BRAIN_EMPTY_TEXT` warnings (empty answers, `finish_reason=length`; DeepSeek-V4.1-Flash x16, gpt-5-nano x7, claude-haiku-5-5 x1), with no effect on the payments of the two visitor missions. The master account went from about 11.91 to about 10.14 NEAR (read by the project lead, not in the journal).
- **Not working in this run**: subcontracting between agents: 18 created, 0 awarded (all 18 expired with no bid; known issue, fix in preparation, not merged). Run 8 had 3 subcontracted tasks paid.
- **Video**: the live recording attempt failed (interrupted for lack of memory). A **partial** recording of 80.8 s (Mission page, typing and sending the first order, 1920x1080, VP9) exists outside the repository (`<user folder>\Darwin-run9c\video\`). The final video will be edited from the **replay** of this journal (`npm run replay`, which now defaults to the run 9c journal), labelled as a replay.
- **All generated content is in English** (as announced at the top of this file); runs 8, 9a and 9b are in French.
<!-- RUN9C-RESULT:END -->
