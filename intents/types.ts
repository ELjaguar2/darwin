// Types of the Intents module (lot L9). Formats checked on 2026-11-09 against
// https://1click.chaindefuser.com/docs/v0/openapi.yaml and by a real dry:true quote (no key, no spending).
import { z } from "zod";
import type { Intents } from "../shared/index.ts";

export const TokenSchema = z.object({
  assetId: z.string(),
  decimals: z.number(),
  blockchain: z.string(),
  symbol: z.string(),
  price: z.number(),
  priceUpdatedAt: z.string(),
  contractAddress: z.string().optional(),
  coingeckoId: z.string().optional(),
}).passthrough();
export type Token = z.infer<typeof TokenSchema>;

export const STATUSES = ["KNOWN_DEPOSIT_TX", "PENDING_DEPOSIT", "INCOMPLETE_DEPOSIT", "PROCESSING", "SUCCESS", "REFUNDED", "FAILED"] as const;
export type SwapStatus = (typeof STATUSES)[number];
export const TERMINAL_STATUSES: readonly SwapStatus[] = ["SUCCESS", "FAILED", "REFUNDED", "INCOMPLETE_DEPOSIT"];

export interface QuoteParams {
  originAsset: string; // assetId returned by /v0/tokens (never built by hand)
  destinationAsset: string;
  amountIn: string; // decimal integer, smallest unit of the origin asset
  /** Refund address on the origin chain. */
  refundTo: string;
  /** Recipient on the destination chain. */
  recipient: string;
  slippageBps?: number; // default 100 (1%)
  deadlineMinutes?: number; // default 15
}

const QuoteRequestSchema = z.object({
  dry: z.boolean(),
  swapType: z.string(),
  originAsset: z.string(),
  destinationAsset: z.string(),
  amount: z.string(),
  refundTo: z.string(),
  recipient: z.string(),
  appFees: z.array(z.object({ recipient: z.string(), fee: z.number() }).passthrough()).optional(),
}).passthrough();

export const QuoteSchema = z.object({
  amountIn: z.string(),
  amountInFormatted: z.string().optional(),
  amountInUsd: z.string().optional(),
  minAmountIn: z.string().optional(),
  amountOut: z.string(),
  amountOutFormatted: z.string().optional(),
  amountOutUsd: z.string().optional(),
  minAmountOut: z.string(),
  timeEstimate: z.number().optional(),
  depositAddress: z.string().optional(),
  depositMemo: z.string().optional(),
  deadline: z.string().optional(),
  timeWhenInactive: z.string().optional(),
}).passthrough();

export const QuoteResponseSchema = z.object({
  correlationId: z.string(),
  timestamp: z.string(),
  signature: z.string().optional(),
  quoteRequest: QuoteRequestSchema,
  quote: QuoteSchema,
}).passthrough();
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

const TxDetails = z.object({ hash: z.string(), explorerUrl: z.string().optional() }).passthrough();
export const SwapDetailsSchema = z.object({
  intentHashes: z.array(z.string()).default([]),
  nearTxHashes: z.array(z.string()).default([]),
  amountIn: z.string().optional(),
  amountOut: z.string().optional(),
  originChainTxHashes: z.array(TxDetails).default([]),
  destinationChainTxHashes: z.array(TxDetails).default([]),
  refundedAmount: z.string().optional(),
  refundReason: z.string().optional(),
  depositedAmount: z.string().optional(),
}).passthrough();
export type SwapDetails = z.infer<typeof SwapDetailsSchema>;

export const StatusResponseSchema = z.object({
  correlationId: z.string(),
  quoteResponse: QuoteResponseSchema,
  status: z.enum(STATUSES),
  updatedAt: z.string(),
  swapDetails: SwapDetailsSchema,
}).passthrough();
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

/** Result of a dry:true quote, enriched (readable fees). */
export interface DryQuote {
  params: QuoteParams;
  response: QuoteResponse;
  /** Sum of the appFees declared in quoteRequest, in basis points (observed: 20 without a key, 2026-11-09). */
  appFeeBps: number;
  mock: boolean;
}

/** dry:false quote: contains a deposit address valid ~ until `quote.deadline`. */
export interface DepositQuote {
  params: QuoteParams;
  response: QuoteResponse;
  depositAddress: string;
  depositMemo?: string;
  mock: boolean;
}

/**
  * VERIFIED deposit proof. Only `verifyDeposit` can build one;
  * `DepositLedger.credit` only accepts this type: no credit without a proof.
 */
declare const verifiedBrand: unique symbol;
export interface VerifiedDeposit {
  readonly [verifiedBrand]: true;
  readonly depositAddress: string;
  readonly correlationId: string;
  readonly recipient: string;
  readonly destinationAsset: string;
  /** Amount actually received at destination (smallest unit). */
  readonly amountOut: string;
  readonly txHashes: readonly string[];
  readonly mock: boolean;
}

export type ProofResult = { accepted: true; proof: VerifiedDeposit } | { accepted: false; reason: string };

/** Extension of `Intents` (shared): the full client. Lock live methods (guard.ts). */
export interface IntentsClient extends Intents {
  readonly mock: boolean;
  listTokens(): Promise<Token[]>;
  /** dry:true quote: no effect, can be called without a key. */
  dryQuote(params: QuoteParams): Promise<DryQuote>;
  /** dry:false quote (deposit address). Requires an identical dry:true beforehand + live lock. */
  requestDepositQuote(params: QuoteParams): Promise<DepositQuote>;
  /** Tells 1Click about the deposit hash (the deposit itself is made by the human, never by this code). Live lock. */
  submitDeposit(q: DepositQuote, txHash: string, opts?: { nearSenderAccount?: string }): Promise<StatusResponse>;
  getStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse>;
  /** Polls /v0/status until a terminal state (or expiry). */
  waitForTerminal(q: DepositQuote, opts?: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> }): Promise<StatusResponse>;
}
