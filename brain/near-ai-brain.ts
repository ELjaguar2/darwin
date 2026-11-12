// NearAiBrain : client NEAR AI Cloud (API compatible OpenAI). Ne débite RIEN : renvoie `usage` ; l'engine calcule
// le coût (costYocto) et émet brain.charged. Aucune clé n'est journalisée ni incluse dans un message d'erreur.
// Endpoints (docs.near.ai/cloud/quickstart.md) : POST {baseUrl}/chat/completions (Authorization: Bearer <clé>), GET {baseUrl}/models.
import {
  BrainError, assertValidPrice, costUsd,
  type Brain, type BrainRequest, type BrainResponse, type ModelInfo, type Usage,
} from "../shared/index.ts";
import { FALLBACK_MODELS, FALLBACK_SNAPSHOT_DATE, parseModelsResponse } from "./pricing.ts";
import { MODEL_WHITELIST, extraBodyFor, WHITELIST_SNAPSHOT_DATE, parseModelList, whitelistFallbackModels } from "./model-list.ts";
import type { AiBudget } from "./budget.ts";

export interface Guardrails {
  /** Plafond de max_tokens par appel (config.sim.maxTokensPerCall). */
  maxTokensPerCall: number;
  maxTokensHardCap: number;
  /** Budget maximum par appel, en USD (prompt estimé + max_tokens au prix de sortie). Au-delà : max_tokens réduit, sinon refus. */
  maxCostUsdPerCall: number;
  /** Taille maximale du prompt en caractères (refus au-delà). */
  maxPromptChars: number;
  /** Anti-boucle : au plus `maxCallsPerAgentWindow` appels par agent sur `windowMs`. */
  maxCallsPerAgentWindow: number;
  windowMs: number;
  /** Anti-boucle : même requête identique répétée plus de `maxIdenticalCalls` fois dans la fenêtre = refus. */
  maxIdenticalCalls: number;
  /** Nombre de relances sur 429/5xx/réseau (une seule par défaut, avec attente courte). */
  retries: number;
  /** Plafond GLOBAL de dépense sur la clé de plateforme (crédit réel), en USD : cumulé par run (vie de l'instance). */
  maxUsdPerRun: number;
  /** Idem sur une fenêtre glissante d'une heure. */
  maxUsdPerHour: number;
}

export const DEFAULT_GUARDRAILS: Guardrails = {
  maxTokensPerCall: 400,
  /** Plafond dur d'une demande explicite (livrables du catalogue : logo = 3000). Le plafond de coût par appel s'applique toujours. */
  maxTokensHardCap: 4000,
  maxCostUsdPerCall: 0.05,
  maxPromptChars: 16000,
  maxCallsPerAgentWindow: 30,
  windowMs: 60_000,
  maxIdenticalCalls: 3,
  retries: 1,
  maxUsdPerRun: 2,
  maxUsdPerHour: 1,
};

export interface NearAiBrainOptions {
  baseUrl: string;
  apiKey: string | undefined;
  /** Modèle par défaut souhaité (NEARAI_MODEL) ; vérifié via /models. */
  model?: string;
  timeoutMs: number;
  fetch?: typeof fetch;
  now?: () => number;
  /** Reçoit les system.warning (le backend les branche sur le journal). Jamais de secret dedans. */
  onWarning?: (w: { code: string; message: string }) => void;
  guardrails?: Partial<Guardrails>;
  /** Durée de vie du cache des modèles. */
  modelsTtlMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Autorise http:// uniquement vers localhost/127.0.0.1/[::1] (tests). Sinon https exigé : la clé ne part jamais en clair. */
  allowInsecureLocalhost?: boolean;
  /**
   * Catalogue des modèles : "models" (GET /models, historique) ou "model-list" (GET /model/list : prix {amount,scale}, liste blanche
   * `allowedModels`, repli sur MODEL_WHITELIST). createBrain utilise "model-list" pour NEAR AI Cloud.
   */
  catalog?: "models" | "model-list";
  /** Liste blanche d'ids (catalogue "model-list"). Défaut : MODEL_WHITELIST. */
  allowedModels?: readonly string[];
  /** Modèles fixes (fournisseur OpenAI-compatible de secours sans catalogue de prix) : aucun appel de catalogue. */
  staticModels?: ModelInfo[];
  /** Budget IA global persistant (plafond d'arrêt, journal data/ai-usage.jsonl). */
  budget?: AiBudget;
  /** Étiquette du fournisseur dans le journal d'usage. */
  provider?: "nearai" | "fallback";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Valide NEARAI_BASE_URL : https obligatoire (http seulement vers localhost avec opt-in explicite). Message sans clé. */
export function assertSafeBaseUrl(baseUrl: string, allowInsecureLocalhost = false): void {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new Error("NEARAI_BASE_URL invalide : URL attendue");
  }
  if (u.username || u.password) throw new Error("NEARAI_BASE_URL ne doit pas contenir d'identifiants");
  if (u.protocol === "https:") return;
  if (u.protocol === "http:" && allowInsecureLocalhost && LOCAL_HOSTS.has(u.hostname)) return;
  throw new Error("NEARAI_BASE_URL doit utiliser https:// (la clé API ne doit jamais circuler en clair)");
}

