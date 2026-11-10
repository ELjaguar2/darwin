// Tests L11 : liste blanche /model/list, budget persistant, journal d'usage, secours OpenAI-compatible. Aucun réseau, aucune clé réelle.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createRuntime } from "../backend/runtime.ts";
import { BrainError, MockBrain, loadConfig, redactConfig } from "../shared/index.ts";
import {
  AiBudget, FallbackBrain, MODEL_WHITELIST, NearAiBrain, createBrain, extraBodyFor, parseModelList, readUsage, whitelistFallbackModels,
} from "./index.ts";
import { usageReport } from "./tools/usage-report.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "darwin-l11-"));
const px = (usdPerM: number) => ({ amount: Math.round(usdPerM * 1000), scale: 9, currency: "USD" });
const entry = (id: string, i: number, o: number, att = false, feats: string[] = []) => ({
  modelId: id, inputCostPerToken: px(i), outputCostPerToken: px(o),
  metadata: { attestationSupported: att, contextLength: 1000, architecture: { outputModalities: ["text"] }, supportedFeatures: feats },
});
const CATALOG = {
  models: [
    entry("Qwen/Qwen3.8-27B", 0.04, 1.35, true, ["reasoning"]),
    entry("openai/gpt-5-nano", 0.05, 0.4),
    entry("anthropic/claude-fable-5", 10, 50), // hors liste blanche et > 1 USD/M
    entry("not/whitelisted", 0.01, 0.01),
  ],
};
const chatOk = (over: Record<string, unknown> = {}) => ({
  id: "chatcmpl-x", model: "openai/gpt-5-nano", choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1000, completion_tokens: 1000, total_tokens: 2000 }, ...over,
});

function fetcher(chat: () => Response, catalog: () => Response = () => Response.json(CATALOG)) {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    if (url.endsWith("/model/list")) return catalog();
    if (url.endsWith("/chat/completions")) return chat();
    return new Response("nf", { status: 404 });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const budgetOf = (dir: string, stopEur = 8, extra: Partial<ConstructorParameters<typeof AiBudget>[0]> = {}) =>
  new AiBudget({ dir, stopEur, totalEur: 10, eurUsdRate: 1.1, ...extra });
const mkBrain = (f: typeof fetch, budget?: AiBudget, extra: Record<string, unknown> = {}) =>
  new NearAiBrain({ baseUrl: "https://cloud-api.near.ai/v1", apiKey: "sk-test", timeoutMs: 500, fetch: f, sleep: async () => {}, catalog: "model-list", budget, ...extra });
const req = (over = {}) => ({ agentId: "a-1", purpose: "execute_task" as const, model: "openai/gpt-5-nano", messages: [{ role: "user" as const, content: "salut" }], ...over });

describe("catalogue /model/list et liste blanche", () => {
  it("convertit {amount,scale} en USD/M, ne garde que la liste blanche, jamais > 1 USD/M, repère le TEE", () => {
    const p = parseModelList(CATALOG);
    expect(p.models.map((m) => m.id).sort()).toEqual(["Qwen/Qwen3.8-27B", "openai/gpt-5-nano"]);
    const q = p.models.find((m) => m.id === "Qwen/Qwen3.8-27B")!;
    expect(q.usdPerMTokIn).toBeCloseTo(0.04, 9);
    expect(q.usdPerMTokOut).toBeCloseTo(1.35, 9);
    expect(p.attestation.has("Qwen/Qwen3.8-27B")).toBe(true);
    expect(p.attestation.has("openai/gpt-5-nano")).toBe(false);
    // même si on l'autorise explicitement, un modèle > 1 USD/M en entrée est exclu
    const forced = parseModelList(CATALOG, ["anthropic/claude-fable-5"]);
    expect(forced.models).toEqual([]);
    expect(forced.skipped[0]!.reason).toMatch(/> 1 USD/);
  });
  it("la liste blanche respecte le plafond d'entrée et ses prix de repli sont cohérents", () => {
    expect(MODEL_WHITELIST.length).toBeGreaterThanOrEqual(7);
    for (const m of MODEL_WHITELIST) expect(m.usdPerMTokIn).toBeLessThanOrEqual(1);
    expect(whitelistFallbackModels().every((m) => !m.verified)).toBe(true);
    expect(extraBodyFor("openai/gpt-5-nano")).toEqual({ reasoning_effort: "minimal" });
    expect(extraBodyFor("inconnu")).toEqual({});
  });
  it("prix dynamiques du catalogue prioritaires ; repli sur la liste blanche si le catalogue échoue", async () => {
    const dir = tmp();
    const dyn = fetcher(() => Response.json(chatOk()), () => Response.json({ models: [entry("openai/gpt-5-nano", 0.07, 0.9)] }));
    const b = mkBrain(dyn.f, budgetOf(dir));
    expect((await b.listModels()).map((m) => [m.id, m.usdPerMTokIn, m.verified])).toEqual([["openai/gpt-5-nano", 0.07, true]]);
    const warns: string[] = [];
    const down = fetcher(() => Response.json(chatOk()), () => new Response("x", { status: 500 }));
    const b2 = mkBrain(down.f, budgetOf(tmp()), { onWarning: (w: { code: string }) => warns.push(w.code) });
    const ms = await b2.listModels();
    expect(ms.length).toBe(MODEL_WHITELIST.length);
    expect(ms.every((m) => !m.verified)).toBe(true);
    expect(warns).toContain("BRAIN_PRICES_FALLBACK");
  });
  it("un modèle hors liste blanche (gène périmé) est remplacé, jamais appelé tel quel", async () => {
    const bodies: any[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/model/list")) return Response.json(CATALOG);
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json(chatOk());
    }) as unknown as typeof fetch;
    const b = mkBrain(f, budgetOf(tmp()));
    await b.complete(req({ model: "anthropic/claude-fable-5" }));
    expect(["Qwen/Qwen3.8-27B", "openai/gpt-5-nano"]).toContain(bodies[0].model);
    expect(bodies[0].model).not.toBe("anthropic/claude-fable-5");
  });
  it("envoie les paramètres de limitation du raisonnement propres au modèle", async () => {
    const bodies: any[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/model/list")) return Response.json(CATALOG);
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json(chatOk());
    }) as unknown as typeof fetch;
    await mkBrain(f, budgetOf(tmp())).complete(req());
    expect(bodies[0].reasoning_effort).toBe("minimal");
  });
});

