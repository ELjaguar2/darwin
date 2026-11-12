# TEE attestation of the brain's responses (NEAR AI Cloud)

> Owner: dev-cerveau-ia (work package L11). Protocol verified on 2026-11-10 on docs.near.ai/cloud/verification (pages "Gateway attestation", "NEAR model attestations", "Response signatures", "Quote, nonce, and signer bindings"). Real execution of 2026-11-10 described in section 3.

## 1. What can be proven, and what is not proven

Models marked `attestationSupported: true` in `GET /v1/model/list` (in our allowlist: `Qwen/Qwen3.8-27B`, `z-ai/glm-5.3-flash`, `Qwen/Qwen3.6-35B-A3B-FP8`, `deepseek-ai/DeepSeek-V4.1-Flash-1017`) run in a trusted execution environment (Intel TDX + NVIDIA GPU). The other three (`openai/gpt-5-nano`, `anthropic/claude-haiku-5-5`, `google/gemini-2.5-flash-lite`) are external models: **no attestation, nothing is proven for them**.

Important: Darwin's brain **does not attest every call**. Attestation is an on-demand check (`npm run ai:verify-attestation`) on a dedicated request, not a property of the whole simulation. A demo must not claim "every agent response is proven".

## 2. How to verify yourself

```bash
npm install
# the NEARAI_API_KEY key is read from .env or the environment (never displayed); it is only used for the request and the signature
npm run ai:verify-attestation -- --model z-ai/glm-5.3-flash --save-evidence data/attestation-glm
# re-verify the signature part later from the saved evidence (no key)
npm run ai:verify-attestation -- --offline data/attestation-glm
```

Options: `--accept UpToDate,SWHardeningNeeded` (accepted TCB statuses, default `UpToDate` only), `--skip-gpu`, `--max-tokens N` (<= 200), `--env-file path`. Exit code 1 if there is a FAIL. Each check is displayed `PASS`, `FAIL` or `SKIP`; a `SKIP` is never a success.

The script follows the official protocol:

1. Generates a nonce of 32 random bytes and calls `GET /v1/attestation/report?model=<id>&provider=near&signing_algo=ecdsa&nonce=<nonce>` with the header `x-no-aliasing: true`. The response contains `gateway_attestation` (gateway) and `model_attestations[]` (model).
2. For the gateway and each model report: verifies the Intel TDX quote with `@phala/dcap-qvl` (collateral fetched from Phala's PCCS), the TCB status, the absence of debug mode, that the quote's `report_data` = signer address + client nonce, that `MRCONFIGID` = `01` + SHA-256(`app_compose`), and that replaying the event log (RTMR3, SHA-384) equals the quote's RTMR3.
3. GPU proof: verifies that the `nvidia_payload` nonce is ours, then sends the payload to NVIDIA NRAS (`https://nras.attestation.nvidia.com/v3/attest/gpu`) and requires `x-nvidia-overall-att-result: true`.
4. Makes a real chat request with the exact bytes retained (canonical model, `x-no-aliasing: true`, `Accept-Encoding: identity`), then `GET /v1/signature/<id>?model=<id>&signing_algo=ecdsa`.
5. Verifies that the signed text equals `<model>:SHA-256(exact request):SHA-256(exact response)`, that the ECDSA signature (EIP-191) recovers to the `signing_address` address, that `signature_kind` is `provider_tee`, and that this address matches exactly one previously verified model report.

## 3. What was actually verified (execution of 2026-11-10, model `z-ai/glm-5.3-flash`)

Result: 20 PASS, 0 FAIL, 0 SKIP.

| Check | Result |
|---|---|
| Attestation report retrieved (1 model candidate) | PASS |
| Gateway: TDX DCAP quote, TCB status `UpToDate`, debug disabled, report_data = signer + nonce, nonce returned, MRCONFIGID, RTMR3 replay | PASS (6 checks) |
| Model: same 6 checks on the model's quote (TCB status `UpToDate`) | PASS (6 checks) |
| NVIDIA GPU proof: payload nonce, NRAS verdict `x-nvidia-overall-att-result=true` | PASS |
| Real request (response id `1c1ea6068280496f8ef8d050c98dbe6d`) | PASS |
| Signature retrieved: `signature_kind=provider_tee`, ECDSA | PASS |
| Signed text = model:SHA-256(exact request):SHA-256(exact response) | PASS |
| ECDSA signature valid for `signing_address` `0x3b753b4406613c5e70ae640508632b600424fa0c` | PASS |
| Signer = exactly one previously verified model report | PASS |

Negative test performed: adding a single byte to the saved response makes the offline verification fail on "signed text differs".

This execution is a dated fact, not a permanent guarantee: re-run the command to obtain fresh proof. The cost of the execution (around 0.00001 USD) is journalled in `data/ai-usage.jsonl` with the agent `attestation`.

## 4. What is NOT verified (limits)

- **Other models in the list**: only `z-ai/glm-5.3-flash` was attested end to end. The other three TEE models (`Qwen3.8-27B`, `Qwen3.6-35B-A3B-FP8`, `DeepSeek-V4.1-Flash-1017`) have the same mechanism but were not run through the script. External models have no attestation.
- **No per-call check during the simulation**: the responses produced by agents during the simulation are not signature-verified one by one.
- **TLS binding**: the TLS connection to `cloud-api.near.ai` is not bound to the gateway attestation (`include_tls_fingerprint` not used).
- **Image provenance / measurement policy**: the measurements (MRTD, RTMR, `app_compose`) are verified for internal consistency with the quote, but **not compared against a list of accepted reference values** (no allowlist policy or image provenance). A production verifier should define one.
- **NVIDIA token**: we rely on the NRAS verdict received over TLS; the JWT token is not re-validated locally (claims signature not verified).
- **Intel collateral**: fetched from Phala's PCCS (third-party service) by default; `INTEL_PCS_URL` can be passed to use Intel's PCS, not done here.
- **Service instance**: all instances of the same model share the signing key; a valid signature does not establish that the report and the response come from the same instance (warning in the official documentation).
- **Full chain**: the `provider_tee` signature does not bind the bytes signed by the model to the gateway or to TLS (limit documented by NEAR AI Cloud).
- **Offline mode** (`--offline`): only redoes the hashing and the signature; the quote, event log and GPU are marked `SKIP`, as is the matching of the signer against a verified report.
- **Dependency vulnerabilities**: `npm audit` reports 2 low alerts (package `elliptic`, via `@phala/dcap-qvl`) in development dependencies only.
- Confidentiality: attestation proves the announced execution environment, not that the provider does not retain data; NEAR AI Cloud's verification page (cloud.near.ai/verify) allows verification in the browser.
