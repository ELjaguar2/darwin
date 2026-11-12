// Complete mock implementation of 1Click: no network, deterministic, same locks as the real client (inherited from BaseIntents).
// Everything coming out of here is labelled `mock:true` on DepositQuote/DryQuote and the proof carries `mock:true`.
import type { Config } from "../shared/index.ts";
import { BaseIntents, type BaseOptions, type QuoteRequestBody } from "./base.ts";
import { IntentsGuardError } from "./guard.ts";
import type { QuoteResponse, StatusResponse, SwapStatus, Token } from "./types.ts";

export const MOCK_TOKENS: Token[] = [
  { assetId: "nep141:wrap.near", decimals: 24, blockchain: "near", symbol: "wNEAR", price: 3.5, priceUpdatedAt: "2026-11-09T00:00:00.000Z", contractAddress: "wrap.near" },
  { assetId: "nep141:mock-usdc.near", decimals: 6, blockchain: "near", symbol: "USDC", price: 1, priceUpdatedAt: "2026-11-09T00:00:00.000Z" },
  { assetId: "nep141:mock-usdc-base.omft.near", decimals: 6, blockchain: "base", symbol: "USDC", price: 1, priceUpdatedAt: "2026-11-09T00:00:00.000Z" },
];

export type MockOutcome = "SUCCESS" | "REFUNDED" | "FAILED" | "INCOMPLETE_DEPOSIT";

interface MockSwap {
  quote: QuoteResponse;
  memo?: string;
  deposit?: { txHash: string; amount: string; outcome: MockOutcome; submitted: boolean };
  step: number;
  /** Simulated malicious tampering, to test proof verification. */
  tamper?: { amountOut?: string; recipient?: string };
}

// Global counter: unique identifiers across instances (like the real service).
let globalCounter = 0;
const FEE_BPS = 25; // 0.25% without a key (fees.md)

export class MockIntents extends BaseIntents {
  readonly mock = true;
  private readonly swaps = new Map<string, MockSwap>();

  constructor(cfg: Config["intents"], opts: BaseOptions = {}) { super(cfg, opts); }

  protected async fetchTokens(): Promise<Token[]> { return MOCK_TOKENS.map((t) => ({ ...t })); }

  protected async postQuote(b: QuoteRequestBody): Promise<QuoteResponse> {
    const tin = MOCK_TOKENS.find((t) => t.assetId === b.originAsset);
    const tout = MOCK_TOKENS.find((t) => t.assetId === b.destinationAsset);
    if (!tin || !tout) throw new IntentsGuardError("mock: unknown asset (use the assetIds from listTokens).");
    const amountIn = BigInt(b.amount);
    const scale = (p: number) => BigInt(Math.round(p * 1e6));
    const gross = (amountIn * scale(tin.price) * 10n ** BigInt(tout.decimals)) / (scale(tout.price) * 10n ** BigInt(tin.decimals));
    const out = (gross * BigInt(10_000 - FEE_BPS)) / 10_000n;
    const min = (out * BigInt(10_000 - (b.slippageTolerance))) / 10_000n;
    const usd = (Number(amountIn) / 10 ** tin.decimals) * tin.price;
    const n = ++globalCounter;
    const quote: QuoteResponse["quote"] = {
      amountIn: b.amount, amountInUsd: usd.toFixed(6), minAmountIn: b.amount,
      amountOut: out.toString(), minAmountOut: min.toString(), timeEstimate: 20,
    };
    if (!b.dry) {
      quote.depositAddress = `mock-deposit-${n}`;
      quote.deadline = b.deadline;
    }
    const response: QuoteResponse = {
      correlationId: `mock-corr-${n}`,
      timestamp: this.now().toISOString(),
      quoteRequest: { ...b, appFees: [{ recipient: "mock-fee-recipient", fee: FEE_BPS }] },
      quote,
    };
    if (!b.dry) this.swaps.set(quote.depositAddress!, { quote: response, step: 0 });
    return response;
  }

  // --- test scenario driving ---

  /** Simulates the arrival of an on-chain deposit at the quote's address. */
  simulateDeposit(depositAddress: string, o: { txHash?: string; amount?: string; outcome?: MockOutcome } = {}): void {
    const s = this.must(depositAddress);
    s.deposit = { txHash: o.txHash ?? `mock-tx-${depositAddress}`, amount: o.amount ?? s.quote.quote.amountIn, outcome: o.outcome ?? "SUCCESS", submitted: false };
  }

  /** Tampers with the returned result (a hostile server or a bug): must be rejected by verifyDeposit. */
  tamper(depositAddress: string, t: { amountOut?: string; recipient?: string }): void { this.must(depositAddress).tamper = t; }

  private must(addr: string): MockSwap {
    const s = this.swaps.get(addr);
    if (!s) throw new IntentsGuardError("mock: unknown deposit address (404).");
    return s;
  }

  private status(addr: string, advance: boolean): StatusResponse {
    const s = this.must(addr);
    let st: SwapStatus = "PENDING_DEPOSIT";
    if (s.deposit) {
      if (advance) s.step++;
      st = s.step <= 0 ? "KNOWN_DEPOSIT_TX" : s.step === 1 ? "PROCESSING" : s.deposit.outcome;
    }
    const d = s.deposit;
    const done = st === "SUCCESS";
    const qr = s.tamper?.recipient ? { ...s.quote.quoteRequest, recipient: s.tamper.recipient } : s.quote.quoteRequest;
    return {
      correlationId: s.quote.correlationId,
      quoteResponse: { ...s.quote, quoteRequest: qr },
      status: st,
      updatedAt: this.now().toISOString(),
      swapDetails: {
        intentHashes: done ? [`mock-intent-${addr}`] : [],
        nearTxHashes: done ? [`mock-near-${addr}`] : [],
        originChainTxHashes: d ? [{ hash: d.txHash }] : [],
        destinationChainTxHashes: done ? [{ hash: `mock-dest-${addr}` }] : [],
        depositedAmount: d?.amount,
        amountOut: done ? (s.tamper?.amountOut ?? s.quote.quote.amountOut) : undefined,
        refundedAmount: st === "REFUNDED" ? d?.amount : undefined,
      },
    };
  }

  protected async postSubmit(b: { txHash: string; depositAddress: string }): Promise<StatusResponse> {
    const s = this.must(b.depositAddress);
    if (!s.deposit) throw new IntentsGuardError("mock: no simulated deposit at this address.");
    s.deposit.submitted = true;
    return this.status(b.depositAddress, false);
  }

  protected async fetchStatus(addr: string): Promise<StatusResponse> { return this.status(addr, true); }
}
