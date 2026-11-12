// `npm run ai:probe`: one tiny real call on each whitelisted model (cost ~0.0003 USD in total, journaled and counted
// in the budget). Requires NEARAI_API_KEY (environment or file pointed to by DARWIN_ENV_FILE, default .env). Never prints the key.
import { loadConfig } from "../../shared/index.ts";
import { createBrain, MODEL_WHITELIST, NearAiBrain } from "../index.ts";

const envFile = process.env.DARWIN_ENV_FILE ?? ".env";
try { process.loadEnvFile(envFile); } catch { /* absent : variables d'environnement seules */ }

const config = loadConfig({ ...process.env, DARWIN_BRAIN: "nearai", DARWIN_MODE: "mock", AI_API_KEY: "", AI_BASE_URL: "", AI_MODEL: "" });
if (!config.nearai.apiKey) {
  console.error("NEARAI_API_KEY missing: nothing to test (mock mode).");
  process.exit(2);
}
const brain = createBrain(config, { onWarning: (w) => console.error(`[warn] ${w.code}: ${w.message}`) }) as NearAiBrain;
const catalog = new Set((await brain.listModels()).map((m) => m.id));
const failed: string[] = [];
for (const w of MODEL_WHITELIST) {
  if (!catalog.has(w.id)) { console.log(`ABSENT  ${w.id} (hors catalogue ou > 1 USD/M)`); failed.push(w.id); continue; }
  try {
    const r = await brain.complete({
      agentId: "probe", purpose: "other", model: w.id, maxTokens: 200,
      messages: [{ role: "user", content: "Reply only with the word OK. Always answer in English." }],
    });
    console.log(`OK      ${w.id}  in=${r.usage.promptTokens} out=${r.usage.completionTokens} raisonnement=${r.usage.reasoningTokens} texte=${JSON.stringify(r.text.slice(0, 30))} servi=${r.model}`);
  } catch (e) {
    console.log(`ECHEC   ${w.id}  ${(e as Error).message.slice(0, 160)}`);
    failed.push(w.id);
  }
}
console.log(`budget : ${JSON.stringify(((brain as unknown) as { opts: { budget: { state(): unknown } } }).opts.budget.state())}`);
if (failed.length) { console.log(`To remove from the whitelist: ${failed.join(", ")}`); process.exitCode = 1; }
