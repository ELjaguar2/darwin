# Run 10: real subcontracting proof (short run, 30 minutes maximum)

Goal: prove on NEAR testnet, with the real AI, that **real subcontracting** works (L21, decision D-048): an agent wins a mission, delegates part of it to an agent of another profession through the normal market, pays the sub-task from its own account, **integrates the child's deliverable into its own** and delivers the complete result to the client, keeping a commission. Run 8 proved the delegation and its payment; run 9c showed the old version broken by the L16 price floors (15 sub-tasks, 15 `no_bids`). The lot enters `main` only if this run proves it.

**Start only AFTER run 9c is finished and its journal is saved.** Never two servers on the same `data/` folder or the same port.

## 1. Prerequisites

1. Run 9c stopped (`sim.stopped` in the journal), its journal copied to `docs/preuves/run9c-journal.jsonl`.
2. Branch `lot/L21-subcontracting` checked out (or merged for the test by the project lead), then:
   ```powershell
   cd <repository>
   git checkout lot/L21-subcontracting
   npm ci
   npm test        # must be green
   ```
3. Real `.env` (master key, `NEARAI_API_KEY`, `NEAR_RPC_URL`), `INTENTS_ENABLED=false`. No new variable: the subcontracting parameters are part of the `selection` preset.
4. **Master balance** `darwin-master-7k2.testnet`: at least **3 NEAR** at the start (stop if it falls below 1 NEAR). Check:
   ```powershell
   curl.exe -s -X POST https://test.rpc.fastnear.com -H "Content-Type: application/json" -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"darwin-master-7k2.testnet\"}}'
   ```
   `amount` is in yoctoNEAR (1 NEAR = 10^24).
5. Backup of `data/` **outside the repository** (startup renames `data/journal.jsonl`, `state.json`, `lineage.json` to `*.prev` and overwrites the old `journal.prev`):
   ```powershell
   $bk = "$env:USERPROFILE\darwin-backups\data-$(Get-Date -Format yyyyMMdd-HHmm)"
   New-Item -ItemType Directory -Force (Split-Path $bk) | Out-Null
   Copy-Item -Recurse data $bk
   ```

## 2. Command

```powershell
cd <repository>
$env:DARWIN_PRESET = "selection"
$env:DARWIN_ADMIN_TOKEN = "<random-string-of-24-characters-or-more>"   # optional, to pause cleanly
npm run start:testnet
```
Page: http://127.0.0.1:3000 (the header must show **NEAR TESTNET**). A tick lasts about 1 minute (10 s configured, real chain latency). No visitor order is needed: missions come from the simulated client; subcontracting probability is 0.15 + 0.6 x cooperation per won mission (depth-0 missions only).

## 3. Cost estimate

Same engine as run 9c for 30 ticks at most: founders 6 x 0.12 = 0.72 NEAR, a few births, simulated client funding about 1 to 2 NEAR (part comes back), each sub-task escrows 0.012 to 0.05 NEAR from the delegating agent's account. **Estimate: 2 to 3 NEAR** gross (testnet, no value). AI: each subcontract adds the child's bid pitches, execution and one judge call, and, in plan B, one extra execution call: well under 0.1 USD at the measured 0.0004 USD per call, against the 8 EUR cap.

## 4. Stop criteria

Stop (Ctrl+C, or pause then stop with the admin token) as soon as ONE of these is true:
- **at least 1 complete real subcontract proven** (aim for 3): see section 5;
- **30 minutes** elapsed;
- master balance below 1 NEAR.

## 5. What must be proven (with transaction hashes)

For each complete subcontract, find in `data/journal.jsonl` (the child task id is `childTaskId` of `subcontract.integrated`):

| Proof | Event | What to check |
|---|---|---|
| Child escrow | `escrow.locked` with `taskId` = child, and its `chain.tx` (`kind` escrow lock) | `payer` = the **delegating agent's account** (the `a-NNNNNN.<master>` of `byAgentId` in `subcontract.created`), NOT `visitors` nor `sim-client`; `tx` = hash, openable on the explorer |
| Release to the child | `escrow.released` with `taskId` = child | `payee` = the child agent's account, `tx` = hash |
| Release to the parent | `escrow.released` with `taskId` = parent | `payee` = the delegating agent's account, `tx` = hash, `amount` = price paid by the client |
| Integrated section | `deliverable.produced` of the parent (`files[].content`) | contains `## Subcontracted to <first name> (<profession>)` followed by the child's text (for a logo: file `subcontracted.md`) |
| Commission | `subcontract.integrated` | `commission` = `parentPrice` - `childPrice` > 0 (yocto); `task.validated` of the parent is `accepted` |

Also record, honestly, every `subcontract.fallback` (reasons `no_bids`, `rejected`, `deadline`, `failed`): the parent must still have delivered and been paid (`escrow.released` of the parent) with `commission` "0" and a section `## Done in-house (subcontract failed: <reason>)`. A parent mission that **expires because of a subcontract** is a bug: stop and report it.

Quick checks after the run (PowerShell):
```powershell
foreach ($t in "subcontract.created","subcontract.integrated","subcontract.fallback") {
  "$t : " + (Select-String -Path data\journal.jsonl -Pattern "`"type`":`"$t`"" | Measure-Object).Count
}
Select-String -Path data\journal.jsonl -Pattern '"type":"subcontract.integrated"' | Select-Object -First 3 | ForEach-Object { $_.Line }
```

## 6. What to watch while it runs (light)

| What | Where | Expected |
|---|---|---|
| `subcontract.created` | event flow | `profession` = the plan's child profession, `budget`, `parentPrice`, `deadline` < the mission's deadline |
| `no_bids` on child tasks | event flow (`task.expired` of a task whose `parentTaskId` is set) | possible when the small population has no agent of the child profession; then `subcontract.fallback` follows. If EVERY sub-task falls back, report it |
| `system.warning` `SUBCONTRACT_FAILED`, `INHOUSE_FAILED`, `EXECUTION_FAILED` | event flow | rare; note them |
| Master balance | RPC command of section 1 | pause if < 1 NEAR |
| RPC 429 | `system.warning` | retries are normal |

## 7. Save the evidence

```powershell
Copy-Item data\journal.jsonl docs\preuves\run10-subcontracting-journal.jsonl
npm run scan-secrets -- --no-history      # no key or token in the journal
node scripts/gen-preuves.mjs docs/preuves/run10-subcontracting-journal.jsonl
```
Replay: `$env:DARWIN_REPLAY_FILE = "docs/preuves/run10-subcontracting-journal.jsonl"; npm run replay`.

Report honestly: subcontracts created, integrated, fallen back (by reason), commissions, transaction hashes, and anything that did not behave as described.
