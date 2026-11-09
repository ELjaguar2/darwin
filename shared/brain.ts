// Interface Brain : le « cerveau » payant des agents. Deux implémentations :
//  - MockBrain     (shared/mock/mock-brain.ts) : texte déterministe, usage simulé, sans clé.
//  - NearAiBrain   (brain/near-ai-brain.ts, lot L5) : POST {NEARAI_BASE_URL}/chat/completions, auth Bearer.
// Le Brain ne débite RIEN : il renvoie `usage` ; l'engine calcule le coût (shared/money.ts costYocto) et le débite.
import type { ModelPrice, Usage } from "./money.ts";

export type BrainPurpose =
  | "execute_task" // exécuter une tâche gagnée
  | "validate" // valider un résultat (si validateur IA)
  | "bid" // décision d'enchère / pitch
  | "letter" // lettre parent -> enfant
  | "mutate" // suggestion de personnalité mutée (optionnel)
  | "other";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BrainRequest {
  agentId: string;
  purpose: BrainPurpose;
  model: string; // id de modèle (gène)
  messages: readonly ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface BrainResponse {
  text: string;
  usage: Usage;
  model: string; // modèle réellement servi
  mock: boolean; // vrai pour MockBrain : l'UI et le journal l'affichent
  /** id de réponse (chat_id) pour attestation/signature éventuelle. */
  responseId?: string;
}

export interface ModelInfo extends ModelPrice {
  id: string;
  contextLength?: number;
  /** vrai si `/v1/models` l'a confirmé (NearAiBrain) ; MockBrain : toujours vrai pour ses ids. */
  verified: boolean;
}

export class BrainError extends Error {
  constructor(
    public code: "NO_API_KEY" | "UNKNOWN_MODEL" | "HTTP_ERROR" | "RATE_LIMITED" | "BAD_RESPONSE" | "TIMEOUT",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "BrainError";
  }
}

export interface Brain {
  readonly kind: "mock" | "nearai";
  /** Modèles disponibles avec prix (GET /v1/models pour la réelle). Mis en cache par l'implémentation. */
  listModels(): Promise<ModelInfo[]>;
  /** Modèle par défaut vérifié (config NEARAI_MODEL sinon premier modèle valide). */
  defaultModel(): Promise<string>;
  complete(req: BrainRequest): Promise<BrainResponse>;
}