const intOr0 = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);

/** Lecture de `usage` : completion_tokens_details.reasoning_tokens puis alias déprécié reasoning_tokens (D-021). */
export function parseUsage(raw: unknown): Usage {
  const u = (raw ?? {}) as Record<string, any>;
  const promptTokens = intOr0(u.prompt_tokens);
  const completionTokens = intOr0(u.completion_tokens);
  const reasoningTokens = intOr0(u.completion_tokens_details?.reasoning_tokens) || intOr0(u.reasoning_tokens);
  const totalTokens = intOr0(u.total_tokens) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, reasoningTokens, totalTokens };
}

/** Estimation grossière des tokens d'entrée (~3 caractères par token : volontairement pessimiste). */
const estimateTokens = (chars: number) => Math.ceil(chars / 3);

export class NearAiBrain implements Brain {
  readonly kind = "nearai" as const;
  readonly guardrails: Guardrails;
  private readonly f: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private cache: { at: number; models: ModelInfo[]; fromFallback: boolean; reasoning: Set<string>; attestation: Set<string> } | undefined;
  private loading: Promise<NonNullable<NearAiBrain["cache"]>> | undefined;
  private readonly calls = new Map<string, number[]>(); // agentId -> horodatages
  private readonly identical = new Map<string, number[]>(); // hash de requête -> horodatages
  private readonly warned = new Set<string>();

  // Dépense globale : réel cumulé + réservations des appels en vol (pire cas), pour tenir même en concurrence.
  private spentRun = 0;
  private pending = 0;
  private readonly hourLog: { t: number; usd: number }[] = [];

  /** USD dépensés (estimés d'après usage) depuis le démarrage, et sur l'heure glissante. */
  spend(): { run: number; hour: number } {
    return { run: this.spentRun, hour: this.hourSpent() };
  }

  private hourSpent(): number {
    const t = this.now();
    while (this.hourLog.length && t - this.hourLog[0]!.t >= 3_600_000) this.hourLog.shift();
    return this.hourLog.reduce((n, e) => n + e.usd, 0);
  }

  private reserve(worstUsd: number) {
    const g = this.guardrails;
    const hour = this.hourSpent();
    this.opts.budget?.reserve(worstUsd); // BUDGET_EXHAUSTED : plafond persistant, avant tout autre garde-fou
    const over = this.spentRun + this.pending + worstUsd > g.maxUsdPerRun ? "run" : hour + this.pending + worstUsd > g.maxUsdPerHour ? "heure" : undefined;
    if (over) {
      const msg = `plafond global de dépense IA atteint (${over === "run" ? `${g.maxUsdPerRun} USD par run` : `${g.maxUsdPerHour} USD par heure`}) : appel refusé`;
      this.warn("BRAIN_BUDGET_CAP", msg);
      this.opts.budget?.settle(worstUsd);
      throw new BrainError("RATE_LIMITED", `Garde-fou budget : ${msg}`);
    }
    this.pending += worstUsd;
  }

