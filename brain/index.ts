// Point d'entrée du lot L5/L11 : createBrain(config) -> Brain (MockBrain, NearAiBrain, ou NearAiBrain + secours OpenAI-compatible).
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
  /** Reçoit les system.warning (ex. repli de prix, garde-fou). Le backend les émet dans le journal. */
  onWarning?: (w: { code: string; message: string }) => void;
  guardrails?: Partial<Guardrails>;
  /** http:// accepté seulement vers localhost (tests explicites). */
  allowInsecureLocalhost?: boolean;
  /**
   * Appelé UNE fois quand le plafond d'arrêt du budget IA est atteint : le backend arrête la simulation proprement.
   * Les appels suivants lèvent BrainError BUDGET_EXHAUSTED.
   */
  onBudgetExhausted?: (info: { spentEur: number; stopEur: number }) => void;
  /** Budget déjà construit (tests) ; sinon créé dans `<dataDir>` depuis la config. */
  budget?: AiBudget;
}

/** Budget persistant (data/ai-budget.json) + journal d'usage (data/ai-usage.jsonl) selon la config. */
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
 * Mock par défaut. Réel (config.brain === "nearai") :
 *  - NEARAI_API_KEY : NearAiBrain (catalogue /model/list, liste blanche), + secours AI_* si configuré (bascule après échecs répétés) ;
 *  - sans clé NEAR mais avec AI_* : fournisseur OpenAI-compatible seul ;
 *  - sans rien : MockBrain + avertissement BRAIN_NO_KEY.
 * Tout appel réel passe par le budget global (plafond d'arrêt, cumul persistant).
 */
export function createBrain(config: Config, opts: CreateBrainOptions = {}): Brain {
  if (config.brain !== "nearai") return new MockBrain();
  const fb = config.ai.fallback;
  if (!config.nearai.apiKey && !fb) {
    opts.onWarning?.({ code: "BRAIN_NO_KEY", message: "cerveau nearai demandé sans NEARAI_API_KEY : repli sur le cerveau mock" });
    return new MockBrain();
  }
  const budget = opts.budget ?? createBudget(config, opts.onBudgetExhausted);
  // Plafond par run : par défaut le plafond d'arrêt du budget (sinon le plafond historique de 2 USD couperait avant).
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
