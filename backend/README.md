# backend/ (lot L7)

Composition root de Darwin : **un seul processus** qui assemble `accounts/` (Chain), `brain/` (Brain), `market/`, `engine/` et le journal, puis expose une API HTTP (Hono), le flux temps réel SSE et les fichiers statiques de `frontend/`. Aucune règle métier ici.

## Lancer

| Commande | Effet |
|---|---|
| `npm start` / `npm run start:mock` | mock complet, sans clé (`start:mock` force `DARWIN_MODE=mock`) |
| `npm run start:demo` | mock, preset `demo` (3 générations en quelques minutes) |
| `npm run start:testnet` | testnet : exige `NEAR_MASTER_ACCOUNT_ID` et `NEAR_MASTER_PRIVATE_KEY` (Node >= 22.22.2) ; cerveau `nearai` si `NEARAI_API_KEY` |

Page : <http://127.0.0.1:3000>. Un fichier `.env` à la racine est lu s'il existe (`process.loadEnvFile`), sans jamais remplacer une variable déjà définie. Arrêt : Ctrl+C (arrêt propre : moteur arrêté, dettes réglées, dernier instantané écrit).

Au démarrage : `loadConfig` -> refus si `HOST` n'est pas `127.0.0.1` sans `DARWIN_ADMIN_TOKEN` (D-023, R7) -> en testnet `NearChain.checkReady()` (RPC testnet joignable, compte maître existant ; sinon erreur claire et arrêt) -> écoute HTTP -> `engine.start()` (fondateurs puis boucle de ticks).

## Branchements (`runtime.ts`)

- `journal` = `createJournal` : chaque événement est ajouté à `data/journal.jsonl` ; les messages `system.warning/error` sont masqués (`ed25519:`, `Bearer`, `sk-`, JWT) avant tout abonné.
- `chain.tx` : avec `NearChain`, `onTx` du backend émet `chain.tx` ; en mock `onTx` n'est jamais appelé et c'est le moteur qui émet (`emitChainTx`, D-027) : un seul émetteur, pas de doublon (testé).
- `onWarning` de `NearChain` et du cerveau -> `system.warning`. Testnet sans `NEARAI_API_KEY` : cerveau mock + `system.warning BRAIN_NO_KEY` (D-011).
- Plafonds IA : `NEARAI_MAX_USD_PER_RUN` / `NEARAI_MAX_USD_PER_HOUR` (USD, optionnels, > 0) passés à `createBrain` (`guardrails.maxUsdPerRun/maxUsdPerHour`) ; absents = défauts du cerveau (2 et 1 USD).
- Séquestre : `/api/health.escrow` = `"contract"` seulement si `NearChain` a un `NEAR_CONTRACT_ID`, sinon `"operator-account"` (dégradé, D-022), **y compris en mock** (`mock: true` le dit séparément).

## Routes

Erreurs : `{"error":{"code","message", ...}}`. Tous les montants sont des chaînes yoctoNEAR. Aucune route ne renvoie de secret ni la config brute.

| Route | Réponse |
|---|---|
| `GET /api/health` | `{ok, version, mode, chain:{kind,masterId,contractId?}, brain:{kind}, escrow, mock, tick, running, paused, startedAt, visitors:{spentLastHour, hourlyCap}}` |
| `GET /api/config` | config publique (mode, preset, chain, brain, sim, intents.enabled) sans secret |
| `GET /api/state` | `SimState` complet (`lastSeq` = point de reprise du flux) |
| `GET /api/agents?status=alive\|dead` | `{agents}` |
| `GET /api/agents/:id` | `{agent, ancestors[], children[], letterReceived?, lettersWritten[], tasks[]}` |
| `GET /api/agents/:id/letter`, `GET /api/letters/:id` | `{letter}` (404 pour un fondateur) |
| `GET /api/lineage` | `{generations, roots[], nodes[{id,parentId,generation,status,name,profession,model,birthTick,deathTick?,causeOfDeath?,balance,childrenIds}]}` |
| `GET /api/tasks?status=&profession=&limit=` | `{tasks}` ; chaque tâche = `Task` + `badge` (`"simulé"`, `"Visiteur (financé par le compte de démo)"`, `"sous-traitance"`) + `validatedBy` (« validé par : ... ») |
| `GET /api/tasks/:id` | `{task, bids[], escrow?}` |
| `POST /api/tasks` | formulaire visiteur (voir ci-dessous) |
| `GET /api/events?since=&limit=` | `{events[], lastSeq}` (limit <= 1000) |
| `GET /api/stream` | SSE (voir ci-dessous) |
| `POST /api/sim/start\|pause\|resume\|stop` | admin ; `{ok, running, paused, tick}` ; 409 si l'état ne le permet pas (une simulation arrêtée ne redémarre pas : relancer le processus) |
| `GET /*` | statique `frontend/` ; sans `frontend/index.html`, une page de repli minimale (état brut, rafraîchie toute seule) |

### `POST /api/tasks`

