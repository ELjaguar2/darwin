# PLAN — lots

Statuts : à faire / en cours / en revue / validé / fusionné (dans main)

| Lot | Contenu | Propriétaire | Dépend de | Statut |
|---|---|---|---|---|
| L0 | Specs et grille de conformité | gardien-des-specs | — | validé |
| L1 | Architecture, interfaces, mocks `Chain`/`Brain` | architecte | L0 | validé (réserves R1 appliquées) |
| L2 | Comptes et wallets (mock puis testnet) | dev-comptes-wallets | L1 | fusionné — testnet jamais exécuté en vrai |
| L3 | Contrats (registre, séquestre, réputation) | dev-contrats | L1 | fusionné — compilé et testé en natif, **non déployé** (échéance 2026-11-11 23:59 UTC) |
| L4 | Moteur d'évolution | dev-moteur-evolution | L1 | fusionné — calibrage 3 générations OK (graines 1, 42, 99) |
| L5 | Cerveau IA (mock puis NEAR AI Cloud) | dev-cerveau-ia | L1 | fusionné — appel réel jamais fait (C-05 ouverte) |
| L6 | Marché des tâches | dev-marche | L1 (L3 pour le séquestre réel) | fusionné |
| L7 | Backend, temps réel, lancement unique | dev-backend | L1, L4 | fusionné |
| L8 | Frontend | dev-frontend | L1, L7 | fusionné |
| L9 | Module Intents (mock, flag off) | dev-intents | L1 | fusionné — aucune opération réelle |
| L10 | Revue sécurité et scan de secrets | securite | chaque lot | passes 1 et 2 faites, aucun bloquant ; historique git à décider (BESOINS_HUMAIN) |
| L11 | README, formulaire, vidéo, post X | redacteur | L7, L8 | fait, rien publié |
| L12 | Recette V1 | qa + gardien-des-specs | tous | QA : PASSE en mock (docs/QA_RAPPORT.md) ; avis final du gardien en cours |
