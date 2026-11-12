// Composite brain: NEAR AI Cloud first, OpenAI-compatible fallback provider after REPEATED failures.
// Never switches on a budget refusal (the cap is shared), nor on an anti-loop guardrail or a request error.
import {
  BrainError, type Brain, type BrainRequest, type BrainResponse, type ModelInfo,
} from "../shared/index.ts";

export interface FallbackBrainOptions {
  /** Consecutive failures of the primary before switching (default 3). */
  maxConsecutiveFailures?: number;
  /** Once switched, the primary is retried after this delay (default 60 s). */
  retryPrimaryAfterMs?: number;
  now?: () => number;
  onWarning?: (w: { code: string; message: string }) => void;
}

/** Errors that indicate a provider outage (not a deliberate refusal or an invalid request). */
export function isProviderOutage(e: unknown): boolean {
  if (!(e instanceof BrainError)) return false;
  if (e.code === "TIMEOUT" || e.code === "NO_API_KEY") return true;
  if (e.code === "HTTP_ERROR") return e.status === undefined || e.status >= 500 || e.status === 401 || e.status === 402 || e.status === 403;
  if (e.code === "RATE_LIMITED") return e.status === 429; // no status = local guardrail, never an outage
  return false;
}

export class FallbackBrain implements Brain {
  readonly kind = "nearai" as const;
  private failures = 0;
  private openedAt: number | undefined;
  private readonly now: () => number;

  constructor(readonly primary: Brain, readonly secondary: Brain, private readonly o: FallbackBrainOptions = {}) {
    this.now = o.now ?? (() => Date.now());
  }

  /** True while the fallback is in use. */
  get usingSecondary(): boolean {
    return this.openedAt !== undefined && this.now() - this.openedAt < (this.o.retryPrimaryAfterMs ?? 60_000);
  }

  private active(): Brain {
    return this.usingSecondary ? this.secondary : this.primary;
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      return await this.active().listModels();
    } catch {
      return this.secondary.listModels();
    }
  }

  async defaultModel(): Promise<string> {
    try {
      return await this.active().defaultModel();
    } catch {
      return this.secondary.defaultModel();
    }
  }

  async complete(req: BrainRequest): Promise<BrainResponse> {
    if (!this.usingSecondary) {
      if (this.openedAt !== undefined) { this.openedAt = undefined; this.failures = 0; } // new attempt on the primary
      try {
        const r = await this.primary.complete(req);
        this.failures = 0;
        return r;
      } catch (e) {
        if (!isProviderOutage(e)) throw e;
        this.failures++;
        const max = this.o.maxConsecutiveFailures ?? 3;
        if (this.failures < max) throw e;
        this.openedAt = this.now();
        this.o.onWarning?.({ code: "BRAIN_FALLBACK_ACTIVE", message: `NEAR AI Cloud failing repeatedly (${this.failures}): switching to the fallback provider` });
      }
    }
    const sec = await this.secondary.defaultModel();
    return this.secondary.complete({ ...req, model: sec });
  }
}
