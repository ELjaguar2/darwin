# engine/ : evolution engine (lot L4)

`createEngine(deps, market, options?) : Engine` (interface `shared/modules.ts`). It depends only on the injected `Chain`, `Brain` and `Market` interfaces, the journal and the `Rng` (no import from `accounts/` or `brain/`, no `process.env`).

| File | Role |
|---|---|
| `index.ts` | tick loop (ARCHITECTURE section 13), start/pause/resume/stop, `getState` |
| `genome.ts` | founders, mutation (bounds from `GENOME_BOUNDS`, gene -> [before, after] report) |
| `lifecycle.ts` | birth (sub-account + registry), reproduction, parent -> child letter, death |
| `economy.ts` | debits (metabolism, AI cost via `costYocto`), batched settlement, balance synchronisation |
| `policy.ts` | an agent's decisions: bid (its own profession only, never below the profession's floor price), risk, subcontracting |
| `stub-market.ts` | minimal `Market` for tests (the real implementation is in `market/`, L6) |

## Behaviour rules
- **Metabolism** is debited at every tick to the master account. **AI cost** is debited from the agent's balance (`brain.charged`, D-013/D-020); unverified model: fall back to the default model with a `system.warning`, never a zero cost.
- **Bid**: a free agent of the right profession asks `askRatio x budget`, floor = estimated AI cost x 1.1; it abstains if its balance after cost would fall below `minVital x (1 + 2(1 - risk))` (the risk gene sets this reserve).
- **Execution** in the tick of the award: `Brain` call, debit, `Market.submitResult`. The engine never credits a balance: earnings are read from `escrow.released` (journal) and from the on-chain balance.
- **Subcontracting**: with probability `cooperation/2`, a child task (25% of the price, `requester: agent`). Simplification: the parent does not wait for the child task's result.
- **Reproduction**: balance >= `reproThreshold x birthCapital`, population < max, delay elapsed (also after a birth), and the parent must keep >= 2 x `minVital`. Child capital = `birthCapital + generosity x surplus` (capped). Event order: `agent.born`, `agent.reproduced`, `letter.written` (letter written by the parent's brain, cost debited from the parent; labelled fallback if the brain fails).
- **Death**: logical balance < `minVital` -> debts settled, `markAgentDead`, `closeAccount` to the master, `agent.died`. No one alive: `sim.stopped(extinction)`. The lineage stays in the registry and in `getState().agents`.
- **Logical balance and gas (R4)**: logical balance = on-chain balance re-read at every tick minus pending debts (`settleEveryTicks > 1`). Gas paid by a sub-account therefore reduces the re-read balance (`balance.changed`, reason `chain_fee`). `minVital` serves as a gas reserve for the death sweep: it must stay well above the gas of a few transactions (testnet: 0.05 NEAR, to be confirmed by the accounts developer).
- **Determinism**: all random draws go through `Deps.rng`; same seed = same journal (apart from `ts`).

## Options
`autoRun` (default true: timed loop `sim.tickMs`; false: tests, manual `tick()`); `emitChainTx` (default: true only with a mock chain, `NearChain` journals by itself).

## Tests
`engine/simulation.test.ts`: 3+ generations in the demo preset (births, work, reproduction, deaths, letters), money conservation invariant, event catalogue, determinism by seed, batched settlement, mutations. Duration: a few seconds.

## Calibration (mock, demo preset, 900 ticks)
Measured with `nearUsdRate=0.01` (demo preset value decided by the architect; reproduced here with `DARWIN_NEAR_USD_RATE=0.01` because these `shared/` changes were not yet committed on `main`). With the old rate of 3, the AI cost was negligible; at 0.01 it weighs 2 to 7 NEAR cumulated over the population, so the "model" gene becomes selective.

| Seed | 1st reproduction | 1st generation-3 birth | 1st death | Deaths | Generations |
|---|---|---|---|---|---|
| 1 | tick 22 | tick 135 | tick 131 | 23 | 6 |
| 42 | tick 30 | tick 84 | tick 137 | 54 | 12 |
| 99 | tick 41 | tick 96 | tick 150 | 44 | 6 |

ARCHITECTURE section 12 targets met (reproduction before tick 60, generation 3 before tick 300). With 0.02: generation 3 at ticks 199, 84, 96, also compliant.

## Robustness
- Batched settlement: the debt is cleared only after a successful transfer (otherwise it stays due and the error propagates). Test in `failures.test.ts`.
- `registerAgent` failure: the birth is cancelled, the orphan account is closed and its funds return to whoever provided them (parent or master), with `system.warning BIRTH_ABORTED` (or `system.error BIRTH_ORPHAN_ACCOUNT` if the repatriation also fails). The parent is not debited and the letter is not written.

## L16: real freelance, 6 professions
- Professions: `logo, finance, architecture, marketing, translation, legal`. Founders are assigned in turn (index % 6); each profession has a short freelance personality (`personalityWith(profession, trait?)`). A profession change by mutation rewrites the personality (trait kept).
- Bid: price = max(askRatio x budget, AI cost x 1.1, `CATALOGUE[profession].nearPrice`); above the budget, the agent abstains.
- Specialisation: event `population.snapshot { tick, byProfession, byGeneration }` every 5 ticks (`POPULATION_SNAPSHOT_EVERY`), emitted just before `sim.tick`, living agents only.
