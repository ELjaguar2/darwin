# PLAN â€” lots

Statuts : Ã  faire / en cours / en revue / validÃ©

| Lot | Contenu | PropriÃ©taire | DÃ©pend de | Statut |
|---|---|---|---|---|
| L0 | Specs et grille de conformitÃ© | gardien-des-specs | â€” | Ã  faire |
| L1 | Architecture, interfaces, mocks `Chain`/`Brain` | architecte | L0 | Ã  faire |
| L2 | Comptes et wallets (mock puis testnet) | dev-comptes-wallets | L1 | Ã  faire |
| L3 | Contrats (registre, sÃ©questre, rÃ©putation) | dev-contrats | L1 | Ã  faire |
| L4 | Moteur d'Ã©volution | dev-moteur-evolution | L1 | Ã  faire |
| L5 | Cerveau IA (mock puis NEAR AI Cloud) | dev-cerveau-ia | L1 | Ã  faire |
| L6 | MarchÃ© des tÃ¢ches | dev-marche | L1 (L3 pour le sÃ©questre rÃ©el) | Ã  faire |
| L7 | Backend, temps rÃ©el, lancement unique | dev-backend | L1, L4 | Ã  faire |
| L8 | Frontend | dev-frontend | L1, L7 (mock) | Ã  faire |
| L9 | Module Intents (mock, flag off) | dev-intents | L1 | Ã  faire |
| L10 | Revue sÃ©curitÃ© et scan de secrets | securite | chaque lot | Ã  faire |
| L11 | README, formulaire, vidÃ©o, post X | redacteur | L7, L8 | Ã  faire |
| L12 | Recette V1 | qa + gardien-des-specs | tous | Ã  faire |