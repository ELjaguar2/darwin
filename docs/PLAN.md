# PLAN — lots

Statuts : à faire / en cours / en revue / validé

| Lot | Contenu | Propriétaire | Dépend de | Statut |
|---|---|---|---|---|
| L0 | Specs et grille de conformité | gardien-des-specs | — | à faire |
| L1 | Architecture, interfaces, mocks `Chain`/`Brain` | architecte | L0 | à faire |
| L2 | Comptes et wallets (mock puis testnet) | dev-comptes-wallets | L1 | à faire |
| L3 | Contrats (registre, séquestre, réputation) | dev-contrats | L1 | à faire |
| L4 | Moteur d'évolution | dev-moteur-evolution | L1 | à faire |
| L5 | Cerveau IA (mock puis NEAR AI Cloud) | dev-cerveau-ia | L1 | à faire |
| L6 | Marché des tâches | dev-marche | L1 (L3 pour le séquestre réel) | à faire |
| L7 | Backend, temps réel, lancement unique | dev-backend | L1, L4 | à faire |
| L8 | Frontend | dev-frontend | L1, L7 (mock) | à faire |
| L9 | Module Intents (mock, flag off) | dev-intents | L1 | à faire |
| L10 | Revue sécurité et scan de secrets | securite | chaque lot | à faire |
| L11 | README, formulaire, vidéo, post X | redacteur | L7, L8 | à faire |
| L12 | Recette V1 | qa + gardien-des-specs | tous | à faire |