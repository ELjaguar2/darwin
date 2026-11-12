// Contexte interne partagé par les modules du moteur (état en mémoire + dépendances injectées).
import type { Agent, Deps, Letter, Market, ModelInfo } from "../shared/index.ts";

export interface EngineOptions {
  /** Lance la boucle temporisée (config.sim.tickMs) au start(). Défaut true ; false pour les tests (tick() manuel). */
  autoRun?: boolean;
  /** Émet `chain.tx` pour les transferts du moteur. Défaut : true seulement avec une chaîne mock (NearChain journalise elle-même). */
  emitChainTx?: boolean;
  /** Numéro de départ des identifiants d'agents (a-XXXX). Défaut 0. Utile en testnet : les comptes et le registre du contrat persistent entre deux lancements. */
  agentSeqStart?: number;
  /** Client simulé du marché (gabarits, événements de marché, budgets au prix du métier). Absent : client simple local (tests). */
  simulatedClient?: { tick(tick: number): Promise<unknown> };
}

export interface Ctx {
  deps: Deps;
  market: Market;
  agents: Map<string, Agent>;
  letters: Map<string, Letter>;
  models: ModelInfo[];
  defaultModel: string;
  emitChainTx: boolean;
  tick: number;
  nextAgent: number;
  nextLetter: number;
  /** Dernier tick de reproduction par parent (délai minimal entre deux enfants). */
  lastRepro: Map<string, number>;
  /** Dettes (métabolisme, coût IA) non encore réglées on-chain quand settleEveryTicks > 1. */
  pending: Map<string, bigint>;
  /** Tâches dont l'exécution a déjà été tentée (pas de nouvel essai : l'échéance du marché tranche). */
  attempted: Set<string>;
  warned: Set<string>;
}

export const bal = (a: Agent): bigint => BigInt(a.balance);
