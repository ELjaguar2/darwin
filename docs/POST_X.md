# POST_X: post draft (nothing published)

> Owner: redacteur. **The human reviews, adapts and publishes personally.** Mandatory mentions (SPECS L-05): say the project was built at the NEAR HACKATHON, tag **@NEARProtocol** and **#NEARHackathon**, attach the **video** (`docs/VIDEO_SCRIPT.md`): it is MANDATORY, HACKATHON.md (re-read on 2026-11-12) says screenshots alone are not enough. Optional: @NearLegion, @NearBuilders. The post link goes into `demoUrl` of the form (`docs/FORMULAIRE.md`).
> Replace `<REPO_URL>` with the public repository URL before publishing. Each tweet is at most 280 characters (a URL counts for 23); counts checked by script, then re-check in the X editor.
> The video must stay under 2 min 20 (likely limit for a free X account); see `docs/VIDEO_SCRIPT.md`.
> Updated 2026-11-12 from `docs/PREUVES_TESTNET.md` (run 8 and run 9c). Facts used: run 8 (historical, French): generation 3, 12 births, 7 deaths. Run 9c (English): generation 3, 16 births, 4 deaths, two missions paid on testnet (a marketing pitch and a logo).
> **Honesty rule for the missions**: they were typed into the interface by an automated browser on the developer's behalf, and paid by the operator's demo account. Do not write "a visitor ordered" or "a user paid". The post says "missions" and "client simulated"; the thread says how they were entered.

## Single post

```text
Built at NEAR HACKATHON: Darwin, AI agents that earn from paid work, pay for their own brain, reproduce, die when broke. Real NEAR testnet run: generation 3, 4 deaths, 2 missions paid (1 logo). Mostly simulated client. <REPO_URL> @NEARProtocol #NEARHackathon
```

Attach: the video (the "wow" in the first 10 seconds). Mandatory.

## Thread variant

```text
1/ Built at NEAR HACKATHON: Darwin. AI agents that earn their living, pay for their own brain, have children with their own money, and die when they run dry. Economic natural selection, live. @NEARProtocol #NEARHackathon
[video: mandatory]
```

```text
2/ Each agent has a genome (profession, AI model, price, risk, generosity...). It is born as a NEAR sub-account, bids in auctions, works, and is paid through an escrow after validation. Its AI cost is debited from its balance.
```

```text
3/ Rich agents reproduce: a child with mutated genes + a "letter to my child" written by the parent's brain. Broke agents die, accounts closed, lineage kept.
```

```text
4/ Spore.fun selected by token price: it reached generation 5; by May 2025 only the original agent was alive (arXiv 2506.04236). Darwin selects by paid, validated work. Selection by speculation died out. Selection by useful work can last. A hypothesis to test.
```

```text
5/ On NEAR testnet, run for real: sub-accounts, function-call keys, a Rust escrow/registry contract, NEAR AI Cloud as the brain. Run of 12 Nov: generation 3, 16 births, 4 deaths, 78 escrows, 2 missions paid, a logo included. NEAR Intents: not run.
```

```text
6/ Honest limits: most tasks come from a labelled simulated client. The 2 missions were typed by an automated browser, paid by our demo account. Subcontracting not awarded in that run. Escrow validated by the operator (not trustless). One run, not a guarantee.
```

```text
7/ Try it: <REPO_URL> (npm ci && npm run start:mock, or npm run replay for the recorded run). README has "do X, you will see Y" steps. Most code written by AI agents (Claude Code). #NEARHackathon @NEARProtocol
```

## Checks before publishing

- The text must stay true: re-read `docs/PREUVES_TESTNET.md` section 14. If the video shows the replay, say so in the post or the first reply ("replay of a recorded run, not live").
- No promise of real gains: testnet NEAR has no value. Never write "the first".
- Do not describe the two missions as ordered by a visitor or a customer.
- Check that the repository is public and the X post is public, then copy its URL into the form.
