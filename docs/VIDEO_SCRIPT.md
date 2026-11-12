# VIDEO_SCRIPT: demo video (2 min 14)

> **Thesis**: "Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."
> **Closing sentence**: "Selection by speculation died out. Selection by useful work can last."

> Owner: redacteur. Draft: nothing is recorded or published. Voice-over in English (international judges); English subtitles recommended.
> **Target length: 2 min 14 (hard ceiling 2 min 20, the likely limit of X for a free account).** Per-shot durations are in the table; the total is the sum of the nine shots (10+14+12+16+20+12+16+12+22 = 134 s). Narration is capped at about 2.5 words per second. If the edit runs over 2:20, cut the end of shot 9 down to the closing sentence, then shorten shot 7.
> The "wow" lands in the first 10 seconds.
> **Central scene** (shots 2 to 5): the **real order of run 9c, from request to payment**, rejoué in the REPLAY of our recorded testnet run 9c (marketing pitch, then logo). **Everything is shot in replay, with one mode and one journal** (`npm run replay` now defaults to the run 9c journal). The **Mission**, **Lineage** and **Proof** tabs place it in the agent economy (tab names read from the page on 2026-11-12).
> **The video is MANDATORY**: HACKATHON.md (re-read on 2026-11-12) requires a video attached to the X post ("screenshots alone are not enough when judges cannot open the demo").
> Rule: show nothing false. A replay is said to be a replay, on screen and in the voice-over. Anything still to verify carries the marker **TO CONFIRM** (search for this phrase before recording; the run 9c markers were resolved on 2026-11-12 from the journal).

## Status of what is proven (as of 2026-11-12)

| Item | Status |
|---|---|
| Run 9c on testnet (2026-11-12, current preset, 6 founders): generation 3, 16 births, 10 reproductions, 4 deaths, 113 bids with pitches, 78 escrows (68 released, 7 refunded), content in English | **Proven**, `docs/PREUVES_TESTNET.md` section 14, journal `docs/preuves/run9c-journal.jsonl` (sha256 in section 12) |
| **Two missions entered through the interface, delivered, accepted and paid on testnet** (marketing `t-9975872`, logo `t-9975887`) | **Proven** by the journal and hashes (section 14). **Obligatory caveat: they were typed into the interface by an automated browser (Playwright, headless) on the developer's behalf, not by an external human visitor; the payer is the operator's demo account `visitors.<master>`** |
| Run 8 on testnet (French content): generation 3, 12 births, 7 deaths, 65 escrows (63 released, 2 refunded) | **Proven**, section 8, nearblocks links; historical run, only cite it as such |
| Runs 9a and 9b: extinction in generation 1, logo orders rejected or expired | Proven by the journals (section 11); do not show them |
| **Mission**, **Lineage**, **Proof** tabs | Default page on `/` (3 tabs; names read from the page in headless Chromium on 2026-11-12). The previous page is at `/?classique` |
| **Replay mode** (replays the run 9c journal by default) | Command `npm run replay` (re-executed 2026-11-12: starts without a key, banner built from the journal date: "Replay of a real testnet run from November 12, 2026", `/api/health` returns `"mode":"replay"`, `POST /api/tasks` returns 403, at the end `/api/lineage` returns 3 generations, 4 dead and 12 alive). The mission box is disabled in replay ("Missions disabled during replay"). Pitches and deliverable contents are recorded and served (`/api/tasks/t-9975887/deliverable` returns the 3 SVGs) |
| Subcontracting between agents | Paid on testnet in run 8 (3 tasks), **not awarded in run 9c** (18 created, 0 awarded): do not show it as working in run 9c |
| Partial recording of 80.8 s outside the repository | `C:\Users\aymer\Darwin-run9c\video\run9c-mission-orders-PARTIAL-remuxed.webm`: Mission page, typing and sending the first order, 1920x1080, VP9. Usable as a cutaway for shot 2 **only** if the on-screen text says it was entered by an automated browser; otherwise do not use it |

## Preparation (before recording)

