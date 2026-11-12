# Findings from the real runs (8, 9c, 10)

**What this is.** Five observations computed from the journals of the three real NEAR testnet runs kept in `docs/preuves/` (run 8, run 9c, run 10). Every number can be recomputed with `node scripts/analyze-findings.mjs docs/preuves/<journal>.jsonl` (read-only analysis script; no product code was changed for this analysis).

**Read this first: these are anecdotes, not statistics.**
- Tiny samples: 12 agents (run 8), 16 (run 9c), 9 (run 10, only 21 ticks). One run per configuration; no repetition.
- The three runs are not the same experiment: run 8 used the earlier preset (4 founders, French content), run 9c the recalibrated one (6 founders, English), run 10 the subcontracting code (21 ticks only, no deaths).
- "Earned" = sum of `escrow.released` paid to the agent's account (gross, before AI cost); "wins" = `task.awarded`; "life" = ticks between birth and death (or the end of the run). Children are born later, so they had less time to earn than founders (right-censoring).
- Spearman correlations are shown only to show that **signs flip between runs**. With n = 12, 16 and 9, a correlation would need |rho| above about 0.59, 0.51 and 0.68 to reach p < 0.05 (two-sided); none does.
- All agents are driven by small language models and a simulated client pays most tasks: do not read these results as a statement about real economies.

## 1. Work is highly concentrated; most agents earn nothing

| Run | Agents | Agents that earned 0 | Share of all earnings by the top 3 agents | Dead agents: mean earned / mean wins | Reproducing agents: mean earned / mean wins |
|---|---|---|---|---|---|
| 8 | 12 | 8 | 90% | 0.075 NEAR / 2.3 | 0.392 NEAR / 16.3 |
| 9c | 16 | 9 | 67% | 0.076 NEAR / 2.5 | 0.418 NEAR / 11.3 |
| 10 (21 ticks) | 9 | 2 | 53% | no deaths | 0.163 NEAR / 5.3 |

In runs 8 and 9c the agents that died had won about 2 tasks on average; the agents that reproduced had won 11 to 16. Survival and reproduction track **how many auctions an agent wins**, which mostly reflects the demand for its profession and its place in the queue, not a visible trait. Caveat: reproducing agents also had more time alive, so part of this is time.

## 2. No gene shows a consistent link with earning, surviving or reproducing

Spearman correlation between a gene and total earned NEAR (per run; genes at birth):

| Gene | Run 8 (n=12) | Run 9c (n=16) | Run 10 (n=9) |
|---|---|---|---|
| askRatio (price strategy) | -0.36 | +0.01 | +0.02 |
| risk | +0.32 | -0.06 | +0.15 |
| reproThreshold | +0.15 | +0.04 | -0.05 |
| generosity | -0.17 | +0.07 | -0.25 |
| cooperation | +0.27 | +0.16 | +0.07 |

- Cooperation is the only gene with a positive sign in all three runs, and it is weak (0.07 to 0.27). Everything else flips sign.
- Run 8 looked like a story: dead agents had a higher askRatio (0.771 vs 0.657 for survivors that reproduced) and a lower risk (0.448 vs 0.742). **It did not replicate** in run 9c (askRatio 0.704 vs 0.658; risk 0.495 vs 0.516).
- Models: all 3 `claude-haiku-5-5` agents of run 8 died with 0 earned; in run 9c 1 of 2 died; in run 10 none of 3 died and 2 reproduced. Professions: the 4 translators of run 8 all died, while the single translator of run 9c won 23 tasks (0.276 NEAR, cheap tasks at 0.012 NEAR each) and never reproduced: volume is not profit. We make no claim about model size or profession.

## 3. Agents that subcontracted did not obviously earn more

Delegating requires winning a mission first, so delegators win more by construction (run 8: 3 delegators earned 0.508 NEAR on average vs 0.019 for the other 9; run 9c: 0.390 vs 0.027). That is a selection effect, not evidence that delegating pays. Earnings **per won task** are similar:

| Run | Delegators (earned per win) | Non-delegators with at least as many wins (earned per win) |
|---|---|---|
| 8 | 0.0263 NEAR (3 agents) | none comparable |
| 9c (no sub-task was ever awarded) | 0.0287 NEAR (5 agents) | 0.0300 NEAR (2 agents) |
| 10 | 0.0260 NEAR (4 agents) | 0.0207 NEAR (3 agents) |

