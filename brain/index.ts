// Point d'entrée du lot L5 : createBrain(config) -> Brain (MockBrain ou NearAiBrain).
import { MockBrain, type Brain, type Config } from "../shared/index.ts";
import { NearAiBrain, type Guardrails } from "./near-ai-brain.ts";

export * from "./near-ai-brain.ts";
export * from "./pricing.ts";
export * from "./prompts.ts";

export interface CreateBrainOptions {
  fetch?: typeof fetch;
  /** Reçoit les system.warning (ex. repli de prix, garde-fou). Le backend les émet dans le journal. */
  onWarning?: (w: { code: string; message: string }) => void;
  guardrails?: Partial<Guardrails>;
}

/** Mock par défaut ; NearAiBrain seulement si config.brain === "nearai" ET clé présente (sinon mock + avertissement). */
export function createBrain(config: Config, opts: CreateBrainOptions = {}): Brain {
  if (config.brain !== "nearai") return new MockBrain();
  if (!config.nearai.apiKey) {
    opts.onWarning?.({ code: "BRAIN_NO_KEY", message: "cerveau nearai demandé sans NEARAI_API_KEY : repli sur le cerveau mock" });
    return new MockBrain();
  }
  return new NearAiBrain({
    baseUrl: config.nearai.baseUrl,
    apiKey: config.nearai.apiKey,
    model: config.nearai.model,
    timeoutMs: config.nearai.timeoutMs,
    fetch: opts.fetch,
    onWarning: opts.onWarning,
    guardrails: { maxTokensPerCall: config.sim.maxTokensPerCall, ...opts.guardrails },
  });
}
