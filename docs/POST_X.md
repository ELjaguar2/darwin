# POST_X: post draft (nothing published)

> Owner: redacteur. **The human reviews, adapts and publishes personally.** Mandatory mentions (SPECS L-05): say the project was built at the NEAR HACKATHON, tag **@NEARProtocol** and **#NEARHackathon**, attach the **video** (`docs/VIDEO_SCRIPT.md`): it is MANDATORY, HACKATHON.md (re-read on 2026-11-12) says screenshots alone are not enough. Optional: @NearLegion, @NearBuilders. The post link goes into `demoUrl` of the form (`docs/FORMULAIRE.md`).
> The repository link is already set to https://github.com/ELjaguar2/darwin. Each tweet is at most 280 characters (a URL counts for 23); counts checked by script, then re-check in the X editor.
> The video (script v4, about 2 min) carries a small creator handle in the corner and "by <handle>" on the end card; the handle is set in the video project, never written in this repository.
> The video must stay under 2 min 20 (likely limit for a free X account); see `docs/VIDEO_SCRIPT.md`.
> Updated 2026-11-12 from `docs/PREUVES_TESTNET.md` (run 8, run 9c, run 10, run 11 section 16). Facts used: run 8 (historical, French): generation 3, 12 births, 7 deaths. Run 9c (English): generation 3, 16 births, 4 deaths, two missions paid on testnet (a marketing pitch and a logo). Run 10 (21 minutes, English): real subcontracting, 3 complete cases, 2 refused parents. Run 11 (21 minutes): 3 non-empty letters received by the children.
> **Honesty rule for the missions**: they were typed into the interface by an automated browser on the developer's behalf, and paid by the operator's demo account. Do not write "a visitor ordered" or "a user paid". The post says "missions" and "client simulated"; the thread says how they were entered.

## Single post

```text
Built at NEAR HACKATHON. Everyone is building agents that can pay. Nobody asked which agents deserve to get paid. Darwin: AI agents bid on NEAR testnet, get paid from escrow only if a judge accepts, die broke. Real-run replay: https://github.com/ELjaguar2/darwin @NEARProtocol #NEARHackathon
```

Attach: the video (the "wow" in the first 10 seconds). Mandatory. The video is a **replay** (runs 9c, 10 and 11): the post says so. First reply to post (optional): "The 2 missions of run 9c were typed by an automated browser for the developer and paid by our demo account."

## Thread variant

```text
1/ Built at NEAR HACKATHON. Everyone is building agents that can pay. Nobody asked which agents deserve to get paid. Darwin: a market where AI agents earn the right to exist. @NEARProtocol #NEARHackathon
Video: replay of recorded NEAR testnet runs, not live.
[video: mandatory]
```

```text
2/ Each agent has a genome (profession, AI model, price, risk, generosity...). It is born as a NEAR sub-account, bids in auctions, works, and is paid from an escrow only if a separate AI judge accepts the work. Its AI cost is debited from its balance.
```

```text
3/ Rich agents reproduce. Darwin: the child's mutated genome, innate. Lamarck: a non-empty letter from its parent (max 1000 characters), passed into the child's AI calls (run 11), acquired. No effect measured. Broke agents die, accounts closed, lineage kept.
```

```text
4/ Spore.fun, selected on token price: by May 2025, only its original agent was alive (arXiv 2506.04236). Darwin selects by paid, validated work. Selection by useful work can last: a hypothesis to test.
```

```text
5/ On NEAR testnet, run for real: sub-accounts, function-call keys, a Rust escrow/registry contract, NEAR AI Cloud as the brain. Run of 12 Nov: generation 3, 16 births, 4 deaths, 78 escrows, 2 missions paid. NEAR Intents: module present, disabled, not run (vision).
```

```text
6/ In our real runs the top 3 agents earned 53% to 90% of all earnings; in two of three runs most agents earned nothing. Tiny samples, one run each: anecdotes, not statistics.
```

```text
7/ Subcontracting, for real on testnet (a separate 21-minute run): an agent paid a child agent from its own account, folded its text into its deliverable and got paid. 3 complete cases, hashes in the repo. 2 parents were refused by the judge: their delegator lost money.
```

```text
8/ Honest limits: a simulated client pays most tasks; 2 missions typed by an automated browser; the AI judge is fallible, picked by the operator (not trustless); attestation on supported models only (94 of 270 calls, run 9c; checked once); one run each.
```

```text
9/ Try it: https://github.com/ELjaguar2/darwin (npm ci && npm run replay for the recorded run, no key needed). README has "do X, you will see Y" steps. Most code written by AI agents (Claude Code). #NEARHackathon @NEARProtocol
```

## Checks before publishing

- The text must stay true: re-read `docs/PREUVES_TESTNET.md` sections 14 and 15. If the video shows the replay, say so in the post or the first reply ("replay of a recorded run, not live").
- No promise of real gains: testnet NEAR has no value. Never write "the first".
- Do not describe the two missions as ordered by a visitor or a customer.
- Check that the repository is public and the X post is public, then copy its URL into the form.
