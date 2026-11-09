# ARCHITECTURE

> Propriétaire : architecte. Version L1 du 2026-11-09. Sources vérifiées le 2026-11-09 (voir `docs/DECISIONS.md` D-003 à D-019). En cas de conflit entre ce document et le code de `shared/`, le code de `shared/` fait foi et ce document doit être corrigé le jour même.
> Tout développeur doit pouvoir démarrer son lot depuis ce document seul, en mode mock.

## 1. Principes

1. **Mock d'abord** : `Chain` et `Brain` sont des interfaces ; `MockChain` et `MockBrain` existent déjà dans `shared/mock/`. Rien ne dépend d'une clé ou du réseau pour tourner.
2. **Une seule source d'historique** : le journal d'événements (§8). L'interface web et les tests se reconstruisent à partir de lui.
3. **Argent exact** : yoctoNEAR en `bigint` / chaîne décimale (D-012).
4. **Jamais de crédit sans preuve vérifiée** : le séquestre ne se libère qu'avec une preuve `accepted` (D-015).
5. **Dépendances dirigées** : `shared` <- tous ; aucun module ne lit `process.env` (tous reçoivent `Config`) ; aucun module métier n'importe `near-api-js`.
6. **Honnêteté** : tout ce qui est simulé est étiqueté (`mock:true`, client `simulated`, mode `dégradé`).

## 2. Stack (versions vérifiées le 2026-11-09)

| Brique | Choix | Version | Vérification |
|---|---|---|---|
| Runtime | Node.js | 22 LTS (>= 22.12 mock ; **>= 22.22.2 testnet**) | `engines` de near-api-js 7.4.0 ; docs.near.org/tools/near-api |
| Langage | TypeScript strict | 6.0.3 | npm |
| Serveur HTTP + SSE | Hono + `@hono/node-server` | 4.13.17 / 2.1.6 | npm, `npm audit` = 0 |
| Validation | zod | 4.6.7 | npm |
| Tests | vitest | 5.1.0 | npm |
| Exécution TS | tsx | 4.23.15 | npm |
| Client NEAR | near-api-js (optionnel, dynamique) | 7.4.0 | npm `latest` ; docs.near.org/tools/near-api (`Account`, `JsonRpcProvider`, `createSubAccount`, `transfer`, `callFunction`) |
| Contrats | Rust, `near-sdk` | 5.30.1 | crates.io ; docs.near.org/smart-contracts/quickstart (« only official SDK ») |
| Build contrat | `cargo-near` | 0.23.0 | crates.io (la doc cite 0.16.1 testé : le dev-contrats confirme) |
| RPC testnet | `https://test.rpc.fastnear.com` | — | docs.near.org/api/rpc/providers |
| IA | NEAR AI Cloud, `https://cloud-api.near.ai/v1` | OpenAI-compatible | SPECS C-01 à C-06 |
| Frontend | HTML + modules ES + CSS, sans build | — | D-009 |

Pas de base de données : l'état vit en mémoire dans le moteur, l'historique dans `data/journal.jsonl` (la simulation repart de zéro à chaque lancement en V1). Pas de Docker nécessaire.

Contrainte locale constatée : `rustc`/`cargo` ne sont pas installés sur la machine de développement. Le mode mock n'en a pas besoin ; le dev-contrats installe la chaîne d'outils (gratuit) ou active le repli D-016.

## 3. Vue d'ensemble

```
                       navigateur  (frontend/ : HTML + ES modules)
                          |  GET /api/state, POST /api/tasks      ^ SSE /api/stream
                          v                                       |
 +--------------------------------------------------------------------------+
 | backend/  (Hono)  composition root : construit Config, Chain, Brain,     |
 |                   Journal, Market, Engine ; expose REST + SSE + statique |
 +------+-------------------+----------------------+------------------------+
        |                   |                      |
   engine/  <----------->  market/               intents/ (V2, flag off)
   cycle de vie, ticks,    tâches, enchères,
   génome, économie        séquestre, validation,
        |    |             réputation
        |    +--------------+
        v                   v
     brain/ (Brain)     accounts/ (Chain)  ---->  contracts/darwin (Rust, testnet)
     MockBrain          MockChain
     NearAiBrain        NearChain (near-api-js)
        ^                   ^
        +----  shared/  ----+   types, interfaces, mocks, config, journal, argent
```

