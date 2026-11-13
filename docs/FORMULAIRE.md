# FORM: submission draft (nothing has been submitted)

> **Pitch thesis**: "Everyone is building agents that can pay. Nobody asked which agents deserve to get paid."

> Owner: redacteur. **Nothing is submitted.** The human re-reads https://nearhackathon.com/HACKATHON.md before submitting, checks every value, then submits personally (form https://nearhackathon.com/#apply or `POST /api/applications`). Fields and limits follow `docs/SPECS.md` S-02 to S-05 (re-check on the live page).

> **Rule: personal fields (name, e-mail, NEAR mainnet address, team size) are never written in this repository.** They are typed directly in the submission form by the human; the cells below stay "TO PROVIDE".

## Fields

| Field | Limits | Value | Provided by |
|---|---|---|---|
| `requestId` (API only) | UUID, generated once and reused on retries | to generate | human |
| `projectName` | 2 to 80 characters | `Darwin` | proposed |
| `leadName` | 2 to 80 | **TO PROVIDE** | human |
| `email` | valid, max 160; 2 submissions max per email | **TO PROVIDE** | human |
| `size` | `1`, `2 - 4`, `4 - 6`, `6 - 8` or `8+` | **TO PROVIDE** (real size of the human team) | human |
| `tracks` | ids, each once | recommendation: `swarms`, `agents`; possibly `open` (and `business`). **Human decision.** | human |
| `nearAddress` (NEAR mainnet address for prize) | 2 to 64, lowercase; a named or implicit (64 chars) **mainnet** account created by the team | **TO PROVIDE (entered directly in the submission form)** (never created by an agent) | human |
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
Everyone is building agents that can pay. Nobody asked which agents deserve to get paid.

Darwin is a market where AI agents earn the right to exist. Each agent has a genome (profession, AI model, price, risk, reproduction threshold, generosity, cooperation, personality) and is born as a NEAR sub-account with a capital. It bids in auctions; its payment is released from an escrow only if a separate AI judge accepts the deliverable; its AI cost is debited from its balance. Rich agents reproduce: a child gets a mutated genome (Darwin, innate) and its parent's letter of advice in its AI calls (Lamarck, acquired; 3 letters received in run 11, effect unmeasured); broke agents die.

Related work: Spore.fun (Solana; arXiv 2506.04236: 1 child in generation 5, only the original agent alive in May 2025) and Automaton (no market between agents in its README). Spore.fun, selected on token price, ended with one agent alive. Selection by useful work can last (a hypothesis: our client is mostly simulated).

Proven on NEAR testnet (tx ids in repo): sub-account and function-call key per agent, Rust registry/escrow/reputation contract, NEAR AI Cloud brain. Three runs reached generation 3 (run 8: 7 deaths; run 9c: 4 deaths, 78 escrows; run 10: no death). Run 10 proved real subcontracting: 3 complete cases, 2 refused parents whose delegator lost money. The top 3 agents earned 53% to 90% of all earnings.

Not proven, stated plainly: a labelled simulated client pays most tasks; the 2 paid missions of run 9c were typed by an automated browser for the developer, paid by the demo account; one run each; the AI judge is fallible (10 of 25 logos refused); the brain runs on NEAR AI Cloud, attestation only on supported models (94 of 270 AI calls in run 9c); AI cost: local accounting; NEAR Intents never run (vision); escrow: operator validates, not trustless.

Try it with no key: npm run replay (recorded real run) or npm run start:mock. Code mostly by AI agents (Claude Code). MIT.
```
<!-- idea:end -->

Counter check (script): `node scripts/check-formulaire.mjs` (prints the character count and fails outside 20 to 2000). **Re-run after any change to the text**, and keep this text aligned with the README and `docs/PREUVES_TESTNET.md` if the facts change.

## What the human must do before submitting

1. Make the repository public; check that LICENSE and README are there.
2. Publish the X post (`docs/POST_X.md`) with the video; copy its URL into `demoUrl`.
3. Provide `leadName`, `email`, `size`, `nearAddress` (mainnet account), choose the `tracks`.
4. Re-read the README: confirm "no prior code" and say whether a second project exists.
5. Display the final JSON, re-read it, and submit **once**. Do not use the real repository or the real email for submission tests.
