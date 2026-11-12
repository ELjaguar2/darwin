// `npm run ai:english-validation [-- --dry] [--only letter,pitch,deliverable] [--out dir]`: at most THREE real NEAR AI calls, through the real
// code path (createBrain/NearAiBrain with its guardrails and budget, the engine's own prompt builders and caps), to check that the
// production model answers in ENGLISH: (1) parent->child letter (engine/lifecycle.ts letterRequestMessages), (2) bid pitch for a
// task written in FRENCH (engine/pitch.ts messages + sanitizePitch + pitchLanguageOk), (3) marketing deliverable for a French order
// (executeMessages + market extractDeliverable + runChecks). Raw responses (never the key) go to <out>/<step>.json, replayed offline by
// brain/english-validation.test.ts. --dry computes the worst-case cost and makes no chat call. Key: NEARAI_API_KEY (env or DARWIN_ENV_FILE, default .env).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE, loadConfig, MAX_PITCH_CHARS, pitchLanguageOk, sanitizePitch, type Agent, type Task } from "../../shared/index.ts";
import { extractDeliverable } from "../../market/deliverable.ts";
import { runChecks } from "../../market/checks.ts";
import { letterRequestMessages } from "../../engine/lifecycle.ts";
import { ENGLISH_REFERENCE, PITCH_MAX_TOKENS } from "../../engine/pitch.ts";
import { createBrain, executeMessages, NearAiBrain } from "../index.ts";
import { bidMessages } from "../prompts.ts";
import { englishVerdict, languageReport } from "../english-check.ts";

const dry = process.argv.includes("--dry");
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1]! : d; };
const out = arg("--out", "docs/preuves/english-validation");
const only = arg("--only", "letter,pitch,deliverable").split(",");
try { process.loadEnvFile(process.env.DARWIN_ENV_FILE ?? ".env"); } catch { /* environment variables only */ }

const config = loadConfig({ ...process.env, DARWIN_BRAIN: "nearai", DARWIN_MODE: "mock", AI_API_KEY: "", AI_BASE_URL: "", AI_MODEL: "" });
if (!config.nearai.apiKey) { console.error("NEARAI_API_KEY missing: nothing to validate."); process.exit(2); }

let captured: any = null;
let sentBody: any = null;
const recFetch: typeof fetch = async (url, init) => {
  const chat = String(url).endsWith("/chat/completions");
  if (chat) sentBody = JSON.parse(String(init?.body));
  const r = await fetch(url, init);
  if (chat) captured = await r.clone().json().catch(() => null);
  return r;
};
const brain = createBrain(config, { fetch: recFetch, onWarning: (w) => console.error(`[warn] ${w.code}: ${w.message}`) }) as NearAiBrain;
const model = await brain.defaultModel();
const info = (await brain.listModels()).find((m) => m.id === model);
if (!info) { console.error(`model ${model} absent from the catalogue`); process.exit(2); }

// Realistic inputs: English personality of a genome; French visitor task (worst case for the output language).
const genome = { personality: "You are a warm, concise freelance copywriter who values trust and low costs.", profession: "marketing" as const, risk: 0.4, askRatio: 0.7 };
const parent = { id: "a-ada", name: "Ada", generation: 2, birthCapital: 1_000_000_000_000_000_000_000_000n, tasksDone: 7, genome } as unknown as Agent;
const child = { id: "a-blaise", name: "Blaise", generation: 3, birthCapital: 500_000_000_000_000_000_000_000n } as unknown as Agent;
const FR_TASK = { title: "Accroche pour mon café", prompt: "Rédige une accroche et un court texte de présentation pour mon petit café de quartier, ton chaleureux, avec un appel à l'action pour venir goûter notre nouveau cappuccino." };
const mtask = { id: "t-english-validation", profession: "marketing" as const, ...FR_TASK };

type Step = { name: string; purpose: "letter" | "bid" | "execute_task"; maxTokens: number; messages: { role: "system" | "user"; content: string }[] };
const steps = ([
  { name: "letter", purpose: "letter", maxTokens: config.sim.maxTokensPerCall, messages: letterRequestMessages(parent, child, { risk: [0.4, 0.5], askRatio: [0.7, 0.65] }) },
  { name: "pitch", purpose: "bid", maxTokens: PITCH_MAX_TOKENS, messages: bidMessages(genome as any, { title: FR_TASK.title, prompt: FR_TASK.prompt, budgetNear: "0.05" }, "0.0123") },
  { name: "deliverable", purpose: "execute_task", maxTokens: Math.max(config.sim.maxTokensPerCall, CATALOGUE.marketing.maxOutputTokens), messages: executeMessages(genome, mtask) },
] as Step[]).filter((s) => only.includes(s.name));

