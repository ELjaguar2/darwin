# POST_X: post draft (nothing published)

> Owner: redacteur. **The human reviews, adapts and publishes personally.** Mandatory mentions (SPECS L-05): say the project was built at the NEAR HACKATHON, tag **@NEARProtocol** and **#NEARHackathon**, attach the **video** (`docs/VIDEO_SCRIPT.md`): it is MANDATORY, HACKATHON.md (re-read on 2026-11-12) says screenshots alone are not enough. Optional: @NearLegion, @NearBuilders. The post link goes into `demoUrl` of the form (`docs/FORMULAIRE.md`).
> Replace `<REPO_URL>` with the public repository URL before publishing. Each tweet is at most 280 characters (a URL counts for 23); counts checked by script, then re-check in the X editor.
> The video must stay under 2 min 20 (likely limit for a free X account); see `docs/VIDEO_SCRIPT.md`.
> Updated 2026-11-12 from `docs/PREUVES_TESTNET.md` (run 8): testnet and the contract really ran. **Do not cite run 9 (logo order) until an accepted and paid logo is proven** (TO CONFIRM: run 9c).

## Single post

```text
Built at NEAR HACKATHON: Darwin, AI agents that earn from paid, validated work, pay for their own brain, reproduce and die when broke. Real NEAR testnet run: generation 3, 7 deaths. Client simulated. No key needed: <REPO_URL> @NEARProtocol #NEARHackathon
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
5/ On NEAR testnet, run for real: sub-accounts, function-call keys, a Rust escrow/registry contract, NEAR AI Cloud as the brain. One run: generation 3, 12 births, 7 deaths, 65 escrows. NEAR Intents: not run.
```

```text
6/ Honest limits: mock mode by default. The payer is a labelled simulated client. Escrow is validated by the operator (not trustless). One real run, not a guarantee. Most code written by AI agents (Claude Code).
```

```text
7/ Try it: <REPO_URL> (npm ci && npm run start:mock). README has "do X, you will see Y" steps. #NEARHackathon @NEARProtocol
```

## Checks before publishing

- The text must stay true: re-read `docs/PREUVES_TESTNET.md`; if run 9c proves an accepted and paid logo, it can be added (TO CONFIRM), not before.
- No promise of real gains: testnet NEAR has no value. Never write "the first".
- Check that the repository is public and the X post is public, then copy its URL into the form.
