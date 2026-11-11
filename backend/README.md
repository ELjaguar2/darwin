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
| `GET /api/state` | `SimState` complet (`lastSeq` = point de reprise du flux) + `population` (dernière `population.snapshot` `{tick, byProfession, byGeneration}`, absente avant le 1er tick) |
| `GET /api/population` | `{population: {tick, byProfession, byGeneration} \| null}` |
| `GET /api/catalogue` | `{priceScale, tick, professions[{profession,label,refUsd,nearPrice (yocto, x priceScale),nearPriceNear,deliverable,files[],rubric[{id,description,weight}],acceptScore}], events[MarketEvent actifs]}` |
| `GET /api/tasks/:id/deliverable` | `{taskId, profession, agentId, files[{name,mime,content}], resultHash, productionCostUsd, judgeCostUsd, createdAt, verdict?, score?}` (sans `rawText`) ; 404 `UNKNOWN_DELIVERABLE` |
| `GET /api/tasks/:id/deliverable/:file[?download=1]` | contenu brut, `Content-Type` du fichier, `nosniff`, `CSP default-src 'none'; style-src 'unsafe-inline'; sandbox` ; `attachment` si `download=1` ; 400 si le nom n'est pas `^[a-z0-9._-]{1,64}$`, 404 s'il n'est pas dans le livrable |
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

Les tâches ouvertes d'une IP = statuts `posted`, `awarded`, `submitted`. L'IP est celle de la socket (X-Forwarded-For est ignoré car falsifiable : derrière un proxy ou un tunnel, toutes les IP se confondent, voir « Reste »).

### Flux SSE `GET /api/stream`

Chaque message : `id: <seq>`, `event: <type>` (ex. `agent.born`, `chain.tx`), `data: <DarwinEvent JSON>` = `{seq, ts, tick, type, data}`. Les types sont ceux de `shared/events.ts` ; le client s'abonne par type avec `addEventListener(type, ...)` (les événements nommés ne passent pas par `onmessage`). Reprise : `EventSource` renvoie seul `Last-Event-ID` ; on peut aussi passer `?since=<seq>`. Séquence côté client : `GET /api/state`, puis `new EventSource("/api/stream?since=" + state.lastSeq)`. Commentaire `: ping` toutes les 15 s. Événement spécial `event: reset` (`data: {"lastSeq":n}`, sans `id`) si le client reprend avec un id plus grand que le journal (le serveur a redémarré, la simulation repart de zéro) : le client vide son affichage, le rejeu depuis le début suit. Un client trop lent (file > 5000) est déconnecté et reprend avec `Last-Event-ID`. Plafonds : 8 flux par IP, 300 au total.

## Administration et sécurité

