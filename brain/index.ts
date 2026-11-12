// Entry point of lot L5/L11: createBrain(config) -> Brain (MockBrain, NearAiBrain, or NearAiBrain + OpenAI-compatible fallback).
import { join } from "node:path";
import { MockBrain, type Brain, type Config } from "../shared/index.ts";
import { AiBudget } from "./budget.ts";
import { FallbackBrain } from "./fallback-brain.ts";
import { NearAiBrain, type Guardrails } from "./near-ai-brain.ts";

export * from "./near-ai-brain.ts";
export * from "./pricing.ts";
export * from "./model-list.ts";
export * from "./budget.ts";
export * from "./fallback-brain.ts";
export * from "./prompts.ts";

export interface CreateBrainOptions {
  fetch?: typeof fetch;
  /** Receives the system.warning events (e.g. price fallback, guardrail). The backend emits them in the journal. */
  onWarning?: (w: { code: string; message: string }) => void;
  guardrails?: Partial<Guardrails>;
  /** http:// accepted only towards localhost (explicit tests). */
  allowInsecureLocalhost?: boolean;
  /**
   * Called ONCE when the stop cap of the AI budget is reached: the backend stops the simulation cleanly.
   * Subsequent calls throw BrainError BUDGET_EXHAUSTED.
   */
  onBudgetExhausted?: (info: { spentEur: number; stopEur: number }) => void;
  /** Already-built budget (tests); otherwise created in `<dataDir>` from the config. */
  budget?: AiBudget;
}

/** Persistent budget (data/ai-budget.json) + usage journal (data/ai-usage.jsonl) according to the config. */
export function createBudget(config: Config, onExhausted?: CreateBrainOptions["onBudgetExhausted"]): AiBudget {
  return new AiBudget({
    dir: config.server.dataDir,
    stopEur: config.ai.budgetEurStop,
    totalEur: config.ai.budgetEurTotal,
    eurUsdRate: config.ai.eurUsdRate,
    onExhausted,
  });
}

/**
 * Mock by default. Real (config.brain === "nearai"):
 *  - NEARAI_API_KEY: NearAiBrain (/model/list catalogue, whitelist), + AI_* fallback if configured (switch after repeated failures);
 *  - no NEAR key but AI_* set: OpenAI-compatible provider alone;
 *  - sans rien : MockBrain + avertissement BRAIN_NO_KEY.
 * Every real call goes through the global budget (stop cap, persistent total).
 */
export function createBrain(config: Config, opts: CreateBrainOptions = {}): Brain {
  if (config.brain !== "nearai") return new MockBrain();
  const fb = config.ai.fallback;
  if (!config.nearai.apiKey && !fb) {
    opts.onWarning?.({ code: "BRAIN_NO_KEY", message: "nearai brain requested without NEARAI_API_KEY: falling back to the mock brain" });
    return new MockBrain();
  }
  const budget = opts.budget ?? createBudget(config, opts.onBudgetExhausted);
  // Per-run cap: by default the budget stop cap (otherwise the historical 2 USD cap would cut earlier).
  const guardrails: Partial<Guardrails> = { maxTokensPerCall: config.sim.maxTokensPerCall, maxUsdPerRun: budget.stopUsd, ...opts.guardrails };
  const common = { fetch: opts.fetch, onWarning: opts.onWarning, allowInsecureLocalhost: opts.allowInsecureLocalhost, guardrails, budget };
  const near = config.nearai.apiKey
    ? new NearAiBrain({
        ...common, baseUrl: config.nearai.baseUrl, apiKey: config.nearai.apiKey, model: config.nearai.model,
        timeoutMs: config.nearai.timeoutMs, catalog: "model-list", provider: "nearai",
      })
    : undefined;
  const secours = fb
    ? new NearAiBrain({
        ...common, baseUrl: fb.baseUrl, apiKey: fb.apiKey, model: fb.model, timeoutMs: config.nearai.timeoutMs, provider: "fallback",
        staticModels: [{ id: fb.model, usdPerMTokIn: fb.usdPerMTokIn, usdPerMTokOut: fb.usdPerMTokOut, verified: true }],
      })
    : undefined;
  if (near && secours) return new FallbackBrain(near, secours, { onWarning: opts.onWarning });
  return (near ?? secours)!;
}
