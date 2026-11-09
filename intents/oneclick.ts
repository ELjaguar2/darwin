// Client HTTP 1Click (https://1click.chaindefuser.com). Aucune signature, aucune clé privée : ce code ne déplace jamais de fonds.
// Il demande des devis, annonce un hash de dépôt et lit des statuts. Les méthodes live sont verrouillées dans base.ts.
import type { Config } from "../shared/index.ts";
import { BaseIntents, type BaseOptions, type QuoteRequestBody } from "./base.ts";
import {
  QuoteResponseSchema, StatusResponseSchema, TokenSchema,
  type QuoteResponse, type StatusResponse, type Token,
} from "./types.ts";
import { z } from "zod";

export class IntentsHttpError extends Error {
  constructor(readonly status: number, message: string) { super(`1Click HTTP ${status}: ${message}`); this.name = "IntentsHttpError"; }
}

export interface OneClickOptions extends BaseOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class OneClickIntents extends BaseIntents {
  readonly mock = false;
  private readonly f: typeof fetch;
  private readonly timeoutMs: number;
  private readonly base: string;

  constructor(cfg: Config["intents"], opts: OneClickOptions = {}) {
    super(cfg, opts);
    this.f = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.base = cfg.baseUrl.replace(/\/+$/, "");
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    // Doc authentication.md : le JWT partenaire s'envoie en `X-API-Key`. Jamais journalisé.
    if (this.cfg.jwt) headers["x-api-key"] = this.cfg.jwt;
    let res: Response;
    try {
      res = await this.f(`${this.base}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new Error(`1Click injoignable (${path}) : ${(e as Error).name}`);
    }
    const text = await res.text();
    let json: unknown;
    try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
    if (!res.ok) {
      const msg = typeof (json as { message?: unknown } | undefined)?.message === "string" ? (json as { message: string }).message : text.slice(0, 200);
      throw new IntentsHttpError(res.status, msg);
    }
    return json;
  }

  protected async fetchTokens(): Promise<Token[]> {
    return z.array(TokenSchema).parse(await this.call("GET", "/v0/tokens"));
  }

  protected async postQuote(body: QuoteRequestBody): Promise<QuoteResponse> {
    return QuoteResponseSchema.parse(await this.call("POST", "/v0/quote", body)); // renvoie 201 en pratique
  }

  protected async postSubmit(body: { txHash: string; depositAddress: string; memo?: string }): Promise<StatusResponse> {
    return StatusResponseSchema.parse(await this.call("POST", "/v0/deposit/submit", body));
  }

  protected async fetchStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse> {
    const qs = new URLSearchParams({ depositAddress });
    if (depositMemo) qs.set("depositMemo", depositMemo);
    return StatusResponseSchema.parse(await this.call("GET", `/v0/status?${qs.toString()}`));
  }
}