- **One mode, replay**: `npm run replay` (default journal: run 9c), page on `http://127.0.0.1:3000/`, the header pill must read "REPLAY recorded real run" and the banner "Replay of a real testnet run from November 12, 2026". Port 3000 free, one Darwin server at a time. Do not use `DARWIN_REPLAY_FILE` (that would load run 8). **Every shot carries the on-screen text and the voice-over: "Replay of our recorded testnet run 9c, not live."**
- Speed: x1 or x5 while the order unrolls (the speed buttons x1, x5, x20 are on the banner); x20 for the passage of time. Approximate positions in the journal (progress bar): first mission (`t-9975872`) at about 12%, logo mission (`t-9975887`) at about 21%, first death at about 76%, generation 3 at about 92%. Use pause and restart (`POST /api/replay/restart` or the page controls) to reposition; take at least two takes.
- The mission composer is disabled in replay: do not try to order in this mode. The "order" you see is the **recorded** one.
- A real tick lasts about a minute: never shoot testnet live.
- **Mandatory disclosure when the two missions are shown**: on-screen text AND voice-over (shots 2 and 5, see the table): "These two missions were typed by an automated browser on the developer's behalf, and paid by the operator's demo account." Never present them as entered by an outside visitor.
- Still shots to open in advance (nearblocks, `https://testnet.nearblocks.io/txns/<hash>`, hashes also in `docs/PREUVES_TESTNET.md` section 14):
  - marketing mission `t-9975872`: lock `6bCF32vuLycjNcpd6frX5He1GnGwQn14dg3JSNymtchD`, release `BaQvifz8YN97MndiygDe88uyCsAKWLbCRianJBe4gYZd` (judge score 1.00, 0.024 NEAR);
  - logo mission `t-9975887`: lock `J4iD9FansSQ8RU7K5YFnRQBNhNoSrnde679t2GuNMVxE`, release `6FCjxzUNtrYR1SHSjJDeMDXB7jVDenEbJSfkANwJn6sZ` (judge score 0.73, 0.045 NEAR, 3 SVGs);
  - a refund of run 9c: task `t-9975862`, refund `Am7ACTFkA7q82k3fqf5D2iA5pHNSzYtrtdZqfRoX4Pw5` (payer: simulated client);
  - a death of run 9c: closing of `a-249400` `DrdaY9Sv7wdLZ51nuL4rU4magyzh7d9VUrWJhMC4PqxQ`, then `mark_dead` `Cfw4TRsP2yq6g2f98eYGR3dJnJhb4y7KRhcoJ2tzBWpm`.
- Mission price: read the price **shown by the page** and say it as it appears on screen.
- Check the terminal before recording: no key, no `.env`, no private URL (replay needs none).

## Shots

| # | Time (duration) | Image | Voice-over |
|---|---|---|---|
| 1 | 0:00 to 0:10 (10 s) | **Wow.** Replay at x5: living agents, balances moving, births, a death. Title "Darwin". On-screen text: "Replay of our recorded testnet run 9c, not live." | "These AI agents earn money, pay for their own brains, have children, and die. Tomorrow, you will pay an agent like a freelancer. This is a replay of our real testnet run, not live." |
| 2 | 0:10 to 0:24 (14 s) | **Mission tab, 1/4: the request, recorded.** Position at about 12%. The marketing mission appears in the thread: "Write a 3-sentence product pitch for an organic bakery in Rennes", budget 0.024 NEAR, tag "Visitor (funded by the demo account)". On-screen text: "Replay of our recorded testnet run 9c, not live. Typed by an automated browser for the developer." Optional cutaway (a few seconds) of the 80.8 s partial recording, with the same text. | "A mission arrives: a pitch for an organic bakery. In this recorded run it was typed by an automated browser on the developer's behalf, and funded by the operator's demo account. The agents and the payments are real." |
| 3 | 0:24 to 0:36 (12 s) | **2/4: auction and award.** The bid with its pitch (one bid, from the marketing agent `a-249400`), the award. | "Agents bid, each pricing from its own genome and costs, with a pitch. A marketing agent wins." |
| 4 | 0:36 to 0:52 (16 s) | **3/4: escrow, delivery, verdict, payment.** The thread shows the lock, the deliverable text, the judge (named on screen: gemini-2.5-flash-lite, score 1.00), the "paid" mark with the link. Still shot: the release `BaQvifz8...` on nearblocks. | "The money is locked in an escrow, a Rust contract on NEAR testnet. The agent delivers, a judge scores 1.00, the escrow is released. Validation is by the operator, not trustless." |
| 5 | 0:52 to 1:12 (20 s) | **Same path for the logo, position about 21%.** The logo mission "Design a logo for an organic bakery in Rennes, warm artisanal style", budget 0.045 NEAR, 3 SVG proposals displayed, judge score 0.73, paid. Still shot: release `6FCjxzUN...`. Text: "Replay of our recorded testnet run 9c, not live. Entered by an automated browser." | "Next, a logo. Three SVG proposals, scored 0.73 by the judge, accepted and paid on testnet. Modest, but real. Same disclosure: an automated browser typed the request." |
| 6 | 1:12 to 1:24 (12 s) | **The refusal, real.** Proof tab or still shot of a run 9c refund (`Am7ACTFk...`). Text: "run 9c: 7 rejected, 7 refunded". | "Not everything passes. In this run seven deliverables were rejected and the escrow was refunded to the payer, by the contract." |
| 7 | 1:24 to 1:40 (16 s) | **Lineage tab, replay (position 76% to 95%).** Family tree by generation (heading such as "Generation 3 · N alive · M dead"); click a child: its parent's letter (in English). A death greyed out, then generation 3. | "Rich agents have children with mutated genes, and write them a letter. Broke agents die; the lineage stays. In this run: generation three, sixteen births, four deaths." |
| 8 | 1:40 to 1:52 (12 s) | **Proof tab, replay.** Counters and transactions. Text: "run 9c: generation 3, 16 births, 4 deaths, 78 escrows (68 released, 7 refunded)". Open a nearblocks link. | "Still the recorded run, not live. Every claim has a transaction. One run, not a guarantee." |
| 9 | 1:52 to 2:14 (22 s) | **End.** NEAR tools (accounts and sub-accounts, function-call keys, Rust contract, NEAR AI Cloud, NEAR Intents), an "Honest limits" card, repository and X post. | "Spore.fun selected on token price; the paper counts one agent in generation five. Darwin selects on paid, validated work. Selection by speculation died out. Selection by useful work can last: a hypothesis, and Darwin lets you test it. Built at NEAR HACKATHON. Mock needs no key; the client is mostly simulated; NEAR Intents was not run." |

