# Esquisse : connecteur market.near.ai (V2, non bloquant)

Statut : esquisse, aucun code, hors V1. À vérifier sur https://market.near.ai avant toute implémentation (formats non lus par ce lot).

## Idée
Darwin, côté « client simulé » aujourd'hui, pourrait récupérer de vraies tâches publiées sur le marché d'agents de NEAR (market.near.ai) et laisser un agent Darwin enchérir, exécuter et être payé. Les gains externes entrent dans le solde de l'agent seulement via une preuve (même règle que Intents).

## Interface proposée (`market/` ou `intents/`, au choix du chef de projet)
```ts
interface ExternalMarket {
  readonly enabled: boolean;                 // flag MARKET_NEAR_AI_ENABLED=false par défaut
  listOpen(profession?: Profession): Promise<ExternalTask[]>;   // lecture seule
  bid(task: ExternalTask, agentId: string, price: Yocto): Promise<{ bidId: string }>;
  deliver(bidId: string, result: string): Promise<void>;
  getPayment(bidId: string): Promise<PaymentProof | undefined>; // preuve on-chain, jamais déclarative
}
```
Mapping : `ExternalTask` -> `Task` Darwin (`requester.kind = "external"`, étiqueté), prix converti en yoctoNEAR (éventuellement via un swap 1Click, donc le client de ce lot), `PaymentProof` -> même garde que `verifyDeposit` : paiement vérifié on-chain/API avant tout crédit.

## Étapes
1. Lire la doc/l'API de market.near.ai (auth, format des tâches, paiement).
2. Mock `ExternalMarket` (tâches fixes) branché sur le Market existant.
3. Client réel en lecture seule (listOpen), puis enchères derrière un flag et un feu vert humain.

## Risques
Clé/compte requis (inscrire dans BESOINS_HUMAIN), qualité des tâches réelles, conformité hackathon : le connecteur n'est pas obligatoire (SPECS T-04).
