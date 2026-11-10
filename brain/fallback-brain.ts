// Brain composite : NEAR AI Cloud d'abord, fournisseur OpenAI-compatible de secours après des échecs RÉPÉTÉS.
// Ne bascule jamais sur un refus de budget (le plafond est commun) ni sur un garde-fou anti-boucle ou une erreur de requête.
import {
  BrainError, type Brain, type BrainRequest, type BrainResponse, type ModelInfo,
} from "../shared/index.ts";

export interface FallbackBrainOptions {
  /** Échecs consécutifs du principal avant bascule (défaut 3). */
  maxConsecutiveFailures?: number;
  /** Une fois basculé, le principal est réessayé après ce délai (défaut 60 s). */
  retryPrimaryAfterMs?: number;
  now?: () => number;
  onWarning?: (w: { code: string; message: string }) => void;
}

/** Erreurs qui indiquent une panne du fournisseur (et non un refus volontaire ou une requête invalide). */
export function isProviderOutage(e: unknown): boolean {
  if (!(e instanceof BrainError)) return false;
  if (e.code === "TIMEOUT" || e.code === "NO_API_KEY") return true;
  if (e.code === "HTTP_ERROR") return e.status === undefined || e.status >= 500 || e.status === 401 || e.status === 402 || e.status === 403;
  if (e.code === "RATE_LIMITED") return e.status === 429; // sans status = garde-fou local, jamais une panne
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

  /** Vrai tant que le secours est utilisé. */
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
      if (this.openedAt !== undefined) { this.openedAt = undefined; this.failures = 0; } // nouvel essai du principal
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
        this.o.onWarning?.({ code: "BRAIN_FALLBACK_ACTIVE", message: `NEAR AI Cloud en échec répété (${this.failures}) : bascule sur le fournisseur de secours` });
      }
    }
    const sec = await this.secondary.defaultModel();
    return this.secondary.complete({ ...req, model: sec });
  }
}
