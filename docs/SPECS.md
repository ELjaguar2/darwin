# SPECS — exigences officielles

> Propriétaire : gardien-des-specs. Date de lecture de toutes les sources : **2026-11-09**.
> Les sources officielles priment sur le prompt initial et sur CLAUDE.md. Les pages sont relues via WebFetch (résumé automatique de la page : citations à re-vérifier avant soumission, car `HACKATHON.md` demande de relire la page vivante avant de soumettre).

Abréviations de sources :
- **[NH]** https://nearhackathon.com
- **[HM]** https://nearhackathon.com/HACKATHON.md
- **[DN]** https://docs.near.org/getting-started/hackathons
- **[INT]** https://docs.near-intents.org (+ sous-pages citées)
- **[CLOUD]** https://cloud.near.ai et https://docs.near.ai/cloud/...
- **[SK]** https://github.com/near/agent-skills

## 0. État d'accès aux sources

| Source | État |
|---|---|
| [NH] nearhackathon.com | Lue. |
| [HM] HACKATHON.md | Lue (la plus détaillée : champs du formulaire, API de soumission, règles Q-000 à Q-017). |
| [DN] docs.near.org/getting-started/hackathons | Lue, **ne contient aucune information sur le hackathon** (ni dates, ni tracks, ni exigences). Seulement des liens généraux : chats Telegram dev, demande de crédits NEAR AI Cloud, faucets testnet (faucet.circle.com, near-faucet.io). Rien n'est donc déduit de cette page. |
| [INT] docs.near-intents.org | Lue (accueil, about-1click-api, quickstart/introduction, resources/fees). Les pages `authentication.md`, quickstart détaillé et schéma complet des requêtes/réponses `quote` n'ont **pas** été lues : à lire par dev-intents (OpenAPI : https://1click.chaindefuser.com/docs/v0/openapi.yaml, non lu). |
| [CLOUD] cloud.near.ai | Page = écran de connexion uniquement (Google, GitHub, NEAR). Aucun détail d'API. Détails pris sur docs.near.ai/cloud (quickstart, models, introduction) et [SK]. Les pages `private-inference`, `verification`, prix détaillés n'ont pas été lues. |
| [SK] github.com/near/agent-skills | Lue (README + SKILL.md de `near-ai-cloud` et `near-intents`). |

