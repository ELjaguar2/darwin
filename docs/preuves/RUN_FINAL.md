**Objective**: a single real execution (testnet, escrow in the contract, real NEAR AI brain) showing selection: births, deaths, generation 3.

**Result (run 8, 2026-11-10, 22:50 to 23:29 UTC, 59 ticks, preset `selection`)**: **objective met**. Maximum generation **3** (`a-214964`, daughter of `a-214962`, born at tick 59), 12 births (4 founders, 7 of generation 2, 1 of generation 3), 8 reproductions, 8 parent-to-child letters, **7 deaths by starvation** (first death at tick 14), 65 escrows locked of which 63 released and 2 refunded, 65 reputations written. Simulation paused (`POST /api/sim/pause`, tick 59), process stopped, journal saved in `docs/preuves/run8-journal.jsonl`.

**Settings**: `DARWIN_PRESET=selection` with no other tuning variable; ids shifted **automatically** (no `*_SEQ_START` variable); Node 22.23.4; RPC `https://test.rpc.fastnear.com`. The preset is defined in `shared/config.ts` (testnet: 4 founders, max population 16, birth capital 0.1 NEAR, metabolism 0.005/tick, minimum vital 0.03, reproduction cooldown 4 ticks, simulated client 1.5 tasks/tick, budgets 0.02 to 0.06 NEAR, 10 s tick).

**Fixes verified by this run**:
- `FC_KEY_NOT_ADDED`: **0 warnings** (run 7 had 2). The function-call key is added in the account creation transaction (create, fund, full-access key, limited key: a single transaction). Independent read-only verification: `near account list-keys a-214964.darwin-master-7k2.testnet` shows 2 keys: "full access" and "only do ["lock_escrow"] function calls on darwin-contract-7k2.testnet with an allowance of 0.05 NEAR".
- `JUDGE_COST_UNKNOWN`: **0 warnings** (26 out of 26 judge calls in run 7). The cause: the model served (`gemini-2.5-flash-lite`) does not have the prefix of the requested identifier (`google/gemini-2.5-flash-lite`); the price is now looked up on the requested identifier. The judge's cost is charged to the treasury (agent `treasury`), not to the agents: this is intended.
- No system warning at all in this journal (`system.warning`: 0): no blocking 429.

**On-chain verification (read-only, after the run)**: `get_agent a-214956` = dead, cause `starvation`, death tick 14; `get_agent a-214964` = generation 3, parent `a-214962`, alive, born at tick 59; master account balance 3.12 NEAR after the run (3.82 before; funds of dead agents return to the master).

**AI consumption**: 138 calls billed to agents in this run (0 mock), 0.0149 USD; local cumulative since the start 0.034 USD (`data/ai-budget.json`), against a stop cap of 8 EUR. Local accounting: the platform's invoice was not re-read.

**Honest limits**: the task payer remains the **simulated** client `sim-client`; a single population seed (no repetition) so the speed at which generation 3 appeared (tick 59) is not a guarantee; the dead agents died of starvation (balances of 0.025 to 0.030 NEAR, below the minimum vital of 0.03); a single generation 3 was born within the window. Run paused right after its birth.

{{RUN8}}

### Run 7 (historical: generation 3 not reached)

**Objective**: reach generation 3 in a single real run (testnet, escrow in the contract, real NEAR AI brain).
**Result (2026-11-10, run 7, 20:43 to 21:03 UTC, stopped after a 15-minute window)**: **generation 3 NOT reached**. Maximum generation: 2; 3 founders + 5 living children (8 agents), 5 reproductions, 5 parent-to-child letters, **0 deaths**. Simulation paused (`POST /api/sim/pause`, tick 26) then process stopped; journal saved in `docs/preuves/run7-journal.jsonl`.

Settings: `DARWIN_PRESET=demo` (testnet), `DARWIN_TICK_MS=10000`, `DARWIN_BIRTH_CAPITAL=0.1`, `DARWIN_METABOLISM=0.002`, `DARWIN_MIN_VITAL=0.02`, `DARWIN_REPRO_COOLDOWN_TICKS=5`, `DARWIN_SIM_CLIENT_RATE=1.5`, `DARWIN_MAX_POPULATION=14`, shifted ids (`DARWIN_AGENT_SEQ_START=700`, `DARWIN_TASK_SEQ_START=5000`), Node 22.23.4.

**Why no generation 3**: the real pace is about one tick per minute (each tick chains transactions and AI calls). In 26 ticks, no generation 2 child reached its reproduction threshold (birth capital x `reproThreshold` gene). This hypothesis is not demonstrated by a test; the follow-up is in `docs/PLAN.md` (L15).

