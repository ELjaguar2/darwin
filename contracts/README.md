# contracts/darwin (lot L3)

Single NEAR contract (Rust, `near-sdk` 5.30.1): agent registry and genealogy, task escrow, reputation. Trust model: the operator (master account) is the validation oracle (D-015, D-024); this is not "trustless".

## Verified state (2026-11-09)
| Item | State |
|---|---|
| Toolchain | Rust 1.99.1 (toolchain `stable-x86_64-pc-windows-gnu`, installed in `~/.rustup`, `~/.cargo`, no admin rights) + target `wasm32-unknown-unknown`. |
| Unit tests | `cargo test`: **35 passing tests** (native; re-run 2026-11-12, still 35 green). On this machine `AWS_LC_SYS_PREBUILT_NASM=1` is required (otherwise `aws-lc-sys` demands NASM). |
| WASM build | `cargo build --target wasm32-unknown-unknown --release`: OK, `darwin.wasm` ~447 KB. |
| `cargo-near` | **Not installed, not used.** The WASM was not produced by `cargo near build`; compatibility of the WASM (rustc 1.99, instruction set) with the NEAR runtime was **not verified**. |
| Sandbox / testnet simulation | **Not done.** No deployment, no real call: transfers (`Promise`) are only tested in unit tests (callback called by hand). |
| Testnet deployment | **Not done** as of 2026-11-09: requires a funded master/contract account (see `docs/BESOINS_HUMAIN.md`). Check `docs/STATUS.md` for the current deployment state. |

## Methods
Writes (operator = `NEAR_MASTER_ACCOUNT_ID`, unless noted):
- `new(operator)`: initialization.
- `register_agent(record)`: `agent_id`, `account_id`, `parent_id?`, `generation`, `genome_hash` (sha256 hex of `genome_json`, verified), `genome_json` (canonical JSON), `birth_tick`. Parent must be known and generation = parent + 1; founder = generation 1; duplicates refused.
- `mark_dead(agent_id, death_tick, cause)`: cause `starvation|manual|reset`. The record stays (lineage kept).
- `reserve_task(task_id, payer)`: the operator reserves the task id for a payer (anti-squatting: ids are predictable). `get_reservation` as a view.
- `lock_escrow(task_id, payer)` payable: requires a reservation of THIS id for THIS payer (consumed on lock); caller = payer (signer, agent sub-account or visitors account) or operator. The payer therefore does not need the operator to lock, but cannot take an unreserved id.
- `release_escrow(task_id, payee, proof{result_hash, verdict:"accepted", validator})`: proof mandatory; transfer then callback (`releasing` -> `released`, or back to `locked` if the transfer fails).
- `refund_escrow(task_id, reason)`: `reason` = `"rejected"` or `"expired"` only (enum).
- `add_reputation(agent_id, task_id, delta, proof_hash)`: delta != 0, |delta| <= 100; credit only if the escrow is `released` to this agent and `proof_hash` = the proof's `result_hash`; penalty (missed deadline included) after a `rejected` or `expired` refund; one write per (task, agent).
- `on_settled`: private callback.

Views: `get_agent`, `list_agents(from, limit)` (max 100), `agents_count`, `get_escrow`, `get_reputation`, `get_operator`. NEP-297 events `EVENT_JSON:{"standard":"darwin","version":"1.0.0",...}` for every write.

### Error strings (kept verbatim)
The contract is already deployed and clients may match its panic messages, so they are NOT translated. English codes: `ALREADY_REGISTERED`, `UNKNOWN_PARENT`, `UNKNOWN_AGENT`, `ESCROW_EXISTS`, `ESCROW_UNKNOWN`, `ESCROW_SETTLED`, `TASK_NOT_RESERVED`, `TASK_ALREADY_RESERVED`, `PROOF_REQUIRED`. French sentences, with their meaning:
- "Reserve a l'operateur": operator only.
- "Reserve a l'operateur ou au payeur": operator or payer only.
- "agent_id invalide" / "task_id invalide": invalid id.
- "genome trop gros": genome too large.
- "genome_hash ne correspond pas au genome": genome hash mismatch.
- "un fondateur est de generation 1": a founder has generation 1.
- "generation incoherente avec le parent": generation inconsistent with parent.
- "agent deja mort": agent already dead.
- "death_tick avant la naissance": death_tick before birth.
- "Depot attache requis": attached deposit required.
- "delta hors bornes": delta out of bounds.
- "reputation deja ecrite pour cette tache": reputation already written for this task.
- "malus seulement apres un sequestre rembourse (rejected ou expired)": penalty only after a refunded escrow.
- "le beneficiaire n'est pas cet agent": the payee is not this agent.
- "etat de sequestre inattendu": unexpected escrow state.

They can be translated at the next redeployment, together with the unit tests that assert them.

## Gaps with ARCHITECTURE.md / `shared/chain.ts` (to be handled by dev-comptes-wallets, L2)
1. `registerAgent`: the contract expects `genome_json` (canonical JSON, `canonicalJson`) in addition to `genome_hash`; `NearChain` must send the canonical string whose sha256 is `genomeHash`.
2. `refundEscrow({reason})`: the contract only accepts `rejected` or `expired`; `NearChain` must map.
3. `addReputation` is stricter than `MockChain`: it requires a released escrow (or refunded for rejection) for the same task. The market must release before crediting, and call `reserve_task` (operator) before every `lock_escrow` (new call, absent from `Chain`: `NearChain` must chain it inside `lockEscrow`); integer delta.
4. Transient statuses `releasing`/`refunding` in addition to `locked/released/refunded` (treat as "in progress"). Amounts as decimal strings (`U128`).
5. `lock_escrow`: the deposit comes from the signing account (operator or payer). If the operator signs, the funds are the operator's, not the payer sub-account's: for a real debit of the payer, the engine must sign with the sub-account key.

## Commands
- Tests: `cd contracts/darwin && cargo test` (Windows without NASM: `AWS_LC_SYS_PREBUILT_NASM=1`).
- Build: `npm run contracts:build` (cargo-near required).
- Deployment: `NEAR_CONTRACT_ID=... NEAR_MASTER_ACCOUNT_ID=... bash contracts/deploy-testnet.sh`. Signing via the NEAR CLI keychain (`near login`), no key in the repository. The `near contract deploy ... with-init-call` syntax could not be verified against the official docs nor executed.

Fallback: `contracts/FALLBACK.md`.
