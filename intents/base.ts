// Logic shared by the real client and the mock: locks, "dry before live", USD cap, status waiting.
// Subclasses only provide the transport (4 calls). Every lock is therefore tested once, mock included.
import type { Config, Journal } from "../shared/index.ts";
import { DEFAULT_MAX_USD, IntentsGuardError, assertEnabled, assertLive, quoteKey } from "./guard.ts";
import {
  TERMINAL_STATUSES,
  type DepositQuote, type DryQuote, type IntentsClient, type QuoteParams, type QuoteResponse, type StatusResponse, type Token,
} from "./types.ts";

export interface BaseOptions {
  journal?: Journal;
  /** Cap per operation, in USD (default 5). Applied to the dry:true quote preceding the dry:false. */
  maxUsd?: number;
  /** Accounts used by `quoteDry` (shared interface, which has no addresses). Quote only, never a deposit. */
  defaultRefundTo?: string;
  defaultRecipient?: string;
  now?: () => Date;
  /** Validity period of the prior dry:true quote (default 5 min). */
  dryTtlMs?: number;
}

export interface QuoteRequestBody {
  dry: boolean;
  swapType: "EXACT_INPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType: "ORIGIN_CHAIN";
  recipient: string;
  recipientType: "DESTINATION_CHAIN";
  deadline: string;
}

export function buildQuoteRequest(p: QuoteParams, dry: boolean, now: Date): QuoteRequestBody {
  if (!/^[1-9]\d*$/.test(p.amountIn)) throw new IntentsGuardError("amountIn must be a decimal integer > 0 (smallest unit).");
  if (!p.refundTo || !p.recipient) throw new IntentsGuardError("refundTo and recipient are required.");
  return {
    dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: p.slippageBps ?? 100,
    originAsset: p.originAsset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: p.destinationAsset,
    amount: p.amountIn,
    refundTo: p.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: p.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(now.getTime() + (p.deadlineMinutes ?? 15) * 60_000).toISOString(),
  };
}

/** Finds an asset in the list returned by /v0/tokens (an assetId is never built by hand). */
export function findToken(tokens: Token[], symbol: string, blockchain: string): Token | undefined {
  return tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase() && t.blockchain === blockchain);
}

export abstract class BaseIntents implements IntentsClient {
  abstract readonly mock: boolean;
  readonly enabled: boolean;
  protected readonly maxUsd: number;
  protected readonly now: () => Date;
  private readonly dryUsd = new Map<string, { usd: number; at: number }>();
  private readonly issuedAddresses = new Set<string>();

  constructor(protected readonly cfg: Config["intents"], protected readonly opts: BaseOptions = {}) {
    this.enabled = cfg.enabled;
    this.maxUsd = opts.maxUsd ?? DEFAULT_MAX_USD;
    this.now = opts.now ?? (() => new Date());
  }

  // --- transport (to be provided) ---
  protected abstract fetchTokens(): Promise<Token[]>;
  protected abstract postQuote(body: QuoteRequestBody): Promise<QuoteResponse>;
  protected abstract postSubmit(body: { txHash: string; depositAddress: string; memo?: string; nearSenderAccount?: string }): Promise<StatusResponse>;
  protected abstract fetchStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse>;

  async listTokens(): Promise<Token[]> {
    assertEnabled(this.cfg);
    return this.fetchTokens();
  }

  async dryQuote(params: QuoteParams): Promise<DryQuote> {
    assertEnabled(this.cfg);
    const response = await this.postQuote(buildQuoteRequest(params, true, this.now()));
    const usd = Number(response.quote.amountInUsd);
    this.dryUsd.set(quoteKey(params), { usd: Number.isFinite(usd) ? usd : Number.NaN, at: this.now().getTime() });
    const appFeeBps = (response.quoteRequest.appFees ?? []).reduce((s, f) => s + f.fee, 0);
    this.opts.journal?.emit({
      type: "intents.quote",
      data: {
        dry: true, originAsset: params.originAsset, destinationAsset: params.destinationAsset, amountIn: params.amountIn,
        amountOut: response.quote.amountOut, note: this.mock ? "mock" : `appFeeBps=${appFeeBps}`,
      },
    });
    return { params, response, appFeeBps, mock: this.mock };
  }

