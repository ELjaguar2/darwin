// MockBrain: deterministic responses (a function of the request), simulated usage (~4 characters per token).
// Lets the whole simulation run without a key; all its responses carry mock:true.
import { BrainError, type Brain, type BrainRequest, type BrainResponse, type ModelInfo } from "../brain.ts";
import { sha256Hex } from "../hash.ts";
import { PROFESSIONS, type Profession } from "../types.ts";
import { mockDeliverable } from "./mock-deliverables.ts";

export const MOCK_MODELS: ModelInfo[] = [
  { id: "mock/small", usdPerMTokIn: 0.1, usdPerMTokOut: 0.3, contextLength: 8192, verified: true },
  { id: "mock/large", usdPerMTokIn: 0.6, usdPerMTokOut: 1.8, contextLength: 32768, verified: true },
];

const tokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

export class MockBrain implements Brain {
  readonly kind = "mock" as const;
  calls = 0;

  async listModels() {
    return MOCK_MODELS.map((m) => ({ ...m }));
  }

  async defaultModel() {
    return MOCK_MODELS[0]!.id;
  }

  async complete(req: BrainRequest): Promise<BrainResponse> {
    if (!MOCK_MODELS.some((m) => m.id === req.model)) throw new BrainError("UNKNOWN_MODEL", `Unknown mock model: ${req.model}`);
    this.calls++;
    const last = req.messages.at(-1)?.content ?? "";
    const prompt = req.messages.map((m) => m.content).join("\n");
    const tag = sha256Hex(`${req.model}|${req.purpose}|${prompt}`).slice(0, 8);
    let text: string;
    switch (req.purpose) {
      case "letter":
        text = `[mock] Dear child, I gave you enough to live on. Work well, do not spend more than you earn, and beware of badly paid tasks. (${tag})`;
        break;
      case "validate": {
        // Profession grid present (L16 judge): a score of 0.8 per criterion; otherwise legacy line format.
        let ids: string[] = [];
        try {
          const o = JSON.parse(last) as { criteria?: { id?: unknown }[] };
          ids = (o.criteria ?? []).map((c) => String(c.id)).filter(Boolean);
        } catch { /* message non JSON */ }
        text = ids.length
          ? JSON.stringify({ scores: Object.fromEntries(ids.map((i) => [i, 0.8])), reason: `[mock] deliverable consistent with the request (${tag})` })
          : `[mock] ACCEPTED score=0.8 raison=answer consistent with the request (${tag})`;
        break;
      }
      case "bid":
        text = `[mock] I can do it quickly and cleanly. (${tag})`;
        break;
      case "mutate":
        text = `[mock] Cautious but curious, variant ${tag}.`;
        break;
      case "execute_task": {
        // The production prompt (brain/prompts.ts) carries the [[PROFESSION:x]] marker: we return a valid deliverable of the right format.
        const m = /\[\[PROFESSION:(\w+)\]\]/.exec(prompt);
        const prof = m && (PROFESSIONS as readonly string[]).includes(m[1]!) ? (m[1] as Profession) : undefined;
        text = prof ? mockDeliverable(prof, last) : `[mock] Result for "${last.slice(0, 60).replace(/\s+/g, " ")}" (${tag})`;
        break;
      }
      default:
        text = `[mock] Result for "${last.slice(0, 60).replace(/\s+/g, " ")}" (${tag})`;
    }
    const promptTokens = tokens(prompt);
    const completionTokens = Math.min(tokens(text), req.maxTokens ?? 1e9);
    const reasoningTokens = 0;
    return {
      text,
      model: req.model,
      mock: true,
      responseId: `mockresp_${tag}`,
      usage: { promptTokens, completionTokens, reasoningTokens, totalTokens: promptTokens + completionTokens + reasoningTokens },
    };
  }
}
