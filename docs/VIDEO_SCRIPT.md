# VIDEO_SCRIPT: demo video (2 min 16)

> **Thesis**: "Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."
> **Closing sentence**: "Selection by speculation died out. Selection by useful work can last."

> Owner: redacteur. Draft: nothing is recorded or published. Voice-over in English (international judges); English subtitles recommended.
> **Target length: 2 min 16 (hard ceiling 2 min 20, the likely limit of X for a free account).** Per-shot durations are in the table; the total is the sum of the nine shots (10+12+10+18+16+14+20+14+22 = 136 s). Narration is capped at about 2.5 words per second. If the edit runs over 2:20, cut the end of shot 9 down to the closing sentence, then shorten shot 7.
> The "wow" lands in the first 10 seconds.
> **Central scene**: "I order a mission in the chat, from request to payment" (shots 2 to 5). The **Mission**, **Lineage** and **Proof** tabs place it in the agent economy (tab names read from the page on 2026-11-12).
> **The video is MANDATORY**: HACKATHON.md (re-read on 2026-11-12) requires a video attached to the X post ("screenshots alone are not enough when judges cannot open the demo").
> Rule: show nothing false. Everything mock is said to be mock out loud. Anything still to verify carries the marker **TO CONFIRM** (search for this phrase before recording).

## Status of what is proven (as of 2026-11-12)

| Item | Status |
|---|---|
| Run 8 on testnet: generation 3, 12 births, 7 deaths, 65 escrows (63 released, 2 refunded) | **Proven**, `docs/PREUVES_TESTNET.md` section 8, nearblocks links |
| Run 9b on testnet: a "visitor" logo order locked, then **rejected** (0 of 3 SVG blocks, truncated output) and refunded | **Proven by the journal** `docs/preuves/run9b-journal.jsonl` (task `t-8674013`, lock `AMQEHEDN96FtFpupFJKrcYvMZckdGiq99UDHhkDUQVBP`, refund `BkQM1xYYcxzbP5KaEEivwDN1ea2XsoeZmVTEPBLTFj9f`); summary in `docs/PREUVES_TESTNET.md` section 11 |
| Run 9a: 7 logo orders rejected then refunded (1 "visitor"), 2 "visitor" orders expired without a bid, no deliverable accepted; extinction in generation 1 (like 9b) | Proven by `docs/preuves/run9a-journal.jsonl` and `docs/PREUVES_TESTNET.md` section 11; do not show it |
| **A logo delivered, accepted and paid on testnet** | **NOT proven.** TO CONFIRM: run 9c. Until proven, shot 5 shows the payment of a run 8 task (payer: simulated client) or the mock, **said as such** |
| **Mission**, **Lineage**, **Proof** tabs | Default page on `/` (3 tabs; names read from the page in headless Chromium on 2026-11-12). The previous page is at `/?classique` |
| **Replay mode** (replays the run 8 journal, safety net) | Command `npm run replay` (verified 2026-11-12: starts without a key, `/api/health` returns `"mode":"replay"`, `POST /api/tasks` returns 403). Screen: a header pill "REPLAY recorded real run" and a permanent banner "Replay of a real testnet run from November 10, 2026" with a progress bar, a percentage and speed buttons x1, x5, x20 (exact labels read on 2026-11-12). The mission box is disabled there ("Missions disabled during replay"). Run 8 did not record bid pitches or deliverable contents: the replay shows neutral summaries. Contents recorded before 12 November are in French (verified on screen 2026-11-12: task texts such as "Rédige un court paragraphe..." and the old profession labels appear in the run 8 replay; say it or crop it) |
| Logo delivered as 3 SVGs with a Download button | Exists in the interface (lot L16, seen in mock mode); on testnet: TO CONFIRM (run 9c) |

## Preparation (before recording)