  private settle(worstUsd: number, actualUsd: number, rec?: Parameters<AiBudget["settle"]>[1]) {
    this.opts.budget?.settle(worstUsd, rec);
    this.pending = Math.max(0, this.pending - worstUsd);
    this.spentRun += actualUsd;
    this.hourLog.push({ t: this.now(), usd: actualUsd });
  }

  constructor(private readonly opts: NearAiBrainOptions) {
    assertSafeBaseUrl(opts.baseUrl, opts.allowInsecureLocalhost);
    this.guardrails = { ...DEFAULT_GUARDRAILS, ...opts.guardrails };
    this.f = opts.fetch ?? fetch;
    this.now = opts.now ?? (() => Date.now());
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private warn(code: string, message: string, once = false) {
    if (once) {
      if (this.warned.has(code + message)) return;
      this.warned.add(code + message);
    }
    this.opts.onWarning?.({ code, message });
  }

  private url(path: string) {
    return `${this.opts.baseUrl.replace(/\/+$/, "")}${path}`;
  }

  private async fetchJson(path: string, init: RequestInit): Promise<{ status: number; body: any }> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.opts.timeoutMs);
    try {
      const res = await this.f(this.url(path), { ...init, signal: ctl.signal });
      let body: any = undefined;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      return { status: res.status, body };
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw new BrainError("TIMEOUT", `NEAR AI Cloud : délai dépassé (${this.opts.timeoutMs} ms)`);
      throw new BrainError("HTTP_ERROR", `NEAR AI Cloud : erreur réseau (${(e as Error)?.name ?? "inconnue"})`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async loadModels(): Promise<NonNullable<NearAiBrain["cache"]>> {
    const ttl = this.opts.modelsTtlMs ?? 10 * 60_000;
    if (this.cache && this.now() - this.cache.at < ttl) return this.cache;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (this.opts.staticModels) {
        this.cache = { at: this.now(), models: this.opts.staticModels.map((m) => ({ ...m })), fromFallback: false, reasoning: new Set(), attestation: new Set() };
        return this.cache;
      }
      const modelList = this.opts.catalog === "model-list";
      const allow = this.opts.allowedModels ?? MODEL_WHITELIST.map((m) => m.id);
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        if (this.opts.apiKey) headers.Authorization = `Bearer ${this.opts.apiKey}`;
        const { status, body } = await this.fetchJson(modelList ? "/model/list" : "/models", { method: "GET", headers });
        if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
        const parsed = modelList ? parseModelList(body, allow) : { ...parseModelsResponse(body), attestation: new Set<string>() };
        if (parsed.models.length === 0) throw new Error("aucun modèle exploitable (prix invalides ?)");
        for (const s of parsed.skipped) this.warn("BRAIN_MODEL_SKIPPED", `modèle ${s.id} ignoré : ${s.reason}`, true);
        this.cache = { at: this.now(), models: parsed.models, fromFallback: false, reasoning: parsed.reasoning, attestation: parsed.attestation };
      } catch (e) {
        // Repli documenté : instantané de pricing.ts, marqué verified:false, avec avertissement. Jamais de prix nul.
        const stale = this.cache && !this.cache.fromFallback ? this.cache : undefined;
        const fbDate = modelList ? WHITELIST_SNAPSHOT_DATE : FALLBACK_SNAPSHOT_DATE;
        this.warn("BRAIN_PRICES_FALLBACK", stale
          ? `GET /models a échoué (${(e as Error).message}) : derniers prix connus conservés`
          : `GET /models a échoué (${(e as Error).message}) : prix du repli du ${fbDate}, possiblement périmés`);
        this.cache = stale
          ? { ...stale, at: this.now() }
          : {
              at: this.now(), fromFallback: true, reasoning: new Set(),
              attestation: new Set(MODEL_WHITELIST.filter((m) => m.tee).map((m) => m.id)),
              models: modelList
                ? whitelistFallbackModels(MODEL_WHITELIST.filter((m) => allow.includes(m.id)))
                : FALLBACK_MODELS.map((m) => ({ ...m })),
            };
      }
      return this.cache!;
    })();
    try {
      return await this.loading;
    } finally {
      this.loading = undefined;
    }
  }

  /** Ids de la liste blanche dont le catalogue annonce attestationSupported (TEE). */
  async attestationModels(): Promise<string[]> {
    return [...(await this.loadModels()).attestation];
  }

  async listModels(): Promise<ModelInfo[]> {
    return (await this.loadModels()).models.map((m) => ({ ...m }));
  }

  /** NEARAI_MODEL si valide, sinon le moins cher des modèles SANS raisonnement (sinon le moins cher tout court). */
  async defaultModel(): Promise<string> {
    const c = await this.loadModels();
    const want = this.opts.model;
    if (want) {
      if (c.models.some((m) => m.id === want)) return want;
      this.warn("BRAIN_MODEL_UNKNOWN", `NEARAI_MODEL=${want} absent de /models : modèle par défaut choisi automatiquement`, true);
    }
    const cost = (m: ModelInfo) => m.usdPerMTokIn + m.usdPerMTokOut;
    const sorted = [...c.models].sort((a, b) => cost(a) - cost(b));
    const pick = sorted.find((m) => !c.reasoning.has(m.id)) ?? sorted[0];
    if (!pick) throw new BrainError("UNKNOWN_MODEL", "Aucun modèle disponible");
    return pick.id;
  }

  private checkLoop(req: BrainRequest, promptKey: string) {
    const g = this.guardrails;
    const t = this.now();
    const prune = (a: number[]) => a.filter((x) => t - x < g.windowMs);
    const mine = prune(this.calls.get(req.agentId) ?? []);
    if (mine.length >= g.maxCallsPerAgentWindow) {
      this.calls.set(req.agentId, mine);
      this.warn("BRAIN_LOOP_GUARD", `agent ${req.agentId} : trop d'appels IA (${mine.length}/${g.windowMs} ms), appel refusé`);
      throw new BrainError("RATE_LIMITED", `Garde-fou anti-boucle : ${mine.length} appels en ${g.windowMs} ms pour ${req.agentId}`);
    }
    const key = `${req.agentId}|${req.purpose}|${req.model}|${promptKey}`;
    const same = prune(this.identical.get(key) ?? []);
    if (same.length >= g.maxIdenticalCalls) {
      this.identical.set(key, same);
      this.warn("BRAIN_LOOP_GUARD", `agent ${req.agentId} : requête identique répétée ${same.length} fois, appel refusé`);
      throw new BrainError("RATE_LIMITED", "Garde-fou anti-boucle : requête identique répétée");
    }
    mine.push(t);
    same.push(t);
    this.calls.set(req.agentId, mine);
    this.identical.set(key, same);
  }

  async complete(req: BrainRequest): Promise<BrainResponse> {
    if (!this.opts.apiKey) throw new BrainError("NO_API_KEY", "NEARAI_API_KEY absente : utiliser le mode mock");
    const g = this.guardrails;
    const promptChars = req.messages.reduce((n, m) => n + m.content.length, 0);
    if (promptChars > g.maxPromptChars) throw new BrainError("BAD_RESPONSE", `Prompt trop long (${promptChars} > ${g.maxPromptChars} caractères) : appel refusé`);

    const cat = await this.loadModels();
    let info = cat.models.find((m) => m.id === req.model);
    let model = req.model;
    if (!info) {
      if (cat.fromFallback) throw new BrainError("UNKNOWN_MODEL", `Modèle ${req.model} inconnu (prix indisponibles, repli limité)`);
      model = await this.defaultModel();
      info = cat.models.find((m) => m.id === model);
      this.warn("BRAIN_MODEL_FALLBACK", `modèle ${req.model} absent de /models : repli sur ${model}`, true);
    }
    if (!info) throw new BrainError("UNKNOWN_MODEL", `Modèle ${req.model} inconnu`);
    assertValidPrice(info);
    if (!info.verified) this.warn("BRAIN_PRICE_UNVERIFIED", `prix de ${info.id} issus du repli du ${FALLBACK_SNAPSHOT_DATE} (non vérifiés)`, true);

    // Budget maximum par appel : on réduit max_tokens pour tenir dans maxCostUsdPerCall, sinon on refuse.
    let maxTokens = Math.max(1, Math.min(req.maxTokens ?? g.maxTokensPerCall, Math.max(g.maxTokensPerCall, g.maxTokensHardCap)));
    const promptEst = estimateTokens(promptChars);
    const worst = (mt: number) => costUsd({ promptTokens: promptEst, completionTokens: mt, reasoningTokens: 0, totalTokens: promptEst + mt }, info!);
    if (worst(maxTokens) > g.maxCostUsdPerCall) {
      const room = g.maxCostUsdPerCall - (promptEst * info.usdPerMTokIn) / 1e6;
      const fit = info.usdPerMTokOut > 0 ? Math.floor((room * 1e6) / info.usdPerMTokOut) : 0;
      if (fit < 16) throw new BrainError("BAD_RESPONSE", `Budget par appel dépassé (> ${g.maxCostUsdPerCall} USD) : appel refusé`);
      maxTokens = Math.min(maxTokens, fit);
    }

    this.checkLoop({ ...req, model }, promptChars + ":" + req.messages.map((m) => m.content).join("\u0001"));

    const body: Record<string, unknown> = {
      ...(this.opts.catalog === "model-list" ? extraBodyFor(model) : {}), model, messages: req.messages, max_tokens: maxTokens,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.opts.apiKey}` },
      body: JSON.stringify(body),
    };

    const worstUsd = worst(maxTokens);
    this.reserve(worstUsd);
    let actualUsd = 0;
    let rec: Parameters<AiBudget["settle"]>[1];
    try {
    let last: BrainError | undefined;
    for (let attempt = 0; attempt <= g.retries; attempt++) {
      if (attempt > 0) await this.sleep(500 * attempt);
      let r: { status: number; body: any };
      try {
        r = await this.fetchJson("/chat/completions", init);
      } catch (e) {
        last = e as BrainError;
        continue;
      }
      if (r.status === 429) { last = new BrainError("RATE_LIMITED", "NEAR AI Cloud : limite de débit (429)", 429); continue; }
      if (r.status >= 500) { last = new BrainError("HTTP_ERROR", `NEAR AI Cloud : erreur serveur ${r.status}`, r.status); continue; }
      if (r.status < 200 || r.status >= 300) {
        const msg = typeof r.body?.error?.message === "string" ? r.body.error.message.slice(0, 200) : "";
        throw new BrainError("HTTP_ERROR", `NEAR AI Cloud : HTTP ${r.status} ${msg}`.trim(), r.status);
      }
      const choice = r.body?.choices?.[0];
      const content = choice?.message?.content;
      if (!choice || (content !== null && content !== undefined && typeof content !== "string")) throw new BrainError("BAD_RESPONSE", "Réponse chat/completions inattendue");
      if (!r.body?.usage) {
        // Sans usage on ne peut pas débiter : on ne fabrique pas un coût nul.
        throw new BrainError("BAD_RESPONSE", "Réponse sans champ usage : débit impossible");
      }
      const usage = parseUsage(r.body.usage);
      actualUsd = costUsd(usage, info);
      rec = {
        provider: this.opts.provider ?? "nearai", model, servedModel: typeof r.body.model === "string" ? r.body.model : model,
        promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, reasoningTokens: usage.reasoningTokens,
        costUsd: actualUsd, responseId: typeof r.body.id === "string" ? r.body.id : null, agentId: req.agentId, purpose: req.purpose,
      };
      const text = typeof content === "string" ? content : "";
      if (text === "" ) this.warn("BRAIN_EMPTY_TEXT", `réponse vide de ${model} (finish_reason=${String(choice.finish_reason)}) : tokens de raisonnement épuisés ?`);
      return {
        text,
        usage,
        model: typeof r.body.model === "string" ? r.body.model : model,
        mock: false,
        responseId: typeof r.body.id === "string" ? r.body.id : undefined,
      };
    }
    throw last ?? new BrainError("HTTP_ERROR", "NEAR AI Cloud : échec");
    } finally {
      this.settle(worstUsd, actualUsd, rec);
    }
  }
}
