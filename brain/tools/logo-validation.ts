// `npm run ai:logo-validation [-- --dry]`: ONE SINGLE real NEAR AI call on a logo brief, through the real code path
// (catalogue executeMessages, deliverable max_tokens cap as in engine/index.ts, Brain guardrails and budget,
// market extractDeliverable + runChecks). Writes the raw response and the SVGs to <out> (never the key).
// --dry: computes the worst-case cost and stops without any network call. Key: NEARAI_API_KEY (env or DARWIN_ENV_FILE, default .env).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE, loadConfig, type Task } from "../../shared/index.ts";
import { extractDeliverable } from "../../market/deliverable.ts";
import { runChecks } from "../../market/checks.ts";
import { createBrain, executeMessages, NearAiBrain } from "../index.ts";

const dry = process.argv.includes("--dry");
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1]! : d; };
const out = arg("--out", "docs/preuves/logo-validation");
const model = arg("--model", "Qwen/Qwen3.6-35B-A3B-FP8");
try { process.loadEnvFile(process.env.DARWIN_ENV_FILE ?? ".env"); } catch { /* variables d'environnement seules */ }

const config = loadConfig({ ...process.env, DARWIN_BRAIN: "nearai", DARWIN_MODE: "mock", AI_API_KEY: "", AI_BASE_URL: "", AI_MODEL: "" });
if (!config.nearai.apiKey) { console.error("NEARAI_API_KEY missing: nothing to validate."); process.exit(2); }

const task = {
  id: "t-logo-validation", profession: "logo" as const, title: "Logo pour Atelier Lumio",
  prompt: "Company: Atelier Lumio\nSector: art crafts, lighting\nDesired style: warm and minimal\nCreate 3 original logo concepts for this fictional company.",
};
const genome = { personality: "Graphiste rigoureux et concis.", profession: "logo" as const };
const messages = executeMessages(genome, task);
const maxTokens = Math.max(config.sim.maxTokensPerCall, CATALOGUE.logo.maxOutputTokens);

let captured: any = null;
let sentMaxTokens: unknown = null;
const recFetch: typeof fetch = async (url, init) => {
  const chat = String(url).endsWith("/chat/completions");
  if (chat) sentMaxTokens = JSON.parse(String(init?.body)).max_tokens;
  const r = await fetch(url, init);
  if (chat) captured = await r.clone().json().catch(() => null);
  return r;
};
const brain = createBrain(config, { fetch: recFetch, onWarning: (w) => console.error(`[warn] ${w.code}: ${w.message}`) }) as NearAiBrain;
const info = (await brain.listModels()).find((m) => m.id === model);
if (!info) { console.error(`model ${model} absent from the catalogue`); process.exit(2); }
const promptChars = messages.reduce((n, m) => n + m.content.length, 0);
const worstUsd = (Math.ceil(promptChars / 3) * info.usdPerMTokIn + maxTokens * info.usdPerMTokOut) / 1e6;
console.log(`model=${model} verified=${info.verified} price in=${info.usdPerMTokIn} out=${info.usdPerMTokOut} USD/M; max_tokens requested=${maxTokens}; prompt ~${promptChars} chars; worst case=${worstUsd.toFixed(5)} USD (per-call cap 0.05)`);
if (dry || worstUsd > 0.05) { console.log(dry ? "--dry : aucun appel." : "pire cas > plafond : abandon."); process.exit(dry ? 0 : 1); }

const resp = await brain.complete({ agentId: "logo-validation", purpose: "execute_task", model, maxTokens, messages });
const choice = captured?.choices?.[0];
const usage = resp.usage;
const meta = {
  model: resp.model, requestedModel: model, finishReason: choice?.finish_reason ?? null, maxTokensSent: sentMaxTokens,
  usage: captured?.usage ?? null, responseId: resp.responseId ?? null,
  costUsd: (usage.promptTokens * info.usdPerMTokIn + usage.completionTokens * info.usdPerMTokOut) / 1e6,
  priceVerified: info.verified, at: new Date().toISOString(),
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "reponse-brute.txt"), resp.text);
writeFileSync(join(out, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
console.log(JSON.stringify(meta));
try {
  const d = extractDeliverable(task as Pick<Task, "id" | "profession">, "logo-validation", resp.text);
  d.files.forEach((f) => writeFileSync(join(out, f.name), f.content));
  const c = runChecks(task as Pick<Task, "profession" | "prompt">, d);
  console.log(`EXTRACTION OK: ${d.files.map((f) => `${f.name} ${f.content.length} chars`).join(", ")}; checks ok=${c.ok} ${c.failures.join(" | ")} ${c.notes.join(" | ")}`);
} catch (e) {
  console.log(`EXTRACTION ECHEC : ${(e as Error).message}`);
  process.exitCode = 1;
}