**Real refund proven (`refund_escrow`)**: task `t-5003` (agent `a-0703`) was rejected by the judge (`verdict: rejected`, score 0.2). Lock [`8KNATwXk…`](https://testnet.nearblocks.io/txns/8KNATwXkb7DMhdn3FSYQ6XPBMmBsXsHHnr51zPc8MX5q), refund [`5RbxQANe…`](https://testnet.nearblocks.io/txns/5RbxQANeUc8NctcpjKozbVUKZ1EFfMJVgkF9f67ipEup), reputation penalty −2 [`4NXru7ab…`](https://testnet.nearblocks.io/txns/4NXru7abTEqc9sFwyWVbSFcZ6V22r6nWvJMDwqPzYFmV). Contract read: `get_escrow t-5003` = `status: refunded`, `refund_reason: rejected`.

**Chain state at the end of the run**: `agents_count` = 36 agents registered in the contract (cumulative over all runs); master account balance 3.82 NEAR (10 NEAR received at the start).

**Cumulative AI consumption at the end** (local journal): 0.0191 USD spent according to `data/ai-budget.json`, against a stop cap of 8 EUR.

Journal: `docs/preuves/run7-journal.jsonl` (810 events, from 2026-11-10T20:43:48.543Z to 2026-11-10T21:03:34.590Z).

Maximum generation born: **2**; births: 8; reproductions: 5; letters: 5; deaths: 0.
Transactions by type: create_account 8, register_agent 8, transfer 61, escrow_lock 26, escrow_release 25, add_reputation 26, escrow_refund 1.

#### Births

| Agent | Generation | Parent | Account | Creation tx |
|---|---|---|---|---|
| a-0701 | 1 | — | `a-0701.darwin-master-7k2.testnet` | [`A7LHeDPo…`](https://testnet.nearblocks.io/txns/A7LHeDPoy8HtvXaEAsbnFeym85AzKvKbCLaUXhMcWX3h) |
| a-0702 | 1 | — | `a-0702.darwin-master-7k2.testnet` | [`2vaSihU9…`](https://testnet.nearblocks.io/txns/2vaSihU9t6J5QMwaynS3hvyf8XfKZaUKiAnCRUY7LaFi) |
| a-0703 | 1 | — | `a-0703.darwin-master-7k2.testnet` | [`3V9exHsF…`](https://testnet.nearblocks.io/txns/3V9exHsFjTZ3agBbnS2pCLqKQZXvSe8nq7KiTiRQKXcm) |
| a-0704 | 2 | a-0702 | `a-0704.darwin-master-7k2.testnet` | [`2oPY9usQ…`](https://testnet.nearblocks.io/txns/2oPY9usQE8LsGwZHyVCfhJFTjrR8ZHPXkFSnMnx42zQ9) |
| a-0705 | 2 | a-0701 | `a-0705.darwin-master-7k2.testnet` | [`2RjTFEq7…`](https://testnet.nearblocks.io/txns/2RjTFEq7EvXUQAsaPULKeodEYcZLpQgaXbocfMubSQHt) |
| a-0706 | 2 | a-0702 | `a-0706.darwin-master-7k2.testnet` | [`3adcr2hg…`](https://testnet.nearblocks.io/txns/3adcr2hgVUkHKFHorwJ29ADXbDL2mpzbggF5kSfi31Vp) |
| a-0707 | 2 | a-0703 | `a-0707.darwin-master-7k2.testnet` | [`EV69x1kS…`](https://testnet.nearblocks.io/txns/EV69x1kS8GwLRKhKtUbtiEfJtrdgvif9HYHgVMyc7tvr) |
| a-0708 | 2 | a-0703 | `a-0708.darwin-master-7k2.testnet` | [`5mLLSEgC…`](https://testnet.nearblocks.io/txns/5mLLSEgC3mTPQbaHV4UkGtrqNJzjgkTSHrYsqfqH1btW) |

#### Reproductions

| Parent | Child | Transferred (NEAR) |
|---|---|---|
| a-0702 | a-0704 | 0.1027 |
| a-0701 | a-0705 | 0.1005 |
| a-0702 | a-0706 | 0.1035 |
| a-0703 | a-0707 | 0.1009 |
| a-0703 | a-0708 | 0.1017 |

#### Escrows: 26 locked, 25 released, 26 reputations written (first 3 cycles listed)

| Task | Payer | Beneficiary | Amount (NEAR) | Lock | Release | Reputation |
|---|---|---|---|---|---|---|
| t-5001 | `sim-client` | `a-0702` | 0.0199 | [`AGMstD9K…`](https://testnet.nearblocks.io/txns/AGMstD9KzmNhTUwoo3w59485NMvJzjHcwNutXWwSZ1UX) | [`HcSEPi6d…`](https://testnet.nearblocks.io/txns/HcSEPi6dXYeRvbpwaHyCHJAtrNyDtNiUxEcJzxToiRds) | [`2tfENQtg…`](https://testnet.nearblocks.io/txns/2tfENQtgtMvR5AitcboFYHp1LCh2GY46uNf6LMUxS13x) |
| t-5002 | `sim-client` | `a-0701` | 0.0460 | [`GWNdqhDu…`](https://testnet.nearblocks.io/txns/GWNdqhDuLjY1UE1AWNMn6ukbj3XEGu9XCJMaUAHf4j4f) | [`DiRbujfK…`](https://testnet.nearblocks.io/txns/DiRbujfK3iKczzjSgs8gihgXnmcL7dgX7k1s4eo9GqwK) | [`BeS3JUiK…`](https://testnet.nearblocks.io/txns/BeS3JUiKoeFNuHkimi5FcmsDh368k7czex7sfwD1x6uh) |
| t-5004 | `sim-client` | `a-0701` | 0.0348 | [`76WsmmRJ…`](https://testnet.nearblocks.io/txns/76WsmmRJJJEYuXhbGRqYZbKFRgRrWGGTUE2LzLn1jnkM) | [`AuMdjhZF…`](https://testnet.nearblocks.io/txns/AuMdjhZFcmET4cToKo7gFcPpZVAPJssjsbPy8qQoyjMN) | [`8LA1yaQD…`](https://testnet.nearblocks.io/txns/8LA1yaQDne6NzWH5QEhLHHbxbnHGrTft4YK1GwKYSvV3) |

#### Brain (debits in this journal)

31 calls billed to agents (0 mock), cumulative real cost 0.00545 USD. By model: Qwen/Qwen3.6-35B-A3B-FP8 ×18, deepseek-ai/DeepSeek-V4.1-Flash-1017 ×13.