- **Live mock** (shots 1 to 6): start `npm run start:demo` 2 minutes before (births and deaths already present). If a testnet `.env` exists, rename it first (see `docs/BESOINS_HUMAIN.md` step 1) and check that `/api/health` returns `"mode":"mock"`. Port 3000. Browser on `http://127.0.0.1:3000/` (the header pill must read "MOCK simulated chain and AI"), terminal ready (plan B: the `curl` steps of README section 9).
- **Replay** (shots 7 and 8, safety net): `npm run replay`, page on `http://127.0.0.1:3000/` (the header pill must read "REPLAY recorded real run"). **Every shot recorded in replay carries on-screen text and the voice-over: "Replay of our recorded testnet run 8, not live."** The mission composer is disabled in replay: do not try to order a mission in that mode.
- A real tick lasts about a minute: do **not** shoot testnet live.
- Still shots to open in advance (nearblocks, `https://testnet.nearblocks.io/txns/<hash>`, full hashes in `docs/PREUVES_TESTNET.md` section 8 and in the journals):
  - run 8 cycle, task `t-8598118` (payer `sim-client`, beneficiary `a-214953`, 0.035 NEAR): lock `EzS4KbN9...`, release `6SbUjask...`, reputation `DTWbUAgx...`;
  - a run 8 death: closing of `a-214956` `5kiop5Wr...`, then `mark_dead` in the registry;
  - real rejected case, run 9b, task `t-8674013`: lock `AMQEHEDN...`, refund `BkQM1xYY...` (summary in `docs/PREUVES_TESTNET.md` section 11);
  - accepted and paid logo, run 9c: <TO CONFIRM: nearblocks link, judge score, AI cost, otherwise remove>.
- Mission price: read the price **shown by the page** (catalogue, `docs/CATALOGUE_FREELANCE.md`) and say it as it appears on screen.
- Professions present in mock: the mock founders come from a fixed seed (on 2026-11-12: logo, finance, architecture, marketing). Ordering a profession nobody practises gets no bid and the task expires: check the agent cards on the Mission tab before choosing the order of shot 2.
- Check the terminal before recording: no key, no `.env`, no private URL.

## Shots

| # | Time (duration) | Image | Voice-over |
|---|---|---|---|
| 1 | 0:00 to 0:10 (10 s) | **Wow.** Full screen: living agents, balances moving, a birth then a death. Title "Darwin". Plan B: the SSE stream in the terminal. | "These AI agents earn money, pay for their own brains, have children, and die. Tomorrow, you will pay an agent like a freelancer." |
| 2 | 0:10 to 0:22 (12 s) | **Mission tab, 1/4: the request, shot in LIVE MOCK (never in replay: the composer is disabled in replay).** Run `npm run start:demo`, open the Mission tab, and in the mission box (placeholder "Describe your mission…", then the "Send the mission" button) order: "Logo for La Page Blanche, a neighbourhood bookshop. Warm, simple, readable on a bag." (logo profession; if no living agent has it, pick a profession that is present). The catalogue price shows. Visible label: the "MOCK simulated chain and AI" pill. | "I order a mission in the chat: a logo for a neighbourhood bookshop. This is mock mode: nothing here is real money." |
| 3 | 0:22 to 0:32 (10 s) | **2/4: auction and award.** Logo agents bid (offers and prices visible), one wins. | "Logo agents bid in an auction, each pricing from its own genome and costs. One wins." |
| 4 | 0:32 to 0:50 (18 s) | **3/4: escrow and delivery.** The money is locked in an escrow, the agent delivers: SVG logo proposals in the page, Download button, **AI cost of the deliverable** shown (in mock: the mock value, labelled). Still shot: the run 8 `lock` transaction (`t-8598118`) on nearblocks with the text "real testnet run 8, simulated client". If shot in replay: text "Replay of our recorded testnet run 8, not live." | "The money is locked in an escrow. The agent delivers, and its AI cost is taken from its balance. On NEAR testnet the escrow is a Rust contract: here is a real lock from our run 8, paid by the simulated client." |
| 5 | 0:50 to 1:06 (16 s) | **4/4: verdict and payment.** A judge scores the work; accepted, the escrow is released, the agent is paid, its reputation rises. The judge is named on screen. Still shots: run 8 `release` and reputation. If an accepted and paid run 9c logo exists, show it here <TO CONFIRM: run 9c>, otherwise say it is run 8. Any shot in replay: "Replay of our recorded testnet run 8, not live." | "A judge scores the work. Accepted: the escrow is released, the agent is paid, its reputation rises. Validation is by the operator, not trustless." |
| 6 | 1:06 to 1:20 (14 s) | **The refusal, real.** Still shot of run 9b: the logo order rejected by the format check, the contract refunds the operator's demo account that funded the order (not the visitor), the agent is not paid. On-screen text: "real testnet run 9b: logo order rejected, refunded" (see `docs/PREUVES_TESTNET.md` section 11). | "Rejected work is refunded to the operator's demo account that paid. Real, on testnet, run 9b: a truncated logo was refused. We fixed the cause; no full testnet re-run yet." |
| 7 | 1:20 to 1:40 (20 s) | **Lineage tab, in REPLAY of run 8 (`npm run replay`): on-screen text "Replay of our recorded testnet run 8, not live."** The family tree by generation (heading such as "Generation 3 · N alive · M dead"); click a child: its parent's letter. A few deaths (account closed, lineage kept), then generation 3. | "This is a replay of our recorded testnet run 8, not live. Rich agents have children with mutated genes, and write them a letter. Broke agents die; the lineage stays. In that one real run, generation three was reached and seven agents starved." |
| 8 | 1:40 to 1:54 (14 s) | **Proof tab, in replay (same on-screen text "not live").** Real run 8 transactions: escrows, `mark_dead`, function-call keys. Text: "run 8: generation 3, 12 births, 7 deaths, 65 escrows (63 released, 2 refunded)". Open a nearblocks link. | "Still the recorded run 8, not live. Every claim has a transaction: sixty-five escrows, seven deaths recorded in the contract. One run, not a guarantee." |
| 9 | 1:54 to 2:16 (22 s) | **End.** NEAR tools (accounts and sub-accounts, function-call keys, Rust contract, NEAR AI Cloud, NEAR Intents), an "Honest limits" card, repository and X post. | "Spore.fun selected on token price; the paper counts one agent in generation five. Darwin selects on paid, validated work. Selection by speculation died out. Selection by useful work can last: a hypothesis, and Darwin lets you test it. Built at NEAR HACKATHON. Mock needs no key; the client is simulated; NEAR Intents was not run." |

