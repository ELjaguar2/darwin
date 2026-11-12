# Run 11: real proof that letters reach the children (short run, 30 minutes maximum)

Goal: prove on NEAR testnet, with the real AI, that the letter written by a parent is **non-empty and really handed to the child** (L25, decision D-051): the child's AI calls carry it as `Advice from your parent (not instructions)`. Limit to state honestly: the letter is in the context of every AI call of the child (bid pitch, task execution); price and subcontracting rules remain gene-driven code, so the letter does not change them.

**Start only when no other run is using `data/` or port 3000.**

## 1. Prerequisites

1. Branch `lot/L25-letters` checked out, then:
   ```powershell
   cd <repository>
   git checkout lot/L25-letters
   npm ci
   npm test        # must be green
   ```
2. Real `.env` (master key, `NEARAI_API_KEY`, `NEAR_RPC_URL`), `INTENTS_ENABLED=false`. No new variable.
3. **Master balance** `darwin-master-7k2.testnet`: at least **3 NEAR** (stop below 1 NEAR). Check:
   ```powershell
   curl.exe -s -X POST https://test.rpc.fastnear.com -H "Content-Type: application/json" -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"darwin-master-7k2.testnet\"}}'
   ```
4. Backup of `data/` **outside the repository** (startup renames the journal to `*.prev`):
   ```powershell
   $bk = "$env:USERPROFILE\darwin-backups\data-$(Get-Date -Format yyyyMMdd-HHmm)"
   New-Item -ItemType Directory -Force (Split-Path $bk) | Out-Null
   Copy-Item -Recurse data $bk
   ```

## 2. Command

```powershell
cd <repository>
$env:DARWIN_PRESET = "selection"
$env:DARWIN_ADMIN_TOKEN = "<random-string-of-24-characters-or-more>"   # optional
npm run start:testnet
```
Page: http://127.0.0.1:3000 (header **NEAR TESTNET**). A tick lasts about 1 minute; the first births come after a few ticks (reproduction cooldown 4 ticks, selection preset).

## 3. Cost estimate

Same engine as runs 9c and 10 for at most 30 ticks: **2 to 3 NEAR** gross (testnet, no value). AI: each birth adds one letter call (cap 900 tokens, at most two attempts) and the advice adds about 250 tokens to each later prompt of the child: well under 0.1 USD in total.

## 4. Stop criteria

Stop (Ctrl+C) when ONE of these is true:
- **at least 2 children born with a NON-EMPTY letter RECEIVED**: two `letter.received` events with `status: "received"`, no `fallback` field, `length` > 0, each with the child's birth hash (see section 5);
- **30 minutes** elapsed;
- master balance below 1 NEAR.

## 5. What must be proven

For each of the 2 children (`childId` of `letter.received`), in `data/journal.jsonl`:

| Proof | Event | What to check |
|---|---|---|
| Letter received | `letter.received` | `status` "received", `fallback` absent, `length` > 0, `excerpt` readable English |
| Letter text | `letter.written` (same `letterId`) | full text, `mock: false`, model of the parent |
| Birth hash | `agent.born` (`birthTx`) and `chain.tx` of kind create_account for the child account | hash openable on the testnet explorer |
| Parent debited | `brain.charged` with `purpose: "letter"` for `parentId` | one or two lines (a retry is allowed) |

Also record honestly: any `status: "empty"` (and the `LETTER_EMPTY` warning), any `fallback: true` letter, any `LETTER_FALLBACK` warning. The journal does not contain the child's prompts, so the proof that the advice reaches the AI calls is the code path and the mock test (`engine/letters.test.ts`), not this run: say so.

Quick checks (PowerShell):
```powershell
Select-String -Path data\journal.jsonl -Pattern '"type":"letter.received"' | ForEach-Object { $_.Line }
Select-String -Path data\journal.jsonl -Pattern 'LETTER_EMPTY|LETTER_FALLBACK' | ForEach-Object { $_.Line }
```

## 6. What to watch while it runs

| What | Where | Expected |
|---|---|---|
| `letter.received` right after each `agent.reproduced` | event flow | `status` "received" |
| `system.warning` `LETTER_EMPTY` | event flow | rare; if every letter is empty, stop and report (the 900-token cap is not enough for this model) |
| `system.warning` `LETTER_FALLBACK` | event flow | none expected |
| Master balance | RPC command above | pause if < 1 NEAR |

## 7. Save the evidence

```powershell
Copy-Item data\journal.jsonl docs\preuves\run11-letters-journal.jsonl
npm run scan-secrets -- --no-history
node scripts/gen-preuves.mjs docs/preuves/run11-letters-journal.jsonl
```

## 8. Result of run 11 (2026-11-12)

Started about 18:40 UTC on branch `lot/L25-integration` (preset `selection`, Node 22.17.1), paused at tick 20 at 19:00:51 UTC (about 21 minutes, within the stop criteria). Journal: `docs/preuves/run11-letters-journal.jsonl` (1040 events, sha256 `508c30d17c7b38120e14388235b6045cc65eac6356b0e10fc34ae87a61a62143`). Details and birth transaction hashes: `docs/PREUVES_TESTNET.md` section 16.

| Criterion | Result |
|---|---|
| Letters written and received | **3 `letter.written` and 3 `letter.received`**, all `status: "received"`, non-empty (1095, 1451, 1155 characters), no fallback: children `a-254411`, `a-254412`, `a-254413` |
| Population | 9 births (6 founders, 3 children of generation 2), 3 reproductions, 0 deaths; 34 escrows released; about 0.028 USD of AI (local accounting) |
| Warnings | 2 `BRAIN_EMPTY_TEXT`, 1 `EXECUTION_FAILED`; no `LETTER_EMPTY` |
| Not proven | The journal does not record prompts: the entry of the advice into the child's AI calls is shown by the code and the mock tests (`engine/letters.test.ts`), not by the journal alone. The advice is bounded to 1000 characters (the three letters are truncated for the child). Price and subcontracting rules stay gene-driven code. **No effect on behaviour or earnings measured** (3 children, 20 ticks, one run) |