describe("budget IA global", () => {
  it("journalise chaque appel (modèle, tokens, USD/EUR, horodatage, id de réponse) et cumule en USD", async () => {
    const dir = tmp();
    const { f } = fetcher(() => Response.json(chatOk()));
    const b = mkBrain(f, budgetOf(dir));
    await b.complete(req());
    const recs = readUsage(join(dir, "ai-usage.jsonl"));
    expect(recs).toHaveLength(1);
    const r = recs[0]!;
    expect(r).toMatchObject({ model: "openai/gpt-5-nano", promptTokens: 1000, completionTokens: 1000, responseId: "chatcmpl-x", provider: "nearai", agentId: "a-1" });
    expect(r.costUsd).toBeCloseTo((1000 * 0.05 + 1000 * 0.4) / 1e6, 10);
    expect(r.costEur).toBeCloseTo(r.costUsd / 1.1, 10);
    expect(Date.parse(r.ts)).not.toBeNaN();
    expect(JSON.stringify(readFileSync(join(dir, "ai-usage.jsonl"), "utf8"))).not.toContain("sk-test");
  });
  it("cumul persistant : un redémarrage retrouve le total, et reconstruit depuis le journal si le compteur est corrompu", async () => {
    const dir = tmp();
    const { f } = fetcher(() => Response.json(chatOk()));
    await mkBrain(f, budgetOf(dir)).complete(req());
    const spent = budgetOf(dir).state().spentUsd;
    expect(spent).toBeCloseTo(0.00045, 8);
    writeFileSync(join(dir, "ai-budget.json"), "{corrompu");
    expect(budgetOf(dir).state().spentUsd).toBeCloseTo(spent, 10);
  });
  it("plafond atteint : erreur typée BUDGET_EXHAUSTED, aucun appel réseau, onExhausted appelé une seule fois", async () => {
    const dir = tmp();
    writeFileSync(join(dir, "ai-budget.json"), JSON.stringify({ spentUsd: 8 * 1.1 - 0.0001 })); // 0.0001 USD restant
    let n = 0;
    const budget = budgetOf(dir, 8, { onExhausted: () => n++ });
    let chats = 0;
    const { f } = fetcher(() => { chats++; return Response.json(chatOk()); });
    const b = mkBrain(f, budget, { guardrails: { maxCostUsdPerCall: 1 } });
    const e = await b.complete(req({ maxTokens: 400 })).catch((x) => x);
    expect(e).toBeInstanceOf(BrainError);
    expect((e as BrainError).code).toBe("BUDGET_EXHAUSTED");
    await expect(b.complete(req({ agentId: "a-2" }))).rejects.toMatchObject({ code: "BUDGET_EXHAUSTED" });
    expect(chats).toBe(0);
    expect(n).toBe(1);
  });
  it("le dernier appel qui franchit le plafond déclenche l'arrêt, les suivants sont refusés", async () => {
    const dir = tmp();
    writeFileSync(join(dir, "ai-budget.json"), JSON.stringify({ spentUsd: 8 * 1.1 - 0.0004 }));
    let n = 0;
    const budget = budgetOf(dir, 8, { onExhausted: () => n++ });
    const { f } = fetcher(() => Response.json(chatOk({ usage: { prompt_tokens: 100, completion_tokens: 900, total_tokens: 1000 } })));
    const b = mkBrain(f, budget, { guardrails: { maxCostUsdPerCall: 1 } });
    await b.complete(req({ maxTokens: 900 })); // réservation pire cas ~0.00036 < 0.0004 : accepté
    expect(budget.exhausted() || budget.state().spentUsd > 8 * 1.1 - 0.0004).toBe(true);
    await expect(b.complete(req({ agentId: "a-3", maxTokens: 900 }))).rejects.toMatchObject({ code: "BUDGET_EXHAUSTED" });
    expect(n).toBe(1);
  });
  it("incohérence de configuration refusée", () => {
    expect(() => new AiBudget({ dir: tmp(), stopEur: 11, totalEur: 10, eurUsdRate: 1.1 })).toThrow();
    expect(() => loadConfig({ DARWIN_AI_BUDGET_EUR_STOP: "12" })).toThrow(/STOP/);
  });
});

