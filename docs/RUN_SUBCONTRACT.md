# Run 10: real subcontracting proof (short run, 30 minutes maximum)

Goal: prove again, on NEAR testnet and with the real AI, that subcontracting works after the L21 fix (D-047): at least 3 child tasks **awarded, escrowed and paid** with transaction hashes. Run 8 proved it; since L16 (price floors) it produced 15 subcontracts and 0 bids in run 9c.

**Start only AFTER run 9c is finished and its journal is saved.** Never two servers on the same `data/` folder or the same port.

## 1. Prerequisites

1. Run 9c stopped (`sim.stopped` in the journal), its journal copied to `docs/preuves/run9c-journal.jsonl`.
2. Branch `lot/L21-subcontracting` merged into `main` by the project lead, then:
   ```powershell
   cd <repository>
   git checkout main
   npm ci
   npm test        # must be green
   ```
3. Real `.env` (master key, `NEARAI_API_KEY`, `NEAR_RPC_URL`), `INTENTS_ENABLED=false`.
4. **Master balance** `darwin-master-7k2.testnet`: at least **3 NEAR** at the start (stop if it falls below 1 NEAR). Check:
   ```powershell
   curl.exe -s -X POST https://test.rpc.fastnear.com -H "Content-Type: application/json" -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"darwin-master-7k2.testnet\"}}'
   ```
   `amount` is in yoctoNEAR (1 NEAR = 10^24).
5. Backup (startup renames `data/journal.jsonl`, `state.json`, `lineage.json` to `*.prev` and overwrites the old `journal.prev`):
   ```powershell
   Copy-Item -Recurse data "data-backup-$(Get-Date -Format yyyyMMdd-HHmm)"
   Copy-Item data\journal.jsonl docs\preuves\run9c-journal.jsonl   # only if not already done
   ```

## 2. Command

```powershell
cd <repository>
$env:DARWIN_PRESET = "selection"
$env:DARWIN_ADMIN_TOKEN = "<random-string-of-24-characters-or-more>"   # optional, to pause cleanly
npm run start:testnet
```
Page: http://127.0.0.1:3000 (header must show **NEAR TESTNET**). A tick lasts about 1 minute. No visitor order is needed: subcontracting starts from the simulated client's tasks.

## 3. Cost estimate

Same engine as run 9c, 30 ticks at most: founders 6 x 0.12 = 0.72 NEAR, a few births, simulated client funding about 1 to 2 NEAR (part comes back), subcontract escrows are small (0.012 to 0.06 NEAR each). **Estimate: 2 to 3 NEAR** gross at testnet (no value). AI: well under 0.1 USD (runs 8 and 9c: 0.0004 USD per call), against the 8 EUR cap.

## 4. Stop criteria

Stop (Ctrl+C, or pause then stop with the admin token) as soon as ONE of these is true:
- at least **3 subcontract child tasks awarded AND paid** in real conditions, each with a transaction hash (`escrow.locked` then `escrow.released`);
- **30 minutes** elapsed;
- master balance below 1 NEAR.

## 5. What to watch

In the page's event flow, or `data/journal.jsonl`:

| What | Where | Expected |
|---|---|---|
| `subcontract.created` | journal | fields `profession` (different from the delegating agent's), `budget`, `parentPrice`, `commission` = parentPrice - budget, commission >= 15% of parentPrice |
| `no_bids` / `task.expired` on child tasks | journal (task whose `parentTaskId` is set) | should be rare; if every child expires, the fix is not enough: stop and report |
| `escrow.locked` of a child task | journal | `payer` = the **delegating agent's account** (`a-NNNNNN.<master>`), NOT `visitors` or `sim-client`; signed by that account's own key |
| `task.awarded`, `escrow.released` of the child | journal | a different agent (not the requester) wins and is paid; transaction hash in `chain.tx` |
| balance of the delegating agent | agent card / `balance.changed` | drops by the budget when the escrow locks, the commission stays in its balance |
| `system.warning` `SUBCONTRACT_FAILED` | journal | none expected |
| RPC 429 | `system.warning` | retries are normal |

Quick check after the run (PowerShell):
```powershell
Select-String -Path data\journal.jsonl -Pattern '"type":"subcontract.created"' | Measure-Object
Select-String -Path data\journal.jsonl -Pattern '"type":"subcontract.created"' | Select-Object -First 3
```

## 6. Save the evidence

```powershell
Copy-Item data\journal.jsonl docs\preuves\run10-subcontracting-journal.jsonl
npm run scan-secrets -- --no-history      # no key or token in the journal
node scripts/gen-preuves.mjs docs/preuves/run10-subcontracting-journal.jsonl
```
Replay: `$env:DARWIN_REPLAY_FILE = "docs/preuves/run10-subcontracting-journal.jsonl"; npm run replay`.

Report honestly: number of subcontracts created, awarded, paid, expired; commissions; transaction hashes. Reminder of the V1 limit: the sub-task result is not merged into the parent deliverable (paid and validated independently).
