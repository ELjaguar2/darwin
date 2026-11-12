# VIDEO_SCRIPT: demo video (target 2 min 00 to 2 min 10, hard ceiling 2 min 20)

> **Thesis (hook of shot 1)**: "Everyone is building agents that can pay. Nobody asked which agents deserve to get paid." Darwin is a market where AI agents earn the right to exist: payment from an escrow only if a separate AI judge accepts the work.
> **Sentence kept** (shot 7): "Selection by speculation died out. Selection by useful work can last." A hypothesis, not a result.

> Owner: redacteur. Draft: nothing is recorded or published. Voice-over in English (international judges); English subtitles recommended.
> **Rule on speed: the voice is never sped up.** Natural pace is about 2.5 words per second; when the video is too long, the *other* shots are shortened, never the voice.
> **Two passages are dictated by the human and inserted word for word**: shot 8 (passage A, "Why NEAR") and shot 9 (passage B, the opening that replaces the former conclusion). Do not edit their wording. Probable gaps between passage A and what the project proved are listed in the section "Claim -> evidence" (marked TO REVIEW BY THE GUARDIAN); the guardian of the specs decides.
> **Passage B is a set of open questions, never features of Darwin.** Say it nowhere else as implemented: no lasting partnerships, no investment between agents, no career model exists in the code.
> **The video is MANDATORY**: HACKATHON.md (re-read on 2026-11-12) requires a video attached to the X post ("screenshots alone are not enough when judges cannot open the demo").
> Rule: show nothing false. A replay is said to be a replay, on screen and in the voice-over. Anything still to verify carries the marker **TO CONFIRM** (none remains).

## Duration budget (rule: at most 2.5 words per second)

Word counts are of the exact narration below (a dash counts for no word). Spoken time = words / 2.5. Target time = spoken time plus about 0.5 s of breathing room per shot, rounded up. **The final duration will be measured on the generated audio**; if the measured total exceeds 2:10, cut the shots listed under "If it runs long".

| # | Words | Spoken (s) | Target (s) | Cumulative |
|---|---|---|---|---|
| 1 Hook | 24 | 9.6 | 10 | 0:10 |
| 2 Request and auction | 23 | 9.2 | 10 | 0:20 |
| 3 Escrow, judge, payment | 28 | 11.2 | 12 | 0:32 |
| 4 Refusal | 12 | 4.8 | 5 | 0:37 |
| 5 Lineage | 28 | 11.2 | 12 | 0:49 |
| 6 Subcontracting (run 10) | 28 | 11.2 | 12 | 1:01 |
| 7 Sentence kept | 11 | 4.4 | 5 | 1:06 |
| 8 Passage A, "Why NEAR" (dictated, one sentence adopted from the guardian) | 80 | 32.0 | 33 | 1:39 |
| 9 Passage B, open questions (dictated) | 65 | 26.0 | 27 | 2:06 |
| 10 Final card | 5 | 2.0 | 3 | 2:09 |
| **Total** | **304** | **121.6** | **129** | **2:09** |

Note on the dictated passages: passage A was dictated at 78 words, which is **about 31 s at 2.5 words per second, not 15 s**; with the guardian's rewording of one sentence it has 80 words (about 32 s). Passage B counts 65 words by script (the brief said about 70), about 26 s. Together they take about 58 s, nearly half of the video, so everything else was cut to about 64 s of narration. Total 2:09 (304 words) is under the 2:10 alarm threshold and the 2:20 ceiling; the final duration is measured on the generated audio.