  async quoteDry(input: { originAsset: string; destinationAsset: string; amountIn: string }): Promise<{ amountOut?: string; raw: unknown }> {
    const q = await this.dryQuote({
      ...input,
      refundTo: this.opts.defaultRefundTo ?? "near",
      recipient: this.opts.defaultRecipient ?? "near",
    });
    return { amountOut: q.response.quote.amountOut, raw: q.response };
  }

  async requestDepositQuote(params: QuoteParams): Promise<DepositQuote> {
    assertLive(this.cfg);
    const key = quoteKey(params);
    if (!this.dryUsd.has(key)) throw new IntentsGuardError("An identical dry:true quote must precede the dry:false quote.");
    const { usd, at } = this.dryUsd.get(key)!;
    this.dryUsd.delete(key); // single use: a dry:true serves only one dry:false
    if (this.now().getTime() - at > (this.opts.dryTtlMs ?? 300_000)) throw new IntentsGuardError("dry:true quote expired: redo a dry:true.");
    if (!Number.isFinite(usd)) throw new IntentsGuardError("USD value of the dry quote unreadable: refused as a precaution.");
    if (usd > this.maxUsd) throw new IntentsGuardError(`Amount ${usd} USD > cap ${this.maxUsd} USD.`);
    const response = await this.postQuote(buildQuoteRequest(params, false, this.now()));
    // The live quote must strictly match the request and also respect the cap.
    const rq = response.quoteRequest;
    if (rq.dry !== false || rq.originAsset !== params.originAsset || rq.destinationAsset !== params.destinationAsset
      || rq.amount !== params.amountIn || rq.recipient !== params.recipient || rq.refundTo !== params.refundTo
      || response.quote.amountIn !== params.amountIn) {
      throw new IntentsGuardError("The dry:false quote does not match the request (assets, amount, recipient).");
    }
    const liveUsd = Number(response.quote.amountInUsd);
    if (!Number.isFinite(liveUsd)) throw new IntentsGuardError("USD value of the dry:false quote unreadable: refused as a precaution.");
    if (liveUsd > this.maxUsd) throw new IntentsGuardError(`Live quote ${liveUsd} USD > cap ${this.maxUsd} USD.`);
    const depositAddress = response.quote.depositAddress;
    if (!depositAddress) throw new IntentsGuardError("dry:false response without depositAddress.");
    this.issuedAddresses.add(depositAddress);
    return { params, response, depositAddress, depositMemo: response.quote.depositMemo, mock: this.mock };
  }

  async submitDeposit(q: DepositQuote, txHash: string, o: { nearSenderAccount?: string } = {}): Promise<StatusResponse> {
    assertLive(this.cfg);
    if (!this.issuedAddresses.has(q.depositAddress)) throw new IntentsGuardError("Deposit address unknown to this instance.");
    if (!txHash.trim()) throw new IntentsGuardError("txHash vide.");
    return this.postSubmit({ txHash: txHash.trim(), depositAddress: q.depositAddress, ...(q.depositMemo ? { memo: q.depositMemo } : {}), ...(o.nearSenderAccount ? { nearSenderAccount: o.nearSenderAccount } : {}) });
  }

  async getStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse> {
    assertEnabled(this.cfg);
    return this.fetchStatus(depositAddress, depositMemo);
  }

  async waitForTerminal(
    q: DepositQuote,
    o: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
  ): Promise<StatusResponse> {
    const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const interval = o.intervalMs ?? 5000;
    const deadline = this.now().getTime() + (o.timeoutMs ?? 20 * 60_000);
    for (;;) {
      const s = await this.getStatus(q.depositAddress, q.depositMemo);
      if (TERMINAL_STATUSES.includes(s.status)) return s;
      if (this.now().getTime() >= deadline) throw new IntentsGuardError(`Timeout exceeded, last status ${s.status}.`);
      await sleep(interval);
    }
  }
}
