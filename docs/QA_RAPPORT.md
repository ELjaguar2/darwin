# QA_RAPPORT — recette « juge IA » sur clone neuf

> **English summary.** QA acceptance reports in the role of the AI judges: start from a fresh clone, follow the README to the letter, check each "do X, you will see Y" step. Sections: 2026-11-09 fresh-clone run (mock mode PASSED, 0 blocking bug), 2026-11-12 replay / new interface / testnet-with-rotated-key run, and the fresh-clone run of `lot/L17-integration` (2026-11-12).
> **State:** latest recorded verdicts are in the last section of the file; testnet, real NEAR AI and Intents were only verified to the extent stated there. The rest of this file is kept in its original French (internal working document, translated on demand).

- **Date** : 2026-11-09 (recette sur `main`, commit `c99eab0`, arbre de travail propre : tout est commité).
- **Environnement** : Windows 11 Pro, Node v22.17.1, npm, Git Bash, Playwright (Chromium, viewport 1280x900, deviceScaleFactor 1). Clone dans un dossier neuf du scratchpad (`git clone <dépôt>`), sans `node_modules`, `.env` ni `data/` copiés. Aucun `.env` dans le clone.
- **Périmètre** : lecture seule sur le code. Rien corrigé, rien commité.

## Verdict : clone neuf PASSE (mode mock). Zéro bug bloquant.

Le testnet, NEAR AI Cloud réel, le contrat déployé et Intents réel n'ont pas pu être vérifiés (voir section 5).

## 1. Étapes du README (sections 7 et 9)

