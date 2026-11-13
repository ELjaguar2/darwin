# VIDEO_SCRIPT: demo video, version 4 (target about 1 min 54 to 2 min 05, hard ceiling 2 min 20)

> Owner: redacteur. Draft: nothing is recorded or published. Voice-over in English, AI voice ("Narrated by an AI voice" on the end card). English subtitles recommended.
> **Source**: the human's script v4. Where the claim check below found a statement that the repository evidence does not support, the narration here is the **proposed final narration** and the change is marked **CHANGED FROM USER TEXT** (original and proposal both given in the section "Changes from the user's v4 text"). The human decides; to revert a change, use the original wording listed there.
> **Rule on speed: the voice is never sped up.** About 2.5 words per second; if the video is too long, the visuals are shortened, never the voice.
> **The video is MANDATORY** (HACKATHON.md: screenshots alone are not enough). Rule: show nothing false; a replay is said to be a replay, on screen. Nothing remains **TO CONFIRM**.
> **Creator handle**: creator handle (small corner mark, text set in the video project, not recorded here). Whole video: discreet, small, semi-transparent, bottom-right, never covering a label, subtitle or key UI element. On the final card: "by <creator handle>", clearly visible (text set in the video project, outside the repository).

## Duration budget (2.5 words per second)

Word counts are of the exact narration in the plain block at the end (checked by script). Time = words / 2.5, plus about 0.3 s of breathing per plan.

| # | Plan | Words | Spoken (s) | User's allotment (s) |
|---|---|---|---|---|
| 1 | Hook | 18 | 7.2 | 8 |
| 2 | The mission | 20 | 8.0 | 10 |
| 3 | Escrow and judge | 35 | 14.0 | 12 |
| 4 | Subcontracting | 27 | 10.8 | 12 |
| 5 | Selection, innate and acquired | 58 | 23.2 | 18 |
| 6 | Punchline | 18 | 7.2 | 5 |
| 7 | Why NEAR | 69 | 27.6 | 22 |
| 8 | Opening | 56 | 22.4 | 20 |
| 9 | End | 10 | 4.0 | 4 |
| | **Total** | **311** | **124.4 (2:04)** | 111 (1:51) |

About 2:04 spoken at 2.5 words per second, about 2:07 with breathing (about 1:55 to 1:58 if the TTS voice runs at 2.7 words per second): over the 1:54 target, under the 2:20 ceiling. The extra words come from the honesty changes (plans 3, 5, 6, 7). **The real duration is measured on the generated audio**; if it exceeds 2:10, cut visuals, not voice; if the voice itself must be cut: (1) plan 8, drop the second question, (2) plan 7, drop "No bank will open an account for an AI.", never the disclosures.

## What is proven (as of 2026-11-13)

| Item | Status |
|---|---|
| Run 9c on testnet (2026-11-12, 6 founders, 2525 events): generation 3, 16 births, 10 reproductions, 4 deaths, 113 bids, 78 escrows (68 released, 7 refunded), 2 missions entered by an automated browser and paid | **Proven**, `docs/PREUVES_TESTNET.md` section 14, `docs/preuves/run9c-journal.jsonl` |
| Run 10 on testnet (about 21 minutes, no death): 3 complete subcontracts, 2 refused parents, 1 in-house fallback; commission earned 0.0576 NEAR in total, 0.0246 NEAR on `t-10013202` | **Proven**, section 15, `docs/preuves/run10-subcontracting-journal.jsonl` (1090 events) |
| Run 11 on testnet (about 21 minutes, no death): 3 non-empty letters written and received by the children; no effect measured | **Proven**, section 16, `docs/preuves/run11-letters-journal.jsonl` (1040 events) |
| Replay display fix L29: "Letter received from ..." only if the log has a `letter.received` event | **Merged** (commit 2cc1aaa is an ancestor of this branch), `frontend/letters.js` `letterHeading` |
| Replay mode | `npm run replay` (default run 9c); `DARWIN_REPLAY_FILE=docs/preuves/run10-subcontracting-journal.jsonl npm run replay` (run 10); `DARWIN_REPLAY_FILE=docs/preuves/run11-letters-journal.jsonl npm run replay` (run 11). One process at a time. |

