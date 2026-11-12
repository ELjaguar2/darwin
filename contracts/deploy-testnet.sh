#!/usr/bin/env bash
# Testnet deployment of the Darwin contract. NO key in this script or in the repository:
# signing goes through the NEAR CLI keychain (`near login`), never through a plain-text variable.
# Prerequisites: Rust + cargo-near + near-cli-rs (`near`), contract account already created and funded (faucet).
# Variables: NEAR_CONTRACT_ID (contract account), NEAR_MASTER_ACCOUNT_ID (operator).
# NOT VERIFIED end to end (no deployment was run from this script): see contracts/README.md.
set -euo pipefail
: "${NEAR_CONTRACT_ID:?set NEAR_CONTRACT_ID (e.g. darwin-contract.<master>.testnet)}"
: "${NEAR_MASTER_ACCOUNT_ID:?set NEAR_MASTER_ACCOUNT_ID}"
case "$NEAR_CONTRACT_ID" in *.testnet) ;; *) echo "Refused: testnet only (account must end in .testnet)" >&2; exit 1;; esac
cd "$(dirname "$0")/darwin"
cargo near build non-reproducible-wasm
WASM="$(ls target/near/darwin.wasm 2>/dev/null || ls target/wasm32-unknown-unknown/release/darwin.wasm)"
near contract deploy "$NEAR_CONTRACT_ID" use-file "$WASM" \
  with-init-call new json-args "{\"operator\":\"$NEAR_MASTER_ACCOUNT_ID\"}" \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-keychain send
echo "Deployed: $NEAR_CONTRACT_ID (set NEAR_CONTRACT_ID in .env)"
