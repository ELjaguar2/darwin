// `npm run ai:logo-validation [-- --dry]` : UN SEUL vrai appel NEAR AI sur un brief de logo, par le chemin de code réel
// (executeMessages du catalogue, plafond max_tokens des livrables comme engine/index.ts, garde-fous et budget du Brain,
// extractDeliverable + runChecks du marché). Écrit la réponse brute et les SVG dans <out> (jamais la clé).
// --dry : calcule le pire cas de coût et s'arrête sans appel réseau. Clé : NEARAI_API_KEY (env ou DARWIN_ENV_FILE, défaut .env).
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
if (!config.nearai.apiKey) { console.error("NEARAI_API_KEY absente : rien à valider."); process.exit(2); }

const task = {
  id: "t-logo-validation", profession: "logo" as const, title: "Logo pour Atelier Lumio",
  prompt: "Entreprise : Atelier Lumio\nSecteur : artisanat d'art, luminaires\nStyle souhaité : chaleureux et minimal\nCrée 3 propositions de logo originales pour cette entreprise fictive.",
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
if (!info) { console.error(`modèle ${model} absent du catalogue`); process.exit(2); }
const promptChars = messages.reduce((n, m) => n + m.content.length, 0);
const worstUsd = (Math.ceil(promptChars / 3) * info.usdPerMTokIn + maxTokens * info.usdPerMTokOut) / 1e6;
console.log(`modèle=${model} verified=${info.verified} prix in=${info.usdPerMTokIn} out=${info.usdPerMTokOut} USD/M ; max_tokens demandé=${maxTokens} ; prompt ~${promptChars} car. ; pire cas=${worstUsd.toFixed(5)} USD (plafond par appel 0.05)`);
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
  console.log(`EXTRACTION OK : ${d.files.map((f) => `${f.name} ${f.content.length} car.`).join(", ")} ; contrôles ok=${c.ok} ${c.failures.join(" | ")} ${c.notes.join(" | ")}`);
} catch (e) {
  console.log(`EXTRACTION ECHEC : ${(e as Error).message}`);
  process.exitCode = 1;
}
