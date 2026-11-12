// Brain interface: the agents' paid "brain". Two implementations:
//  - MockBrain     (shared/mock/mock-brain.ts): deterministic text, simulated usage, no key.
//  - NearAiBrain   (brain/near-ai-brain.ts, lot L5) : POST {NEARAI_BASE_URL}/chat/completions, auth Bearer.
// The Brain debits NOTHING: it returns `usage`; the engine computes the cost (shared/money.ts costYocto) and debits it.
import type { ModelPrice, Usage } from "./money.ts";

export type BrainPurpose =
  | "execute_task" // execute a won task
  | "validate" // validate a result (if AI validator)
  | "bid" // bidding / pitch decision
  | "letter" // lettre parent -> enfant
  | "mutate" // suggestion of a mutated personality (optional)
  | "other";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BrainRequest {
  agentId: string;
  purpose: BrainPurpose;
  model: string; // model id (gene)
  messages: readonly ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface BrainResponse {
  text: string;
  usage: Usage;
  model: string; // model actually served
  mock: boolean; // true for MockBrain: the UI and the journal display it
  /** Response id (chat_id) for possible attestation/signature. */
  responseId?: string;
}

export interface ModelInfo extends ModelPrice {
  id: string;
  contextLength?: number;
  /** true if `/v1/models` confirmed it (NearAiBrain); MockBrain: always true for its ids. */
  verified: boolean;
}

export class BrainError extends Error {
  constructor(
    public code: "NO_API_KEY" | "UNKNOWN_MODEL" | "HTTP_ERROR" | "RATE_LIMITED" | "BAD_RESPONSE" | "TIMEOUT" | "BUDGET_EXHAUSTED",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "BrainError";
  }
}

export interface Brain {
  readonly kind: "mock" | "nearai";
  /** Available models with prices (GET /v1/models for the real one). Cached by the implementation. */
  listModels(): Promise<ModelInfo[]>;
  /** Verified default model (NEARAI_MODEL config, otherwise the first valid model). */
  defaultModel(): Promise<string>;
  complete(req: BrainRequest): Promise<BrainResponse>;
}
