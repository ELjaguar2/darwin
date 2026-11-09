#!/usr/bin/env bash
# Deploiement testnet du contrat Darwin. AUCUNE cle dans ce script ni dans le depot :
# la signature passe par le trousseau du CLI NEAR (`near login`), jamais par une variable en clair.
# Prerequis : Rust + cargo-near + near-cli-rs (`near`), compte contrat deja cree et finance (faucet).
# Variables : NEAR_CONTRACT_ID (compte du contrat), NEAR_MASTER_ACCOUNT_ID (operateur).
# NON VERIFIE de bout en bout (aucun deploiement n'a ete execute) : voir contracts/README.md.
set -euo pipefail
: "${NEAR_CONTRACT_ID:?definir NEAR_CONTRACT_ID (ex. darwin-contract.<maitre>.testnet)}"
: "${NEAR_MASTER_ACCOUNT_ID:?definir NEAR_MASTER_ACCOUNT_ID}"
case "$NEAR_CONTRACT_ID" in *.testnet) ;; *) echo "Refus : testnet uniquement (compte en .testnet)" >&2; exit 1;; esac
cd "$(dirname "$0")/darwin"
cargo near build non-reproducible-wasm
WASM="$(ls target/near/darwin.wasm 2>/dev/null || ls target/wasm32-unknown-unknown/release/darwin.wasm)"
near contract deploy "$NEAR_CONTRACT_ID" use-file "$WASM" \
  with-init-call new json-args "{\"operator\":\"$NEAR_MASTER_ACCOUNT_ID\"}" \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-keychain send
echo "Deploye : $NEAR_CONTRACT_ID (renseigner NEAR_CONTRACT_ID dans .env)"