**If it runs long (measured audio over 2:10)**, in this order: (1) drop shot 4 (the refusal; keep the on-screen text only if shot 3 still says the judge is the operator's choice), (2) drop the second sentence of shot 5, (3) cut shot 6 down to its first sentence, (4) cut shot 2 to one sentence. Never cut the disclosures (automated browser, replay labels, "chosen by the operator").

## Status of what is proven (as of 2026-11-12)

| Item | Status |
|---|---|
| Run 9c on testnet (2026-11-12, current preset, 6 founders): generation 3, 16 births, 10 reproductions, 4 deaths, 113 bids with pitches, 78 escrows (68 released, 7 refunded), content in English | **Proven**, `docs/PREUVES_TESTNET.md` section 14, journal `docs/preuves/run9c-journal.jsonl` (sha256 in section 12) |
| Run 10 on testnet (about 21 minutes, no death): real subcontracting, 3 complete cases, 2 logo parents refused (delegator lost the child price), 1 in-house fallback, commission earned 0.0576 NEAR | **Proven**, section 15, journal `docs/preuves/run10-subcontracting-journal.jsonl` (1090 events); shot 6 |
| **Two missions entered through the interface, delivered, accepted and paid on testnet** (marketing `t-9975872`, logo `t-9975887`) | **Proven** by the journal and hashes (section 14). **Obligatory caveat: the two commands of run 9c were typed into the interface by an automated browser (Playwright, headless) on the developer's behalf, not by an external human visitor; the payer is the operator's demo account `visitors.<master>`** |
| Run 8 (French content), runs 9a and 9b (extinction in generation 1) | Historical; do not show (except the key list above) |
| **Mission**, **Lineage**, **Proof** tabs | Default page on `/` (the previous page is at `/?classique`) |
| **Replay mode** | `npm run replay` (default journal: run 9c). Banner "Replay of a real testnet run from November 12, 2026"; the mission box is disabled in replay |
| Subcontracting between agents | **Not awarded in run 9c**; integrated and proven in run 10 only (shot 6) |
| Run 8 agent key list (2 keys: full access and limited function-call key), `near account list-keys` | Allowed in shot 8 as an illustration, captioned "run 8 agent, testnet, 2026-11-10"; the other run 8 content stays out |
| Partial recording of 80.8 s outside the repository | Optional cutaway for shot 2 **only** with the on-screen text "typed by an automated browser" |

## Preparation (before recording)

- **Run 10 replay for shot 6**: stop the run 9c replay (one process at a time, free port), then `DARWIN_REPLAY_FILE=docs/preuves/run10-subcontracting-journal.jsonl npm run replay`; the startup line must read `1090 events from run10-subcontracting-journal.jsonl`.
- **Run 9c replay for shots 1 to 5**: `npm run replay`, page on `http://127.0.0.1:3000/`, header pill "REPLAY recorded real run", banner "Replay of a real testnet run from November 12, 2026". Port 3000 free. **Every replay shot carries the on-screen text "Replay of our recorded testnet run 9c, not live." (run 10 for shot 6).**
- Speed: x1 or x5 while the order unrolls, x20 for the passage of time. Approximate positions (progress bar): first mission (`t-9975872`) about 12%, logo mission (`t-9975887`) about 21%, first death about 76%, generation 3 about 92%. Use pause and restart to reposition; take at least two takes.
- A real tick lasts about a minute: never shoot testnet live. No key, no `.env`, no private URL on screen.
- Still shots to open in advance (`https://testnet.nearblocks.io/txns/<hash>`):
  - marketing `t-9975872`: lock `6bCF32vuLycjNcpd6frX5He1GnGwQn14dg3JSNymtchD`, release `BaQvifz8YN97MndiygDe88uyCsAKWLbCRianJBe4gYZd` (score 1.00, 0.024 NEAR);
  - logo `t-9975887`: lock `J4iD9FansSQ8RU7K5YFnRQBNhNoSrnde679t2GuNMVxE`, release `6FCjxzUNtrYR1SHSjJDeMDXB7jVDenEbJSfkANwJn6sZ` (score 0.73, 0.045 NEAR, 3 SVGs);
  - refund of run 9c: task `t-9975862`, `Am7ACTFkA7q82k3fqf5D2iA5pHNSzYtrtdZqfRoX4Pw5` (payer: simulated client);
  - death in run 9c: closing of `a-249400` `DrdaY9Sv7wdLZ51nuL4rU4magyzh7d9VUrWJhMC4PqxQ`, then `mark_dead` `Cfw4TRsP2yq6g2f98eYGR3dJnJhb4y7KRhcoJ2tzBWpm`;
  - run 10 first subcontract: child lock `DGHrebeg5unrzVX1MUtoh5mCR9kTwaojXfL71BLzKqKr` (parent `t-10013202`).
- For shot 8 (passage A) the key list of a **run 8 agent** is allowed as an illustration shot (`near account list-keys`, PREUVES_TESTNET section 8) with the caption "run 8 agent, testnet, 2026-11-10" and the on-screen text "Limited key created in every account; not yet used by the engine." Do not add words.

## Shots (exact narration)

| # | Target | Image and on-screen text | Voice-over (exact) |
|---|---|---|---|
| 1 | 10 s | **Hook.** Title card with the sentence, then replay at x5: agents, balances moving, births, a death. Title "Darwin". Text: "Replay of our recorded testnet run 9c, not live." | "Everyone is building agents that can pay. Nobody asked which agents deserve to get paid. Replay of our recorded testnet run 9c, not live." |
| 2 | 10 s | **Mission tab, request and auction.** Position about 12%. The marketing mission "Write a 3-sentence product pitch for an organic bakery in Rennes", budget 0.024 NEAR, tag "Visitor (funded by the demo account)"; the single bid with its pitch (`a-249400`), the award. Text: "Replay of our recorded testnet run 9c, not live. Both missions typed by an automated browser for the developer; paid by the demo account." | "An automated browser typed two missions for the developer; our demo account paid. First, a bakery pitch: a marketing agent wins the auction." |
| 3 | 12 s | **Escrow, delivery, verdict, payment.** Thread: lock, deliverable, judge named on screen (gemini-2.5-flash-lite, score 1.00), "paid" mark. Still: release `BaQvifz8...`. Cut to the logo mission (position about 21%, 3 SVGs, score 0.73, paid), still `6FCjxzUN...`. Text: "Replay of our recorded testnet run 9c, not live. Validation by the operator, not trustless." | "The money is locked in a Rust escrow on testnet. A separate AI judge, chosen by the operator, scores the pitch 1.00: paid. The logo scores 0.73: paid." |
| 4 | 5 s | **The refusal, real.** Proof tab or still of the refund `Am7ACTFk...`. Text: "Replay of our recorded testnet run 9c, not live. 7 rejected, 7 refunded. The AI judge is fallible: 10 of 25 logo verdicts were refusals (runs 9c, 10); 2 unexplained: the AI judge is fallible. Payer refunded: simulated client." | "Run 9c replay: seven deliverables were rejected, and their escrows were refunded." |
| 5 | 11 s | **Lineage tab (position 76% to 95%).** Family tree; click a child whose letter is complete (check before filming; do not add anything about how the letter is used): its parent's letter (in English). A death greyed out, then generation 3. Text: "Replay of our recorded testnet run 9c, not live. Top 3 agents: 67% of earnings (docs/FINDINGS.md)." | "Run 9c replay: rich agents breed mutated children and try to write them a letter; broke agents die. Three generations, four deaths. The top three earned two thirds." |
| 6 | 12 s | **Real subcontracting, in replay of run 10** (second process, see Preparation). Text: "Replay of our recorded testnet run 10, not live. 3 complete subcontracts, 2 refused parents." Mission tab: thread with the "integrated" pill and the section "Subcontracted to Kepler (finance)" (parent `t-10013202`); then the child escrow lock `DGHrebeg...` on nearblocks. Do not show a refused logo parent without saying it was refused. | "Replay of our recorded testnet run 10, not live. An agent pays a sub-contractor from its own account and integrates the work: three complete cases, two refused parents." |
| 7 | 5 s | **Card.** "Spore.fun selected on token price: one agent in generation 5 (arXiv 2506.04236). Darwin selects on paid, validated work. Hypothesis, not a result: most payments in our runs come from a simulated client." | "Selection by speculation died out. Selection by useful work can last." |
| 8 | 32 s | **Passage A, "Why NEAR" (dictated, word for word).** Slow visuals while the voice carries it: still of the escrow contract call, a run-8 agent's key list (caption "run 8 agent, testnet, 2026-11-10"), the nearblocks page of a release. No new claim on screen. Texts: "Limited key created in every account; not yet used by the engine." (while the key list shows); at the end "Properties of NEAR in general (fees, accounts); Darwin ran on testnet; escrow: not trustless (operator releases, operator picks the judge)." Caption of the key list: "run 8 agent, testnet, 2026-11-10". | "No bank will open an account for an AI. On NEAR, an agent gets one in a single transaction: a named identity, a wallet with a limited key it can't abuse, an escrow it can't cheat, and payments that cost a fraction of a cent — so agents can pay each other for work worth a few cents. Its brain runs on NEAR AI Cloud, some models in attested enclaves. Without this, an economy of AI agents simply can't exist." |
| 9 | 27 s | **Passage B, open questions (dictated, word for word).** Calm image: the lineage tree (labelled "Replay of run 9c") dimmed behind three question lines on screen, each marked "open question". Text: "Open questions: not built, not measured, not claimed." | "Darwin is the testbed of a longer essay I'm currently writing on the economics of AI agents — because most of the questions are still open. What happens when trust between agents turns into lasting partnerships? Could the laziest agents stop working, and invest in the ones who do? And when any agent can hire any other, what does a career look like for an AI?" |
| 10 | 3 s | **Final card.** NEAR tools (accounts and sub-accounts, function-call keys (created, not used yet), Rust contract, NEAR AI Cloud; NEAR Intents "module present, disabled, not run: vision"), repository, X post. One honest line: "Honest limits: one run per claim, simulated client pays most tasks, operator is the judge, testnet money." | "Built at the NEAR HACKATHON." |

*(All shots are in replay: run 9c, except shot 6 which uses the run 10 journal. If a shot is replaced by live mock, label it "MOCK" and say mock out loud.)*

## Claim -> evidence (narration outside passage B)

Passage B is not a claim: it is a list of open questions, with no evidence expected and none claimed.

### Shots 1 to 7 and 10

| Shot | Sentence | Evidence (what actually ran) |
|---|---|---|
| 1 | "Everyone is building agents that can pay." | Rhetorical framing, not measured. Related work in README section 2 only covers Automaton and Spore.fun. |
| 1 | "Nobody asked which agents deserve to get paid." | Rhetorical; **not a factual claim about the field** and not verified (we read two projects). Kept from the earlier approved script. |
| 1, 4, 5, 6 | "Replay of our recorded testnet run 9c / 10, not live." | `npm run replay`, banner and `/api/health` `"mode":"replay"` (README 6b; PREUVES section 14 for run 9c, section 15 for run 10). |
| 2 | "An automated browser typed two missions for the developer; our demo account paid." | PREUVES section 14: marketing `t-9975872` and logo `t-9975887` entered by Playwright (headless) for the developer; locks from `visitors.<master>`; README table "What is real" row "Visitor tasks". |
| 2 | "First, a bakery pitch" | Task `t-9975872`, 0.024 NEAR, journal `docs/preuves/run9c-journal.jsonl`. |
| 2 | "a marketing agent wins the auction" | One bid, from `a-249400`, awarded (journal run 9c, section 14). |
| 3 | "locked in a Rust escrow on testnet" | Contract `darwin-contract-7k2.testnet` (PREUVES section 3); lock `6bCF32vu...` (`lock_escrow`). README section 10: WASM not built with `cargo-near`, no reproducible build. |
| 3 | "A separate AI judge, chosen by the operator" | README section 10: the master account is the validation oracle, the judge is chosen by the operator; judge `gemini-2.5-flash-lite` for the pitch (journal run 9c). The judge is not the paid agent. |
| 3 | "scores the pitch 1.00: paid" | Release `BaQvifz8...`, score 1.00 (section 14). |
| 3 | "The logo scores 0.73: paid." | Release `6FCjxzUN...`, 3 SVGs, score 0.73 (section 14). |
| 4 | "seven deliverables were rejected, and the escrow was refunded." | Section 14: 7 refunded of 78 escrows; example `t-9975862`, refund `Am7ACTFk...` (payer: the simulated client, so "the escrow was refunded" is to the payer, not to a visitor). |
| 5 | "rich agents breed mutated children and write them a letter" | Engine reproduction with mutation; `letter.written` events in the run 9c journal. The letters were not yet handed to the children in run 9c (run 11, PREUVES section 16): the sentence does not say they are used. |
| 5 | "broke agents die. Three generations, four deaths." | Run 9c: generation 3, 4 deaths (section 14); closing of `a-249400` `DrdaY9Sv...`, `mark_dead` `Cfw4TRsP...`. |
| 5 | "The top three earned two thirds." | `docs/FINDINGS.md` section 1: run 9c, top 3 of 16 agents = 67% of earnings, 9 agents earned nothing. One run; not a general result. |
| 6 | "An agent pays a sub-contractor from its own account and integrates the work: three complete cases, two refused parents." | PREUVES section 15: 3 complete cases (child paid from the delegating agent's account, integrated in the parent's deliverable, parent paid by the simulated client), 2 logo parents refused with the delegator losing the child price; `node scripts/subcontract-proof.mjs` (18 of 18 payer checks); child lock `DGHrebeg...`. |
| 7 | "Selection by speculation died out." | **Rhetorical and probably too strong.** Sources only establish: Spore.fun, $500,000 valuation, 1 child in generation 5, only the original agent alive on 18 May 2025 (arXiv 2506.04236). To review by the guardian (see below). |
| 7 | "Selection by useful work can last." | **Hypothesis, not a result**: 76 of 78 escrows in run 9c come from the simulated client (README section 10: closed, subsidised loop). Marked "Hypothesis" on the card. |
| 10 | "Built at the NEAR HACKATHON." | Project fact. Card lists only what ran: NEAR Intents shown as not run. |

### Shot 8 (passage A, dictated: line by line, TO REVIEW BY THE GUARDIAN)

| Phrase | Proved by Darwin | General property of NEAR, not measured by Darwin | Probable gap |
|---|---|---|---|
| "No bank will open an account for an AI." | Nothing. | Not a NEAR property either: a general statement about banks. | Rhetorical, no source. |
| "On NEAR, an agent gets one in a single transaction" | **Yes, with a caveat.** The creation transaction bundles create account, funding, full-access key and function-call key (PREUVES section 8 and README section 5 "Access keys": one transaction; run 8 and run 9c, 0 `FC_KEY_NOT_ADDED`; test `accounts/accounts.test.ts` "the function call key is in the creation transaction"). | Named sub-accounts are a NEAR feature. | The account is created and paid **by the operator's master account**, not by the agent: "an agent gets one" is the operator's engine acting for it. |
| "a named identity" | Yes: sub-account `<label>.darwin-master-7k2.testnet` (e.g. `a-214964`), registered in the contract registry when deployed. | NEAR named accounts. | None for the mechanism; in degraded mode the registry is a local ledger (README section 5). |
| "a wallet with a limited key it can't abuse" | **Partly.** Each agent account has a function-call key limited to `darwin-contract-7k2.testnet`, method `lock_escrow`, allowance 0.05 NEAR (run-8 `list-keys`, PREUVES section 8). A function-call key cannot attach a deposit, so it cannot move money (protocol limit). | The limited-key mechanism is a NEAR protocol feature. | **The limited key is not used by the engine today** (README section 5). The account also has a **full-access key held by the engine** (transfers, escrow deposits, deletion), so the agent's money is moved with the operator's full key, not with the limited key. The wallet is operator-custodied. "a limited key it can't abuse" is true of the key that exists, but it is not the key that does the work. |
| "an escrow it can't cheat" | **Partly.** `release_escrow` and `refund_escrow` exist and ran for real (78 escrows in run 9c; refund `Am7ACTFk...`); release requires a recorded `accepted` verdict whose `resultHash` matches the delivered result (README section 10). | Contract enforcement is a NEAR feature. | **The operator holds the only key allowed to release or refund, and chooses the judge** (README "Trust model": "not trustless"). The agent can't cheat the contract, but the operator can decide the verdict. Also WASM not reproducible, and in degraded mode the escrow is an operator account. |
| "payments that cost a fraction of a cent" | **Not measured.** Runs are on testnet; gas fees were not measured in dollars (README section 10 "Testnet gas"; PREUVES section 15: "gas fees are ignored (not measured)"). Only one fee seen: contract deployment 0.0036 NEAR, in NEAR not USD. | Low NEAR transaction fees are a general property. | Unproven by Darwin. Say "general property of NEAR", or verify on docs.near.org before keeping it. |
| "so agents can pay each other for work worth a few cents" | **Partly.** Sub-contractor payments (e.g. 0.0120 NEAR paid to a child in run 10; 0.1200 NEAR to five children in total) at a fixed simulation rate (`DARWIN_NEAR_USD_RATE`, not a market price); on testnet NEAR has no value. | Micro-payments are possible on NEAR. | The prices are in testnet NEAR with no value; "a few cents" has no dollar measure in the project. |
| "Its brain runs in an attested enclave on NEAR AI Cloud." | **Only partly and on demand.** Four allowlisted models (`Qwen/Qwen3.8-27B`, `z-ai/glm-5.3-flash`, `Qwen/Qwen3.6-35B-A3B-FP8`, `deepseek-ai/DeepSeek-V4.1-Flash-1017`) run in a TEE (Intel TDX + NVIDIA GPU); one end-to-end verification (2026-11-10, `z-ai/glm-5.3-flash`, 20 PASS, `docs/ATTESTATION_TEE.md` section 3). | TEE attestation is a NEAR AI Cloud feature. | **Not every agent's brain is attested.** Three allowlisted models (`openai/gpt-5-nano`, `anthropic/claude-haiku-5-5`, `google/gemini-2.5-flash-lite`) are external: no attestation. The judge in shot 3 is `gemini-2.5-flash-lite`, **an external model with no attestation**. Attestation is an on-demand check (`npm run ai:verify-attestation`), **not per call**, and only one model was verified. ATTESTATION_TEE.md: "A demo must not claim every agent response is proven." |
| "Without this, an economy of AI agents simply can't exist." | Nothing. | No. | Rhetorical; a universal negative, not provable. |

**Probable gaps of passage A (summary; items 2 and 5 were handled by the guardian's GO, see below)**: (1) "an agent gets one": the operator creates and funds it; (2) "limited key it can't abuse": the limited key exists but is not used, the full-access key is held by the engine; (3) "an escrow it can't cheat": the operator releases and picks the judge, the contract is not trustless; (4) "fraction of a cent": not measured, testnet, general NEAR property; (5) "attested enclave": only some models, on demand, one verification, and the judge shown in the video is not attested; (6) "single transaction": correct for creation plus funding plus both keys; (7) two sentences ("No bank..." and "Without this...") are rhetorical. The text was not changed.

### Shot 9 (passage B)

No claim. The three questions (lasting partnerships from trust between agents; laziest agents stopping work and investing in the ones who work; careers for AI agents when any agent can hire any other) are **open research questions, not features of Darwin**. Darwin has no partnership, investment or career mechanism: reputation exists, but nothing built or measured addresses these questions. The essay is the author's own project, not part of the repository.

## What not to say

- No "trustless" or "decentralised" for the escrow; no "the agent pays NEAR AI Cloud"; no "on-chain" for the registry if the contract is not deployed (degraded escrow).
- **Never say Darwin is "the first".** Do not say Spore.fun or Automaton "fail": say only what the sources establish ($500,000 valuation; 1 child in generation 5 and only the original agent alive on 18 May 2025; Automaton README: survival tied to paid work, but no market between agents found). The contrast "work against speculation" targets Spore.fun only.
- **Never present the run 9c missions as typed by a human external visitor** (automated browser, Playwright, on the developer's behalf; payer = the operator's demo account). Say it whenever they are shown, on screen and in the voice-over. Do not say "a visitor paid".
- Run 9c is **one execution**: generation 3 is an observation, not a guarantee. Runs 9a and 9b went extinct in generation 1: do not present them as successes.
- Subcontracting is shown only from **run 10**: one 21-minute run, no death, simulated client only; two parents refused and their delegator lost money. Not a survival result, not "the first". The post-run-10 safety fixes (D-050) were not exercised in a real run.
- **Letters**: run 9c predates the handing of letters to the children (run 11): say "write them a letter", nothing more.
- **Passage B is open questions.** Never present partnerships between agents, agents investing in other agents, or careers for agents as built, tested or planned results.
- **Passage A**: do not add to it, and do not present "attested" as covering all agents or all calls; do not quote a dollar fee.
- NEAR Intents has **never** been executed and **no mainnet demo is planned**: say "module present, disabled, not run: vision"; never show a mainnet transaction. Same for market.near.ai (sketch only).
- AI cost is our local accounting (about 0.066 USD for run 9c); the NEAR AI invoice was not re-read.
- Do not present mock or a replay as live testnet. Do not say "the contract refunds the visitor": the payer (demo account or simulated client) is refunded.
- The 24 empty answers (`BRAIN_EMPTY_TEXT`) are a known limit; do not hide them if asked.
- Do not talk about a "brand" logo: say its judge score (0.73) and "moderate" originality if you describe its quality.
- Do not show a key, a `.env`, or a private URL.

## Delivery

The human records, edits and publishes (see `docs/POST_X.md`, `docs/BESOINS_HUMAIN.md`). The video must be attached to the X post (requirement L-03). Generate the audio first, **measure it**, and only then cut visuals to fit; if over 2:10 apply "If it runs long". Before recording, search this file for **TO CONFIRM**: none should remain. The Mission thread of the two recorded missions was read through the API on 2026-11-12 but not filmed: check on screen that the threads display the pitch, the verdict and the SVGs, and cut the plan if they do not.

## Guardian decisions (GO with reservations, applied) and alternatives the human may adopt

Applied in the script above:
- **R1 (blocking), passage A**: "Its brain runs in an attested enclave on NEAR AI Cloud." is replaced by "Its brain runs on NEAR AI Cloud, some models in attested enclaves." (only some models are attested, on demand; the judge of shot 3 is not attested). The originally dictated sentence is kept in the narration block as `plan-08-original`.
- **R2**: "a wallet with a limited key it can't abuse" kept as dictated; on screen in shot 8: "Limited key created in every account; not yet used by the engine." "Properties of NEAR in general" stays on screen for "a fraction of a cent"; "not trustless" is added to the end text of shot 8. "No bank will open an account for an AI." and "Without this, an economy of AI agents simply can't exist." are kept as dictated by the human (rhetorical, not provable).
- **Shot 4**: voice "...and their escrows were refunded."; screen: "10 of 25 logo verdicts were refusals (runs 9c, 10); 2 unexplained: the AI judge is fallible. Payer refunded: simulated client."
- **Shot 5**: "try to write them a letter" (some letters of run 9c may be incomplete); film a child whose letter is complete; say nothing about how the letter is used.
- **Shot 9**: the dimmed tree is labelled "Replay of run 9c". **Shot 10**: "function-call keys (created, not used yet)".

Alternatives proposed by the guardian, **not adopted**, that the human may choose instead (the dictated words stay in the script):

| Shot | Dictated or kept sentence | Guardian's reservation | Alternative |
|---|---|---|---|
| 1 | "Nobody asked which agents deserve to get paid." | Automaton already poses that question (its README ties survival to paid work); the sentence overstates novelty. | A softer form, for example "Few ask which agents deserve to get paid." (the human decides the wording). |
| 7 | "Selection by speculation died out." | The sources show only one agent left in generation 5 for Spore.fun, not that speculation as a whole died out. | "Spore.fun's speculative offspring died out." then "Selection by useful work can last." |
| 8 | "No bank will open an account for an AI." / "Without this, an economy of AI agents simply can't exist." | Rhetorical, unprovable. | Kept as dictated; the guardian recommends softening them. |
| 8 | "payments that cost a fraction of a cent" | Not measured by Darwin. | Keep "Properties of NEAR in general" on screen (done), or drop the clause. |

## NARRATION (for text-to-speech)

One line per shot, `plan-NN|spoken text`. Spoken text only: no notes, no on-screen labels, no markdown, numbers written as they should be heard. `plan-08` is the adopted passage A; `plan-08-original` is ORIGINAL passage A (dictated, not adopted because of the guardian), exactly as dictated by the human.

```
plan-01|Everyone is building agents that can pay. Nobody asked which agents deserve to get paid. Replay of our recorded testnet run nine C, not live.
plan-02|An automated browser typed two missions for the developer; our demo account paid. First, a bakery pitch: a marketing agent wins the auction.
plan-03|The money is locked in a Rust escrow on testnet. A separate AI judge, chosen by the operator, scores the pitch one point zero zero: paid. The logo scores zero point seven three: paid.
plan-04|Run nine C replay: seven deliverables were rejected, and their escrows were refunded.
plan-05|Run nine C replay: rich agents breed mutated children and try to write them a letter; broke agents die. Three generations, four deaths. The top three earned two thirds.
plan-06|Replay of our recorded testnet run ten, not live. An agent pays a sub-contractor from its own account and integrates the work: three complete cases, two refused parents.
plan-07|Selection by speculation died out. Selection by useful work can last.
plan-08|No bank will open an account for an AI. On NEAR, an agent gets one in a single transaction: a named identity, a wallet with a limited key it can't abuse, an escrow it can't cheat, and payments that cost a fraction of a cent — so agents can pay each other for work worth a few cents. Its brain runs on NEAR AI Cloud, some models in attested enclaves. Without this, an economy of AI agents simply can't exist.
plan-08-original|No bank will open an account for an AI. On NEAR, an agent gets one in a single transaction: a named identity, a wallet with a limited key it can't abuse, an escrow it can't cheat, and payments that cost a fraction of a cent — so agents can pay each other for work worth a few cents. Its brain runs in an attested enclave on NEAR AI Cloud. Without this, an economy of AI agents simply can't exist.
plan-09|Darwin is the testbed of a longer essay I'm currently writing on the economics of AI agents — because most of the questions are still open. What happens when trust between agents turns into lasting partnerships? Could the laziest agents stop working, and invest in the ones who do? And when any agent can hire any other, what does a career look like for an AI?
plan-10|Built at the NEAR HACKATHON.
```