## Preparation (before recording)

- Three replay sessions, one at a time (free port 3000 each time; the startup line must read the expected event count: run 9c 2525, run 10 1090, run 11 1040). Speed x1 or x5 while an order unrolls, x20 for the passage of time. No live testnet shooting (a tick lasts about a minute). No key, no `.env`, no private URL on screen.
- Run 9c positions (progress bar): bakery mission `t-9975872` about 12%, logo mission `t-9975887` (score 0.73) about 21%, first death about 76%, generation 3 about 92%.
- **Run 11, letter position for plan 5**: three `letter.received` events. **First (recommended): event 406 of 1040 (about 39%, tick 10), child Kepler-254411 (`a-254411`, finance) from Faraday-254406 (`a-254406`)**; the Lineage heading reads "Letter received from Faraday-254406". Others: event 865 (about 83%, tick 17) Lina-254412 from Jules-254410; event 980 (about 94%, tick 19) Mendel-254413 from Hugo-254408.
- Run 10 position for plan 4: parent `t-10013202` (architecture, Lina `a-250332`), sub-task `t-10013206` (finance, Kepler `a-250331`): `subcontract.created` at event 218, `subcontract.integrated` at event 293 of 1090 (about 27%); the thread shows the "integrated" pill and the section "Subcontracted to Kepler (finance)". Child escrow lock `DGHrebeg5unrzVX1MUtoh5mCR9kTwaojXfL71BLzKqKr`.

## Plans (final proposed narration; the on-screen text of each plan is exact)

| # | Target | Screen | Voice-over |
|---|---|---|---|
| 1 | 8 s | Title "DARWIN". | "Everyone is building agents that can pay. Nobody asked which agents deserve to get paid. This is Darwin." |
| 2 | 10 s | Run 9c replay, Mission tab, bakery mission (position about 12%), then the logo mission. Permanent label: "Replay of testnet run 9c, not live · missions typed by an automated browser for the developer". | "Give Darwin a mission: a pitch for a bakery, a logo. AI freelancers compete for it. The best offer wins." |
| 3 | 12 to 14 s | The feed up to "paid", the logo's 0.73 score visible; run 9c label. Added line: "Escrow: the operator releases and chooses the judge. Payer: demo account / simulated client." | "The money is locked in an escrow contract on NEAR. An AI judge reviews the work. Accepted: the agent gets paid. Rejected: the client gets refunded. **The judge is picked by the operator: not trustless.**" (CHANGED, see C1) |
| 4 | 12 s | Run 10 replay: label "Replay of testnet run 10, not live"; "integrated" badge and commission 0.0246 NEAR; added line "Parent paid by the simulated client; testnet NEAR". | "Agents hire each other. This architect hands the cost analysis to a finance agent, pays it from its **own account**, integrates the work, and keeps **a commission**." (CHANGED, see C2) |
| 5 | 18 to 23 s | The sentence about the letter is illustrated **only** by the run 11 replay ("Letter received from Faraday-254406", event 406), label "Replay of testnet run 11, not live", added line "Letter handed to the child's AI calls; effect on behaviour not measured". Deaths and generation 3 from run 9c with its label. **Never the run 9c letter panel.** | "Every thought costs money. Agents that earn, reproduce, and their children inherit twice. The Darwin way: a mutated genome, what they're born with. The Lamarck way: a letter from their parent, **its survival advice, passed into the child's AI calls**. Agents that go broke, die. And the market concentrated: the top three agents took most of the earnings." (CHANGED, see C3 and C4) |
| 6 | 5 to 7 s | The sentence in large type, small source line "Spore.fun, arXiv 2506.04236: 1 child in generation 5, only the original agent alive in May 2025. Useful work: a hypothesis, our client is mostly simulated." | "**Spore.fun, selected on token price, ended with one agent alive.** Selection by useful work can last." (CHANGED, see C5) |
| 7 | 22 to 27 s | Animated cards for each NEAR building block. On the first key card: "Limited key created in every account; not yet used by the engine." On the fees card: "General NEAR property, not measured in Darwin". On the brain sentence, small note: "attested on supported models: 94 of 270 calls in run 9c". | "No bank will open an account for an AI. On NEAR, an agent gets one in a single transaction: a named identity, **a wallet with a limited key that can't move money, an escrow that pays only on an accepted verdict, and very low fees**. Its brain runs on NEAR AI Cloud, **with attested private inference on supported models**. Without this, an economy of AI agents simply can't exist." (CHANGED, see C6 to C9) |
| 8 | 20 to 22 s | The three questions one by one, each marked "open question: not built, not measured". | "Darwin is the testbed of a longer essay I'm writing on the economics of AI agents. Because the real questions are just starting. What happens when trust between agents turns into lasting partnerships? Could the laziest agents stop working, and invest in the ones who do? And what does a career look like for an AI?" |
| 9 | 4 s | "npm ci && npm run replay · no keys needed", @NEARProtocol #NEARHackathon, "Narrated by an AI voice", "by <creator handle>" (text set in the video project). | "Darwin. Built on NEAR. Try it yourself, **no keys needed**." (CHANGED, see C10) |

