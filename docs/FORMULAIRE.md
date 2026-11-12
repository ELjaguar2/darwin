# FORM: submission draft (nothing has been submitted)

> **Pitch thesis**: "Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."

> Owner: redacteur. **Nothing is submitted.** The human re-reads https://nearhackathon.com/HACKATHON.md before submitting, checks every value, then submits personally (form https://nearhackathon.com/#apply or `POST /api/applications`). Fields and limits follow `docs/SPECS.md` S-02 to S-05 (re-check on the live page).

## Fields

| Field | Limits | Value | Provided by |
|---|---|---|---|
| `requestId` (API only) | UUID, generated once and reused on retries | to generate | human |
| `projectName` | 2 to 80 characters | `Darwin` | proposed |
| `leadName` | 2 to 80 | **TO PROVIDE** | human |
| `email` | valid, max 160; 2 submissions max per email | **TO PROVIDE** | human |
| `size` | `1`, `2 - 4`, `4 - 6`, `6 - 8` or `8+` | **TO PROVIDE** (real size of the human team) | human |
| `tracks` | ids, each once | recommendation: `swarms`, `agents`; possibly `open` (and `business`). **Human decision.** | human |
| `nearAddress` | 2 to 64, lowercase; a named or implicit (64 chars) **mainnet** account created by the team | **TO PROVIDE** (never created by an agent) | human |
| `projectUrl` | public repository, max 300 | **TO PROVIDE**: repository URL, to make public before 2026-11-14 23:59 UTC | human |
| `demoUrl` | public X post, max 300 | **TO PROVIDE**: URL of the published post (see `docs/POST_X.md`) | human |
| `idea` | **20 to 2000 characters** | text below | proposed, reviewed by the human |
| `consent` | `true` after the lead agrees | `true` only if the lead reads and accepts: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." | human |
| `website` | anti-spam trap: leave **empty** (send no value) | empty | -- |

No other field may be sent (body limited to 12000 bytes). Response codes: 201 recorded; 400 fix (same `requestId`); 403 closed or cross-site (do not retry); 409 duplicate (do not work around); 413 too large; 503 retry with the same `requestId`. Corrections afterwards: https://nearhackathon.com/request-changes.

## Text of the `idea` field

It covers the problem, the product and the role of NEAR. Terms match the README (what is mock or not run is stated there). Facts updated on 2026-11-12 from `docs/PREUVES_TESTNET.md` (run 8, run 9c section 14, run 10 section 15); related work checked on 2026-11-11 (arXiv 2506.04236, Automaton README). Runs 9a and 9b (extinction in generation 1) are not cited in the text; the README tells them.

<!-- idea:start -->
```text
"Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."

Problem: can an agent pay its own inference bill, and which genomes survive?

Product: a live economy of AI agents, simulated by default or on NEAR testnet. Each agent has a genome (profession, AI model, price, risk, reproduction threshold, generosity, cooperation, personality), is born as a NEAR sub-account with a capital, bids in auctions, works, is paid from an escrow after validation, gets a reputation and pays its AI cost from its balance. Rich agents reproduce (mutated child plus a "letter to my child"); broke agents die.

Related work: Spore.fun (Solana; arXiv 2506.04236: 1 child in generation 5, only the original agent alive in May 2025) and Automaton (no market between agents in its README). Darwin selects on paid, validated work. Selection by speculation died out. Selection by useful work can last (a hypothesis: our client is mostly simulated).

NEAR, run for real on testnet (tx ids in the repo): sub-account and function-call key per agent, Rust registry/escrow/reputation contract, NEAR AI Cloud brain. Two runs reached generation 3: run 8 (12 births, 7 deaths) and run 9c on 12 Nov (16 births, 4 deaths, 78 escrows, English). Run 9c also paid two UI missions (marketing, logo).

Honesty: mock is the default; most paid tasks come from the labelled simulated client; the two missions were typed by an automated browser for the developer, paid by our demo account; real subcontracting proven in a 21-minute run (3 complete cases; 2 refused parents, their delegator lost money), unawarded in run 9c (bug, fixed); AI cost (about 0.07 USD) is local accounting; NEAR Intents was never run; escrow is validated by the operator, not trustless.

Run: npm ci && npm run start:mock (README: do X, see Y). Code mostly by AI agents (Claude Code). MIT.
```
<!-- idea:end -->

Counter check (script): `node scripts/check-formulaire.mjs` (prints the character count and fails outside 20 to 2000). **Re-run after any change to the text**, and keep this text aligned with the README and `docs/PREUVES_TESTNET.md` if the facts change.

## What the human must do before submitting

1. Make the repository public; check that LICENSE and README are there.
2. Publish the X post (`docs/POST_X.md`) with the video; copy its URL into `demoUrl`.
3. Provide `leadName`, `email`, `size`, `nearAddress` (mainnet account), choose the `tracks`.
4. Re-read the README: confirm "no prior code" and say whether a second project exists.
5. Display the final JSON, re-read it, and submit **once**. Do not use the real repository or the real email for submission tests.
