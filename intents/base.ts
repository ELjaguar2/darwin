// Logique commune au client réel et au mock : verrous, « dry avant live », plafond USD, attente de statut.
// Les sous-classes ne fournissent que le transport (4 appels). Tout verrou est donc testé une seule fois, mock compris.
import type { Config, Journal } from "../shared/index.ts";
import { DEFAULT_MAX_USD, IntentsGuardError, assertEnabled, assertLive, quoteKey } from "./guard.ts";
import {
  TERMINAL_STATUSES,
  type DepositQuote, type DryQuote, type IntentsClient, type QuoteParams, type QuoteResponse, type StatusResponse, type Token,
} from "./types.ts";

export interface BaseOptions {
  journal?: Journal;
  /** Plafond par opération, en USD (défaut 5). Appliqué au devis dry:true précédant le dry:false. */
  maxUsd?: number;
  /** Comptes utilisés par `quoteDry` (interface shared, qui n'a pas d'adresses). Devis seulement, jamais de dépôt. */
  defaultRefundTo?: string;
  defaultRecipient?: string;
  now?: () => Date;
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
  if (!/^[1-9]\d*$/.test(p.amountIn)) throw new IntentsGuardError("amountIn doit être un entier décimal > 0 (plus petite unité).");
  if (!p.refundTo || !p.recipient) throw new IntentsGuardError("refundTo et recipient sont obligatoires.");
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

/** Trouve un actif dans la liste renvoyée par /v0/tokens (on ne construit jamais un assetId à la main). */
export function findToken(tokens: Token[], symbol: string, blockchain: string): Token | undefined {
  return tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase() && t.blockchain === blockchain);
}

export abstract class BaseIntents implements IntentsClient {
  abstract readonly mock: boolean;
  readonly enabled: boolean;
  protected readonly maxUsd: number;
  protected readonly now: () => Date;
  private readonly dryUsd = new Map<string, number>();
  private readonly issuedAddresses = new Set<string>();

  constructor(protected readonly cfg: Config["intents"], protected readonly opts: BaseOptions = {}) {
    this.enabled = cfg.enabled;
    this.maxUsd = opts.maxUsd ?? DEFAULT_MAX_USD;
    this.now = opts.now ?? (() => new Date());
  }

  // --- transport (à fournir) ---
  protected abstract fetchTokens(): Promise<Token[]>;
  protected abstract postQuote(body: QuoteRequestBody): Promise<QuoteResponse>;
  protected abstract postSubmit(body: { txHash: string; depositAddress: string; memo?: string }): Promise<StatusResponse>;
  protected abstract fetchStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse>;

  async listTokens(): Promise<Token[]> {
    assertEnabled(this.cfg);
    return this.fetchTokens();
  }

  async dryQuote(params: QuoteParams): Promise<DryQuote> {
    assertEnabled(this.cfg);
    const response = await this.postQuote(buildQuoteRequest(params, true, this.now()));
    const usd = Number(response.quote.amountInUsd);
    this.dryUsd.set(quoteKey(params), Number.isFinite(usd) ? usd : Number.NaN);
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
    if (!this.dryUsd.has(key)) throw new IntentsGuardError("Un devis dry:true identique doit précéder le devis dry:false.");
    const usd = this.dryUsd.get(key)!;
    if (!Number.isFinite(usd)) throw new IntentsGuardError("Valeur USD du devis dry illisible : refus par prudence.");
    if (usd > this.maxUsd) throw new IntentsGuardError(`Montant ${usd} USD > plafond ${this.maxUsd} USD.`);
    const response = await this.postQuote(buildQuoteRequest(params, false, this.now()));
    const depositAddress = response.quote.depositAddress;
    if (!depositAddress) throw new IntentsGuardError("Réponse dry:false sans depositAddress.");
    this.issuedAddresses.add(depositAddress);
    return { params, response, depositAddress, depositMemo: response.quote.depositMemo, mock: this.mock };
  }

  async submitDeposit(q: DepositQuote, txHash: string): Promise<StatusResponse> {
    assertLive(this.cfg);
    if (!this.issuedAddresses.has(q.depositAddress)) throw new IntentsGuardError("Adresse de dépôt inconnue de cette instance.");
    if (!txHash.trim()) throw new IntentsGuardError("txHash vide.");
    return this.postSubmit({ txHash: txHash.trim(), depositAddress: q.depositAddress, ...(q.depositMemo ? { memo: q.depositMemo } : {}) });
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
      if (this.now().getTime() >= deadline) throw new IntentsGuardError(`Délai dépassé, dernier statut ${s.status}.`);
      await sleep(interval);
    }
  }
}