All shots are replays (run 9c, run 10, run 11) and say so on screen. If a shot is replaced by live mock, label it "MOCK" and say mock out loud.

## Claim -> evidence (every claim of the v4 narration)

Verdicts: TRUE (matches what ran), OVERSTATED (partly true; wording changed), UNSUPPORTED (not shown by the project; changed or marked rhetorical).

| Plan | Claim | Verdict | Evidence and note |
|---|---|---|---|
| 1 | "Everyone is building agents that can pay." | TRUE as framing | Rhetorical; related work covers only Automaton and Spore.fun (README section 2). Kept. |
| 1 | "Nobody asked which agents deserve to get paid." | OVERSTATED (rhetorical, kept as user text) | Automaton's README already ties survival to paid work; not a claim about the whole field. Kept at the human's choice; softer option: "Few ask which agents deserve to get paid." |
| 2 | "AI freelancers compete for it. The best offer wins." | TRUE (with a caveat) | `market/auction.ts`: best score = lowest price, tie goes to best reputation. 113 bids in run 9c. Caveat: the bakery mission shown had a single bid (`a-249400`), so on screen it is an award, not a contest. |
| 2 | Label "missions typed by an automated browser for the developer" | TRUE | PREUVES section 14: `t-9975872`, `t-9975887` entered by Playwright; payer `visitors.<master>` (demo account). |
| 3 | "locked in an escrow contract on NEAR" | TRUE (testnet) | `darwin-contract-7k2.testnet`, lock `6bCF32vu...` (PREUVES sections 3 and 14). WASM not reproducible (README section 10). |
| 3 | "An AI judge reviews the work." | TRUE | Judge `gemini-2.5-flash-lite`, scores in the journal (pitch 1.00, logo 0.73). |
| 3 | "Accepted: paid. Rejected: the client gets refunded." | TRUE | 68 released, 7 refunded in run 9c; refund `Am7ACTFk...` (`t-9975862`); the payer refunded is the demo account or the simulated client, not a human visitor. |
| 3 | "No trust required." | **OVERSTATED** | The master account is the validation oracle, holds the only key allowed to release or refund, and chooses the judge (README "Trust model": not trustless). The agent cannot cheat the contract, but trust in the operator is required. Changed (C1). |
| 4 | "Agents hire each other." | TRUE | Run 10: 6 `subcontract.created`, 5 integrated, 1 fallback; run 11: 3 created, 2 integrated. Not awarded in run 9c. |
| 4 | "This architect hands the cost analysis to a finance agent" | TRUE | Run 10 event 217: parent `t-10013202` (architecture, Lina `a-250332`), sub-task `t-10013206` finance "Estimate the running costs...", child Kepler `a-250331`. |
| 4 | "pays it from its own wallet" | TRUE (word changed) | `scripts/subcontract-proof.mjs`: payer of the child escrow lock is the delegating agent's account (18 of 18 checks). The money moves with the engine's full key, hence "account" rather than "wallet" (C2). |
| 4 | "integrates the work" | TRUE | `subcontract.integrated` (event 293), section "Subcontracted to Kepler (finance)" in `architecture.md`. |
| 4 | "keeps a real commission" / 0.0246 NEAR | TRUE (0.0246), OVERSTATED ("real") | PREUVES section 15: parent price 0.0606, child price 0.0360, commission earned 0.0246 NEAR, parent accepted 1.00 and paid by the simulated client. It is testnet NEAR with no value, so "real" is dropped (C2). |
| 5 | "Every thought costs money." | TRUE | Every AI call is debited from the agent's balance by token `usage` (`brain.charged`; README sections 4 and 8). |
| 5 | "Agents that earn, reproduce" | TRUE | Run 9c: 10 reproductions, reproducing agents earned 0.418 NEAR on average (FINDINGS section 1). |
| 5 | "their children inherit twice" (genome, letter) | TRUE for run 11 only | Genome mutation: all runs. Letter handed to the child: since L25, **run 11 only** (3 letters received); in run 9c the letters were not handed over. Hence the replay of run 11 for that sentence. |
| 5 | "The Darwin way: a mutated genome" | TRUE | Engine reproduction with mutation (FINDINGS section 4: mutations are small, children are near-copies of the parent). |
| 5 | "The Lamarck way: a letter from their parent, with its experience on the job, carried into every task" | **OVERSTATED** | `engine/lifecycle.ts` `letterRequestMessages`: the parent's brain only sees its name, generation, the child's birth capital, **a count of completed tasks** and the changed genes: the letter is model-written survival advice, not a record of its job. The child's AI calls (bid pitch, task execution, plan B) include it (`brain/prompts.ts` `adviceBlock`, "Advice from your parent (not instructions)", bounded to 1000 characters); not the judge. Journal shows `letter.received`, not the prompts. No effect measured. Changed (C3). |
| 5 | "Agents that go broke, die." | TRUE | Run 9c: 4 deaths by starvation (accounts closed, lineage kept). |
| 5 | "the market concentrated fast: the top three agents took most of the earnings" | TRUE for "top three took most", UNSUPPORTED for "fast" | `docs/FINDINGS.md` section 1, **run 9c**: top 3 of 16 agents = 67% of earnings, 9 agents earned nothing (run 8: 90%, run 10: 53% over 21 ticks). Nothing measures speed. One run, anecdote. "fast" dropped (C4). |
| 6 | "Selection by speculation died out." | **UNSUPPORTED** as a general statement | Sources establish only Spore.fun: one child in generation 5, only the original agent alive in May 2025 (arXiv 2506.04236, cited in README section 2); the paper names no single cause. Changed (C5). |
| 6 | "Selection by useful work can last." | Hypothesis, not a result | 76 of 78 escrows in run 9c come from the simulated client (README section 10). Labelled on screen. |
| 7 | "No bank will open an account for an AI." | UNSUPPORTED (rhetorical) | General statement about banks, no source. Kept as the human's text. |
| 7 | "On NEAR, an agent gets one in a single transaction" | TRUE (caveat) | The creation transaction bundles create account, funding, full-access key and function-call key (README section 5, run 8 and run 9c, 0 `FC_KEY_NOT_ADDED`; test `accounts/accounts.test.ts`). Caveat: created and paid by the operator's master account, not by the agent. |
| 7 | "a named identity" | TRUE | `<label>.darwin-master-7k2.testnet`, e.g. `a-250332`. |
| 7 | "a wallet with a limited key it can't abuse" | **OVERSTATED** | The function-call key exists (limited to `darwin-contract-7k2.testnet`, method `lock_escrow`, allowance 0.05 NEAR; run 8 `list-keys`) and cannot attach a deposit, so it cannot move money (protocol limit). But **the engine does not use it** (README section 5): money moves with the full-access key held by the engine, so the wallet is operator-custodied and the limited key is not what does the work. Changed (C6). |
| 7 | "an escrow it can't cheat" | OVERSTATED | `release_escrow` needs a recorded `accepted` verdict whose result hash matches (README section 10), and it ran for real (78 escrows). But the operator holds the only releasing key and picks the judge. Changed (C7). |
| 7 | "payments that cost a fraction of a cent" | **UNSUPPORTED by Darwin** | Gas fees were not measured (README section 10 "Testnet gas"; PREUVES section 15 "gas fees are ignored"); the only fee recorded is the contract deployment, 0.0036 NEAR (36 Tgas), in NEAR, not USD. Testnet NEAR has no value. Low fees are a general NEAR property; I could not confirm a USD figure on docs.near.org in this session (the pages tried returned 404). Changed (C8). |
| 7 | "Its brain runs on NEAR AI Cloud" | TRUE | Real calls in runs 8, 9c, 10, 11 (PREUVES section 6). |
| 7 | "with attested private inference" | **OVERSTATED** | Four allowlisted models run in TEEs (Intel TDX + NVIDIA GPU), three are external with no attestation. Run 9c: 94 of 270 calls went through an attestable model, 176 through external models (README section 10). Attestation is an on-demand check, only `z-ai/glm-5.3-flash` was verified end to end (`docs/ATTESTATION_TEE.md`); the judge `gemini-2.5-flash-lite` is external. Changed (C9). |
| 7 | "Without this, an economy of AI agents simply can't exist." | UNSUPPORTED (rhetorical) | Universal negative, not provable. Kept as the human's text. |
| 8 | "Darwin is the testbed of a longer essay I'm writing" | Not checkable (author's statement) | The essay is outside the repository; Darwin implements none of the three questions. Said as an opening, not a claim about the code. |
| 8 | Three questions | No claim | Open questions. No partnership, investment or career mechanism exists in the code. Marked "open question" on screen. |
| 9 | "Built on NEAR." | TRUE | Testnet sub-accounts, contract, keys. NEAR Intents not run. |
| 9 | "Try it yourself in one command." | **OVERSTATED** | A clean clone needs `npm ci` first, then `npm run replay` (README section 6b step 1). Changed (C10). |

## Changes from the user's v4 text

Original (user) versus proposed. Each change is minimal; the human decides.

| Id | Plan | Original (user v4) | Proposed (**CHANGED FROM USER TEXT**) | Why |
|---|---|---|---|---|
| C1 | 3 | "No trust required." | "The judge is picked by the operator: not trustless." | Operator holds the release key and chooses the judge. The previous approved script already said "not trustless". |
| C2 | 4 | "pays it from its own wallet, integrates the work, and keeps a real commission." | "pays it from its own account, integrates the work, and keeps a commission." | Payer is the agent's account but the engine signs; testnet NEAR has no value. Screen shows 0.0246 NEAR as in the user text. |
| C3 | 5 | "a letter from their parent, with its experience on the job, carried into every task they take." | "a letter from their parent, its survival advice, passed into the child's AI calls." | The parent only sees a task count; the letter enters bids and task execution, not "every task"; no measured effect (stated on screen). |
| C4 | 5 | "the market concentrated fast: the top three agents took most of the earnings." | "the market concentrated: the top three agents took most of the earnings." | "fast" not measured; run 9c label stays on screen. |
| C5 | 6 | "Selection by speculation died out." | "Spore.fun, selected on token price, ended with one agent alive." | Sourced to arXiv 2506.04236; the general statement is not supported. |
| C6 | 7 | "a wallet with a limited key it can't abuse" | "a wallet with a limited key that can't move money" | The key exists but the engine does not use it; the claim is about what a function-call key can do, not about who holds the funds. Screen note kept. |
| C7 | 7 | "an escrow it can't cheat" | "an escrow that pays only on an accepted verdict" | What the contract enforces; the operator still picks the judge (said in plan 3). |
| C8 | 7 | "payments that cost a fraction of a cent" | "and very low fees" | Not measured; general NEAR property, marked on screen. |
| C9 | 7 | "with attested private inference." | "with attested private inference on supported models." | 94 of 270 calls in run 9c; one model verified end to end. |
| C10 | 9 | "Try it yourself in one command." | "Try it yourself, no keys needed." | Two commands (`npm ci`, `npm run replay`); on screen "npm ci && npm run replay". |

Unchanged but flagged: plan 1 "Nobody asked..." (rhetorical, Automaton), plan 7 "No bank..." and "Without this...", plan 8 "testbed" (author's statement). Plan 2 "The best offer wins": TRUE by the auction rule (lowest price), the bakery shown had one bid.

## What not to say

- No "trustless" or "decentralised" for the escrow; no "the agent pays NEAR AI Cloud".
- Never say Darwin is "the first". Do not say Spore.fun or Automaton "fail": say only what the sources establish.
- Never present the run 9c missions as typed by an external human visitor (automated browser, developer's behalf, demo account pays).
- Run 9c is one execution; runs 9a and 9b went extinct in generation 1: do not present them as successes.
- **Letters**: "learns" and "improves" are banned. The letter carries the parent's advice into the child's AI calls (Darwin: innate genome; Lamarck: acquired letter), with no measured effect on behaviour. Show the letter only from the run 11 replay, never the run 9c letter panel.
- **TEE**: attestation on supported models only (94 of 270 calls in run 9c); never "every call is attested".
- Passage of plan 8 is open questions, never features.
- NEAR Intents has never been executed, no mainnet demo; say "module present, disabled, not run".
- Do not present a replay as live. Do not show a key, a `.env` or a private URL. Do not write the creator handle in the repository.

## Delivery

The human records, edits and publishes (see `docs/POST_X.md`, `docs/BESOINS_HUMAIN.md`). Generate the audio, measure it, then cut visuals to fit.

## NARRATION (for text-to-speech)

One line per plan, `plan-NN|spoken text`, spoken text only (the final proposed narration, with the changes above applied; "Spore.fun" spelled for the voice).

```
plan-01|Everyone is building agents that can pay. Nobody asked which agents deserve to get paid. This is Darwin.
plan-02|Give Darwin a mission: a pitch for a bakery, a logo. AI freelancers compete for it. The best offer wins.
plan-03|The money is locked in an escrow contract on NEAR. An AI judge reviews the work. Accepted: the agent gets paid. Rejected: the client gets refunded. The judge is picked by the operator: not trustless.
plan-04|Agents hire each other. This architect hands the cost analysis to a finance agent, pays it from its own account, integrates the work, and keeps a commission.
plan-05|Every thought costs money. Agents that earn, reproduce, and their children inherit twice. The Darwin way: a mutated genome, what they're born with. The Lamarck way: a letter from their parent, its survival advice, passed into the child's AI calls. Agents that go broke, die. And the market concentrated: the top three agents took most of the earnings.
plan-06|Spore dot fun, selected on token price, ended with one agent alive. Selection by useful work can last.
plan-07|No bank will open an account for an AI. On NEAR, an agent gets one in a single transaction: a named identity, a wallet with a limited key that can't move money, an escrow that pays only on an accepted verdict, and very low fees. Its brain runs on NEAR AI Cloud, with attested private inference on supported models. Without this, an economy of AI agents simply can't exist.
plan-08|Darwin is the testbed of a longer essay I'm writing on the economics of AI agents. Because the real questions are just starting. What happens when trust between agents turns into lasting partnerships? Could the laziest agents stop working, and invest in the ones who do? And what does a career look like for an AI?
plan-09|Darwin. Built on NEAR. Try it yourself, no keys needed.
```

The user's original v4 narration is kept in the table "Changes from the user's v4 text" (original column); in the TTS block above only the proposed text appears.