describe("configuration IA", () => {
  it("défauts : 10 EUR de budget, arrêt à 8, 1.10 USD par EUR, pas de secours", () => {
    const c = loadConfig({});
    expect(c.ai).toEqual({ budgetEurTotal: 10, budgetEurStop: 8, eurUsdRate: 1.1, fallback: undefined });
  });
  it("variables DARWIN_AI_BUDGET_EUR_STOP / DARWIN_EUR_USD_RATE et secours AI_* ; clé masquée", () => {
    const c = loadConfig({ DARWIN_AI_BUDGET_EUR_STOP: "5", DARWIN_EUR_USD_RATE: "1.2", AI_BASE_URL: "https://x.example/v1", AI_API_KEY: "secret-ai-key", AI_MODEL: "m" });
    expect(c.ai.budgetEurStop).toBe(5);
    expect(c.ai.eurUsdRate).toBe(1.2);
    expect(c.ai.fallback).toMatchObject({ model: "m", usdPerMTokIn: 1, usdPerMTokOut: 5 });
    expect(JSON.stringify(redactConfig(c))).not.toContain("secret-ai-key");
  });
});

describe("secours OpenAI-compatible", () => {
  const cfgBoth = (dir: string) => loadConfig({
    DARWIN_BRAIN: "nearai", NEARAI_API_KEY: "k", DARWIN_DATA_DIR: dir,
    AI_BASE_URL: "https://alt.example/v1", AI_API_KEY: "alt", AI_MODEL: "alt-model", AI_PRICE_IN_USD_PER_M: "0.5", AI_PRICE_OUT_USD_PER_M: "1",
  });
  const routed = (primary: () => Response, alt: () => Response) => {
    const calls: string[] = [];
    const f = (async (url: string) => {
      calls.push(url);
      if (url.startsWith("https://alt.example")) return alt();
      if (url.endsWith("/model/list")) return Response.json(CATALOG);
      return primary();
    }) as unknown as typeof fetch;
    return { f, calls };
  };
  it("bascule sur le secours après des échecs répétés, avec le prix du secours et le même budget", async () => {
    const dir = tmp();
    const { f, calls } = routed(() => new Response("boom", { status: 503 }), () => Response.json(chatOk({ model: "alt-model", id: "alt-1" })));
    const b = createBrain(cfgBoth(dir), { fetch: f });
    expect(b).toBeInstanceOf(FallbackBrain);
    for (let i = 0; i < 2; i++) await expect(b.complete(req({ agentId: `a-${i}` }))).rejects.toBeInstanceOf(BrainError);
    const r = await b.complete(req({ agentId: "a-9" }));
    expect(r.responseId).toBe("alt-1");
    expect(calls.some((u) => u.startsWith("https://alt.example") && u.endsWith("/chat/completions"))).toBe(true);
    const rec = readUsage(join(dir, "ai-usage.jsonl")).at(-1)!;
    expect(rec).toMatchObject({ provider: "fallback", model: "alt-model" });
    expect(rec.costUsd).toBeCloseTo((1000 * 0.5 + 1000 * 1) / 1e6, 10);
  });
  it("ne bascule jamais sur un refus de budget ni sur le garde-fou local", async () => {
    const dir = tmp();
    writeFileSync(join(dir, "ai-budget.json"), JSON.stringify({ spentUsd: 100 }));
    const { f, calls } = routed(() => Response.json(chatOk()), () => Response.json(chatOk()));
    const b = createBrain(cfgBoth(dir), { fetch: f });
    for (let i = 0; i < 5; i++) await expect(b.complete(req({ agentId: `a-${i}` }))).rejects.toMatchObject({ code: "BUDGET_EXHAUSTED" });
    expect(calls.filter((u) => u.endsWith("/chat/completions"))).toHaveLength(0);
  });
  it("sans clé NEAR AI mais avec AI_* : fournisseur de secours seul ; sans rien : mock", async () => {
    const dir = tmp();
    const c = loadConfig({ DARWIN_BRAIN: "nearai", DARWIN_DATA_DIR: dir, AI_BASE_URL: "https://alt.example/v1", AI_API_KEY: "alt", AI_MODEL: "alt-model" });
    const { f } = routed(() => Response.json(chatOk()), () => Response.json(chatOk({ model: "alt-model" })));
    const b = createBrain(c, { fetch: f });
    expect(b).toBeInstanceOf(NearAiBrain);
    expect((await b.listModels()).map((m) => m.id)).toEqual(["alt-model"]); // pas de dépendance à la liste blanche NEAR
    expect((await b.complete(req({ model: "alt-model" }))).mock).toBe(false);
    expect(createBrain(loadConfig({ DARWIN_BRAIN: "nearai" }))).toBeInstanceOf(MockBrain);
  });
});

