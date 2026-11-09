# CONFORMITE — grille à cocher

> Propriétaire : gardien-des-specs. Vert = conforme `[x]`, rouge = non conforme ou non vérifiable `[ ]` avec justification. Les identifiants renvoient à `docs/SPECS.md`. Recette V1 du 2026-11-09 sur `main` au commit `4c94c30` : sources officielles relues le jour même (nearhackathon.com et HACKATHON.md, aucun changement constaté). Rien n'est coché sans vérification par le gardien (lecture du code, `npm test`, `npm run typecheck`, `node scripts/check-formulaire.mjs`, `node scripts/scan-secrets.mjs --no-history`, backend lancé en preset demo sur le port 3300 puis arrêté). Rust/`cargo` absent de la machine : aucun test Rust relancé.

## A. Définition de la V1 (CLAUDE.md)
- [ ] Clone neuf + commandes du README = tout tourne (mock sans clé, testnet avec clés) : mock vérifié par la QA sur clone neuf (c99eab0) et par moi sur l'arbre de travail (démarrage, health, POST /api/tasks, tâche `settled`) ; pas de re-clone par moi ; testnet jamais exécuté (pas de clés, Node 22.17.1 < 22.22.2)
- [x] >= 3 générations naissent, travaillent, paient leur IA, se reproduisent, meurent, sans intervention (mock) : `start:demo` lancé par moi, `generations: 3` en ~1 min, 94 `brain.charged`, 45 `escrow.released`, 2 `agent.reproduced`, 2 `letter.written` ; morts : test `engine/simulation.test.ts` (3 générations) et QA (15 morts, `starvation`). Réserve : en testnet non exécuté
- [x] Marché : publication, enchères, séquestre, validation, paiement, réputation (mock) : tâche visiteur `t-0047` publiée, enchère, validée `brain:mock/small`, `settled` ; 45 `reputation.updated`, 6 `subcontract.created` ; code `market/index.ts` `settle()` lu
- [x] Lettres parent -> enfant générées et consultables (événements `letter.written` vérifiés ; endpoint `/api/agents/<id>/letter` vérifié par la QA)
- [ ] Page web en direct : arbre généalogique, soldes, naissances, morts, flux de transactions, formulaire de tâche : code `frontend/` lu (étiquettes d'honnêteté présentes, aucun `innerHTML`), vérifiée dans Chromium par la QA (réserve : panneau « morts » non contrôlé visuellement, puis capture `morts-desktop` ajoutée) ; je n'ai pas rendu la page moi-même
- [x] Tests verts : 183 tests, 10 fichiers, `npm run typecheck` sans erreur (2026-11-09)
- [ ] README conforme, étapes « faites X, vous verrez Y » toutes vérifiées par la QA : QA sur c99eab0 (avant les derniers correctifs) ; écarts README/code ou surpromesses restants listés dans « Avis final V1 » (E1 à E10)
- [ ] Cette grille au vert (ou rouge justifié) : rouge justifié, voir ci-dessous

## B. Exigences officielles : dépôt et livrables (L-xx)
- [ ] L-01 Dépôt public (rendu public par l'humain, avant 2026-11-14 23:59 UTC) avec README reproductible : dépôt local, rien de public ; humain
- [x] L-02 Fichier LICENSE présent à la racine (MIT, revérifié le 2026-11-09 ; HACKATHON.md Q-014 toujours en vigueur)
- [ ] L-03 Démo ouvrable par les juges : installation locale reproductible OK (mock), mais vidéo non enregistrée et dépôt non public ; humain
- [ ] L-04 Si démo hébergée : en ligne au moins jusqu'au 2026-11-18 (idéal 2026-11-25) : aucune démo hébergée prévue ; humain
- [ ] L-05 Post X : brouillon `docs/POST_X.md` contient « Built at NEAR HACKATHON », @NEARProtocol, #NEARHackathon, vidéo jointe (conforme à HACKATHON.md relu) ; non publié ; surpromesse à corriger avant publication (E1, E2) ; humain
- [x] L-07 README : section de divulgation (README §11 : code généré par IA, bibliothèques tierces, code antérieur « aucun », travail NEAR antérieur « aucun », services externes). Réserve : « aucun code antérieur » à confirmer par l'humain (indiqué dans le README)
- [ ] L-07 Si l'humain a un second projet : les deux README se citent (« à remplir par l'humain », README §11) ; humain
- [x] L-08 Historique git cohérent avec la fenêtre : premier commit du 2026-11-09, aucun code antérieur déclaré, aucun tag `pre-hackathon` nécessaire ; le tag `hackathon-submission` est facultatif (à poser par le chef de projet au moment de la soumission)
- [x] L-09 README lisible par machine et humain : produit, problème, architecture, étapes « Do X, you will see Y » (§9) ; étapes 1, 2, 6, 7, 9, 10 rejouées par moi sur le backend réel
- [ ] Tout le code est écrit depuis l'annonce (H-07) : cohérent avec l'historique git, mais attestation de l'humain requise

## C. Exigences officielles : soumission (S-xx), humain uniquement
- [x] S-02 `docs/FORMULAIRE.md` fournit chaque champ conforme (relu contre HACKATHON.md du jour : projectName 2-80, leadName 2-80, email max 160, size `1`/`2 - 4`/`4 - 6`/`6 - 8`/`8+`, tracks ids valides, nearAddress 2-64 mainnet, projectUrl, demoUrl, `idea` 20-2000 ; `check-formulaire.mjs` : 1649 caractères, OK) ; valeurs humaines restent « À FOURNIR »
- [x] S-03 Aucun champ en trop ; `website` laissé vide ; corps < 12000 octets (champ `idea` 1649 car., total très inférieur)
- [x] S-04 Texte de consentement verbatim identique à HACKATHON.md du jour
- [ ] S-07 Le JSON final est affiché à l'humain, qui confirme ; aucune soumission automatique : aucun code ne soumet (recherche de `nearhackathon.com/api` dans le code : rien) ; l'étape reste à faire par l'humain
- [ ] S-08 Compte NEAR mainnet de paiement fourni par l'humain (jamais créé par un agent) ; humain
- [ ] S-01 Soumission effectuée une seule fois avant la clôture ; humain
- [ ] Tracks cochés décidés (recommandation : `swarms`, `agents`, éventuellement `business`, `open`) ; humain (README ligne 5 les annonce déjà : E8)

## D. Exigences officielles : jugement (J-xx)
- [ ] J-01 Un agent IA neuf peut cloner, lancer et reproduire chaque étape du README sans aide : fait par la QA en mock sur c99eab0 ; non refait sur le commit final ; testnet impossible sans clés
- [ ] J-01 Chaque fonction annoncée dans le README existe et fonctionne (pas d'écart README/code) : mock oui ; testnet, contrat déployé, NEAR AI Cloud réel, Intents réel non vérifiables ; écarts de formulation E1 à E10
- [ ] J-03 Les critères indicatifs sont couverts : implémentation technique, design, impact, originalité, durabilité : jugement subjectif, non évalué par le gardien

## E. NEAR AI Cloud (C-xx)
- [ ] C-01 URL par défaut `https://cloud-api.near.ai/v1` (`shared/config.ts:171`), configurable (`NEARAI_BASE_URL`, https obligatoire), `/chat/completions` et `/models` codés et testés avec `fetch` simulé ; aucun appel `chat/completions` réel
- [x] C-02 Auth `Authorization: Bearer` avec clé lue en variable d'environnement (`NEARAI_API_KEY`), jamais en dur (`brain/near-ai-brain.ts`, test `brain.test.ts:78-86` avec fausse clé ; scan de secrets vert)
- [ ] C-04 Prix lus depuis `/v1/models` : champs `pricing.input`/`output` (USD par million de tokens) confirmés par ma lecture de la réponse réelle du jour (`brain/pricing.ts` les lit bien) ; id de modèle vérifié contre la liste, repli `verified:false` avec avertissement. Mais le modèle d'exemple du quickstart `zai-org/GLM-5.1-FP8` n'est plus dans la liste vivante (64 modèles dont `z-ai/glm-5.3-flash`) : le repli du code utilise des ids présents. Reste décoché : jamais exécuté de bout en bout avec clé
- [ ] C-05 Coût IA débité depuis `usage` : `billableCompletionTokens = max(completion, total - prompt, reasoning, 0)` (`shared/money.ts:46`, testé), `parseUsage` lit `completion_tokens_details.reasoning_tokens` puis l'alias ; débit vérifié en mock (`brain.charged`) ; jamais vérifié sur une réponse réelle (pas de clé)
- [x] Mode mock IA complet quand la clé est absente (backend lancé par moi : `brain.kind: mock`, 94 `brain.charged`, lettres et validation mock)
- [x] Clé absente documentée dans `docs/BESOINS_HUMAIN.md` (ligne P0 `NEARAI_API_KEY`) ; le fichier est périmé (voir E9)

## F. Réseau NEAR (N-xx, T-xx)
- [ ] T-05 / N-01 Tout tourne sur testnet NEAR ; faucet documenté dans le README : faucet documenté (README §8, « quantité non documentée ») ; testnet jamais exécuté
- [ ] N-02 URL RPC testnet vérifiées : `https://test.rpc.fastnear.com` déclaré par l'architecte (D-006), aucun appel réel `status` fait ; non vérifié par moi
- [ ] T-04 Contrat(s) NEAR personnalisé(s) : `contracts/darwin` écrit (35 `#[test]` comptés dans `tests.rs`, passage non relancé : pas de Rust), NON déployé, jamais appelé par `NearChain` sur un réseau ; échéance D-022 : 2026-11-11 23:59 UTC
- [ ] T-02 / T-03 Le projet démontre réellement enchères et sous-comptes (Swarms), agents qui gagnent, dépensent et sous-traitent (Agent Economy) : enchères, sous-traitance, gains, dépenses démontrés en mock ; sous-comptes réels = testnet jamais exécuté
- [x] Mode mock chaîne complet (sans réseau ni clé) : `MockChain` utilisée par le backend lancé par moi, hash `mock_...`, conservation testée (183 tests)

## G. NEAR Intents (I-xx), hors V1
- [ ] I-01 Base `https://1click.chaindefuser.com` (testée dans `intents/intents.test.ts:193`), `assetId` pris de `/v0/tokens` : jamais appelé en réel
- [x] I-03 Aucun appel `dry:false` ni dépôt mainnet sans feu vert humain : `INTENTS_ENABLED=false` et `INTENTS_DRY_ONLY=true` par défaut (`shared/config.ts:179-182`, `.env.example:73,78`), garde `intents/guard.ts` lue ; BESOINS_HUMAIN : aucun feu vert donné
- [ ] I-05 Frais re-vérifiés au moment d'une éventuelle exécution (sources divergentes, SPECS E-07) ; hors V1

## H. Concept Darwin (CLAUDE.md) et règles communes
- [x] Génome (vérifié `shared/types.ts`, `GenomeSchema`, test vert) : métier, modèle d'IA, prix, appétit du risque, seuil de reproduction, générosité, coopération, personnalité
- [x] Cycle (mock) : naissance, travail, reproduction (mutations + lettre), mort (solde sous le minimum vital, lignée conservée) : événements observés en preset demo ; mort et lignée par test et QA ; en testnet non exécuté
- [x] Économie (mock) : tâches de visiteurs (séquestre, validation, réputation), sous-traitance, client simulé étiqueté (`badge: "simulé"`, « Visiteur (financé par le compte de démo) »)
- [x] Jamais de crédit sans preuve vérifiée : `Chain.releaseEscrow` exige `PROOF_REQUIRED` (testé `shared.test.ts:90-116`) ; `market/index.ts:278-308` : libération seulement après verdict `accepted` enregistré, `resultHash` identique, séquestre contrôlé ; `rejected` -> remboursement ; juge IA indisponible -> `VALIDATION_PENDING` 503 (échec fermé). La « preuve » est produite par l'opérateur (non cryptographique), divulgué dans README §10
- [x] Aucune dérive de périmètre : rien d'ajouté hors concept dans `frontend/`, `backend/`, `market/`, `engine/`, `brain/`, `accounts/`, `intents/`
- [ ] R3 Aucun secret dans le dépôt, les logs ou les commits : fichiers propres (`scan-secrets --no-history` : 137 fichiers, OK) ; `redactConfig` testé ; MAIS `node scripts/scan-secrets.mjs` complet échoue (6 à 7 valeurs factices dans l'historique, commit `4eb92ea`, `backend/backend.test.ts`) : réécriture d'historique ou documentation = décision humaine
- [x] R4 Aucune dépense réelle sans feu vert humain écrit : aucune clé ni dépense effectuée ; Intents verrouillé par défaut ; plafonds `NEARAI_MAX_USD_PER_RUN`/`_PER_HOUR` dans le cerveau ; BESOINS_HUMAIN : aucun feu vert
- [x] R5 Rien n'est publié automatiquement : aucun code d'appel à X, à l'API du hackathon, ni de `git push` ; dépôt, post et formulaire restent humains
- [ ] R2 Chaque secret manquant a une ligne dans `docs/BESOINS_HUMAIN.md` : lignes NEARAI, compte maître, JWT 1Click présentes ; fichier périmé (daté 14:40, « Aucun feu vert »), sans la chaîne d'outils Rust/contrat, le post X, la vidéo, l'attestation « code antérieur », le second projet

## I. Avis par lot
| Lot | Avis (VALIDÉ / REFUSÉ) | Date | Raisons |
|---|---|---|---|
| L0 | n/a (rédaction des specs) | 2026-11-09 | SPECS.md et CONFORMITE.md rédigés ; réserves : pages `authentication.md` 1Click, OpenAPI, RPC providers, `private-inference` non lues ; fiabilité des résumés WebFetch à re-vérifier avant soumission. |
| L1 | VALIDÉ SOUS RÉSERVES (R1 à R10, voir « Avis L1 ») | 2026-11-09 | Architecture conforme aux specs et au concept ; 11 tests verts, typecheck OK ; 6 questions tranchées ; réserves à traiter par lot. |
| V1 (recette) | VALIDÉE SOUS RÉSERVES (mock) ; testnet non validé | 2026-11-09 | Voir « Avis final V1 » : E1 à E11, R1 à R10 traitées sauf R2 (partielle) et R3 (en cours). |

## Avis L1 (architecture)

Date : 2026-11-09. Gardien : gardien-des-specs. Objet : `docs/ARCHITECTURE.md` (L1), `docs/DECISIONS.md` D-003 à D-019, squelette `shared/`.

### Verdict : VALIDÉ SOUS RÉSERVES

L'architecture est conforme aux specs officielles (SPECS) et au concept Darwin (CLAUDE.md). Les lots suivants peuvent démarrer. Les réserves R1 à R10 sont des conditions de fusion des lots indiqués, pas des blocages du démarrage.

### Vérifié par le gardien
- `npm test` : 11 tests verts ; `npm run typecheck` : sans erreur (2026-11-09).
- Lecture de `shared/{money,chain,brain,config,types}.ts` et `shared/mock/mock-chain.ts`.
- Génome : les 8 gènes du concept existent, avec bornes et schéma zod. Cycle naissance, travail, reproduction, mort et lignée conservée : modélisés (`Chain.registerAgent`, `markAgentDead`, `closeAccount`). Client simulé étiqueté (`requester.kind = "simulated"`). Mode mock par défaut sans clé. Intents limité à `dry:true`, flag off. Montants en `bigint`. LICENSE MIT présente.
- Pas de dérive de périmètre : rien d'ajouté hors concept. Dossiers conformes à la carte de CLAUDE.md.

### Les 6 questions de l'architecte

**1. Coût IA débité en NEAR vers le compte maître alors que la clé paie en USD : ACCEPTÉ SOUS CONDITIONS.**
Le concept dit « paiement IA débité du solde » : D-013 le respecte. Le débit est une représentation, pas un paiement à NEAR AI Cloud. Décision exécutoire :
- Le README (redacteur) écrit : « le coût de chaque appel IA est calculé en USD d'après les prix de `/v1/models`, converti en NEAR de testnet à un taux fixe configurable (`DARWIN_NEAR_USD_RATE`, ce n'est pas un cours de marché) et débité à l'agent au profit du compte maître ; la facture réelle est payée en USD par la clé de plateforme de l'opérateur ». Interdit : écrire que l'agent « paie NEAR AI Cloud » ou que les NEAR de testnet ont une valeur.
- `brain.charged` porte en plus `costUsd`, `nearUsdRate` et `priceSource` (`models` ou `mock`) ; l'UI les affiche.
- Prix absent ou modèle non vérifié : jamais de coût 0 silencieux. `BrainError` + repli (modèle par défaut vérifié ou mock) avec `system.warning`.
- Les appels mock sont débités avec un usage simulé et étiquetés `mock:true`.

**2. Tokens de raisonnement : RÈGLE ACCEPTÉE, À DURCIR.**
`max(completion, total - prompt)` est prudente (jamais sous-facturée) et conforme à C-05. Décision exécutoire pour dev-cerveau (L5) :
- Règle finale : `billable = max(completion_tokens, total_tokens - prompt_tokens, reasoning_tokens, 0)`. L'architecte corrige `billableCompletionTokens` dans `shared/money.ts` et ajoute un test (`total_tokens` absent, `reasoning_tokens` seul).
- Lire `completion_tokens_details.reasoning_tokens`, puis l'alias `reasoning_tokens`.
- Le dev-cerveau capture une vraie réponse (si clé) ou documente l'absence de clé dans `docs/BESOINS_HUMAIN.md` ; tant que non vérifié sur réponse réelle, C-05 reste décoché. Les champs de prix de `/v1/models` (noms exacts, unité) ne sont pas vérifiés : à lire dans la doc ou la réponse réelle, pas de mémoire.
- Le README indique que la règle peut légèrement surestimer le coût.

**3. L'opérateur (compte maître) oracle de validation du séquestre : ACCEPTÉ SOUS CONDITIONS (divulgation obligatoire).**
Suffisant pour « séquestre, validation, réputation » en V1 hackathon, à condition de ne rien survendre. Décision exécutoire :
- Section README « Modèle de confiance » : l'opérateur détient la seule clé autorisée à libérer ou rembourser ; la validation est faite par une règle ou un modèle choisi par l'opérateur ; le système n'est pas sans confiance (« trustless »). Les termes « trustless » et « décentralisé » sont interdits pour le séquestre.
- Chaque `task.validated` et `escrow.released` journalise `validator` et `resultHash` (déjà dans le schéma) ; l'UI affiche « validé par : <validator> ».
- Le validateur n'est jamais l'agent payé ni l'agent demandeur d'une sous-traitance. Le coût d'un validateur IA est imputé à la trésorerie, pas à l'agent gagnant (sinon biais de sélection) : dev-marche le documente.
- La « preuve » de `releaseEscrow` est un objet produit par l'opérateur, non vérifié cryptographiquement ; ne pas parler de « preuve cryptographique ». « Jamais de crédit sans preuve vérifiée » s'entend : pas de libération sans verdict `accepted` enregistré.
- Dev-marche : le montant verrouillé est défini explicitement (budget ou prix gagnant, le reste remboursé au demandeur) ; remboursement uniquement sur `rejected` ou `expired`.

**4. Tâches de visiteurs payées par un compte de démo étiqueté : ACCEPTÉ SOUS CONDITIONS.**
Conforme à « tâches de visiteurs (séquestre, validation, réputation) » : le visiteur n'a pas de testnet à portée de formulaire. Décision exécutoire :
- Étiquette distincte de `simulated` : « Visiteur (financé par le compte de démo) ». L'UI et le README précisent que ce sont des fonds de test de l'opérateur, pas l'argent du visiteur.
- Plafond de dépense global du compte `visitors.<maître>` par heure (en plus des 10 tâches ouvertes par IP et du budget min/max) ; au-delà : 429 explicite. `funding.received` avec `source: "visitor"` devient `demo` pour ne pas suggérer un vrai paiement.
- Le texte du visiteur est toujours passé en message `user`, jamais en `system`.
- L'option V2 `accountId` reste hors V1.
- README : les gains des agents viennent de l'opérateur (client simulé et démo) ; l'économie est subventionnée et en boucle fermée (métabolisme et coûts IA retournent au maître). À dire clairement.

**5. Repli D-016 si Rust ou le contrat est indisponible : ACCEPTÉ COMME REPLI SEULEMENT, SOUS CONDITIONS.**
T-04 : un contrat personnalisé n'est pas obligatoire. Le contrat reste l'objectif (J-03 : implémentation technique). Décision exécutoire :
- Échéance : si le contrat ne compile pas et n'est pas déployé sur testnet au plus tard le 2026-11-11 23:59 UTC, dev-contrats le signale au chef de projet et D-016 est activé. L'installation de la chaîne d'outils Rust est gratuite (pas une dépense) : à tenter d'abord.
- En mode dégradé : badge permanent « Séquestre dégradé : compte piloté par l'opérateur, sans contrat » dans l'UI ; `/api/health` expose `escrow: "contract" | "operator-account"` ; section README dédiée. Interdit de parler de « contrat intelligent », de registre ou de réputation « on-chain » : registre et réputation tenus dans le journal local sont affichés comme « journal local ».
- T-04 et la case « Contrat(s) NEAR » ne sont cochées que si un contrat est réellement déployé et appelé par `NearChain`.
- L'étiquette `mock` du mode mock ne remplace jamais cette mention.

**6. Points non vérifiés : liste exécutoire.**
| Point | Statut | Responsable et action |
|---|---|---|
| near-sdk 5.30.1, cargo-near 0.23.0, near-api-js 7.4.0, Node >= 22.22.2 | Déclarés par l'architecte (npm, crates.io), non re-vérifiés par le gardien | dev-contrats, dev-comptes : vérifier à l'installation, corriger D-004/D-005 si écart |
| RPC `https://test.rpc.fastnear.com` | Déclaré lu sur la liste officielle (D-006) | dev-comptes : un appel réel `status` avant fusion de L2 |
| Faucet : quantité réelle ; explorateur testnet (`explorerBase` vide) | Non vérifiés | dev-comptes : documenter ; comparer le besoin total (3 fondateurs + comptes démo et séquestre) au faucet, sinon baisser les presets testnet |
| Champs de prix de `/v1/models`, forme exacte de `usage` | Non vérifiés | dev-cerveau (point 2) |
| Gaz des sous-comptes (solde logique contre solde chaîne) | Non traité | dev-comptes, dev-moteur : inclure le gaz dans le solde logique ou le rembourser ; documenter |
| Pages 1Click `authentication`, OpenAPI, `private-inference` | Non lues (réserve L0 maintenue) | dev-intents (hors V1) |
| D-019 (encodage corrompu) | À ma lecture du 2026-11-09, les accents de CLAUDE.md et STATUS.md sont corrects ; README est un placeholder | chef de projet : vérifier les octets avant toute « correction » |
| Fiabilité des résumés WebFetch de SPECS | Réserve L0 maintenue | gardien : relire les pages vivantes avant soumission |

### Réserves à traiter, par lot
- **R1 (L1, architecte)** : durcir `billableCompletionTokens` + test ; ajouter `costUsd`, `nearUsdRate`, `priceSource` à `brain.charged` ; renommer `funding.received.source: "visitor"` en `demo` ; mettre à jour ARCHITECTURE §17 avec ces décisions.
- **R2 (L2, dev-comptes)** : vérifier RPC, faucet, explorateur, gaz ; aucune clé journalisée.
- **R3 (L3, dev-contrats)** : échéance du 2026-11-11 pour D-016.
- **R4 (L4, dev-moteur)** : calibrer les presets avec un test de 3 générations en mock ; solde logique et gaz.
- **R5 (L5, dev-cerveau)** : points 1 et 2 ; vérification via `/v1/models` ; pas de repli à coût nul.
- **R6 (L6, dev-marche)** : points 3 et 4 (validateur, montant verrouillé, remboursement, plafond visiteurs).
- **R7 (L7, dev-backend, securite)** : `DARWIN_ADMIN_TOKEN` obligatoire dès que `HOST` n'est pas `127.0.0.1` ; `/api/health` expose l'état du séquestre ; aucune route ne renvoie de secret.
- **R8 (L8, dev-frontend)** : étiquettes « mock », « simulé », « visiteur (démo) », « dégradé », « validé par » ; échappement du contenu.
- **R9 (README, redacteur)** : sections coût IA, modèle de confiance, séquestre dégradé, économie subventionnée, divulgation du code généré par IA (L-07), Node >= 22.22.2 pour le testnet, mock sur Node >= 22.12.
- **R10 (QA)** : tester qu'aucune libération n'a lieu sans preuve `accepted` au niveau du marché, pas seulement de `MockChain`.

Prochain avis : à chaque lot présenté, avec relecture du code et des tests.

## Avis final V1 (recette)

Date : 2026-11-09. Gardien : gardien-des-specs. Objet : `main` au commit `4c94c30`. Verdict global : **V1 VALIDÉE SOUS RÉSERVES pour le mode mock ; NON VALIDÉE pour le testnet, qui n'a jamais été exécuté.** Aucun veto de conformité, mais les écarts E1 à E10 sont à corriger avant toute publication (post X, formulaire, dépôt public). Je n'ai corrigé aucun fichier des autres.

### 1. Exigences officielles relues (nearhackathon.com et HACKATHON.md, 2026-11-09)
Aucun changement par rapport à SPECS : début 2026-11-01 00:00 UTC, clôture 2026-11-14 23:59 UTC, jugement 16 au 18 nov. ; dépôt public jusqu'à la fin du jugement ; LICENSE exigée (Q-014) ; divulgations README (Q-002, Q-003, Q-005, Q-015) ; démo ouvrable (Q-012 : démo locale acceptée si dépôt public, README reproductible et vidéo dans le post X) ; post X : « built at NEAR HACKATHON », @NEARProtocol, #NEARHackathon, vidéo ou captures ; champs et limites du formulaire identiques (`idea` 20-2000, `size` `1`/`2 - 4`/`4 - 6`/`6 - 8`/`8+`, 13 tracks, `website` piège, 12000 octets) ; consentement verbatim identique. Notes : la page d'accueil ne mentionne ni LICENSE ni divulgations (seul HACKATHON.md les exige, il prime) ; la page rappelle de relire avant soumission (l'humain doit le faire). Nouveauté NEAR AI Cloud : la réponse vivante de `/v1/models` liste 64 modèles ; `zai-org/GLM-5.1-FP8` (exemple du quickstart, SPECS C-04) n'y figure plus ; les champs `pricing.input`/`output` (USD par million de tokens) sont confirmés et lus par `brain/pricing.ts`.

### 2. Verdict par case de la définition de la V1
| Case | Verdict | Raison |
|---|---|---|
| Clone neuf + README | PARTIEL | Mock OK (QA sur clone neuf à c99eab0, moi sur l'arbre de travail : démarrage, health, tâche `settled`). Testnet avec clés jamais exécuté. |
| >= 3 générations autonomes | OK (mock) | `start:demo` : 3 générations en ~1 min, paiements IA, reproductions, lettres ; morts par test et QA. Jamais sur testnet. |
| Marché complet | OK (mock) | Publication, enchères, séquestre, validation nommée, paiement, réputation observés ; garde « pas de crédit sans verdict `accepted` » lue dans `market/index.ts:278-308`. Séquestre dégradé par défaut (contrat non déployé). |
| Lettres consultables | OK | `letter.written` observé ; endpoint vérifié par la QA. |
| Page web en direct | PARTIEL | Code et étiquettes lus ; vérifiée dans un navigateur par la QA uniquement ; je ne l'ai pas rendue. |
| Tests verts | OK | 183/183, typecheck propre. |
| README conforme, étapes vérifiées par la QA | PARTIEL | Étapes vérifiées par la QA avant les derniers correctifs ; écarts de formulation E1 à E10 ; la QA est à refaire sur le commit final. |
| `docs/CONFORMITE.md` | OK (rouge justifié) | Chaque `[ ]` porte sa raison : testnet, contrat, NEAR AI Cloud réel, Intents réel, dépôt public, vidéo, post X, soumission. |

### 3. Écarts entre documents et code (à corriger par le rédacteur, sauf mention)
- **E1 `docs/POST_X.md:10`** (post unique) : « Live selection on NEAR testnet: sub-accounts, escrow, NEAR AI Cloud. » Survente : le testnet n'a jamais tourné, la commande « sans clé » lance le mock, aucun appel NEAR AI Cloud réel, le séquestre est dégradé. Le post unique ne porte aucune réserve. Reformuler, par exemple « Runs in mock mode with no key; built for NEAR testnet (not yet run on the real network) ».
- **E2 `docs/POST_X.md:33`** (4/) et **`docs/FORMULAIRE.md:34`** : « a Rust escrow/registry/reputation contract », « NEAR Intents 1Click » présentés comme outils utilisés ; le contrat n'est pas déployé, Intents n'a jamais été appelé (même en dry-run réel). Le paragraphe « Honesty » de FORMULAIRE (ligne 36) ne dit rien de NEAR AI Cloud (jamais appelé en réel) ni d'Intents, ni du séquestre dégradé / registre local.
- **E3 `docs/FORMULAIRE.md:30`** : « Darwin is a live economy of AI agents on NEAR testnet » (testnet non exécuté ; défaut = mock). Même remarque pour **`README.md:3`** (« live, on NEAR testnet »), atténuée par l'encart d'honnêteté de la ligne 7 : à préciser « (mock by default; testnet mode not yet run) ».
- **E4 `docs/VIDEO_SCRIPT.md:19` et `:25`** : voix off inconditionnelles « born as its own NEAR sub-account » et « Built ... with NEAR accounts, access keys, a Rust contract, NEAR AI Cloud and NEAR Intents » : faux en mock. La règle de la ligne 6 (dire « mock ») n'est appliquée qu'aux plans 5 et 6. À rendre conditionnel.
- **E5 `README.md:174`** : « Not run by the author: ... the web page, a clean-clone install » contredit les lignes 154 et 171 (page vérifiée avec Playwright) et la recette QA (clone neuf). Texte périmé.
- **E6 `README.md:67`** : « 35 native unit tests pass » : 35 `#[test]` comptés par moi dans `contracts/darwin/src/tests.rs`, mais le passage n'est vérifiable ni par moi ni par la QA (pas de Rust) ; la mention « not re-run » est présente : acceptable, à garder.
- **E7 `README.md:154`** : tous les chiffres « author's run » (15 morts, tick 238) sont ceux d'une autre exécution ; les miens (3 générations, 0 mort à tick 91 en ~40 s) concordent avec la formulation « varies between runs ». Aucun écart.
- **E8 `README.md:5`** : les tracks (Swarms, Agent Economy, Open Innovation) sont affirmés comme choisis ; décision de l'humain (CONFORMITE C).
- **E9 `docs/BESOINS_HUMAIN.md`** (propriétaire chef de projet) : périmé (« mis à jour 14:40 », « Aucun feu vert », « specs à venir »). Manquent : contrat/Rust (échéance 2026-11-11), vidéo, post X, attestation « pas de code antérieur », second projet, décision sur l'historique git (valeurs factices).
- **E10 `CLAUDE.md:6`** (propriétaire chef de projet) : le pitch dit « on-chain (testnet NEAR) » ; correct comme ambition, mais ne doit pas être repris tel quel dans un texte public tant que le testnet n'a pas tourné et que le séquestre est dégradé. Les mots « trustless » et « décentralisé » apparaissent seulement dans des phrases de négation (README, POST_X, VIDEO_SCRIPT) : conforme. Aucun usage « on-chain » pour le mode dégradé dans le README ni l'interface (`frontend/app.js:212` dit « journal local »). « L'agent paie NEAR AI Cloud » : absent, README §5 dit l'inverse (conforme).
- **E11 `SPECS.md`** (mon fichier) : C-04 et E-06 citent `zai-org/GLM-5.1-FP8` ; l'id n'est plus dans `/v1/models` à ce jour. Note ajoutée à SPECS.

### 4. Réserves R1 à R10 de l'Avis L1
| Réserve | État | Preuve |
|---|---|---|
| R1 (architecte) : coût, `brain.charged`, `demo` | TRAITÉE | `shared/money.ts:46` (max à 4 termes) + test `shared.test.ts:25-32` ; `shared/events.ts:32` (`costUsd`, `nearUsdRate`, `priceSource`) ; `source: "master" \| "faucet" \| "demo"` (ligne 34). |
| R2 (dev-comptes) : RPC, faucet, explorateur, gaz | PARTIELLE | Gaz analysé en doc (`accounts/README.md`) mais « non mesuré en réel » ; RPC jamais appelé ; quantité du faucet « non documentée » (README §8). Dépend du testnet. |
| R3 (dev-contrats) : échéance 2026-11-11 | EN COURS | Contrat écrit, non déployé, Rust absent de la machine ; échéance dans 2 jours ; D-016 (dégradé) actif par défaut et correctement annoncé. |
| R4 (dev-moteur) : calibrage 3 générations, gaz | TRAITÉE en mock, PARTIELLE pour le gaz | Test `engine/simulation.test.ts` (>= 3 générations) vert ; ma recette : 3 générations en ~1 min en demo. Gaz logique : `engine/economy.ts` relit le solde chaîne ; non mesuré en réel. |
| R5 (dev-cerveau) : `/models`, pas de coût nul | TRAITÉE (code), non vérifiée en réel | `assertValidPrice`, repli `verified:false` + `system.warning`, prix nuls écartés ; format `/models` confirmé par ma lecture du jour ; jamais de `chat/completions` réel. |
| R6 (dev-marche) : validateur, montant, remboursement, plafond | TRAITÉE | `market/index.ts:391` (validateur jamais gagnant ni demandeur) ; juge imputé à `treasury` (`validation.ts:133,160`) ; remboursement seulement `rejected`/`expired` ; `/api/health` expose `visitors.hourlyCap` ; texte visiteur en `user`. |
| R7 (dev-backend, securite) : token admin, health, secrets | TRAITÉE | `backend/app.ts:35-38` (refus de démarrer sans token hors loopback) ; `escrow` dans `/api/health` (vérifié en live) ; redaction testée. |
| R8 (dev-frontend) : étiquettes, échappement | TRAITÉE | `frontend/app.js:207-216` : « MODE MOCK », « Client simulé », « Visiteur (financé par le compte de démo) », « Séquestre dégradé », « Modèle de confiance », « validé par : » (ligne 360) ; aucun `innerHTML` (grep). Rendu navigateur vu par la QA seulement. |
| R9 (README) : six sections | TRAITÉE | Coût IA (§5), modèle de confiance (§10), séquestre dégradé (§5), économie subventionnée (§10), divulgation IA (§11), Node >= 22.22.2 testnet / 22.12 mock (§6). |
| R10 (QA) : pas de libération sans `accepted` au niveau marché | TRAITÉE | `market/index.ts:278-308` et tests `market.test.ts` (rejet -> remboursement, `VALIDATION_PENDING` échec fermé) ; non rejoué par la QA dans son rapport (qui n'évoque pas R10) : à confirmer. |

### 5. Ce qui dépend de l'humain (et ce que je n'ai pas pu vérifier)
- Rendre le dépôt public avant le 2026-11-14 23:59 UTC ; décider du sort des 7 valeurs factices de l'historique (`4eb92ea`) : réécriture avant publication ou mention dans le README ; sinon `npm run scan:secrets` affiche ECHEC pour un juge.
- Fournir clés (NEAR testnet maître, `NEARAI_API_KEY`), Node >= 22.22.2, faire une première exécution testnet et NEAR AI Cloud réelle (puis mettre README, FORMULAIRE, POST_X à jour) ; installer Rust et déployer le contrat avant le 2026-11-11 ou assumer le mode dégradé.
- Vidéo, post X, `leadName`, `email`, `size`, `nearAddress` mainnet, tracks, attestation « pas de code antérieur », second projet éventuel, relecture de la page vivante, soumission unique.
- Non vérifié par le gardien : tout ce qui touche testnet, contrat déployé et tests Rust, NEAR AI Cloud réel, Intents réel, vidéo, post X, dépôt public, soumission ; rendu de la page web ; installation sur Linux/macOS ou Node >= 22.22.2.