## 1. Hackathon : dates et cadre

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| H-01 | Thème de la page : « Programmable money » (« Autonomous payments. Intelligent agents. Money with a mind of its own. » / « Build what's next. »). Le thème « Construisez la suite pour l'IA et l'argent » n'apparaît pas dans les pages lues. | [NH] | 2026-11-09 |
| H-02 | Début du hackathon : 2026-11-01 00:00 UTC (ouverture des soumissions identique). | [NH], [HM] | 2026-11-09 |
| H-03 | Fin du développement / date limite de soumission : **2026-11-14 23:59 UTC**. | [NH], [HM] | 2026-11-09 |
| H-04 | Le dépôt doit être public au plus tard le 2026-11-14 23:59 UTC et le rester pendant le jugement. | [HM] | 2026-11-09 |
| H-05 | Jugement : 2026-11-16 (00:00 UTC) au 2026-11-18 ; résultats annoncés au plus tard le 2026-11-18 23:59 UTC. | [NH], [HM] | 2026-11-09 |
| H-06 | Paiement : un seul versement, sans vesting, sous 30 jours après les résultats (Q-016). | [HM] | 2026-11-09 |
| H-07 | Le code doit être écrit « depuis l'annonce » pour compter. [HM] indique « code window opens 2026-10-19 (per the announcement) » : le code antérieur est une base de référence (baseline, Q-001). | [NH], [HM] | 2026-11-09 |
| H-08 | Cagnotte 250 000 USD payée en NEAR : grand prix 55 000 (x1) ; 1re place par track 10 000 (x13) ; 2e 3 000 (x13) ; 3e 2 000 (x13). | [NH], [HM] | 2026-11-09 |
| H-09 | Ouvert aux développeurs, designers, porteurs d'idées ; solo ou équipe. Une personne peut déposer au plus 2 projets indépendants, chaque README nommant l'autre (Q-015). Seule une adresse de compte NEAR est requise. | [NH], [HM] | 2026-11-09 |

## 2. Tracks

13 tracks officiels (ids de l'API entre parenthèses) : Unstoppable DeFi (`defi`), Investment Thesis (`thesis`), Privacy & Private AI (`privacy`), Autonomous Business (`business`), **AI Swarms (`swarms`)**, AI Security & Defense (`security`), **Agent Economy (`agents`)**, Real-World Money (`realworld`), Games With Real Economies (`games`), NFTs That Do Something (`nfts`), Memecoins With Mechanics (`memecoins`), Social Money (`social`), **Open Innovation (`open`)**.

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| T-01 | Un projet peut cocher plusieurs tracks mais reste une seule soumission. Choisir tous ceux qui conviennent. | [NH], [HM] | 2026-11-09 |
| T-02 | AI Swarms : « coordination markets, bidding, collective purchasing, agent economies (sub-accounts) » / « Coordination markets, bidding, collective purchasing among agents ». Cadre bien avec enchères + sous-comptes de Darwin. | [NH], [HM] | 2026-11-09 |
| T-03 | Agent Economy : « agents that earn, spend, negotiate, hire agents, pay for APIs or data ». Cadre avec Darwin (paient leur IA, sous-traitance). | [NH], [HM] | 2026-11-09 |
| T-04 | Les mentions (NEAR Intents, Chain Signatures, NEAR AI Cloud, TEE, NEP) sont des suggestions, pas des obligations ; aucune intégration n'est obligatoire, un contrat NEAR personnalisé adapté au track suffit (Q-011). | [HM] | 2026-11-09 |
| T-05 | Les projets testnet uniquement sont éligibles dans tous les tracks, sauf si l'intégration est mainnet-only (Q-010). | [HM] | 2026-11-09 |
| T-06 | Exemples de prompts : https://github.com/nearai/near-hackathon-prompt-examples (non lu). | [HM] | 2026-11-09 |

## 3. Livrables

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| L-01 | Dépôt public avec un README permettant à un juge de reproduire le projet. | [NH], [HM] | 2026-11-09 |
| L-02 | Un fichier **LICENSE** (toute licence, MIT convient) dans le dépôt (Q-014). | [HM] | 2026-11-09 |
| L-03 | Démo ouvrable par les juges : vidéo, démo hébergée **ou** installation locale reproductible. Les captures d'écran seules ne suffisent pas. Une démo locale seule est acceptée si dépôt public, README reproductible et vidéo dans le post X (Q-012). | [HM] | 2026-11-09 |
| L-04 | Si démo hébergée : la garder en ligne au moins jusqu'au 2026-11-18, idéalement 2026-11-25 (Q-012). | [HM] | 2026-11-09 |
| L-05 | Post public sur X : dit que le projet a été construit au NEAR HACKATHON, tague @NEARProtocol et #NEARHackathon, joint vidéo ou captures. @NearLegion et @NearBuilders optionnels. **L'humain écrit et publie.** | [NH], [HM] | 2026-11-09 |
| L-06 | Les deux liens (dépôt + post X) sont obligatoires dans le formulaire. | [NH] | 2026-11-09 |
| L-07 | Le README doit indiquer : code pré-hackathon, code tiers ou généré par IA, bibliothèques et gabarits, tout autre travail NEAR antérieur (Q-002, Q-004, Q-005). Si une personne a deux projets, chaque README cite l'autre (Q-015). | [HM] | 2026-11-09 |
| L-08 | Pas de nouveau dépôt obligatoire : branche dédiée, ou tags `pre-hackathon` et `hackathon-submission`, plus une section README liant le diff (Q-003). | [HM] | 2026-11-09 |
| L-09 | Le README doit servir un lecteur machine et humain : ce qu'est le produit, le problème, étapes « faites X, voyez Y ». | [HM] | 2026-11-09 |
| L-10 | Droits : l'équipe garde tous ses droits ; les organisateurs reçoivent des droits promotionnels non exclusifs (nom, captures, vidéo, lien du dépôt) (Q-013). | [HM] | 2026-11-09 |

## 4. Soumission

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| S-01 | Soumission via le formulaire https://nearhackathon.com/#apply **ou** l'API `POST https://nearhackathon.com/api/applications`. Une soumission par projet ; chaque dépôt n'est soumis qu'une fois ; max 2 soumissions par email. | [HM] | 2026-11-09 |
| S-02 | Champs API : `requestId` (UUID généré une fois, réutilisé aux retries) ; `projectName` 2-80 car. ; `leadName` 2-80 ; `email` valide, max 160 ; `size` parmi `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` ; `tracks` (ids, chacun une fois) ; `nearAddress` 2-64 car., minuscules, compte mainnet nommé ou implicite 64 car. ; `projectUrl` dépôt public max 300 ; `demoUrl` post X public max 300 ; `idea` 20-2000 car. (problème, produit, place de NEAR) ; `consent` `true` après accord du lead. | [HM] | 2026-11-09 |
| S-03 | Corps limité à 12000 octets ; aucun champ supplémentaire ; le champ `website` est un piège anti-spam (toute valeur non vide = rejet). Le formulaire web affiche un champ « Website » optionnel, à laisser vide côté API. | [HM], [NH] | 2026-11-09 |
| S-04 | Texte de consentement lu verbatim au lead : « I agree that the organizers may use these details to review our submission and contact us about this hackathon. » | [HM] | 2026-11-09 |
| S-05 | Codes de réponse : 201 enregistré ; 400 champ invalide (corriger, même requestId) ; 403 fermé ou cross-site (ne pas réessayer) ; 409 dépôt déjà soumis ou 2 soumissions pour l'email (ne pas contourner) ; 413 trop gros ; 503 stockage indisponible (réessayer avec le même requestId). | [HM] | 2026-11-09 |
| S-06 | Pas d'édition directe : corrections via https://nearhackathon.com/request-changes (revue manuelle). Ne pas soumettre à nouveau. | [NH], [HM] | 2026-11-09 |
| S-07 | Règles pour un agent IA : relire la page avant de soumettre ; ne jamais soumettre, poster sur X, rendre le dépôt public, pousser, signer, dépenser, déployer en mainnet ou committer de secret sans confirmation explicite de l'humain ; afficher le JSON complet et attendre un oui ; ne pas inventer de valeurs. | [HM] | 2026-11-09 |
| S-08 | Aucune connexion de wallet requise pour soumettre. Le compte NEAR de paiement doit être un compte **mainnet** créé par l'équipe elle-même (l'agent ne doit pas en créer). | [NH], [HM] | 2026-11-09 |

## 5. Jugement

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| J-01 | Claude Code et Codex filtrent d'abord chaque projet : vérifient que ça tourne et que ça fait ce que dit le README (reproductibilité, vérification des fonctions, rapport structuré, score préliminaire). | [NH], [HM] | 2026-11-09 |
| J-02 | Les juges humains décident ; un faible score IA seul ne peut pas rejeter un projet (Q-017). | [HM] | 2026-11-09 |
| J-03 | Critères des éditions précédentes (indicatif) : implémentation technique, design, impact, originalité, durabilité. Pour games et memecoins : jugé sur la boucle de jeu / la mécanique. | [NH], [HM] | 2026-11-09 |

## 6. NEAR AI Cloud (cerveau des agents)

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| C-01 | Base URL OpenAI-compatible : `https://cloud-api.near.ai/v1` ; `POST /v1/chat/completions`, `GET /v1/models`. | https://docs.near.ai/cloud/quickstart.md ; [SK] near-ai-cloud/SKILL.md | 2026-11-09 |
| C-02 | Auth : en-tête `Authorization: Bearer <clé>` ; la clé se génère dans le tableau de bord cloud.near.ai. | https://docs.near.ai/cloud/quickstart.md ; [SK] | 2026-11-09 |
| C-03 | Obtention de la clé : (1) s'inscrire sur cloud.near.ai (Google, GitHub ou NEAR), (2) section « Credits » : acheter des crédits, (3) section « API Keys » : générer la clé. Alternative : 10 USD de crédits réclamables en rejoignant NEAR Builders (https://nearbuilders.org/join) (Q-000). Une demande de crédits existe aussi (lien Notion sur [DN]). | https://docs.near.ai/cloud/quickstart.md ; [HM] ; [DN] | 2026-11-09 |
| C-04 | (Note 2026-11-09, recette V1 : `zai-org/GLM-5.1-FP8` ne figure plus dans la liste vivante de `GET /v1/models`, 64 modèles dont `z-ai/glm-5.3-flash` ; champs de prix `pricing.input`/`output` en USD par million de tokens confirmés.) Le quickstart utilise le modèle `zai-org/GLM-5.1-FP8` (raisonnement) ; `[SK]` cite `deepseek-ai/DeepSeek-V3.1` (exemple possiblement périmé). Les modèles et leurs **prix** se lisent dynamiquement via `GET /v1/models` (tarifs, contexte, limites). Ne jamais coder un id de modèle en dur sans le vérifier via `/v1/models`. | https://docs.near.ai/cloud/quickstart.md ; https://docs.near.ai/cloud/models.md ; [SK] | 2026-11-09 |
| C-05 | La réponse contient `usage` : `prompt_tokens`, `completion_tokens`, `completion_tokens_details.reasoning_tokens` (`reasoning_tokens` = alias déprécié), `total_tokens`. Base du débit par tokens de Darwin ; les tokens de raisonnement sont à compter. | https://docs.near.ai/cloud/quickstart.md | 2026-11-09 |
| C-06 | Niveaux de confidentialité des modèles : Confidential TEE (GPU NEAR AI), 3P Confidential TEE, Incognito (routé vers OpenAI/Anthropic/Gemini hors TEE). Attestation : `GET /v1/attestation/report?model=...`, signatures `GET /v1/signature/{chat_id}` (facultatif pour Darwin). | https://docs.near.ai/cloud/models.md ; [SK] | 2026-11-09 |

## 7. NEAR Intents / 1Click (moment mainnet, hors V1)

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| I-01 | Base URL : `https://1click.chaindefuser.com`. Endpoints : `GET /v0/tokens` (utiliser les `assetId` renvoyés, ne pas les construire), `POST /v0/quote`, `POST /v0/deposit/submit`, `GET /v0/status`. SDK TypeScript `@defuse-protocol/one-click-sdk-typescript` (aussi Go, Rust). | [INT] accueil ; https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api.md ; [SK] near-intents | 2026-11-09 |
| I-02 | Flux : tokens -> quote `dry:true` -> quote `dry:false` (adresse de dépôt valable environ 10 min) -> dépôt -> `deposit/submit` -> `status` jusqu'à un état terminal. Terminaux : SUCCESS, FAILED, REFUNDED, INCOMPLETE_DEPOSIT ; en cours : PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, PROCESSING. | [SK] near-intents/SKILL.md | 2026-11-09 |
| I-03 | **Pas de testnet** pour NEAR Intents : « There is no testnet version of NEAR Intents - use small amounts for test swaps ». Utiliser le mainnet avec comptes de dev séparés, petits montants, quotes `dry` ; coûts mainnet non remboursés (Q-007/Q-008). | https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/introduction.md ; [HM] | 2026-11-09 |
| I-04 | Auth : la **clé/JWT est optionnelle**, obtenue sur https://partners.near-intents.org (Q-006). Les pages divergent sur le nom (JWT pour la quickstart et [HM] ; « API key » pour fees.md et [SK]) : voir écarts. Détail dans `authentication.md` non lu. | [HM] ; https://docs.near-intents.org/resources/fees.md ; [SK] | 2026-11-09 |
| I-05 | Frais 1Click : sans clé, 0,25 % (25 bps) ajoutés à toute quote hors `ANY_INPUT` ; avec clé sans `appFees`, 0,20 % (0,01 % sur paires stablecoins et routes multichaîne du même actif) ; plus 0,0001 % de frais protocole on-chain. [HM] dit « sans JWT, 0,2 % » : divergence, voir écarts. | https://docs.near-intents.org/resources/fees.md ; [HM] Q-006 | 2026-11-09 |
| I-06 | Le dépôt via Intents n'est pas requis par le hackathon (Q-011) ; c'est une option « hors V1 » chez Darwin. | [HM], CLAUDE.md | 2026-11-09 |

## 8. Réseau NEAR et agent-skills

| ID | Exigence | Source | Lu le |
|---|---|---|---|
| N-01 | Testnet NEAR gratuit : faucet near-cli ou https://near-faucet.io. | [HM] ; [DN] | 2026-11-09 |
| N-02 | Fournisseurs RPC publics listés sur https://docs.near.org/api/rpc/providers (non lu : l'architecte doit y vérifier les URL testnet avant usage). | [HM] Q-009 | 2026-11-09 |
| N-03 | `near/agent-skills` fournit 6 skills : near-ai-cloud, near-api-js, near-dapp, near-intents, near-kit, near-smart-contracts. Installation : `npx skills add near/agent-skills` (option `--skill <nom>`). Ce sont des aides pour agents de code, pas des exigences. | [SK] | 2026-11-09 |

## 9. Écarts avec le prompt initial (CLAUDE.md et briefing)

| # | Sujet | Prompt initial | Sources officielles | Conséquence |
|---|---|---|---|---|
| E-01 | Dates | Construction 1er-14 nov., clôture 14 nov. 23h59 UTC | Identique ([NH], [HM]). Précisions : jugement 16-18 nov. ; fenêtre de code « ouverte le 2026-10-19 » dans [HM] ; dépôt public jusqu'à fin du jugement ; démo hébergée jusqu'au 18 nov. au moins. | Conforme. Préparer README avec section « code antérieur » si du code existe avant le 1er nov. (tout est neuf ici). |
| E-02 | Thème | « Construisez la suite pour l'IA et l'argent » | Thème de la page : « Programmable money » ; aucune trace de la formule du prompt dans les pages lues. | Mineur. Le README doit s'appuyer sur le thème officiel (argent programmable, agents autonomes). |
| E-03 | Tracks | AI Swarms (principale), Agent Economy, Open Innovation | 13 tracks ; ces trois existent (`swarms`, `agents`, `open`). Plusieurs tracks cochables, une seule soumission. D'autres sont plausibles pour Darwin : `business` (Autonomous Business : trésorerie, paiements). | Conforme. Recommander de cocher swarms + agents (+ éventuellement business/open) ; décision à l'humain via le chef de projet. |
| E-04 | Livrables | Dépôt public + README ; démo sur X ; formulaire unique | Ajouts : **fichier LICENSE obligatoire** ; démo **ouvrable** par les juges (captures seules insuffisantes) ; **divulgations README** (code pré-hackathon, tiers, généré par IA, travail NEAR antérieur) ; post X doit dire « built at NEAR HACKATHON ». Le prompt ne mentionne ni LICENSE ni divulgations. | À ajouter à la V1 : LICENSE + section divulgations dans le README (voir CONFORMITE.md). Le fait que Darwin soit largement écrit par des agents IA doit être divulgué. |
| E-05 | Format du formulaire | « Formulaire unique soumis par l'humain » | Formulaire web **et** API JSON `POST /api/applications` avec validations strictes (S-02) ; `size` en tranches ; `tracks` par ids ; adresse NEAR **mainnet** ; champ idea 20-2000 car. ; consentement verbatim ; champ `website` piège. Le formulaire web liste « Website » comme optionnel mais l'API l'interdit. | `docs/FORMULAIRE.md` (rédacteur) doit suivre exactement S-02 (longueurs incluses). La soumission reste humaine. |
| E-06 | Endpoints NEAR AI Cloud | `https://cloud-api.near.ai/v1`, une clé de plateforme, débit par `usage` | Base URL **confirmée**. `usage` confirmé (avec `reasoning_tokens` à gérer). Modèle d'exemple actuel : `zai-org/GLM-5.1-FP8` (pas `DeepSeek-V3.1` de [SK]). Prix par modèle via `/v1/models`. La clé s'obtient par achat de crédits (ou 10 USD via NEAR Builders). cloud.near.ai lui-même n'expose aucune doc d'API. | Le cerveau doit lire `/v1/models` pour les prix et choisir le modèle par configuration, avec repli mock. |
| E-07 | API 1Click | 1Click, feature flag off, un seul moment mainnet | Endpoints confirmés. **Pas de testnet Intents** : toute vraie démo est en mainnet (dépense réelle = feu vert humain écrit, règle 4). JWT/clé optionnelle ; frais 0,25 % sans clé (fees.md) contre « 0,2 % sans JWT » ([HM]) : sources divergentes. Appel `dry:true` sans dépense possible. | Le dev-intents doit se limiter à `tokens` et `quote dry:true` par défaut. Frais exacts à re-vérifier au moment d'une éventuelle exécution. |
| E-08 | Comptes et clés réellement requis | Non précisé | Pour **soumettre** : un compte NEAR **mainnet** (`xxx.near` ou implicite 64 car.) pour le paiement, un email du lead, URL de dépôt public, URL du post X. Pour **faire tourner** Darwin : clé NEAR AI Cloud (optionnelle car mock) ; testnet NEAR gratuit via faucet. Pas de wallet connecté pour soumettre ; pas de JWT 1Click nécessaire ; aucun compte pour « commencer ». | Voir BESOINS_HUMAIN.md. Le code ne doit jamais créer lui-même le compte de paiement. |
| E-09 | Rôle de [DN] | Cité comme source officielle du hackathon | La page docs.near.org/getting-started/hackathons ne contient aucune info sur le hackathon. | Source sans valeur pour les exigences ; ne pas la citer comme preuve. |
| E-10 | Jury | Tri par IA puis juges humains | Confirmé. Précision : l'IA ne rejette pas seule (Q-017) ; elle reproduit le projet et lit le README. | Le README doit être exécutable tel quel par un agent (commandes, résultats attendus). |
| E-11 | Limite du nombre de soumissions | Non précisé | 2 projets max par personne (README croisés), 2 soumissions max par email, un dépôt = une soumission. | Ne pas tester la soumission avec le vrai dépôt ni le vrai email. |