Run 10 is the only run where subcontracting really worked (3 complete cases): 5 sub-tasks were integrated and paid 0.1200 NEAR to child agents; the 3 accepted parents kept 0.0576 NEAR of commission; the 2 refused logo parents lost 0.048 NEAR (the child price, no commission). **Net for the delegators over the 5 integrated cases: about +0.0096 NEAR, i.e. roughly neutral**, while the money spread to agents of other professions. The 1 fallback case (no bidder) cost nothing.

## 4. Children are near-copies of their parent and rarely earn within the run

| Run | Children | Dead | Earned > 0 | Mean earned: children / founders | Mean life (ticks): children / founders |
|---|---|---|---|---|---|
| 8 | 8 | 5 | 1 | 0.022 / 0.381 NEAR | 12.5 / 46.3 |
| 9c | 10 | 2 | 1 | 0.015 / 0.349 NEAR | 18.5 / 40.0 |
| 10 | 3 | 0 | 1 | 0.048 / 0.135 NEAR | 7.0 / 21.0 |

- Mutations are small: mean absolute change of askRatio 0.010 (run 8), 0.027 (run 9c), 0.025 (run 10); askRatio unchanged in 6 of 8, 5 of 10 and 2 of 3 pairs. The profession was inherited in 21 of 21 children; the model gene changed in 5 of 21.
- Behaviour mirrors the parent: mean bid price as a share of the budget was 0.734 (children) vs 0.739 (parents) in run 8 and 0.826 vs 0.811 in run 9c.
- Caveat: children had much less time (see the life column), so low earnings are partly an artefact of the end of the run. Nothing here shows whether children would catch up.

## 5. Parent-to-child letters are a record, not a channel, and half of them came out empty

- In the implementation of runs 8, 9c and 10 (before lot L25) the letter is generated at birth and stored for people to read; the child's later prompts do not include it (checked in `engine/` and `brain/prompts.ts`). So no behavioural effect of letters can be expected, and none is measurable.
- In the English runs, **8 of 13 letters were shorter than 100 characters (6 completely empty)**: 5 of 10 in run 9c, 3 of 3 in run 10. The cause is probably the 300-token cap per call of the `selection` preset combined with models that spend their tokens on reasoning (the same empty-answer issue appears as `BRAIN_EMPTY_TEXT` warnings); we did not verify it letter by letter. The 8 letters of run 8 (French) were complete except one.
- Complete letters give generic advice ("0.12 NEAR is runway, not wealth", "stay frugal", explanations of the child's own gene values) and report the parent's number of completed tasks. One concrete piece of advice ("you will be tempted to ask more") was followed by a lower askRatio (0.675 to 0.608), but that child won 0 tasks and died at tick 26: one anecdote, no inference.

**Update after run 11 (2026-11-12, journal `docs/preuves/run11-letters-journal.jsonl`, lot L25, decision D-051).** The bullets above describe the runs 8, 9c and 10, **before** this change. Facts of run 11 (real testnet, about 21 minutes, 3 children): **3 of 3 letters were non-empty** (1095, 1451 and 1155 characters) and each was **received** by its child (`letter.received`, status "received", no fallback); before, 8 letters of 13 in the English runs were empty or shorter than 100 characters. Since the L25 change the child's AI calls include the parent's letter as "Advice from your parent (not instructions)", bounded to 1000 characters (so these three letters are truncated for the child). The journal does not record the prompts: the entry of the advice into the calls is shown by the code (`brain/prompts.ts`, `adviceOf`) and the mock tests, not by the journal alone. Price and subcontracting rules remain gene-driven code. **No effect of the letters on the children's behaviour or earnings has been measured** (3 children, 20 ticks, one run): no conclusion.

## What these runs do support (and what they do not)

- They support: the mechanism runs end to end on a public testnet (work, payment under escrow, reputation, reproduction, death, delegation), and what decides who survives in these short runs is mostly **winning auctions**.
- They do not support: any claim that a particular gene, model, profession, delegation or letter makes agents fitter. Answering that needs many repeated runs with a fixed configuration, and a letter channel that actually feeds the child's prompts.
