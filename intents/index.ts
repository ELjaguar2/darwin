// Entry point of the Intents module (lot L9).
//  - INTENTS_ENABLED!=true (default): disabled stub, `enabled:false`, every method throws IntentsDisabledError, no network call.
//  - enabled + mock mode: MockIntents (no network).
//  - enabled + testnet mode: real 1Click client; dry:false/deposit-submit additionally require INTENTS_DRY_ONLY=false.
import type { Config } from "../shared/index.ts";
import { BaseIntents, type BaseOptions, type QuoteRequestBody } from "./base.ts";
import { IntentsDisabledError } from "./guard.ts";
import { MockIntents } from "./mock-intents.ts";
import { OneClickIntents, type OneClickOptions } from "./oneclick.ts";
import type { IntentsClient, QuoteResponse, StatusResponse, Token } from "./types.ts";

class DisabledIntents extends BaseIntents {
  readonly mock = true;
  protected fetchTokens(): Promise<Token[]> { throw new IntentsDisabledError(); }
  protected postQuote(_b: QuoteRequestBody): Promise<QuoteResponse> { throw new IntentsDisabledError(); }
  protected postSubmit(): Promise<StatusResponse> { throw new IntentsDisabledError(); }
  protected fetchStatus(): Promise<StatusResponse> { throw new IntentsDisabledError(); }
}

export interface CreateIntentsOptions extends OneClickOptions {
  /** Forces the mock even in testnet mode (tests). */
  forceMock?: boolean;
}

export function createIntents(config: Config, opts: CreateIntentsOptions = {}): IntentsClient {
  const cfg = config.intents;
  if (!cfg.enabled) return new DisabledIntents(cfg, opts as BaseOptions);
  if (opts.forceMock || config.mode === "mock") return new MockIntents(cfg, opts);
  return new OneClickIntents(cfg, opts);
}

export { MockIntents, MOCK_TOKENS } from "./mock-intents.ts";
export type { MockOutcome } from "./mock-intents.ts";
export { OneClickIntents, IntentsHttpError } from "./oneclick.ts";
export { findToken, buildQuoteRequest } from "./base.ts";
export { DepositLedger, verifyDeposit, isIssuedProof } from "./proof.ts";
export { IntentsDisabledError, IntentsGuardError, DEFAULT_MAX_USD } from "./guard.ts";
export * from "./types.ts";
