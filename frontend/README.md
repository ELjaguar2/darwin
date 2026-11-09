# Frontend Darwin (lot L8)

Page unique, HTML + CSS + modules ES, **sans build, sans dépendance, hors ligne** (aucune ressource externe ; compatible avec la CSP du backend : pas de script ni de `style=` inline). Le backend (`backend/`) la sert en statique.

## Lancer

| Besoin | Commande | Attendu |
|---|---|---|
| Avec le vrai backend (mock) | `npm run start:mock` puis http://127.0.0.1:3000 | arbre, soldes, flux en direct |
| Démo rapide | `DARWIN_PRESET=demo npm run start:mock` | 3 générations en quelques minutes |
| Sans backend | `node frontend/dev/fake-server.mjs` (port 3000, options en tête du fichier) | faux journal conforme au catalogue |
| Tests de bout en bout | `NODE_PATH=<node_modules avec playwright> node frontend/dev/e2e.cjs <dossier>` | 29 vérifications, captures |
| Contre le vrai backend | `REAL_URL=http://127.0.0.1:3000 NODE_PATH=... node frontend/dev/real.cjs <dossier>` | formulaire + rendu réels |

Options du faux serveur : `--tick=400`, `--testnet` (hashes réels-like et liens explorateur), `--degraded`, `--no-sim`, `--task-status=429|503|400` (force la réponse de `POST /api/tasks`). C'est un générateur de données de test, sans aucune logique du produit.

## Fichiers

`index.html` (structure), `style.css` (thèmes clair/sombre, variables), `app.js` (chargement, SSE avec reprise, panneaux, formulaire), `store.js` (état reconstruit depuis le journal), `tree.js` (arbre SVG animé), `format.js` (montants, liens, constructeur DOM sûr), `theme-init.js` (thème avant le premier rendu), `screens/` (captures de référence), `dev/` (outils de développement, non servis par le faux serveur).

## Ce que la page montre

- **Arbre vivant** : naissance depuis le parent (anneaux, arête qui se dessine), mort (nœud gris barré), taille = solde, anneau = lignée, lettre = métier ; gains/coûts flottants ; panneau « Lignées » (prospère / fragile / éteinte) ; **compteur de générations**.
- **Soldes** en direct, **flux de transactions** (lien `testnet.nearblocks.io/txns/<hash>` si `explorerUrl` fourni, ou chaîne `near` ; badge « mock » et aucun lien pour les hashes fictifs ; les coûts de vie par tick sont masqués par défaut), **chronique**, **marché** (tâches, offres, « validé par : … »), **lettres** parent -> enfant et fiche agent.
- **Formulaire « poster une tâche »** : `POST /api/tasks` ; gère 201, 400 (messages du serveur), 429 et 503 avec `Retry-After` (bouton verrouillé ; `VALIDATION_PENDING` affiché comme attente, pas panne), 413, 415, 403.
- **Honnêteté (D-024, R8)** : MODE MOCK, client « simulé », « Visiteur (financé par le compte de démo) », « Séquestre dégradé » (si `/api/health.escrow = "operator-account"`, indépendant du badge mock), modèle de confiance, outils NEAR (RPC, contrat, NEAR AI Cloud, Intents) avec état réel / simulé.
- **Connexion** : pastille En direct / Reconnexion (essai n) / Hors ligne ; reprise par `?since=<lastSeq>` ; événement `reset` = vidage puis rejeu.
- **Accessibilité** : contrastes vérifiés visuellement dans les deux thèmes, `aria-label`, régions défilables au clavier, focus visible, `prefers-reduced-motion` (positions instantanées, effets supprimés), pas de scroll horizontal dès 320 px, jamais d'`innerHTML`.

## Contrat d'API utilisé (aligné sur `backend/app.ts`)

`GET /api/state` (`SimState`) puis `EventSource("/api/stream?since=" + lastSeq)` avec un `addEventListener` par type du catalogue + `reset` ; `GET /api/events?since=&limit=` (`{events, lastSeq}`, pour amorcer le flux de transactions) ; `GET /api/health` (`escrow`, `mock`, `chain`/`brain` objets) ; `GET /api/letters/:id` (`{letter}`) ; `POST /api/tasks`. Les tâches portent `badge` et `validatedBy`. Les erreurs ont la forme `{error:{code,message,retryable?}}` (les `issues` zod éventuelles sont aussi lues).

## Hypothèses à confirmer

- Format d'explorateur `https://testnet.nearblocks.io/txns/<hash>` repris de `accounts/near-chain.ts` (non vérifié en ligne ici).
- Le champ `visitors` de `/api/health` est lu mais pas encore affiché.
- Les événements `balance.changed` « metabolism » sont supposés émis à chaque tick pour chaque agent vivant.
