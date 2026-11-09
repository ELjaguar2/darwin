# CONFORMITE — grille à cocher

> Propriétaire : gardien-des-specs. Vert = conforme `[x]`, rouge = non conforme `[ ]` avec justification. Les identifiants renvoient à `docs/SPECS.md` (lu le 2026-11-09). Rien n'est coché tant que le gardien n'a pas vérifié le code, les tests ou l'exécution (pas de validation sans vérification).

## A. Définition de la V1 (CLAUDE.md)
- [ ] Clone neuf + commandes du README = tout tourne (mock sans clé, testnet avec clés)
- [ ] >= 3 générations naissent, travaillent, paient leur IA, se reproduisent, meurent, sans intervention
- [ ] Marché : publication, enchères, séquestre, validation, paiement, réputation
- [ ] Lettres parent -> enfant générées et consultables
- [ ] Page web en direct : arbre généalogique, soldes, naissances, morts, flux de transactions, formulaire de tâche
- [ ] Tests verts
- [ ] README conforme, étapes « faites X, vous verrez Y » toutes vérifiées par la QA
- [ ] Cette grille au vert (ou rouge justifié)

## B. Exigences officielles : dépôt et livrables (L-xx)
- [ ] L-01 Dépôt public (rendu public par l'humain, avant 2026-11-14 23:59 UTC) avec README reproductible
- [x] L-02 Fichier LICENSE présent à la racine (MIT, vérifié le 2026-11-09)
- [ ] L-03 Démo ouvrable par les juges : installation locale reproductible, vidéo ou démo hébergée (captures seules insuffisantes)
- [ ] L-04 Si démo hébergée : en ligne au moins jusqu'au 2026-11-18 (idéal 2026-11-25) (humain)
- [ ] L-05 Post X rédigé (`docs/POST_X.md`) : « built at NEAR HACKATHON », @NEARProtocol, #NEARHackathon, vidéo ou captures ; publié par l'humain
- [ ] L-07 README : section de divulgation (code antérieur au 1er nov. s'il y en a, code tiers, code généré par IA, bibliothèques et gabarits, travail NEAR antérieur)
- [ ] L-07 Si l'humain a un second projet : les deux README se citent
- [ ] L-08 Historique git cohérent avec la fenêtre (tag ou branche pré-hackathon si du code existe avant)
- [ ] L-09 README lisible par machine et humain : produit, problème, étapes « faites X, voyez Y »
- [ ] Tout le code est écrit depuis l'annonce (H-07)

## C. Exigences officielles : soumission (S-xx), humain uniquement
- [ ] S-02 `docs/FORMULAIRE.md` fournit chaque champ conforme : projectName 2-80, leadName 2-80, email, size (`1`, `2 - 4`, ...), tracks (ids valides), nearAddress mainnet, projectUrl, demoUrl, idea 20-2000 car., consent
- [ ] S-03 Aucun champ en trop ; `website` laissé vide ; corps < 12000 octets
- [ ] S-04 Texte de consentement verbatim présenté à l'humain
- [ ] S-07 Le JSON final est affiché à l'humain, qui confirme ; aucune soumission automatique
- [ ] S-08 Compte NEAR mainnet de paiement fourni par l'humain (jamais créé par un agent)
- [ ] S-01 Soumission effectuée une seule fois avant la clôture (humain)
- [ ] Tracks cochés décidés (recommandation : `swarms`, `agents`, éventuellement `business`, `open`)

## D. Exigences officielles : jugement (J-xx)
- [ ] J-01 Un agent IA neuf peut cloner, lancer et reproduire chaque étape du README sans aide (test QA)
- [ ] J-01 Chaque fonction annoncée dans le README existe et fonctionne (pas d'écart README/code)
- [ ] J-03 Les critères indicatifs sont couverts : implémentation technique, design, impact, originalité, durabilité

## E. NEAR AI Cloud (C-xx)
- [ ] C-01 (L1 : URL par défaut et `NEARAI_BASE_URL` dans `shared/config.ts` OK ; client à venir, L5) Appels vers `https://cloud-api.near.ai/v1` (`/chat/completions`, `/models`), URL configurable
- [ ] C-02 Auth par `Authorization: Bearer` avec clé lue dans une variable d'environnement, jamais en dur
- [ ] C-04 Modèle choisi par configuration et vérifié via `GET /v1/models` (pas d'id codé sans vérification) ; prix lus depuis `/v1/models`
- [ ] C-05 (L1 : `costYocto` testé, règle de raisonnement à durcir, voir Avis L1 point 2 ; débit réel L4/L5) Coût IA débité du solde de l'agent à partir de `usage` (prompt + completion, y compris tokens de raisonnement)
- [ ] Mode mock IA complet quand la clé est absente (L1 : `MockBrain` et résolution `loadConfig` testés ; reste le branchement bout en bout, L5/L7)
- [ ] Clé absente documentée dans `docs/BESOINS_HUMAIN.md`

## F. Réseau NEAR (N-xx, T-xx)
- [ ] T-05 / N-01 Tout tourne sur testnet NEAR ; faucet documenté dans le README
- [ ] N-02 (L1 : `https://test.rpc.fastnear.com` déclaré vérifié par l'architecte, D-006, non re-vérifié par le gardien) URL RPC testnet vérifiées sur la liste officielle des fournisseurs
- [ ] T-04 Contrat(s) NEAR personnalisé(s) cohérent(s) avec les tracks choisis
- [ ] T-02 / T-03 Le projet démontre réellement des enchères et sous-comptes (Swarms) ainsi que des agents qui gagnent, dépensent et sous-traitent (Agent Economy)
- [ ] Mode mock chaîne complet (sans réseau ni clé) (L1 : `MockChain` et invariant de conservation testés, 11 tests verts ; reste l'intégration, L4/L6/L7)

## G. NEAR Intents (I-xx), hors V1
- [ ] I-01 Si intégré : base `https://1click.chaindefuser.com`, `assetId` pris de `/v0/tokens`
- [ ] I-03 Aucun appel `dry:false` ni dépôt mainnet sans feu vert humain écrit dans `docs/BESOINS_HUMAIN.md` ; feature flag off par défaut
- [ ] I-05 Frais re-vérifiés au moment d'une éventuelle exécution (sources divergentes, voir SPECS E-07)

## H. Concept Darwin (CLAUDE.md) et règles communes
- [x] Génome (vérifié `shared/types.ts`, `GenomeSchema`, test vert) : métier, modèle d'IA, prix, appétit du risque, seuil de reproduction, générosité, coopération, personnalité
- [ ] Cycle : naissance (sous-compte + capital + génome), travail, reproduction (mutations + lettre), mort (solde sous le minimum vital, lignée conservée)
- [ ] Économie : tâches de visiteurs (séquestre, validation, réputation), sous-traitance, client simulé étiqueté comme simulé
- [ ] Jamais de crédit sans preuve vérifiée (L1 : garde `PROOF_REQUIRED` de `Chain`/`MockChain` testée ; la « preuve » est produite par l'opérateur, voir Avis L1 point 3 ; contrôle au niveau du marché en L6)
- [ ] Aucune dérive de périmètre : pas d'ajout hors concept sans décision validée par le gardien
- [ ] R3 (L1 : `redactConfig`, `.gitignore`, `.env.example` sans valeur OK ; scan à faire) Aucun secret dans le dépôt, les logs ou les commits (scan `scripts/scan-secrets.*` vert)
- [ ] R4 Aucune dépense réelle sans feu vert humain écrit
- [ ] R5 Rien n'est publié automatiquement (dépôt, X, formulaire = humain)
- [ ] R2 Chaque secret manquant a une ligne dans `docs/BESOINS_HUMAIN.md`

## I. Avis par lot
| Lot | Avis (VALIDÉ / REFUSÉ) | Date | Raisons |
|---|---|---|---|
| L0 | n/a (rédaction des specs) | 2026-11-09 | SPECS.md et CONFORMITE.md rédigés ; réserves : pages `authentication.md` 1Click, OpenAPI, RPC providers, `private-inference` non lues ; fiabilité des résumés WebFetch à re-vérifier avant soumission. |
| L1 | VALIDÉ SOUS RÉSERVES (R1 à R10, voir « Avis L1 ») | 2026-11-09 | Architecture conforme aux specs et au concept ; 11 tests verts, typecheck OK ; 6 questions tranchées ; réserves à traiter par lot. |

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