*(All shots are in replay. If a shot is cut from live mock for variety, label it "MOCK" and say mock out loud. Cumulative length: 2 min 14. If the edit goes over 2:20, cut shot 9 down to the closing sentence, then shorten shot 7.)*

## What not to say

- No "trustless" or "decentralised" for the escrow; no "the agent pays NEAR AI Cloud"; no "on-chain" for the registry if the contract is not deployed (degraded escrow).
- **Never say Darwin is "the first".** Do not say Spore.fun or Automaton "fail": say only what the sources establish ($500,000 valuation; 1 child in generation 5 and only the original agent alive on 18 May 2025; Automaton README: survival tied to paid work, but no market between agents found). Do not contrast Darwin with Automaton on "work against speculation": that contrast targets Spore.fun only.
- "Selection by useful work can last" is a **hypothesis**, not a result: most payments in run 9c come from a simulated client (76 of 78 escrows).
- **Never present the run 9c missions as typed by a human external visitor.** They were typed by an automated browser (Playwright) on the developer's behalf; the payer is the operator's demo account. Say it whenever they are shown, in the voice-over and on screen. Do not say "a visitor paid".
- Run 9c is **one execution**: generation 3 is an observation, not a guarantee. Runs 9a and 9b **went extinct in generation 1**: do not present them as successes.
- **Do not show or claim subcontracting between agents working in run 9c** (18 created, 0 awarded).
- NEAR Intents has **never** been executed.
- AI cost is our local accounting (about 0.066 USD for run 9c); the **NEAR AI invoice was not re-read**.
- Do not present mock or a replay as live testnet. A replay is always said to be "not live". Do not say "the contract refunds the visitor": the payer (the operator's demo account or the simulated client) is refunded.
- The 24 empty answers (`BRAIN_EMPTY_TEXT`) are a known limit; do not hide them if asked.
- Do not talk about a "brand" logo: the logo is original, but say its judge score (0.73) and "moderate" originality if you describe its quality.
- Do not show a key, a `.env`, or a private URL.

## Delivery

The human records, edits and publishes (see `docs/POST_X.md`, `docs/BESOINS_HUMAIN.md` for the order of steps). The video must be attached to the X post (requirement L-03: screenshots alone are not enough). Before recording, search this file for **TO CONFIRM**: none should remain; the page rendering of the Mission thread for the two recorded missions was read through the API on 2026-11-12 but not filmed, so check on screen that the two threads (marketing, logo) display the pitch, the verdict and the SVGs, and cut the plan if they do not.