| Étape du README | Résultat réel | Verdict |
|---|---|---|
| §7 `git clone` + `npm install` | 51 paquets en 4 s, 0 vulnérabilité. `near-api-js` (optionnel) NON installé sur Node 22.17.1 (attendu, documenté §6/§8) | OK |
| §7 `npm run start:mock`, 3 lignes `[darwin]` | Les 3 lignes exactes affichées, processus actif | OK |
| 1 démarrage | idem | OK |
| 2 `/api/health` | `ok:true, mode:mock, chain.kind:mock, brain.kind:mock, escrow:operator-account, mock:true, running:true`, `tick` croissant ; en-têtes sécurité (CSP, nosniff, DENY) | OK |
| 3 `/api/config` | Config publique, aucun secret | OK |
| 4 `/api/agents` | 4 fondateurs `a-0001..a-0004` gen 1 avec génome, solde, réputation ; enfants gen 2 après ~20 s | OK |
| 5 `/api/stream` (SSE) | `retry: 3000`, `event: sim.started`, `chain.tx` (hash `mock_...`), `agent.born`, avec `id:` et `data:` JSON `{seq,ts,tick,type,data}`. Note : `id:` est émis après `data:` (valide en SSE) | OK |
| 6 POST `/api/tasks` | HTTP 201, `Location: /api/tasks/t-0019`, `status:posted`, `badge` « Visiteur (financé par le compte de démo) » | OK |
| 7 GET de la tâche ~15 s après | `settled`, `winnerId`, `bids`, `validation` accepted par `brain:mock/small`, `escrow` `released` avec `proof` (resultHash, verdict, validator), texte `[mock]` | OK |
| 8 POST invalide | HTTP 400 `INVALID_INPUT` | OK |
| 9 `/api/lineage` | `generations:2` après ~1 min, 4 `roots`, `nodes` avec parentId/status/balance | OK |
| 10 lettre | `letter.written` trouvé (`data.letter.toAgentId`, la clé est imbriquée dans `letter`, le README dit « its toAgentId » : acceptable). `/api/agents/a-0005/letter` renvoie la lettre `[mock] Cher enfant...`, `mock:true`. Fondateur : 404 `UNKNOWN_LETTER` | OK |
| 11 `/api/tasks?limit=50` | badges `simulé` (39), `sous-traitance` (10), visiteur (1) | OK |
| 12 pause / resume | `paused:true` puis `paused:false`, `ok:true` | OK |
| 13 `npm run start:demo`, ~100 s | 25 agents dont 15 morts (14 lus avec `causeOfDeath:"starvation"` à l'instant de la requête), 5 générations, tick 233 | OK |
| 14 page `http://127.0.0.1:3000/` | Le frontend EST fusionné : page « Darwin », arbre généalogique (SVG), soldes, compteurs vivants/morts/nés/payées, bandeau de transparence, flux d'événements (« X est payé pour ... »), marché de tâches, formulaire. Aucune erreur console, aucune requête échouée. Soumission du formulaire dans Chromium : tâche « Haiku via form » créée puis payée en ~12 s (apparaît dans le flux). Capture : `shot1.png` (scratchpad). Le README décrit encore la page comme « non fusionnée » (voir bug NB-1) | OK (README en retard) |
| 15 `npm test` / `npm run typecheck` | 8 fichiers, **174 tests verts** (README annonce 161) ; typecheck sans erreur | OK (chiffre README périmé, NB-2) |
| §8 testnet sans clés | `[darwin] ERREUR : Mode testnet : NEAR_MASTER_ACCOUNT_ID et NEAR_MASTER_PRIVATE_KEY sont requis (voir docs/BESOINS_HUMAIN.md)`, sortie propre, sans stack trace | OK (NB-3) |

## 2. Définition de la V1 (CLAUDE.md)

| Critère | Résultat | Verdict |
|---|---|---|
| Clone neuf + commandes README (mock sans clé) | Voir tableau ci-dessus ; testnet avec clés non vérifiable | OK mock / NON VÉRIFIÉ testnet |
| >= 3 générations autonomes (naissance, travail, paiement IA, reproduction, mort, lettres) | `start:demo` : 5 générations, 25 agents, 15 morts (starvation), événements `agent.born`, `agent.reproduced`, `brain.charged`, `escrow.released`, `letter.written` observés sans intervention | OK |
| Marché complet (publication, enchères, séquestre, validation, paiement, réputation) | Événements `task.posted`, `bid.placed`, `task.awarded`, `escrow.locked`, `task.validated`, `escrow.released`, `reputation.updated`, `task.expired`, `subcontract.created` observés | OK |
| Lettres consultables | `/api/agents/<id>/letter` | OK |
| Page en direct | Arbre, soldes, naissances, flux, formulaire vérifiés avec Playwright. Panneau « morts » non contrôlé visuellement (capture en preset normal, 0 mort à ce moment ; morts vérifiés via l'API) | OK (réserve) |
| Tests verts dans le clone | 174/174, typecheck propre | OK |
| LICENSE | MIT présent à la racine | OK |
| Divulgations README | §11 : code IA, code tiers, travail antérieur (à confirmer par l'humain), second projet (à remplir par l'humain) | OK (2 points humains en attente) |
| Formulaire | `node scripts/check-formulaire.mjs` : idea 1649 caractères (20-2000), OK | OK |
| Scan de secrets | Fichiers : propres (131 fichiers, grep complémentaire sur `sk-`, `ed25519:`, `BEGIN` : seule la regex du scanner). Historique : 7 valeurs factices dans `backend/backend.test.ts` au commit `4eb92ea` ; `npm run scan:secrets` sort donc en ECHEC (voir NB-4) | OK fichiers / réserve historique |
| `docs/CONFORMITE.md` | Toutes les cases `[ ]` sauf L-02 : la grille n'a pas été mise à jour par le gardien des specs | À FAIRE (gardien) |

## 3. Cas d'échec d'un juge

| Cas | Résultat | Verdict |
|---|---|---|
| Absence de `.env` | Mock démarre normalement | OK |
| Port occupé (3000 pris) | `[darwin] ERREUR : port 3000 déjà utilisé (changez PORT)`, sortie propre | OK |
| `PORT=3100` | Écoute sur 3100, health OK | OK |
| Testnet sans clés | Message clair (ci-dessus) | OK |
| Testnet avec fausses clés sur Node 22.17.1 | `near-api-js est introuvable (paquet optionnel). Installez-le avec Node >= 22.22.2 : npm install near-api-js@7.4.0` : clair, cohérent avec le README | OK |
| `HOST=0.0.0.0` sans `DARWIN_ADMIN_TOKEN` | Démarrage refusé avec message clair | OK |
| Mauvaise version de Node (v20.20.2) | Le mock démarre quand même (aucune garde sur `engines`, pas d'avertissement). Le README documente >= 22.12 mais ne l'impose pas | OK/NB-5 |
| POST invalide | 400 `INVALID_INPUT`, JSON malformé 400 `INVALID_JSON`, mauvais Content-Type 415 | OK |
| Host forgé (`Host: evil.com`) | 403 `FORBIDDEN_HOST` (GET et POST) | OK |
| Origin forgée sur POST `/api/sim/pause` | 403 `FORBIDDEN_ORIGIN` | OK |

Chaque serveur lancé a été arrêté ; aucun port 3000/3100/3101 en écoute à la fin.

## 4. Bugs

### Bloquants
Aucun.

### Non bloquants
- **NB-1 README périmé sur le frontend** : §4 schéma (« planned »), §9 intro et étape 14, §12, §13 (« not merged yet ») et le résumé français (« en cours dans un autre lot ») disent que la page n'est pas fusionnée, alors que `frontend/` est dans `main` et fonctionne. Reproduction : ouvrir `http://127.0.0.1:3000/` après `npm run start:mock`. À corriger par le rédacteur (et retirer les mentions « to verify »).
- **NB-2 README : « 161 tests »** (§9 étape 15) ; le clone donne 174. Aussi le texte « Not run by the author : the web page, a clean-clone install » est désormais couvert par cette recette.
- **NB-3 Message testnet** renvoie vers `docs/BESOINS_HUMAIN.md` plutôt que vers `.env.example` / README §8, un juge n'y trouvera pas forcément la marche à suivre. Suggestion dev-backend.
- **NB-4 `npm run scan:secrets` échoue** (code non nul) à cause de 7 valeurs factices dans l'historique git (commit `4eb92ea`, tests backend). Un juge qui lance ce script lit « ECHEC ». Réécriture d'historique avant publication = décision humaine (déjà notée par la sécurité). Alternative : documenter dans le README que l'échec est attendu.
- **NB-5 Pas de garde Node** : sur Node 20 le serveur mock tourne sans avertissement alors que `engines` exige >= 22.12 (npm n'affiche pas de blocage sans `engine-strict`). Mineur.
- **NB-6 README step 10** : `toAgentId` se trouve sous `data.letter.toAgentId` dans l'événement (formulation ambiguë). `/api/events` plafonne à 1000 événements (les plus anciens), sans préciser dans le README.

## 5. Non vérifié

- **Mode testnet réel** (RPC NEAR, création de sous-comptes, clé maître financée) : non exécuté, pas de clés ; seul le chemin d'erreur « sans clés / near-api-js absent » est testé. `near-api-js` n'est pas installé sur Node 22.17.1 (< 22.22.2) ; il faudrait Node >= 22.22.2 pour tester.
- **NEAR AI Cloud réel** (`chat/completions` avec clé) : non exécuté.
- **Contrat Rust déployé** et tests Rust (`cargo`) : non exécutés ; contrat non déployé, séquestre en mode dégradé.
- **NEAR Intents réel** (1Click) : non exécuté, hors V1.
- Installation sur Node >= 22.22.2 et sur Linux/macOS : non testé (Windows 11 uniquement).
- Panneau « morts » de la page web : non contrôlé visuellement (morts constatés via l'API en preset demo).
- Navigateurs autres que Chromium, responsive mobile : non testés.
- Rien de ce qui touche à la publication (dépôt public, post X, formulaire) : humain.


---

# Recette du 2026-11-12 : interface L17, rejeu run8/run9b, testnet avec la clé maître rotationnée

Branche `lot/L17-integration` (L16 + L17 + L18), Windows 11, Node 22.17.1, Chromium headless (Playwright). Captures : `docs/captures/l17-recette-*.png` (toutes relues). Script de pilotage : `tests/e2e/recette-replay-ui.cjs`.

## 1. Tests du faux serveur

| Test | Fait | Vu | Verdict |
|---|---|---|---|
| `frontend/dev/l17.cjs` | lancé (faux serveur, port 3261) | 41 OK, 0 FAIL (onglets, mode, cartes, barre, fil jusqu'à « payé ✓ », livrable SVG inerte, arbre, zoom, panneau, preuves, /classique, mobile 375, console/CSP) | OK |
| `frontend/dev/e2e.cjs` | lancé 2 fois | 35 OK, « TOUT OK », aucune erreur console | OK |
| `frontend/dev/l16.cjs` (démarre déjà sur `/?classique&debug`, aucune adaptation nécessaire) | lancé 4 fois | passe 3 fois sur 4 (28 à 32 OK, 0 FAIL ; les contrôles « architecture » ne s'exécutent que si le faux serveur a livré une tâche architecture à ce moment). 1ère exécution : 1 FAIL « architecture : Markdown rendu » puis exception `waitFor #task-t-0084 .deliverable` (timeout 30 s) | OK avec réserve (NB-1) |

## 2. Rejeu de bout en bout dans l'interface

Serveur : `DARWIN_ADMIN_TOKEN=<factice, 24+ caractères> npm run replay` (port 3000), journal run8 puis run9b ; restart par l'API puis clics sur x1 puis x20 dans le bandeau.

| Point | Fait / vu | Verdict |
|---|---|---|
| Démarrage | log « MODE REPLAY (1819 événements ... vitesse x5) », « aucune clé, aucun réseau NEAR » ; un `DARWIN_ADMIN_TOKEN` trop court (< 24) refuse le démarrage avec un message clair | OK |
| Bandeau « Rejeu d'un run réel testnet du 10 novembre 2026 » (run9b : 11 novembre) | visible en permanence sur les 3 onglets, au début, au milieu, à la fin et sur mobile, avec barre de progression et « terminé · 100 % » | OK |
| Pastille de mode | « REJEU run réel enregistré » (violet) toujours dans l'en-tête | OK |
| Boutons x1 / x5 / x20 | fonctionnent SANS jeton alors que `DARWIN_ADMIN_TOKEN` est défini (API : vitesse 1 puis 20 constatée), bouton actif surligné ; « Rejouer » apparaît à la fin | OK |
| Cartes d'agents | 3 cartes au début, 5 à la fin (Iris, Kepler, Blaise, Clara, Darwin), jauge de solde, icône de métier, halo sur les agents actifs | OK |
| Fil de chat run8 | PAS vide : 14 fils, tous des missions du **client simulé** (étiquette « simulé »), avec enchères, « Blaise remporte la mission · 2 offres », « payé ✓ » ; le run8 n'a pas de mission de visiteur. Avant le premier fil, l'état vide affiche proprement « Les enchères des agents, leurs livrables et leurs paiements apparaîtront ici. » | OK |
| Notifications | « Jules rejoint la simulation », « Darwin naît de Blaise · génération 3 », « Faraday s'éteint : à court d'argent », « Simulation terminée » | OK (NB-2) |
| Arbre run8 | fin : « Génération 3 · 5 vivants · 7 morts », 12 nœuds, morts grisés avec croix, couleurs par métier, soldes sous les noms, légende | OK |
| Panneau nœud (clic sur Jules, mort) | « mort · tick 53 · à court d'argent », 0 NEAR, courbe de solde, génome avec badge TEE, personnalité, lettre parent -> enfant dépliable | OK |
| Preuves run8 | indicateurs (3 générations, 5 vivants, 7 morts, 63 missions payées, 1,70 NEAR), population par génération, flux d'argent, TEE « 73 appels sur 138 », 366 transactions, « Voir plus (336 restantes) », briques NEAR | OK (NB-3) |
| Liens nearblocks | 34 liens (run8), 30 (run9b), tous `https://testnet.nearblocks.io/txns/<hash>`, `target=_blank`, `rel=noopener noreferrer`, aucun lien hors explorateur | OK |
| Run9b (missions visiteurs) | fil avec enchère, « Clara remporte la mission · 1 offre », « Livrable remis a88837be…544eb8 », verdict « Rejeté ✗ · score 0 % · format non respecté », « remboursé · 0.045 NEAR rendus au client », « expirée · aucune offre », sous-traitance, liens « preuve ↗ » | OK (NB-4, NB-5) |
| `/classique` | 302 vers `/?classique`, ancienne page avec bandeau de rejeu, x1/x5/x20, arbre, soldes, « Rejouer » | OK |
| Mobile 375 px | aucun défilement horizontal sur les 3 onglets (scrollWidth = 375), onglets en barre basse, bandeau sur plusieurs lignes lisible | OK (NB-6) |
| Console / CSP | run8 : aucune erreur ; run9b : 2 erreurs « 404 » (NB-4) ; aucune violation CSP, aucune requête échouée | OK avec réserve |
| Missions en rejeu | barre désactivée, placeholder « Missions désactivées pendant le rejeu » | OK |

## 3. Mode testnet avec la nouvelle clé et la nouvelle interface

Pas de mode pause : `start:testnet` démarre la simulation immédiatement (`running:true`) ; l'API admin n'est pas utilisable (pas de `DARWIN_ADMIN_TOKEN` dans `.env`), arrêt par fin de processus (port libéré, vérifié). `.env` est ignoré par git (`git check-ignore`). `data/` sauvegardé hors dépôt avant le test (le démarrage fait passer journal/state en `*.prev`).

| Point | Fait / vu | Verdict |
|---|---|---|
| Solde maître avant (RPC fastnear et rpc.testnet.near.org concordent) | 2,688 NEAR (attendu ~3 : confortable) | OK |
| Budget IA avant | `spentUsd` 0,0412 (budget 8 EUR) | OK |
| Démarrage avec la clé rotationnée | OK : chaîne `near`, cerveau `nearai`, preset selection, `escrow: contract`, compte maître et contrat joignables. Avertissement « Node 22.17.1 : le mode testnet exige Node >= 22.22.2 », mais near-api-js est installé et fonctionne | OK |
| Interface | pastille « TESTNET NEAR · IA réelle · fonds sans valeur », « En direct », 6 cartes (6 métiers), arbre 6 nœuds (génération 1), fil avec vrais pitchs d'enchères, mission « payé ✓ », page Preuves avec 26 transactions, TEE « 6 appels sur 13 », 28 liens nearblocks | OK |
| SSE | 145 événements en ~3 min : 6 agent.born, 32 chain.tx, 5 task.posted, 4 task.awarded/validated/escrow.released/reputation.updated, 13 brain.charged, 1 system.warning | OK |
| Hashes des premières transactions | `create_account` 6L6vyTzMEscpw82qDbui9izSEprVbVRy9GQGE4oRPcyT (0,12 NEAR) ; `register_agent` 7aoLayvvi47VeomzZwwFhVisaucQcdPa4YvFaTbAoWRY ; `create_account` 9euiWxyMk4UZcf56db5aMHKmJCbsNNxGuABc9ND2Um8M | OK |
| 429 RPC | 0 (log et événements) | OK |
| Erreurs console navigateur | aucune | OK |
| Warning | `BRAIN_EMPTY_TEXT` : réponse vide de openai/gpt-5-nano (finish_reason=length), 1 occurrence (NB-7) | note |
| Coût | IA : 0,00457 USD (0,0412 -> 0,0457), 13 appels. NEAR : solde maître 2,688 -> 1,909, soit 0,779 NEAR sortis du maître (6 agents x 0,12 NEAR de capital + frais + financement du client simulé) ; ces fonds sont dans les 6 sous-comptes de ce lancement (clés dans `data/keys`, non lues) | note |
| État final | processus arrêté, port 3000 libre, aucun processus Darwin résiduel | OK |

Run arrêté à ~3 min (tick 4), pas de commande visiteur.

## 4. Bugs

Bloquant : **aucun**.

Non bloquants :
- **NB-1 `frontend/dev/l16.cjs` instable** : les contrôles dépendent du hasard du faux serveur (tâche architecture livrée ou non dans les 22 s) ; 1 exécution sur 4 a échoué (« architecture : Markdown rendu » puis `TimeoutError` non intercepté à la ligne 93 qui plante le script). Correctif proposé : attendre qu'une tâche de chaque métier soit livrée, ou rendre la section conditionnelle sans exception, et un `try/catch` autour de `open`. Faible (outil de dev).
- **NB-2 Les toasts masquent les boutons x1/x5/x20** : sur la page Mission, les notifications (haut droite) recouvrent le contrôle de vitesse du bandeau (voir `l17-recette-r8-mission-debut.png` et `-fin.png` : boutons absents tant qu'un toast est affiché). Correctif : décaler les toasts sous le bandeau en mode rejeu. Moyenne-faible.
- **NB-3 « Dépensé en cerveau IA 0.00 NEAR »** en run8 (138 appels réels, environ 0,01 USD, soit ~0,003 NEAR) : l'arrondi à 2 décimales fait croire que les agents ne paient pas leur cerveau (idem par génération et en testnet). Correctif : 4 décimales ou « < 0,01 » pour les montants cerveau. Faible.
- **NB-4 404 en console pendant le rejeu de run9b** : `GET /api/tasks/<id>/deliverable` répond 404 (documenté pour les anciens journaux sans contenu), mais le navigateur journalise « Failed to load resource ... 404 » ; un juge qui ouvre la console voit 2 erreurs. Correctif : ne pas interroger l'endpoint si `deliverable.produced` n'a pas de `content` sur tous les fichiers (`frontend/chat-deliverable.js`), ou répondre 200 `{available:false}` côté backend. Faible.
- **NB-5 Fin de rejeu run9b** : tous les agents sont morts, la page Mission affiche « En attente des premiers agents... » (faux : la population est éteinte), et le point d'état de l'en-tête reste « Rejeu en cours » (vert) alors que le bandeau dit « terminé · 100 % » (`frontend/darwin.js` l.43, `core.js` l.171 : tenir compte de `replay.phase === "ended"`). Les missions restent « en cours » quand le journal s'arrête avant leur issue (fidèle au journal). Faible.
- **NB-6 Mobile** : le placeholder « Missions désactivées pendant le rejeu » est coupé et le message est répété juste dessous (doublon aussi sur desktop). Cosmétique.
- **NB-7 `BRAIN_EMPTY_TEXT` sur openai/gpt-5-nano** (finish_reason=length) : un modèle à raisonnement épuise ses tokens sans produire de texte ; à voir par dev-cerveau (plus de `max_tokens` ou exclusion du modèle). Pas d'impact constaté sur les paiements.
- **NB-8 Pas de mode pause en testnet** : pour une recette sans simulation, un drapeau de démarrage en pause serait utile (proposition au chef, hors V1).

## 5. Verdict

| Étape | Verdict |
|---|---|
| 1. l16 / l17 / e2e | l17 41/41, e2e OK, l16 OK sauf instabilité du test (NB-1) |
| 2. Rejeu run8 + run9b + classique + mobile | OK, 0 bloquant, 5 défauts mineurs (NB-2 à NB-6) |
| 3. Testnet avec la clé rotationnée | OK : démarre, agents, SSE, transactions et liens nearblocks ; coût IA 0,0046 USD, 0,779 NEAR sortis du maître (solde 1,909 NEAR), 0 erreur 429 |

---

## Clone neuf 2026-11-12 (L17-integration 0d76273)

- **Procédure** : `git clone --branch lot/L17-integration` dans un dossier neuf du scratchpad (HEAD 0d76273, aucun `.env`, aucun `data/`), Windows 11, Node v22.17.1, Git Bash, Chromium headless (Playwright). README suivi dans l'ordre : replay d'abord, puis mock. Ports 3000 libérés à la fin.
- **Verdict : GO pour la fusion.** Zéro bloquant. 3 écarts non bloquants (texte du README), voir en bas.
- Captures : `docs/captures/clone-neuf-1112/` (rejeu : mission, lignées, preuves ; mock : mission ; page classique).

| Étape | Attendu | Vu | Verdict |
|---|---|---|---|
| `npm ci` | installe | 4,4 s (cache npm chaud), 0 erreur | OK |
| 6b-1 `npm run replay` | 4 lignes `[darwin]` + « rejeu démarré » | `MODE REPLAY (1819 événements de run8-journal.jsonl, enregistrés le 2026-11-10, vitesse x5)`, `aucune clé...`, `écoute sur http://127.0.0.1:3000 ...`, ligne contrôle ouvert, `rejeu démarré` : identique | OK |
| 6b-2 page | pastille REJEU, bandeau, barre, x1/x5/x20 | pill « REJEU run réel enregistré », bandeau « Rejeu d'un run réel testnet du 10 novembre 2026 » visible, « en cours · 5 % », x1 x5 x20, 4 cartes, 6 fils, saisie désactivée, 0 erreur console | OK |
| 6b-3 lien nearblocks | ouvre la transaction | non cliqué (pas de réseau voulu) ; liens présents dans le flux | non vérifié |
| 6b-4 `/api/health` | `"mode":"replay"` + objet `replay` | `"mode":"replay"`, `replay{phase:"playing",speed:5,position,total:1819,meta.recordedOn:"2026-11-10"}` (chain `near`, brain `nearai`, `mock:false` sont les valeurs enregistrées) | OK |
| 6b-5 rechargement | état reconstruit | nouvelle page ouverte en plein rejeu : cartes et fils déjà présents (6 fils, 4 cartes) | OK |
| 6b-6 POST /api/tasks | 403 REPLAY_READ_ONLY | `HTTP/1.1 403`, `REPLAY_READ_ONLY` | OK |
| 6b-7 `DARWIN_REPLAY_FILE=...run9b...` | autre journal | `377 événements de run9b-journal.jsonl, 2026-11-11`, bandeau « 11 novembre 2026 », 6 cartes, 0 erreur | OK (la vitesse x20 n'a pas été relancée, non nécessaire) |
| 7 `npm run start:mock` | 3 lignes | `mode mock (chaîne mock, cerveau mock, preset normal)`, écoute, simulation démarrée : identique | OK |
| 9-2 health | ok, mock, operator-account | `"mode":"mock"`, kind mock, `escrow:"operator-account"`, `mock:true`, tick croissant | OK |
| 9-3 config | config publique sans secret | mode, preset normal, seed 42, sim, intents.enabled false | OK |
| 9-4 agents | 4 fondateurs a-0001..4 | a-0001 logo, a-0002 finance, a-0003 architecture, a-0004 marketing ; enfants gen 2 à partir du tick 32 (~32 s) | OK |
| 9-5 stream | SSE retry/event/id | `retry: 3000`, `event: sim.started`, `chain.tx` (`mock_...`), `data:` JSON `{seq,ts,tick,type,data}` puis `id:` | OK |
| 9-6 POST marketing | 201, Location, posted, badge | 201, `location: /api/tasks/t-0006`, `"status":"posted"`, badge « Visiteur (financé par le compte de démo) » | OK |
| 9-7 tâche réglée | settled, winnerId, bids/pitch, accepted 0.8, released | settled en 2 ticks (tick 9), `winnerId a-0004`, 1 offre avec pitch, `accepted` 0.8 `brain:mock/small`, escrow `released` payer `visitors.darwin.mock.testnet`, hash `mock_`, proof. Réponse enveloppée sous `task`/`bids`/`escrow` | OK |
| 9-8 POST invalide | 400 INVALID_INPUT | message identique mot pour mot | OK |
| 9-9 lineage | generations, roots, nodes | gen 2 à tick 56, roots les 4 fondateurs, 8 nœuds avec parentId | OK |
| 9-10 lettre | letter.written puis lettre | a-0003 -> a-0005, `[mock] Cher enfant...`, `mock:true` ; fondateur a-0001 : 404 | OK |
| 9-11 tâches | badges simulé / sous-traitance / visiteur | tick 56 : `?limit=50` = 45 simulé + 5 sous-traitance, **tâche visiteur absente** (sortie des 50 plus récentes) ; `limit=1000` : 69 tâches dont 1 visiteur | écart E-2 |
| 9-12 pause/resume | paused true puis false | `{"ok":true,"running":true,"paused":true,"tick":56}` puis `"paused":false` | OK |
| 9-13 `start:demo` avec `DARWIN_MODE=testnet` posé | mock quand même | `mode mock (chaîne mock, cerveau mock, preset demo)`, health `mode:mock`. À 90 s (tick 209) : 10 morts `starvation`, génération 3 (README : 15 morts, 5 générations au tick 238, « run de l'auteur ») | OK (chiffres différents, voir E-3) |
| 9-14 page par défaut (mock) | MODE MOCK, 3 onglets | pill « MODE MOCK chaîne et IA simulées », onglets Mission / Lignées / Preuves, bandeau de rejeu masqué, saisie « Décrivez votre mission… » active, 8 cartes, 14 fils, 0 erreur console | OK |
| 9-14 `/?classique` | bandeau MODE MOCK, Client simulé, Séquestre dégradé, Publier la tâche | les 4 textes présents, 0 erreur de page | OK |
| 9-15 `npm test` | tous verts | 22 fichiers, **319 / 319**, 7,9 s | OK |
| `npm run typecheck` | 0 erreur | 0 erreur, 3,5 s | OK |
| `npm run scan-secrets` (et `scan:secrets`) | OK | 259 fichiers, 100 commits, 7 exemptions factices, « aucun secret détecté » | OK |
| Ports | libérés | aucun écouteur sur 3000 | OK |

Temps réels : replay prêt en moins de 8 s ; mock prêt en moins de 7 s ; première génération 2 à ~32 s ; tâche visiteur réglée en ~9 s ; tests 8,9 s ; typecheck 3,5 s. Aucune particularité Windows/PowerShell rencontrée (étape 7 de 6b déjà donnée en syntaxe PowerShell). Le chemin `npm ci` a été testé avec un cache npm chaud : le temps d'un vrai juge sera plus long.

### Écarts (tous non bloquants, texte du README)

- **E-1 (section 7, clone)** : la section 7 dit `npm install` alors que 6b dit `npm ci`. Correction : remplacer `npm install` par `npm ci` (lockfile respecté) dans le bloc `git clone` de la section 7 et dans le résumé français.
- **E-2 (section 9, étape 11)** : « your visitor task (1 of 50) » faux si l'on attend : à 1 minute la tâche visiteur n'est plus dans `?limit=50` (69 tâches). Correction : « ... and your visitor task (visible in the last 50 only in the first ~30 seconds; use `?limit=1000` to find it) ».
- **E-3 (section 9, étape 13)** : le README annonce 15 morts / 5 générations à tick 238 ; vu 10 morts / 3 générations à tick 209 (même graine, preset demo, mais la boucle dépend du timing). Correction : « Dead agents with `"causeOfDeath":"starvation"` (about 10 to 15 dead and 3 to 5 generations after 90 s; the exact count varies) ».
- Remarque (non écart) : l'étape 14 du paragraphe d'intro de la section 9 dit que la page n'a pas été ouverte dans un navigateur : c'est désormais fait (ce rapport), la phrase peut être mise à jour.
