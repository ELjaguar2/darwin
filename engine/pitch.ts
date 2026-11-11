// Pitch d'enchère (L18) : phrase de vente publique jointe à l'offre (`bid.placed.data.bid.pitch`).
// Mock : pitch déterministe lié au génome, AUCUN appel IA (les débits et les journaux des runs mock ne changent pas).
// Réel : un petit appel cerveau (purpose "bid", <= 120 tokens de sortie), débité de l'agent comme tout appel IA, uniquement si
// l'agent peut se le payer en gardant sa réserve ; garde-fous du cerveau (plafond d'appels, délais) inchangés. Toute panne ou réponse
// inexploitable (vide, mauvaise langue) : repli sur le pitch déterministe, jamais d'échec d'enchère.
import { MAX_PITCH_CHARS, costYocto, formatNear, mockPitch, pitchLanguageOk, sanitizePitch, type Agent, type Task } from "../shared/index.ts";
import { bidMessages } from "../brain/prompts.ts";
import { bal, type Ctx } from "./context.ts";
import { chargeBrain, resolveModel, warnOnce } from "./economy.ts";
import { reserve } from "./policy.ts";

const PITCH_MAX_TOKENS = 120;

export async function makePitch(ctx: Ctx, a: Agent, task: Task, price: bigint): Promise<string> {
  const fallback = mockPitch(a.genome, task);
  const { brain, config } = ctx.deps;
  if (brain.kind === "mock") return fallback;
  try {
    const model = resolveModel(ctx, a);
    const messages = bidMessages(a.genome, { title: task.title, prompt: task.prompt, budgetNear: formatNear(task.budget, 4) }, formatNear(price, 4));
    const promptTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4);
    const worst = costYocto({ promptTokens, completionTokens: PITCH_MAX_TOKENS, reasoningTokens: 0, totalTokens: promptTokens + PITCH_MAX_TOKENS }, model, config.sim.nearUsdRate);
    if (bal(a) - worst < reserve(ctx, a)) return fallback; // trop juste : on n'entame pas la réserve pour une phrase
    const resp = await brain.complete({ agentId: a.id, purpose: "bid", model: model.id, maxTokens: PITCH_MAX_TOKENS, messages });
    await chargeBrain(ctx, a, "bid", resp, model);
    const pitch = sanitizePitch(resp.text, MAX_PITCH_CHARS);
    return pitchLanguageOk(pitch, `${task.title}. ${task.prompt}`) ? pitch : fallback;
  } catch (e) {
    warnOnce(ctx, "PITCH_FALLBACK", `Pitch de repli (cerveau indisponible) : ${(e as Error).message}`.slice(0, 300));
    return fallback;
  }
}
