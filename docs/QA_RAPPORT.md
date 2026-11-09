# QA_RAPPORT — recette « juge IA » sur clone neuf

- **Date** : 2026-11-09 (recette sur `main`, commit `c99eab0`, arbre de travail propre : tout est commité).
- **Environnement** : Windows 11 Pro, Node v22.17.1, npm, Git Bash, Playwright (Chromium, viewport 1280x900, deviceScaleFactor 1). Clone dans un dossier neuf du scratchpad (`git clone C:\Users\aymer\Darwin`), sans `node_modules`, `.env` ni `data/` copiés. Aucun `.env` dans le clone.
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
