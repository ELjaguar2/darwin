# NEAR Intents (1Click) mainnet demo: procedure for the human

> **Status: vision only. Not run, not part of the hackathon demo, no mainnet demo is planned.** These notes are kept for a possible future use, which would need a written human go-ahead.

A single real moment, small amounts, **mainnet** (Intents has no testnet). None of this is run by the agents. The code never signs: you send the deposit yourself from your wallet.

## 0. Green light
Nothing happens until you have written a green light in `docs/BESOINS_HUMAIN.md` (section "Feux verts demandés", green lights), for example: "Intents green light: 1 NEAR maximum, wNEAR(near) -> USDC(base), account X, date". Code cap: 5 USD per operation (`maxUsd`).

## 1. Prepare (free)
- A **mainnet dev** NEAR account, separate from your main accounts, with about 2 NEAR (1 NEAR for the swap + gas fees). A wallet that lets you **transfer wNEAR** or do an `ft_transfer` (see the note below).
- A valid destination address on the target chain (e.g. an EVM address on Base, correct EIP-55 casing, otherwise the API answers "recipient is not valid").
- Optional: partner key at https://partners.near-intents.org -> `INTENTS_JWT` (sent in the `X-API-Key` header, never logged). Without a key, fees are slightly higher.
- `npm install`, Node >= 22.22.2.

## 2. Verify without spending anything (public dry run)
```
INTENTS_ENABLED=true npx tsx intents/demo.ts tokens
INTENTS_ENABLED=true npx tsx intents/demo.ts dry wNEAR near USDC base 1000000000000000000000000 <your_account.near> <destination_0x_address>
```
You get `amountOut`, `minAmountOut`, `appFeeBps`. Real example observed on 2026-11-09: 1 wNEAR (3.55 USD) -> 3,532,493 USDC (6 decimals), `appFeeBps: 20` without a key (the fees.md doc announces 25; we read the real value). If `dry` fails, do not continue.

## 3. Real swap (after the green light)
```
INTENTS_ENABLED=true INTENTS_DRY_ONLY=false npx tsx intents/demo.ts run wNEAR near USDC base 1000000000000000000000000 <your_account.near> <destination_0x_address>
```
The script does: dry:true, then dry:false (displays a **deposit address** valid ~15 min), then waits.
1. From your dev account, send **exactly** the indicated amount of the origin asset to the deposit address (for wNEAR: `ft_transfer` on `wrap.near` to the address, with 1 yocto attached; if the deposit address has no registered NEAR account, a prior `storage_deposit` may be required by the wNEAR contract). A deposit sent after the deadline or of the wrong amount will be refunded (`REFUNDED`) to `refundTo`.
2. Paste the transaction hash into the terminal (if the origin is NEAR, set `NEAR_SENDER_ACCOUNT=<your_account.near>` before launching). The script calls `/v0/deposit/submit` then follows `/v0/status` (PENDING_DEPOSIT -> KNOWN_DEPOSIT_TX -> PROCESSING -> SUCCESS).
3. You will see "Proof accepted" with the destination hash, or "Proof REFUSED: reason". Only an accepted proof can credit anything in Darwin.

## 4. Track and keep the proofs
- Status at any time: `INTENTS_ENABLED=true npx tsx intents/demo.ts status <deposit_address>`.
- Explorers: https://nearblocks.io (NEAR hash), the destination chain's explorer for the target hash. Capture them for the video/post.
- Terminal statuses: SUCCESS, REFUNDED, FAILED, INCOMPLETE_DEPOSIT. If FAILED or INCOMPLETE_DEPOSIT, the funds are refundable: keep the deposit address and the hash, contact Intents support.

## 5. Afterwards
Set `INTENTS_DRY_ONLY` back to its default value (remove the variable). Never commit a key, a test deposit address or a `.env`.

## Code safeguards
INTENTS_ENABLED=false by default; dry:false and submit refused if `INTENTS_DRY_ONLY` != `false`; identical dry:true mandatory before dry:false; 5 USD cap; proof = SUCCESS status of `/v0/status` cross-checked against OUR quote (correlationId, address, recipient, asset, `amountOut >= minAmountOut`, destination hash, no refund); single credit per deposit, refused without a proof issued by `verifyDeposit`.