## 4. Modules et frontières

| Dossier | Propriétaire | Exporte | Peut importer | Ne doit pas |
|---|---|---|---|---|
| `shared/` | architecte | types, `Chain`, `Brain`, `Market`, `Engine`, `Intents`, `Journal`, `Config`, `MockChain`, `MockBrain`, utilitaires (`money`, `rng`, `hash`) | `zod`, `node:crypto` | importer un autre module ; lire `process.env` hors de `loadConfig` |
| `contracts/darwin/` | dev-contrats | contrat WASM (§10) | Rust uniquement | être requis par le mode mock |
| `accounts/` | dev-comptes-wallets | `createChain(config): Chain` ; `NearChain` | `shared`, `near-api-js` (import dynamique) | contenir de la logique de marché ou d'évolution ; journaliser une clé |
| `brain/` | dev-cerveau-ia | `createBrain(config): Brain` ; `NearAiBrain` (+ prompts) | `shared` | débiter un solde (c'est le rôle de l'engine) ; coder un id de modèle sans le vérifier via `/v1/models` |
| `market/` | dev-marche | `createMarket(deps): Market` | `shared` (donc `Chain` pour séquestre/réputation) | connaître le génome ou le cycle de vie ; appeler `Brain` pour exécuter les tâches |
| `engine/` | dev-moteur-evolution | `createEngine(deps, market): Engine` ; génome, mutation, lettre, métabolisme | `shared`, interface `Market` | importer `accounts/` ou `brain/` directement (injection) ; émettre un événement hors catalogue |
| `intents/` | dev-intents | `createIntents(config): Intents` (mock + 1Click `dry:true`) | `shared` | `dry:false`, dépôt, signature mainnet ; démarrer si `INTENTS_ENABLED!=true` |
| `backend/` | dev-backend | `main.ts`, app Hono, SSE, persistance du journal, scripts de lancement | tout (composition root) | contenir des règles métier |
| `frontend/` | dev-frontend | pages statiques | HTTP/SSE uniquement (jamais d'import TS des autres dossiers ; types recopiés en JSDoc) | parler à la chaîne ou à l'IA directement |
| `tests/e2e/` | qa | scénarios bout en bout (démarrent le backend en mock) | tout | modifier le code testé |
| `scripts/` | securite (`scan-secrets.*`), dev-backend (lancement) | scripts utilitaires | — | embarquer un secret |

Tests unitaires : à côté du code (`engine/xxx.test.ts`, `market/xxx.test.ts`, `shared/shared.test.ts`), lancés par `npm test` (vitest trouve tous les `*.test.ts`). Tests e2e : `tests/e2e/*.test.ts`.

## 5. Structure définitive des dossiers

```
Darwin/
  CLAUDE.md  README.md  LICENSE(*)  package.json  tsconfig.json  .env.example  .gitignore
  docs/            SPECS, CONFORMITE, ARCHITECTURE, DECISIONS, PLAN, STATUS, BESOINS_HUMAIN, SECURITE, ...
  shared/          index.ts money.ts rng.ts hash.ts types.ts events.ts chain.ts brain.ts bus.ts
                   config.ts modules.ts mock/{mock-chain.ts,mock-brain.ts} shared.test.ts     (fait, L1)
  contracts/darwin/  Cargo.toml  src/{lib.rs,registry.rs,escrow.rs,reputation.rs}  tests/        (L3)
  accounts/        index.ts (createChain)  near-chain.ts  keys.ts                                 (L2)
  brain/           index.ts (createBrain)  near-ai-brain.ts  prompts.ts                            (L5)
  market/          index.ts (createMarket)  auction.ts  validation.ts  simulated-client.ts         (L6)
  engine/          index.ts (createEngine)  genome.ts  lifecycle.ts  economy.ts  policy.ts         (L4)
  intents/         index.ts (createIntents)  mock-intents.ts  oneclick.ts                          (L9)
  backend/         main.ts  app.ts  sse.ts  journal-store.ts  state.ts                             (L7)
  frontend/        index.html  app.js  tree.js  style.css                                          (L8)
  scripts/         scan-secrets.mjs  (+ lancement si besoin)
  tests/e2e/       *.test.ts                                                                       (L12)
  data/            journal.jsonl (exécution, ignoré par git)
```
(*) `LICENSE` obligatoire (SPECS L-02) : à la charge du rédacteur / chef de projet (MIT proposé).

Imports : toujours avec l'extension `.ts` (`import { X } from "../shared/index.ts"`). `tsconfig.json` couvre tous les dossiers sauf `frontend/` et `contracts/`.

## 6. Interfaces

Tout est défini dans `shared/` (code compilé et testé). Résumé ; le détail des signatures est dans le code.

### 6.1 `Chain` (`shared/chain.ts`)
- Comptes : `createAccount({label, initialFunding, fundFrom?})` -> sous-compte `label.<maître>` ; `getBalance` ; `transfer` ; `closeAccount` (mort : solde restant renvoyé au bénéficiaire, compte clos).
- Registre : `registerAgent` (génome + hash, lignée), `markAgentDead`, `getAgentRecord`, `listAgentRecords` : la lignée est conservée après la mort.
- Séquestre : `lockEscrow` -> `releaseEscrow` (preuve obligatoire, sinon `ChainError PROOF_REQUIRED`) ou `refundEscrow` (motifs `rejected` ou `expired` uniquement, comme le contrat).
- Réputation : `addReputation` (delta entier non nul, |delta| <= 100 ; crédit seulement après séquestre libéré vers cet agent avec `proofHash` = `resultHash` ; malus seulement après remboursement ; une écriture par tâche et agent, sinon `REPUTATION_EXISTS`), `getReputation`. `MockChain` applique ces règles (D-031).
- Codes d'erreur notables : `SPEND_CAP_EXCEEDED` (plafond de dépense de `NearChain`, distinct de `INSUFFICIENT_FUNDS`).
- `AgentRecord.accountId` est le compte payeur (coûts, séquestre) et bénéficiaire (paiements) de l'agent. `getEscrow(taskId)` renvoie `{taskId, payer, amount, status}` (D-030).
- Toute opération d'écriture renvoie un `TxReceipt` (`hash`, `explorerUrl?`) ; les erreurs sont des `ChainError` typées.
- Implémentations : `MockChain` (fait ; invariant testé : somme comptes + séquestres constante) ; `NearChain` (L2/L3). Fabrique unique `createChain(config)` dans `accounts/index.ts`.

### 6.2 `Brain` (`shared/brain.ts`)
- `listModels()` (ids + prix USD/Mtok, lus depuis `GET /v1/models`), `defaultModel()`, `complete({agentId, purpose, model, messages, maxTokens})` -> `{text, usage, model, mock}`.
- Le Brain ne débite rien. L'engine appelle `costYocto(usage, prix, nearUsdRate)` (`shared/money.ts`) et émet `brain.charged` + débite l'agent (D-013).
- `NearAiBrain` : `POST {NEARAI_BASE_URL}/chat/completions`, en-tête `Authorization: Bearer ${NEARAI_API_KEY}`, `usage.completion_tokens_details.reasoning_tokens` (alias `reasoning_tokens`) à lire ; si `/v1/models` n'a pas le modèle du gène : `BrainError UNKNOWN_MODEL`, repli sur `defaultModel()`. Sans clé : `createBrain` renvoie `MockBrain`.

### 6.3 `Market`, `Engine`, `Intents` (`shared/modules.ts`)
- `Deps` = `{config, chain, brain, journal, rng, now}` injecté dans toutes les fabriques.
- `Market` : `postTask`, `placeBid`, `step(tick)`, `submitResult` (valide puis libère ou rembourse), `getTask`, `listTasks`, `openTasks`.
- `Engine` : `start/pause/resume/stop`, `tick()` (un tick sans horloge, pour les tests), `getState(): SimState`.
- `Intents` : `quoteDry` seulement.

### 6.3b Propriété des comptes de service et temps (D-027 à D-029)
- `chain.tx` en mock : `MockChain` n'a pas de journal ; c'est le moteur (`createEngine(deps, market, { emitChainTx: true })`, type `EngineOptions`) qui émet `chain.tx` pour ses transferts. Le backend n'enveloppe pas `MockChain`. Avec `NearChain`, `accounts/` émet déjà : option à false.
- (D-029) Le marché possède, crée et finance les comptes `sim-client` et `visitors` (`Chain.createAccount`, financement depuis le maître, `funding.received` source `master`/`demo`). Il déduit le tick courant du dernier `step(tick)` ou du journal (pas d'horloge injectée en plus).
- Calibrage demo : `nearUsdRate` = 0.01 pour que le gène « modèle » pèse dans l'économie (un appel `mock/large` ≈ 0,07 NEAR, `mock/small` ≈ 0,01 NEAR, contre un métabolisme de 0,08/tick). Voir D-028.

### 6.4 Division du travail agent <-> marché
L'agent (engine) décide : enchérir ou non, à quel prix (`askRatio` du génome x budget, borné par son coût IA estimé), exécuter (appel `Brain`, coût débité), sous-traiter (créer une tâche fille via `Market.postTask` avec `requester:{kind:"agent"}`). Le marché ne connaît que des identifiants d'agents et des comptes.

## 7. Schémas de données (`shared/types.ts`)

Tous sérialisables en JSON ; montants = `Yocto` (chaîne d'entier).

| Objet | Champs principaux |
|---|---|
| **Genome** | `profession` (writer, translator, summarizer, analyst, coder), `model`, `askRatio` [0.3-1] (prix demandé / budget), `risk` [0-1], `reproThreshold` [1.2-4] (multiple du capital de naissance), `generosity` [0-0.6] (part de capital en plus donnée à l'enfant), `cooperation` [0-1] (sous-traitance), `personality` (prompt système). Validé par `GenomeSchema`, bornes dans `GENOME_BOUNDS`. |
| **Agent** | `id` (a-0001), `name`, `accountId`, `generation`, `parentId`, `childrenIds`, `genome`, `status` (alive/dead), `birthTick/deathTick`, `bornAt/diedAt`, `causeOfDeath` (starvation/manual/reset), `birthCapital`, `balance`, `earned`, `spentBrain`, `reputation`, `tasksDone`, `letterId`, `birthTx`. |
| **Task** | `id` (t-0001), `requester` (`visitor` / `simulated` / `agent`), `parentTaskId?`, `profession`, `title`, `prompt`, `budget`, `status` (posted, awarded, submitted, settled, rejected, expired), `createdTick`, `biddingEndsTick`, `deadlineTick`, `winnerId`, `winningBidId`, `bidIds`, `escrowId`, `result{text,resultHash,submittedTick}`, `validation`. |
| **Bid** | `id`, `taskId`, `agentId`, `price`, `etaTicks`, `pitch?`, `tick`, `won?`. |
| **Escrow** | `id` (= taskId), `taskId`, `payer`, `payee?`, `amount`, `status` (locked/released/refunded), `lockTx`, `settleTx`, `proof{resultHash,verdict:"accepted",validator}`. |
| **Validation** | `verdict` (accepted/rejected), `score` [0-1], `validator` (`brain:<modèle>` / `rule:<nom>` / `visitor`), `reason`, `resultHash`, `tick`. |
| **Letter** | `id` (l-0001), `fromAgentId`, `toAgentId`, `generation`, `text`, `model`, `mock`, `tick`, `createdAt`. |
| **DarwinEvent** | `{seq, ts, tick, type, data}` (§8). |
| **TaskInput** (formulaire visiteur, `TaskInputSchema`) | `title` 3-120, `prompt` 10-4000, `profession`, `budgetNear` (décimal, borné par `DARWIN_TASK_BUDGET_MIN/MAX`), `requesterLabel`. |

Règle de désignation des tâches : attribution au meilleur score = prix bas, départagé par réputation (détail laissé à dev-marche, documenté dans `market/`).

## 8. Catalogue d'événements (`shared/events.ts`, type `EventCatalog`)

Journal append-only, `seq` croissant sans trou. Ajouter un type exige de modifier `EventCatalog` + `EVENT_TYPES` + ce tableau.

| Type | Émis par | Charge utile (`data`) |
|---|---|---|
| `sim.started` | engine | mode, preset, seed, chain, brain |
| `sim.paused` / `sim.resumed` | engine | — |
| `sim.stopped` | engine | reason (extinction/manual/max_ticks/error), generations |
| `sim.tick` | engine | alive, tasksOpen, totalBalance |
| `agent.born` | engine | agent complet, parentId, birthTx |
| `agent.reproduced` | engine | parentId, childId, transferred, mutations (gène -> [avant, après]) |
| `agent.died` | engine | agentId, cause, finalBalance, swept, sweptTo, tx |
| `letter.written` | engine | letter |
| `task.posted` | market | task |
| `bid.placed` | market | bid |
| `task.awarded` | market | taskId, bidId, winnerId, price, bids |
| `task.expired` | market | taskId, reason (no_bids/deadline/unfunded/winner_dead) |
| `escrow.locked` | market | taskId, payer, amount, tx |
| `task.submitted` | market | taskId, agentId, resultHash |
| `task.validated` | market | taskId, validation |
| `escrow.released` | market | taskId, payee, amount, tx |
| `escrow.refunded` | market | taskId, payer, amount, tx |
| `subcontract.created` | market | parentTaskId, childTaskId, byAgentId |
| `reputation.updated` | market | agentId, delta, total, taskId, tx |
| `brain.charged` | engine | agentId, purpose, model, promptTokens, completionTokens, reasoningTokens, cost, costUsd, nearUsdRate, priceSource (`models`/`mock`), mock, tx |
| `balance.changed` | engine | agentId, balance, delta, reason (metabolism/brain/task/birth/...) |
| `funding.received` | engine/backend | to, amount, source (master/faucet/demo), tx |
| `chain.tx` | accounts (NearChain, journal injecté) ; engine en mock (`emitChainTx`, D-027) | kind, from, to, amount, hash, explorerUrl : alimente le « flux de transactions » de l'UI |
| `intents.quote` | intents | devis `dry:true` seulement |
| `system.warning` / `system.error` | tous | code, message (jamais de secret) |

Règle : tout événement qui touche à l'argent porte un `tx`/`hash` (mock ou réel) pour que l'UI affiche le flux de transactions.

## 9. Temps réel et API

**Flux : SSE** (D-008). `GET /api/stream` : `Content-Type: text/event-stream` ; chaque message `id: <seq>`, `event: <type>`, `data: <DarwinEvent JSON>` ; en-tête `Last-Event-ID` (ou `?since=<seq>`) rejoue les événements manquants ; commentaire `: ping` toutes les 15 s. Initialisation côté client : `GET /api/state` (`SimState.lastSeq`), puis `EventSource` depuis `lastSeq`.

| Route | Rôle |
|---|---|
| `GET /api/health` | `{ok, mode, chain, brain, tick, escrow: "contract" \| "operator-account"}` (D-022) |
| `GET /api/config` | configuration publique (`redactConfig`) |
| `GET /api/state` | `SimState` complet |
| `GET /api/agents`, `/api/agents/:id` | agents (vivants et morts), détail + lignée |
| `GET /api/lineage` | arbre `{id, parentId, generation, status}` pour l'arbre généalogique |
| `GET /api/letters/:id`, `/api/agents/:id/letter` | lettre parent -> enfant |
| `GET /api/tasks`, `/api/tasks/:id` | tâches, offres, séquestre, validation |
| `POST /api/tasks` | formulaire visiteur ; corps = `TaskInput` ; 201 + `Task`, 400 si invalide (erreurs zod), 429 au-delà de 10 tâches ouvertes par IP |
| `GET /api/events?since=&limit=` | journal paginé |
| `POST /api/sim/start|pause|resume|stop` | contrôle ; exige `Authorization: Bearer ${DARWIN_ADMIN_TOKEN}` ; le token est OBLIGATOIRE dès que `HOST` n'est pas `127.0.0.1` (démarrage refusé sinon, D-023) |
| `GET /*` | statique `frontend/` |

Le serveur écoute `127.0.0.1:3000` par défaut. Aucune route ne renvoie un secret ni la configuration brute.

## 10. Contrat NEAR `contracts/darwin` (Rust, near-sdk 5.30.1)

Un contrat, trois modules, un opérateur (le compte maître). Méthodes minimales :
- Registre : `register_agent(record)`, `mark_dead(agent_id, death_tick, cause)`, vues `get_agent`, `list_agents(from,limit)`.
- Séquestre : `lock_escrow(task_id, payer)` payable (le dépôt est reçu par le contrat) , `release_escrow(task_id, payee, proof)` (preuve non vide, verdict `accepted`), `refund_escrow(task_id, reason)`, vue `get_escrow`.
- Réputation : `add_reputation(agent_id, task_id, delta, proof_hash)`, vue `get_reputation`.
- Garde : seuls l'opérateur et (pour `lock_escrow`) le payeur autorisé appellent les écritures. Événements NEP-297 en JSON pour chaque écriture.
- Hypothèse à confirmer par dev-contrats : le payeur de `lock_escrow` est un sous-compte détenu par le moteur ; le moteur signe donc pour les sous-comptes (clés générées par `accounts/`, stockées hors dépôt, jamais journalisées).

Mapping `Chain` -> contrat : `registerAgent` -> `register_agent` ; `lockEscrow` -> `lock_escrow` ; `releaseEscrow` -> `release_escrow` ; `addReputation` -> `add_reputation`. `createAccount`, `transfer`, `closeAccount` sont des actions de compte (sans contrat).

## 11. Variables d'environnement

Détail commenté dans `.env.example` ; valeurs par défaut dans `shared/config.ts` (`loadConfig`). Les secrets sont marqués SECRET et n'apparaissent jamais dans les logs (`redactConfig`).

| Groupe | Variables |
|---|---|
| Mode | `DARWIN_MODE` (mock/testnet), `DARWIN_PRESET` (normal/demo), `DARWIN_CHAIN` (mock/near), `DARWIN_BRAIN` (mock/nearai), `DARWIN_SEED` |
| Serveur | `HOST`, `PORT`, `DARWIN_DATA_DIR`, `DARWIN_ADMIN_TOKEN` (SECRET, obligatoire si `HOST` != `127.0.0.1`), `DARWIN_VISITOR_HOURLY_CAP_NEAR` (plafond horaire du compte de démo, en NEAR ; lu dans `sim.visitorHourlyCap: bigint`, défauts : mock normal 20 / demo 30, testnet 0,5 ; D-025, D-026) |
| NEAR | `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_MASTER_ACCOUNT_ID`, `NEAR_MASTER_PRIVATE_KEY` (SECRET), `NEAR_CONTRACT_ID` |
| NEAR AI Cloud | `NEARAI_API_KEY` (SECRET), `NEARAI_BASE_URL`, `NEARAI_MODEL`, `NEARAI_TIMEOUT_MS` |
| Simulation | voir §12 |
| Intents | `INTENTS_ENABLED`, `INTENTS_BASE_URL`, `INTENTS_JWT` (SECRET), `INTENTS_DRY_ONLY` |

Résolution (D-011) : `mock` (défaut) = chaîne et cerveau mock. `testnet` = chaîne `near` (exige `NEAR_MASTER_ACCOUNT_ID` et `NEAR_MASTER_PRIVATE_KEY`, sinon erreur claire au démarrage et ligne dans `docs/BESOINS_HUMAIN.md`) ; cerveau `nearai` si `NEARAI_API_KEY`, sinon mock + `system.warning`.

## 12. Paramètres de simulation

Cible : **3 générations complètes en 3 à 5 minutes** avec `DARWIN_PRESET=demo` (mock). Montants en NEAR, durées en ticks. Défauts (mock) ; la table testnet est dans `shared/config.ts`.

| Variable | normal | demo | Rôle |
|---|---|---|---|
| `DARWIN_TICK_MS` | 1000 | 400 | durée réelle d'un tick |
| `DARWIN_FOUNDERS` | 4 | 4 | fondateurs (génération 1) |
| `DARWIN_MAX_POPULATION` | 24 | 16 | plafond de population (pas de naissance au-delà) |
| `DARWIN_MAX_TICKS` | 0 (infini) | 900 | arrêt automatique (900 x 0,4 s = 6 min) |
| `DARWIN_BIRTH_CAPITAL` | 10 | 10 | capital de naissance |
| `DARWIN_METABOLISM` | 0.05 | 0.08 | coût de vie par tick |
| `DARWIN_MIN_VITAL` | 1 | 1.5 | sous ce solde : mort |
| `DARWIN_REPRO_COOLDOWN_TICKS` | 20 | 10 | délai minimal entre deux enfants |
| `DARWIN_SIM_CLIENT_RATE` | 1.2 | 1.5 | tâches simulées par tick (espérance) |
| `DARWIN_TASK_BUDGET_MIN/MAX` | 0.5 / 2 | 0.5 / 2.5 | budget des tâches |
| `DARWIN_BID_WINDOW_TICKS` | 2 | 1 | durée des enchères |
| `DARWIN_TASK_DEADLINE_TICKS` | 8 | 5 | délai d'exécution |
| `DARWIN_MUTATION_RATE` / `_SD` | 0.3 / 0.15 | 0.4 / 0.2 | mutation par gène / amplitude relative |
| `DARWIN_NEAR_USD_RATE` | 3 | 0.01 (D-028) | USD par NEAR pour convertir le coût IA |
| `DARWIN_MAX_TOKENS_PER_CALL` | 400 | 300 | plafond de tokens par appel IA |
| `DARWIN_SETTLE_EVERY_TICKS` | 1 | 1 | regroupement des débits on-chain (4 en testnet) |
| `DARWIN_VISITOR_HOURLY_CAP_NEAR` | 20 | 30 | plafond horaire du compte `visitors` (testnet : 0,5) ; 429 au-delà |

Ordre de grandeur voulu (à calibrer par dev-moteur, avec la QA) : un fondateur sans revenu meurt en environ (10 - 1,5) / 0,08 = 106 ticks ; un agent qui gagne en moyenne plus de 0,08 + coût IA par tick atteint le seuil de reproduction (`reproThreshold` x capital) avant le tick 60 ; la 3e génération naît avant le tick 300. Si le calibrage échoue, ajuster les presets (fichier `shared/config.ts`), pas le moteur.

Testnet : montants volontairement minuscules (capital 0.2-0.3 NEAR), ticks lents (3-4 s), débits regroupés ; le faucet limite le total disponible (https://near-faucet.io). Aucun montant n'est fixé par mémoire sur la quantité fournie : le dev-comptes documente ce que le faucet donne réellement.

## 13. Boucle d'un tick (contrat de comportement du moteur)

1. Métabolisme : `DARWIN_METABOLISM` débité à chaque agent vivant (vers le compte maître ; regroupé si `settleEveryTicks > 1`, le solde logique = solde on-chain moins dettes en attente).
2. Client simulé : tire `Poisson(simClientRatePerTick)` tâches (budget uniforme, profession aléatoire), `Market.postTask` avec `requester:{kind:"simulated"}`. Les tâches de visiteurs arrivent par `POST /api/tasks`.
3. Enchères : chaque agent vivant libre de la bonne profession décide d'enchérir (`placeBid`) ; `Market.step(tick)` attribue.
4. Exécution : le gagnant appelle `Brain.complete` (coût débité, événement `brain.charged`), puis `Market.submitResult`. Avec probabilité liée à `cooperation`, il sous-traite une partie.
5. Validation et paiement : dans `submitResult` (preuve -> `releaseEscrow`, `addReputation`) ou remboursement.
6. Reproduction : si solde >= `reproThreshold` x `birthCapital`, population < max, délai écoulé : enfant (mutation, capital = `birthCapital` + `generosity` x surplus, `Chain.createAccount` + `registerAgent`), puis lettre via `Brain` (`letter.written`).
7. Mort : solde logique < `minVital` : `markAgentDead`, `closeAccount` vers le maître, `agent.died`. Si plus aucun vivant : `sim.stopped(extinction)`.
8. `sim.tick`.

Tous les tirages passent par `Deps.rng` (graine `DARWIN_SEED`) : en mock, deux exécutions de même graine donnent le même journal (hors horodatages).

## 14. Commandes de lancement

| Besoin | Commande | Attendu |
|---|---|---|
| Installer | `npm install` | aucune clé requise |
| Lancer en mock | `npm start` | page sur http://127.0.0.1:3000 (lot L7 ; script défini dans `package.json`) |
| Démo rapide mock | `npm run start:demo` | 3 générations en quelques minutes |
| Tests | `npm test` | vitest, tous verts (11 tests déjà en place dans `shared/`) |
| Types | `npm run typecheck` | `tsc --noEmit` sans erreur |
| Testnet | copier `.env.example` vers `.env`, renseigner `NEAR_MASTER_ACCOUNT_ID`, `NEAR_MASTER_PRIVATE_KEY`, optionnellement `NEARAI_API_KEY`, puis `npm run start:testnet` | Node >= 22.22.2 requis |
| Build contrat | `npm run contracts:build` | exige Rust + `cargo-near` ; inutile en mock |
| Scan de secrets | `npm run scan-secrets` | script du lot sécurité |

Les scripts `start*` pointent vers `backend/main.ts`, créé au lot L7 : avant L7 ils échouent (normal).

## 15. Intents (V2, hors V1)

`intents/` (lot L9) : `types.ts`, `base.ts`, `oneclick.ts` (client 1Click complet : `GET /v0/tokens`, `POST /v0/quote` en `dry:true` puis `dry:false`, `POST /v0/deposit/submit`, `GET /v0/status`), `guard.ts` (verrous), `proof.ts` (preuve de dépôt), `mock-intents.ts`, `demo.ts` (CLI : `tokens`, `dry`, `run`, `status`), `intents.test.ts`. Procédure humaine : `intents/DEMO_MAINNET.md`. Mainnet uniquement (Intents n'a pas de testnet) ; le code ne signe jamais, l'humain envoie le dépôt depuis son wallet.

Verrous : `INTENTS_ENABLED=false` par défaut ; `dry:false` et `deposit/submit` refusés tant que `INTENTS_DRY_ONLY` n'est pas `false` (et feu vert écrit dans `docs/BESOINS_HUMAIN.md`) ; un devis `dry:true` identique est obligatoire avant `dry:false` ; plafond de 5 USD par opération (`maxUsd`) ; clé partenaire optionnelle `INTENTS_JWT` (en-tête `X-API-Key`, jamais journalisée).

Preuve de dépôt : `verifyDeposit` n'émet une preuve que si `/v0/status` indique `SUCCESS` et recoupe NOTRE devis (correlationId, adresse de dépôt, destinataire, actifs, `amountOut >= minAmountOut`, hash de destination présent, aucun remboursement). Un crédit n'est possible qu'une fois par dépôt et jamais sans preuve émise par `verifyDeposit`. Aucune interaction avec la V1.

## 16. Qualité et sécurité transverses

- Aucun module n'écrit un secret dans un log, un événement ou une réponse HTTP (`redactConfig`, messages d'erreur sans clé).
- Le journal est public par nature (affiché dans l'UI) : ne jamais y mettre de clé, de prompt système complet d'un visiteur ni d'adresse e-mail.
- Entrées utilisateur : validées par zod (`TaskInputSchema`) ; textes échappés côté frontend (jamais `innerHTML` sur du contenu d'agent ou de visiteur).
- Limites : 4000 caractères par prompt de tâche, 10 tâches ouvertes par IP, `maxTokensPerCall`.

## 17. Points à faire valider (gardien des specs) et risques

Questions 1 à 5 tranchées par le gardien le 2026-11-09 (Avis L1, `docs/CONFORMITE.md`) ; décisions D-020 à D-025.

1. **Coût IA sur la chaîne (D-013) : ACCEPTÉ SOUS CONDITIONS (D-020).** Débit NEAR = représentation, pas un paiement à NEAR AI Cloud. `brain.charged` porte `costUsd`, `nearUsdRate`, `priceSource` ; prix inconnu = erreur (`assertValidPrice`), jamais un coût 0 silencieux ; les appels mock sont étiquetés `mock:true`.
2. **Tokens de raisonnement (C-05) : RÈGLE DURCIE (D-021).** `billable = max(completion, total - prompt, reasoning, 0)` (`shared/money.ts`, testé). Reste à vérifier sur réponse réelle (dev-cerveau, L5) ; peut légèrement surestimer.
3. **Modèle de confiance du séquestre (D-015) : ACCEPTÉ, divulgation obligatoire (D-024).** `validator` et `resultHash` journalisés, UI « validé par ».
4. **Tâches de visiteurs financées par la démo (D-014) : ACCEPTÉ SOUS CONDITIONS (D-025).** `funding.received.source = "demo"` ; plafond horaire du compte `visitors.<maître>`.
5. **Chaîne d'outils Rust absente (D-016) : REPLI SEULEMENT, échéance 2026-11-11 23:59 UTC (D-022).** Mode dégradé : badge permanent, `/api/health.escrow`.
6. **Node >= 22.22.2 pour le testnet (D-005)** : à annoncer dans le README (J-01 : le juge IA doit pouvoir lancer au moins le mock sur Node 22.12+).
7. **Faucet et URL d'explorateur testnet** : non vérifiés ici (`ChainInfo.explorerBase` laissé vide) ; dev-comptes les vérifie et les documente.
8. **LICENSE (L-02)** absente du dépôt ; hors périmètre architecte, à confier au rédacteur.
9. **Ancien constat** : plusieurs fichiers de coordination ont un encodage corrompu (D-019) ; à corriger par le chef de projet.
