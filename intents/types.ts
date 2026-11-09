// Types du module Intents (lot L9). Formats vérifiés le 2026-11-09 sur
// https://1click.chaindefuser.com/docs/v0/openapi.yaml et par un devis dry:true réel (sans clé, sans dépense).
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
  originAsset: string; // assetId renvoyé par /v0/tokens (jamais construit à la main)
  destinationAsset: string;
  amountIn: string; // entier décimal, plus petite unité de l'actif d'origine
  /** Adresse de remboursement sur la chaîne d'origine. */
  refundTo: string;
  /** Destinataire sur la chaîne de destination. */
  recipient: string;
  slippageBps?: number; // défaut 100 (1 %)
  deadlineMinutes?: number; // défaut 15
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

/** Résultat d'un devis dry:true, enrichi (frais lisibles). */
export interface DryQuote {
  params: QuoteParams;
  response: QuoteResponse;
  /** Somme des appFees déclarés dans quoteRequest, en points de base (observé : 20 sans clé, 2026-11-09). */
  appFeeBps: number;
  mock: boolean;
}

/** Devis dry:false : contient une adresse de dépôt valable ~ jusqu'à `quote.deadline`. */
export interface DepositQuote {
  params: QuoteParams;
  response: QuoteResponse;
  depositAddress: string;
  depositMemo?: string;
  mock: boolean;
}

/**
 * Preuve de dépôt VÉRIFIÉE. Seule `verifyDeposit` peut en fabriquer une ;
 * `DepositLedger.credit` n'accepte que ce type : pas de crédit sans preuve.
 */
declare const verifiedBrand: unique symbol;
export interface VerifiedDeposit {
  readonly [verifiedBrand]: true;
  readonly depositAddress: string;
  readonly correlationId: string;
  readonly recipient: string;
  readonly destinationAsset: string;
  /** Montant effectivement reçu à destination (plus petite unité). */
  readonly amountOut: string;
  readonly txHashes: readonly string[];
  readonly mock: boolean;
}

export type ProofResult = { accepted: true; proof: VerifiedDeposit } | { accepted: false; reason: string };

/** Extension de `Intents` (shared) : le client complet. Les méthodes live sont verrouillées (guard.ts). */
export interface IntentsClient extends Intents {
  readonly mock: boolean;
  listTokens(): Promise<Token[]>;
  /** Devis dry:true : aucun effet, peut être appelé sans clé. */
  dryQuote(params: QuoteParams): Promise<DryQuote>;
  /** Devis dry:false (adresse de dépôt). Exige un dry:true identique avant + verrou live. */
  requestDepositQuote(params: QuoteParams): Promise<DepositQuote>;
  /** Informe 1Click du hash de dépôt (le dépôt lui-même est fait par l'humain, jamais par ce code). Verrou live. */
  submitDeposit(q: DepositQuote, txHash: string): Promise<StatusResponse>;
  getStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse>;
  /** Interroge /v0/status jusqu'à un état terminal (ou expiration). */
  waitForTerminal(q: DepositQuote, opts?: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> }): Promise<StatusResponse>;
}