const worst = (s: Step) => (Math.ceil(s.messages.reduce((n, m) => n + m.content.length, 0) / 3) * info.usdPerMTokIn + s.maxTokens * info.usdPerMTokOut) / 1e6;
const total = steps.reduce((n, s) => n + worst(s), 0);
console.log(`model=${model} (default of the brain = production) verified=${info.verified} price in=${info.usdPerMTokIn} out=${info.usdPerMTokOut} USD/M`);
for (const s of steps) console.log(`  ${s.name}: max_tokens=${s.maxTokens}, worst case=${worst(s).toFixed(5)} USD`);
console.log(`total worst case=${total.toFixed(5)} USD (budget 0.01 USD, per-call cap 0.05)`);
if (dry || total > 0.01 || steps.length > 3) { console.log(dry ? "--dry: no call." : "worst case above budget: abort."); process.exit(dry ? 0 : 1); }

mkdirSync(out, { recursive: true });
let bad = 0, totalCost = 0;
for (const s of steps) {
  captured = null;
  const resp = await brain.complete({ agentId: `english-validation-${s.name}`, purpose: s.purpose, model, maxTokens: s.maxTokens, messages: s.messages });
  const choice = captured?.choices?.[0];
  const cost = (resp.usage.promptTokens * info.usdPerMTokIn + resp.usage.completionTokens * info.usdPerMTokOut) / 1e6;
  totalCost += cost;
  let checked = resp.text;
  const extra: Record<string, unknown> = {};
  if (s.name === "pitch") {
    const pitch = sanitizePitch(resp.text, MAX_PITCH_CHARS);
    extra.sanitized = pitch;
    extra.pitchLanguageOk = pitchLanguageOk(pitch, ENGLISH_REFERENCE);
    checked = pitch;
  } else if (s.name === "deliverable") {
    try {
      const d = extractDeliverable(mtask as Pick<Task, "id" | "profession">, "english-validation", resp.text);
      const c = runChecks(mtask as Pick<Task, "profession" | "prompt">, d);
      extra.extraction = { ok: true, files: d.files.map((f) => ({ name: f.name, chars: f.content.length })) };
      extra.checks = { ok: c.ok, failures: c.failures, notes: c.notes };
      checked = d.files.map((f) => f.content).join("\n");
    } catch (e) { extra.extraction = { ok: false, error: (e as Error).message }; }
  }
  const lang = languageReport(checked);
  const rec = {
    step: s.name, model: resp.model, requestedModel: model, requestMessages: s.messages, maxTokensSent: sentBody?.max_tokens ?? null,
    finishReason: choice?.finish_reason ?? null, usage: captured?.usage ?? null, responseId: resp.responseId ?? null, text: resp.text,
    checkedText: checked, language: lang, short: s.name === "pitch", ...extra, costUsd: cost, priceVerified: info.verified, at: new Date().toISOString(),
  };
  writeFileSync(join(out, `${s.name}.json`), JSON.stringify(rec, null, 2) + "\n");
  const ok = englishVerdict(checked, s.name === "pitch") && extra.pitchLanguageOk !== false;
  if (!ok) bad++;
  console.log(`[${s.name}] english=${ok} en=${lang.englishWords.length} fr=${JSON.stringify(lang.frenchWords)} accents=${lang.accents} finish=${rec.finishReason} tokens=${JSON.stringify(rec.usage)} cost=${cost.toFixed(6)} USD`);
  console.log(`   excerpt: ${checked.replace(/\s+/g, " ").slice(0, 220)}`);
  if (s.name !== "letter") console.log(`   ${JSON.stringify(extra).slice(0, 400)}`);
}
console.log(`total cost=${totalCost.toFixed(6)} USD; ${bad === 0 ? "ALL ENGLISH" : `${bad} NOT ENGLISH`}`);
process.exitCode = bad === 0 ? 0 : 1;
