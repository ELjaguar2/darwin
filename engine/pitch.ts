// Bid pitch (L18): public sales sentence attached to the bid (`bid.placed.data.bid.pitch`).
// Mock: deterministic pitch tied to the genome, NO AI call (debits and journals of mock runs do not change).
// Real: one small brain call (purpose "bid", <= 120 output tokens), debited from the agent like any AI call, only if the agent
// can afford it while keeping its reserve; brain guardrails (call cap, timeouts) unchanged. Any failure or unusable answer
// (empty, wrong language): fall back to the deterministic pitch, never a bid failure.
// Language (L19): the target language is ALWAYS English, whatever the language of the task.
import { MAX_PITCH_CHARS, costYocto, formatNear, mockPitch, pitchLanguageOk, sanitizePitch, type Agent, type Task } from "../shared/index.ts";
import { bidMessages } from "../brain/prompts.ts";
import { bal, type Ctx } from "./context.ts";
import { chargeBrain, resolveModel, warnOnce } from "./economy.ts";
import { reserve } from "./policy.ts";

const PITCH_MAX_TOKENS = 120;
/** English reference text: forces the mock pitch language, and pitchLanguageOk(pitch, ENGLISH_REFERENCE) rejects a pitch detected as French. */
const ENGLISH_REFERENCE = "This is the work that you need for your team, and it will be delivered with the quality that you expect.";

/** Pitch of an agent for a task, always in English (see the file header). */
export async function makePitch(ctx: Ctx, a: Agent, task: Task, price: bigint): Promise<string> {
  // Always English: the language is forced through the English reference text, not detected from the (possibly foreign) task.
  const fallback = mockPitch(a.genome, { id: task.id, title: task.title, prompt: ENGLISH_REFERENCE });
  const { brain, config } = ctx.deps;
  if (brain.kind === "mock") return fallback;
  try {
    const model = resolveModel(ctx, a);
    const messages = bidMessages(a.genome, { title: task.title, prompt: task.prompt, budgetNear: formatNear(task.budget, 4) }, formatNear(price, 4));
    const promptTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4);
    const worst = costYocto({ promptTokens, completionTokens: PITCH_MAX_TOKENS, reasoningTokens: 0, totalTokens: promptTokens + PITCH_MAX_TOKENS }, model, config.sim.nearUsdRate);
    if (bal(a) - worst < reserve(ctx, a)) return fallback; // too tight: we do not dip into the reserve for one sentence
    const resp = await brain.complete({ agentId: a.id, purpose: "bid", model: model.id, maxTokens: PITCH_MAX_TOKENS, messages });
    await chargeBrain(ctx, a, "bid", resp, model);
    const pitch = sanitizePitch(resp.text, MAX_PITCH_CHARS);
    return pitchLanguageOk(pitch, ENGLISH_REFERENCE) ? pitch : fallback; // always English, whatever the task language
  } catch (e) {
    warnOnce(ctx, "PITCH_FALLBACK", `Fallback pitch (brain unavailable): ${(e as Error).message}`.slice(0, 300));
    return fallback;
  }
}
