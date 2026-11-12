// Deposit proof: no credit without a verified proof (CLAUDE.md, D-015).
// The proof NEVER comes from the user (announced hash): it comes from /v0/status, cross-checked against the quote we obtained ourselves.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DepositQuote, ProofResult, StatusResponse, VerifiedDeposit } from "./types.ts";

const issued = new WeakSet<object>();

function big(v: string | undefined): bigint | undefined {
  if (v === undefined || !/^\d+$/.test(v)) return undefined;
  return BigInt(v);
}

/**
  * Checks that a status proves the delivery of quote `quote`. Refuses everything except a consistent SUCCESS:
  *  - SUCCESS status (REFUNDED, FAILED, PROCESSING... = refusal);
  *  - correlationId and deposit address identical to our quote;
  *  - recipient and destination asset identical to those requested;
  *  - received amount >= the quote's minAmountOut (strict decimal integer);
  *  - at least one destination transaction (non-empty hash);
  *  - no associated refund.
 */
export function verifyDeposit(quote: DepositQuote, status: StatusResponse, opts: { mock: boolean }): ProofResult {
  const no = (reason: string): ProofResult => ({ accepted: false, reason });
  if (status.status !== "SUCCESS") return no(`status ${status.status} != SUCCESS`);
  // All identifiers must be present AND equal to those of our quote.
  if (!status.correlationId || !status.quoteResponse?.correlationId || !quote.response.correlationId) return no("correlationId missing");
  if (status.correlationId !== quote.response.correlationId || status.quoteResponse.correlationId !== quote.response.correlationId) {
    return no("correlationId differs from the quote");
  }
  if (status.quoteResponse.quote.depositAddress !== quote.depositAddress) return no("deposit address differs from the quote");
  const req = status.quoteResponse.quoteRequest;
  if (req.recipient !== quote.params.recipient) return no("recipient differs from the request");
  if (req.destinationAsset !== quote.params.destinationAsset) return no("destination asset differs from the request");
  if (req.originAsset !== quote.params.originAsset) return no("origin asset differs from the request");
  const out = big(status.swapDetails.amountOut);
  if (out === undefined) return no("amountOut missing or not an integer");
  const min = big(quote.response.quote.minAmountOut);
  if (min === undefined) return no("quote minAmountOut unreadable");
  if (out < min) return no("received amount < minAmountOut");
  const refunded = big(status.swapDetails.refundedAmount);
  if (refunded !== undefined && refunded > 0n) return no("partial refund present");
  const hashes = [
    ...status.swapDetails.destinationChainTxHashes.map((t) => t.hash),
    ...status.swapDetails.nearTxHashes,
  ].filter((h) => h.length > 0);
  if (hashes.length === 0) return no("no transaction hash");
  const proof = Object.freeze({
    depositAddress: quote.depositAddress,
    correlationId: quote.response.correlationId,
    recipient: quote.params.recipient,
    destinationAsset: quote.params.destinationAsset,
    amountOut: out.toString(),
    txHashes: Object.freeze(hashes),
    mock: opts.mock,
  }) as unknown as VerifiedDeposit;
  issued.add(proof);
  return { accepted: true, proof };
}

export function isIssuedProof(p: unknown): p is VerifiedDeposit {
  return typeof p === "object" && p !== null && issued.has(p);
}

/** Credit ledger: accepts only proofs issued by `verifyDeposit`, once per deposit. */
export class DepositLedger {
  private readonly credited = new Map<string, { amountOut: string; mock: boolean }>();

  /** `file` (e.g. data/intents-credits.json, git-ignored): atomic persistence, idempotence survives restarts. */
  constructor(private readonly file?: string) {
    if (file && existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, { amountOut: string; mock: boolean }>;
      for (const [k, v] of Object.entries(raw)) this.credited.set(k, v);
    }
  }

  private persist(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.credited)), "utf8");
    renameSync(tmp, this.file);
  }

  credit(proof: VerifiedDeposit): { credited: boolean; amountOut: string; reason?: string } {
    if (!isIssuedProof(proof)) throw new Error("Credit refused: proof not issued by verifyDeposit.");
    const key = `${proof.depositAddress}|${proof.correlationId}`;
    if (this.credited.has(key)) return { credited: false, amountOut: proof.amountOut, reason: "already credited" };
    this.credited.set(key, { amountOut: proof.amountOut, mock: proof.mock });
    try { this.persist(); } catch (e) { this.credited.delete(key); throw e; } // no unpersisted credit
    return { credited: true, amountOut: proof.amountOut };
  }

  get size(): number { return this.credited.size; }
  has(depositAddress: string, correlationId: string): boolean { return this.credited.has(`${depositAddress}|${correlationId}`); }
}