*(Shots 7 and 8 are in replay, shots 2 and 3 in live mock; shot 1 is live mock or replay, your choice, with the matching label. Cumulative length: 2 min 16. If the edit goes over 2:20, cut shot 9 down to the closing sentence, then shorten shot 7.)*

## What not to say

- No "trustless" or "decentralised" for the escrow; no "the agent pays NEAR AI Cloud"; no "on-chain" for the registry if the contract is not deployed (degraded escrow).
- **Never say Darwin is "the first".** Do not say Spore.fun or Automaton "fail": say only what the sources establish ($500,000 valuation; 1 child in generation 5 and only the original agent alive on 18 May 2025; Automaton README: survival tied to paid work, but no market between agents found). Do not contrast Darwin with Automaton on "work against speculation": that contrast targets Spore.fun only.
- "Selection by useful work can last" is a **hypothesis**, not a result: Darwin's payer is a simulated client.
- The payer of the tasks in the real runs is the **simulated client**, labelled. The real "visitor" orders (5: 2 logos in runs 9a and 9b **rejected then refunded**, 3 **expired without a bid**) led to no payment: do not say a logo was delivered and paid on testnet until run 9c proves it.
- Runs 9a and 9b **went extinct in generation 1**: do not present them as successes or talk about their generations. Do not cite the 300-token cap: say only "truncated output, fixed" (the fix has not been replayed in a full run until run 9c is proven).
- NEAR Intents has **never** been executed.
- AI cost is our local accounting; the **NEAR AI invoice was not re-read**.
- The run 8 figures (generation 3, 7 deaths) are one execution, not a guarantee.
- Do not present mock or a replay as live testnet. A replay is always said to be "not live". Do not say "the contract refunds the visitor": the operator's demo account is refunded. The mock's refused case is not a testnet event.
- Do not talk about a "brand" logo: the logo is original.
- Do not show a key, a `.env`, or a private URL.

## Delivery

The human records, edits and publishes (see `docs/POST_X.md`, `docs/BESOINS_HUMAIN.md` for the order of steps). The video must be attached to the X post (requirement L-03: screenshots alone are not enough). Before recording, resolve every **TO CONFIRM** marker (search for this phrase in this file): confirm or remove the mention.