- Routes `POST /api/sim/*` : `Authorization: Bearer <DARWIN_ADMIN_TOKEN>` (comparaison à temps constant, 10 échecs/min/IP puis 429). Sans jeton configuré, elles sont ouvertes **uniquement** parce que le serveur n'écoute que sur 127.0.0.1.
- **Anti rebond DNS** : l'en-tête `Host` doit être `localhost`, `127.0.0.1` ou `[::1]` (avec ou sans port), le `HOST` configuré, ou un nom listé dans `DARWIN_ALLOWED_HOSTS` (liste séparée par des virgules, ex. le nom d'un tunnel de démo ; `*` désactive le contrôle). Sinon 403 `FORBIDDEN_HOST`, sur toutes les routes (lecture, écriture, SSE, statique). Avec `HOST=0.0.0.0`, renseigner `DARWIN_ALLOWED_HOSTS` avec le nom public.
- **Jeton admin** : 24 caractères minimum dès qu'il est renseigné (démarrage refusé sinon) ; obligatoire si `HOST` n'est pas `127.0.0.1`.
- Anti-CSRF : toute requête non-GET portant un en-tête `Origin` différent de `Host` est refusée (403).
- Limitation de débit : 240 requêtes/min/IP sur `/api/*` (hors flux SSE).
- En-têtes : `Content-Security-Policy` (`default-src 'self'`, scripts et connexions de même origine uniquement : **le frontend ne doit charger aucune ressource externe ni de script inline**), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` sur l'API. Fichiers cachés (`.xxx`) jamais servis.
- Le journal est public : le backend n'y ajoute rien de secret.

## Persistance (`data/`, ignoré par git)

`journal.jsonl` (un événement par ligne, append-only), `state.json` (instantané `SimState`, réécrit toutes les 2 s si le journal a bougé, atomiquement), `lineage.json` (`{generations, nodes}`). V1 : la simulation repart de zéro à chaque lancement ; les fichiers du lancement précédent sont conservés en `journal.prev.jsonl`, `state.prev.json`, `lineage.prev.json`. Si l'écriture échoue, la persistance se désactive avec une alerte unique et la simulation continue. `accounts/` écrit ses propres fichiers (`keys/`, ledger, archive) dans le même dossier.

Livrables : pas de `deliverable.zip` (aucune dépendance de compression ajoutée, D-042). Chaque livrable est écrit dans `data/deliverables/<taskId>/<fichier>` + `meta.json` (noms validés, jamais hors du dossier). Le lancement suivant déplace ce dossier en `deliverables.prev/` et ne le recharge pas : la simulation repart de zéro et les ids de tâche se rejouent. Les livrables ne sont donc servis par l'API que pour le lancement en cours.

## Tests

`backend/backend.test.ts` (vitest + `app.request`, moteur sans horloge : `engine.tick()` à la main) : lecture, publication visiteur et tous les codes d'erreur, administration, R7, SSE (reprise, reset, ping, plafond), persistance, testnet avec faux backend NEAR (`checkReady`, `chain.tx`, escrow), plafonds du cerveau, masquage.

## Reste / limites connues

- Pas de route `reset` (relancer le processus) : `Engine` n'en expose pas.
- **Proxy / tunnel (option `trust proxy` non implémentée)** : derrière un proxy inverse, l'IP vue est celle du proxy, donc les plafonds par IP (10 tâches ouvertes, 6 publications/min, 8 flux, 240 requêtes/min, échecs admin) deviennent globaux : acceptable pour une démo, le plafond horaire du compte de démo et le plafond global de 100 tâches bornent de toute façon la dépense. Pour une vraie option, il faudrait une variable (ex. `DARWIN_TRUST_PROXY`) dans `shared/config.ts` et ne lire `X-Forwarded-For` que si la socket vient du proxy ; non faite car sans variable on ne peut pas distinguer un proxy de confiance d'un client qui falsifie l'en-tête.
- Le journal complet reste en mémoire (`shared/bus.ts`) : suffisant pour le preset `demo` (900 ticks) ; en `normal` infini il grossit sans borne.
- Arrêt propre vérifié par test (`shutdown()`) mais pas par signal sous Windows (Node n'y émet pas SIGINT à un `kill`).
- Le mode testnet n'a été exercé qu'avec le faux backend NEAR (pas de clé ni de réseau dans cet environnement).

## Mode replay (L17) : rejouer un run réel

`npm run replay` relit un journal de run (JSONL `{seq,ts,tick,type,data}`) et réémet ses événements dans le **même flux** (`/api/stream`, SSE) que le mode live, aux cadences du run d'origine divisées par la vitesse. Aucune clé, aucun réseau NEAR, aucun appel IA : le processus ne fait que lire un fichier. Les `explorerUrl` des `chain.tx` sont ceux du run réel (liens nearblocks vers de vraies transactions).

| Variable | Défaut | Effet |
|---|---|---|
| `DARWIN_MODE=replay` | posé par `npm run replay` | active le mode (secrets retirés de l'environnement lu) |
| `DARWIN_REPLAY_FILE` | `docs/preuves/run8-journal.jsonl` | journal à rejouer (run8, run9c, ...) ; fichier invalide = arrêt avec la ligne en cause |
| `DARWIN_REPLAY_SPEED` | `5` | x1, x5, x20... (0,25 à 100) |
| `DARWIN_REPLAY_LOOP` | `0` | `1` : recommence 5 s après la fin (le flux envoie `event: reset`) |
| `DARWIN_REPLAY_MAX_GAP_MS` | `8000` | un silence plus long dans le journal d'origine est raccourci à cette valeur (avant division par la vitesse) |
| `DARWIN_REPLAY_CONTROL` | `open` | `locked` : les routes `/api/replay/speed\|pause\|resume\|restart` exigent `DARWIN_ADMIN_TOKEN`. **Démo publique multi-visiteurs : la vitesse est partagée, lancer avec `locked`** |
| `DARWIN_REPLAY_LABEL` | (date du journal) | remplace le texte du bandeau |

Pas d'argument CLI : `DARWIN_REPLAY_SPEED=20 DARWIN_REPLAY_FILE=docs/preuves/run9b-journal.jsonl npm run replay` (en PowerShell : `$env:DARWIN_REPLAY_SPEED=20; npm run replay`). La page est sur <http://127.0.0.1:3000>.

**API.** Même surface que le live (`/api/state`, `/api/events`, `/api/tasks`, `/api/agents`, `/api/lineage`, `/api/letters/:id`, `/api/stream`...), servie par la réduction des événements déjà émis : un client qui arrive en cours de route reçoit `/api/state` avec `lastSeq` exact, puis le flux depuis `lastSeq`, sans trou. Ajouts :

| Route | Rôle |
|---|---|
| `GET /api/health` | `mode: "replay"` et `replay: {phase: playing\|paused\|ended, speed, loop, position, total, rounds, meta}` ; `meta = {file, events, startedAt, endedAt, recordedOn (AAAA-MM-JJ lue du 1er événement), originalDurationMs, ticks, skipped, renumbered, recorded:{mode,preset,chain,brain,seed}, label?}` |
| `GET /api/state` | idem avec `mode: "replay"` et `replay` |
| `GET /api/replay` | l'objet `replay` ci-dessus |
| `POST /api/replay/speed` `{speed}`, `/pause`, `/resume`, `/restart` | contrôle de la lecture ; **sans jeton par défaut** (D-044, même si `DARWIN_ADMIN_TOKEN` est défini) ; avec `DARWIN_REPLAY_CONTROL=locked`, `Authorization: Bearer` exigé ; 400 `REPLAY_BAD_SPEED` |
| `GET /api/replay/missions` | missions de visiteurs : `{missions:[{taskId,title,profession,requester,status,events:[DarwinEvent]}]}`, événements dans l'ordre (fil de chat) |
| `POST /api/tasks`, `POST /api/sim/*` | **403 `REPLAY_READ_ONLY`** (refus avant toute validation ; aucune écriture chaîne/IA n'existe dans ce mode) |

Fin de rejeu : `phase: "ended"` (le dernier état reste affiché) ; `POST /api/replay/restart` ou `DARWIN_REPLAY_LOOP=1` repartent de zéro, les clients connectés reçoivent `event: reset` (le frontend vide son affichage) puis les événements depuis `seq: 1`.

**Validation du journal** (`backend/replay.ts`) : une ligne JSON par événement avec `type` connu, `ts` ISO croissant, `tick` numérique, `data` objet. Erreur claire avec numéro de ligne sinon ; type inconnu = ligne écartée (compte dans `meta.skipped`) ; dernière ligne tronquée tolérée ; `seq` renumérotés 1..N si besoin (`meta.renumbered`) car le flux exige des `seq` sans trou. Les `system.warning/error` sont masqués une seconde fois (`redact.ts`).

### Événements d'une mission de visiteur (fil de chat)

Le journal d'une mission de visiteur (`task.posted` avec `requester.kind: "visitor"`) enchaîne, tous reconnaissables par `data.taskId` (sauf `task.posted` : `data.task.id`, et `bid.placed` : `data.bid.taskId`) :

| Ordre | Événement | Contenu utile pour un fil de chat |
|---|---|---|
| 1 | `task.posted` | `task` : titre, consigne (`prompt`), métier, budget, `requester.label` (le visiteur) |
| 2 | `bid.placed` (0..n) | `bid` : `agentId`, `price`, `etaTicks`, `pitch?` (L18 : une phrase de vente, une ligne, <= 240 caractères, sans balisage, tronquée au mot avec « … » ; absente des journaux run5 à run9b) |
| 3 | `task.awarded` ou `task.expired` | gagnant, prix, nombre d'offres ; ou motif d'expiration |
| 4 | `escrow.locked` | `payer`, `amount`, `tx` (lien nearblocks via le `chain.tx` de même hash) |
| 5 | `brain.charged`, `deliverable.produced` | coût IA de l'agent (`purpose: "bid"` pour le pitch en réel, `"execute_task"` pour le travail) ; fichiers produits `files[] = {name, mime, bytes, content?, truncated?}` (L18) : `bytes` = taille UTF-8 réelle du fichier complet, `content` = texte, SVG déjà assaini ou Markdown, **PUBLIC**, borné à 24 000 caractères par fichier et 64 000 par livrable (`truncated: true` si coupé). Les journaux run5 à run9b n'ont que nom/mime/taille : `GET /api/tasks/:id/deliverable` répond alors 404 en replay ; avec `content` sur tous les fichiers il est servi (`{taskId, profession, agentId, files:[{name,mime,content,truncated?}], resultHash, ..., verdict, score}`). Ordre réel : `task.validated`, puis `deliverable.produced`, puis `escrow.released`. `/api/state` et `/api/tasks` ne portent ni pitch de liste ni contenu ; seuls `/api/stream`, `/api/events`, `/api/replay/missions` et l'endpoint livrable les portent |
| 6 | `task.submitted` | `resultHash` |
| 7 | `task.validated` | `validation`: `verdict`, `score`, `validator`, `reason` |
| 8 | `escrow.released` (accepté) ou `escrow.refunded` (rejeté) + `reputation.updated` | paiement `payee`/`amount`/`tx`, variation de réputation |

Run8 ne contient aucune mission de visiteur (clients simulés seulement) ; run9a/run9b en contiennent (missions rejetée/expirée, journal posé dans `docs/preuves/`).
