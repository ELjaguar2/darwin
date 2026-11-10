# PLAN — lots

Statuts : à faire / en cours / en revue / validé / fusionné (dans main)

| Lot | Contenu | Propriétaire | Dépend de | Statut |
|---|---|---|---|---|
| L0 | Specs et grille de conformité | gardien-des-specs | — | validé |
| L1 | Architecture, interfaces, mocks `Chain`/`Brain` | architecte | L0 | validé (réserves R1 appliquées) |
| L2 | Comptes et wallets (mock puis testnet) | dev-comptes-wallets | L1 | fusionné — testnet exécuté en réel le 2026-11-10 (partiel : génération 2, voir docs/PREUVES_TESTNET.md) |
| L3 | Contrats (registre, séquestre, réputation) | dev-contrats | L1 | fusionné — **déployé sur testnet le 2026-11-10** (`darwin-contract-7k2.testnet`), séquestre, registre et réputation appelés en réel ; `refund_escrow` non exercé |
| L4 | Moteur d'évolution | dev-moteur-evolution | L1 | fusionné — calibrage 3 générations OK (graines 1, 42, 99) |
| L5 | Cerveau IA (mock puis NEAR AI Cloud) | dev-cerveau-ia | L1 | fusionné — appels réels faits le 2026-11-10 (C-05 close) ; lot L13 ajoute budget, liste blanche, attestation |
| L6 | Marché des tâches | dev-marche | L1 (L3 pour le séquestre réel) | fusionné |
| L7 | Backend, temps réel, lancement unique | dev-backend | L1, L4 | fusionné |
| L8 | Frontend | dev-frontend | L1, L7 | fusionné |
| L9 | Module Intents (mock, flag off) | dev-intents | L1 | fusionné — aucune opération réelle |
| L10 | Revue sécurité et scan de secrets | securite | chaque lot | passes 1 et 2 faites, aucun bloquant ; historique git à décider (BESOINS_HUMAIN) |
| L11 | README, formulaire, vidéo, post X | redacteur | L7, L8 | fait, rien publié |
| L12 | Recette V1 | qa + gardien-des-specs | tous | QA : PASSE en mock (docs/QA_RAPPORT.md) ; avis final du gardien en cours |
| L13 | Cerveau réel : budget global 8 EUR, liste blanche de modèles bon marché, journal de consommation, attestation TEE, secours OpenAI-compatible | dev-cerveau-ia | L5 | fusionné dans `main` (branche `lot/L11-cerveau-reel`) |
| L14 | Testnet réel : compte maître, déploiement du contrat, runs réels, décalage des ids (`DARWIN_AGENT_SEQ_START`, `DARWIN_TASK_SEQ_START`), marge de financement du marché, réessais 429 | chef-de-projet | L2, L3, L13 | branche `testnet-reel` ; génération 2 et `refund_escrow` prouvés ; génération 3 et mort **non prouvées** |
| **L15 (PROCHAIN)** | **Fiabiliser le RPC testnet puis créer un preset testnet** (détail ci-dessous) | dev-comptes-wallets, dev-backend, dev-moteur-evolution | L14 | à faire |

## Prochain lot : L15

1. **Limite de débit RPC** (le RPC public fastnear renvoie HTTP/JSON-RPC 429 et a arrêté 5 runs sur 7 ; `rpc.testnet.near.org` répond 429 « deprecated ») :
   - nouvelles tentatives avec délai croissant : **premier jet fait** dans `accounts/near-backend.ts` (6 essais, 2 s puis x2 jusqu'à 30 s sur `429`/`rate limit`) ; à compléter (jitter, mêmes règles pour les vues, test unitaire avec un faux backend qui renvoie 429) ;
   - regroupement des appels : réduire les lectures redondantes par tick (soldes, états de compte, lectures de contrat), cache court des `view_account`, lecture groupée quand c'est possible ;
   - fournisseur RPC configurable : la variable `NEAR_RPC_URL` existe déjà ; choisir un autre fournisseur testnet **listé dans la doc NEAR** (https://docs.near.org/api/rpc/providers), vérifier ses limites, documenter dans `.env.example` et le README ; option : liste de secours (`FailoverRpcProvider` de near-api-js) via une variable d'environnement.
2. **Preset testnet** (le preset `demo` testnet plafonne la population à 8 agents, ce qui bloque la génération 3) : créer `testnet` (ou corriger `demo` en mode testnet) avec un plafond de population adapté (essai réel : 14), capital de naissance 0,1 NEAR, métabolisme 0,002, minimum vital 0,02, cooldown de reproduction 5 ticks, client simulé 1,5 tâche/tick, ticks de 10 s ; faire du décalage des ids un comportement automatique (lecture du registre du contrat `agents_count` ou persistance du dernier numéro) au lieu de variables manuelles.
3. **À corriger au passage** : `JUDGE_COST_UNKNOWN` (coût du juge non débité aux agents, il est compté dans le budget global) ; `FC_KEY_NOT_ADDED` (clé function call lue juste après la création du compte) ; aucun test réel de mort d'un agent sur testnet (le `refund_escrow` a été exercé une fois, run 7) ; champ `idea` de `docs/FORMULAIRE.md` (28 caractères de marge) et `docs/VIDEO_SCRIPT.md` à mettre à jour avec ce qui a réellement tourné.
4. **Run final** (section à compléter dans `docs/PREUVES_TESTNET.md`) : 3 générations dans un même run réel, journaux et identifiants de transactions sauvegardés.