Corps JSON (`Content-Type: application/json`, 16 Ko max) : `{title (3-120), prompt (10-4000), profession, budgetNear ("1.5" ou nombre), requesterLabel}` (`TaskInputSchema`). `201` + tâche (+ en-tête `Location`).

| Statut | Cas |
|---|---|
| 400 | JSON ou champs invalides, budget hors bornes (`INVALID_INPUT`, `BUDGET_OUT_OF_RANGE`) |
| 413 / 415 | corps trop gros / pas de JSON |
| 429 | `TOO_MANY_OPEN_TASKS` (10 tâches ouvertes par IP), `VISITOR_CAP_EXCEEDED` (plafond horaire du compte de démo, D-025), `MARKET_BUSY` (100 tâches de visiteurs ouvertes au total), `RATE_LIMITED` (6 publications/min/IP) ; `Retry-After` fourni |
| 503 | `SIM_NOT_RUNNING` ; `VALIDATION_PENDING` = **état d'attente non fatal** (`retryable:true`, `Retry-After: 5`, rien n'est journalisé comme erreur) |
| autres | `MarketError.httpStatus` tel quel ; erreur inconnue = 500 sans détail |

Les tâches ouvertes d'une IP = statuts `posted`, `awarded`, `submitted`. L'IP est celle de la socket (X-Forwarded-For est ignoré car falsifiable : derrière un proxy, toutes les IP se confondent, voir « Reste »).

### Flux SSE `GET /api/stream`

Chaque message : `id: <seq>`, `event: <type>` (ex. `agent.born`, `chain.tx`), `data: <DarwinEvent JSON>` = `{seq, ts, tick, type, data}`. Les types sont ceux de `shared/events.ts` ; le client s'abonne par type avec `addEventListener(type, ...)` (les événements nommés ne passent pas par `onmessage`). Reprise : `EventSource` renvoie seul `Last-Event-ID` ; on peut aussi passer `?since=<seq>`. Séquence côté client : `GET /api/state`, puis `new EventSource("/api/stream?since=" + state.lastSeq)`. Commentaire `: ping` toutes les 15 s. Événement spécial `event: reset` (`data: {"lastSeq":n}`, sans `id`) si le client reprend avec un id plus grand que le journal (le serveur a redémarré, la simulation repart de zéro) : le client vide son affichage, le rejeu depuis le début suit. Un client trop lent (file > 5000) est déconnecté et reprend avec `Last-Event-ID`. Plafonds : 8 flux par IP, 300 au total.

## Administration et sécurité

- Routes `POST /api/sim/*` : `Authorization: Bearer <DARWIN_ADMIN_TOKEN>` (comparaison à temps constant, 10 échecs/min/IP puis 429). Sans jeton configuré, elles sont ouvertes **uniquement** parce que le serveur n'écoute que sur 127.0.0.1.
- Anti-CSRF : toute requête non-GET portant un en-tête `Origin` différent de `Host` est refusée (403).
- Limitation de débit : 240 requêtes/min/IP sur `/api/*` (hors flux SSE).
- En-têtes : `Content-Security-Policy` (`default-src 'self'`, scripts et connexions de même origine uniquement : **le frontend ne doit charger aucune ressource externe ni de script inline**), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` sur l'API. Fichiers cachés (`.xxx`) jamais servis.
- Le journal est public : le backend n'y ajoute rien de secret.

## Persistance (`data/`, ignoré par git)

`journal.jsonl` (un événement par ligne, append-only), `state.json` (instantané `SimState`, réécrit toutes les 2 s si le journal a bougé, atomiquement), `lineage.json` (`{generations, nodes}`). V1 : la simulation repart de zéro à chaque lancement ; les fichiers du lancement précédent sont conservés en `journal.prev.jsonl`, `state.prev.json`, `lineage.prev.json`. Si l'écriture échoue, la persistance se désactive avec une alerte unique et la simulation continue. `accounts/` écrit ses propres fichiers (`keys/`, ledger, archive) dans le même dossier.

## Tests

`backend/backend.test.ts` (vitest + `app.request`, moteur sans horloge : `engine.tick()` à la main) : lecture, publication visiteur et tous les codes d'erreur, administration, R7, SSE (reprise, reset, ping, plafond), persistance, testnet avec faux backend NEAR (`checkReady`, `chain.tx`, escrow), plafonds du cerveau, masquage.

## Reste / limites connues

- Pas de route `reset` (relancer le processus) : `Engine` n'en expose pas.
- Derrière un proxy inverse (tunnel de démo), l'IP vue est celle du proxy : le plafond « 10 tâches ouvertes par IP » devient global. Une option `trust proxy` demanderait une variable dans `shared/config.ts`.
- Le journal complet reste en mémoire (`shared/bus.ts`) : suffisant pour le preset `demo` (900 ticks) ; en `normal` infini il grossit sans borne.
- Arrêt propre vérifié par test (`shutdown()`) mais pas par signal sous Windows (Node n'y émet pas SIGINT à un `kill`).
- Le mode testnet n'a été exercé qu'avec le faux backend NEAR (pas de clé ni de réseau dans cet environnement).
