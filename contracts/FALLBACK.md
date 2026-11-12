# Fallback D-016 / D-022 (contract not deployed)

Deadline: 2026-11-11 23:59 UTC. If the contract is not built by `cargo near build` AND deployed on testnet by that date, the project lead activates degraded mode:

- `NearChain`: escrow = `escrow.<master>` sub-account driven by the engine; registry and reputation kept in the local journal.
- `GET /api/health` exposes `escrow: "operator-account"`; permanent UI badge: "Degraded escrow: operator-driven account, no contract".
- Forbidden wording in degraded mode: "on-chain" and "smart contract" for the registry, reputation and escrow.
- The contract code stays in the repository, presented as "unit-tested, not deployed".

Proof rule kept in degraded mode: the engine never calls the release transfer without an `accepted` proof (`PROOF_REQUIRED` guard on the `Chain` side).

State as of 2026-11-09: see `contracts/README.md` (section "Verified state") before activating this fallback.