describe("rapport de consommation", () => {
  it("produit des tableaux Markdown à partir du journal", async () => {
    const dir = tmp();
    const { f } = fetcher(() => Response.json(chatOk()));
    await mkBrain(f, budgetOf(dir)).complete(req());
    const md = usageReport(readUsage(join(dir, "ai-usage.jsonl")), { stopEur: 8, totalEur: 10 });
    expect(md).toContain("## Consommation IA réelle");
    expect(md).toContain("| openai/gpt-5-nano | nearai | 1 |");
    expect(md).toContain("`chatcmpl-x`");
    expect(usageReport([])).toContain("mode mock");
  });
});

describe("arrêt propre de la simulation à l'atteinte du plafond (backend)", () => {
  it("budget épuisé : appels refusés, system.warning BRAIN_BUDGET_STOP, sim.stopped, aucun crash", async () => {
    const dir = tmp();
    writeFileSync(join(dir, "ai-budget.json"), JSON.stringify({ spentUsd: 8 * 1.1 })); // plafond déjà atteint
    let chats = 0;
    vi.stubGlobal("fetch", (async (url: string) => {
      if (String(url).endsWith("/model/list")) return Response.json(CATALOG);
      chats++;
      return Response.json(chatOk());
    }) as unknown as typeof fetch);
    try {
      const rt = createRuntime(loadConfig({ DARWIN_BRAIN: "nearai", NEARAI_API_KEY: "k", DARWIN_DATA_DIR: dir, DARWIN_PRESET: "demo" }), { autoRun: false });
      const types: string[] = [];
      rt.journal.subscribe((e) => types.push(e.type === "system.warning" ? `w:${(e.data as { code: string }).code}` : e.type));
      await rt.startSim();
      for (let i = 0; i < 12 && rt.engine.getState().running; i++) {
        await rt.engine.tick();
        await new Promise((r) => setTimeout(r, 5));
      }
      expect(chats).toBe(0);
      expect(types).toContain("w:BRAIN_BUDGET_STOP");
      expect(types).toContain("sim.stopped");
      expect(rt.engine.getState().running).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
