> **Internal developer checklist (French) — not part of the submission.**
> Ordered list of the actions only the human can do (publish the repository, X post, form submission, key rotation, faucet top-ups); kept in French on purpose.

# Besoins pour l'humain — mis à jour le 2026-11-12 (lot L17-docs3)

**Échéance : samedi 14 novembre 2026, 23:59 UTC** (soit 00:59 le 15 novembre à Paris, heure d'hiver UTC+1). **Marge de sécurité conseillée : avoir tout soumis le 14 novembre avant 12:00 UTC (13:00 à Paris)**, pour absorber une panne de X, de GitHub ou du formulaire. Le formulaire est à soumettre **une seule fois** et corrigé ensuite via https://nearhackathon.com/request-changes : ne pas le garder pour la dernière heure.

## Résumé
- **Prouvé en réel (voir `docs/PREUVES_TESTNET.md` §8)** : run 8 du 2026-11-10, preset `selection`, génération 3, 12 naissances, 8 reproductions, 7 morts par famine, 65 séquestres (63 libérés, 2 remboursés), contrat `darwin-contract-7k2.testnet`, clés function call vérifiées, appels réels NEAR AI Cloud (environ 0,034 USD en comptabilité locale), une attestation TEE.
- **Run 9 (2026-11-11, journaux `docs/preuves/run9a-journal.jsonl` et `run9b-journal.jsonl`, résumés dans `docs/PREUVES_TESTNET.md` §11)** : commandes de logo. 9a : 7 logos rejetés puis remboursés (dont 1 commande « visiteur »), 2 commandes « visiteur » expirées sans offre, aucun livrable accepté. 9b : un logo « visiteur » verrouillé puis **rejeté** (sortie tronquée, 0 bloc SVG sur 3) et **remboursé** par le contrat ; deux livrables texte acceptés et payés (payeur : client simulé). Les deux runs se sont éteints en génération 1 (aucune naissance au-delà des fondateurs ; 4 fondateurs et 4 morts en 9a, 6 fondateurs et 6 morts en 9b, d'après les journaux). Dans ces journaux chaque appel de production s'arrête à exactement 300 tokens de sortie (plafond du preset `selection` de l'époque), ce qui explique des sorties tronquées ; le plafond a été relevé depuis (`docs/PREUVES_TESTNET.md` §10, §11) et n'a pas été rejoué en run complet. **Aucun logo livré, accepté et payé sur testnet n'est prouvé** (run 9c à faire, par le chef de projet).
- **Jamais prouvé** : NEAR Intents (jamais exécuté, aucune dépense), facture réelle NEAR AI relue, second run confirmant la génération 3, tâche de visiteur acceptée et payée sur testnet.
- **Rien n'est publié** : dépôt, post X et formulaire sont à vous (règle 5). Aucune dépense mainnet.
- Les clés (NEAR AI, compte maître) sont uniquement dans `.env`, ignoré par git. La clé NEAR AI a transité par la conversation : **à régénérer avant publication** (étape 3).

## Liste ordonnée à faire par vous

Tout se fait depuis le dossier du dépôt. Remplacer `<REPO_URL>` par l'adresse GitHub du dépôt. Avant de commencer, demander au chef de projet (ou lire `docs/STATUS.md`) que les lots L17 (pages Mission, Lignées, Preuves, mode replay), le run 9c et la mise à jour de `docs/PREUVES_TESTNET.md` sont fusionnés dans `main`, puis lire chaque repère « À CONFIRMER » de `docs/VIDEO_SCRIPT.md`.

**Repli si le run 9c n'est pas prouvé (aucun logo accepté et payé, avec hash) avant le 13 novembre 12:00 UTC** : ne pas attendre. Retirer **toute mention du run 9c** de la vidéo (`docs/VIDEO_SCRIPT.md` : ligne « logo accepté et payé, run 9c » des plans fixes, plan 5) et du post X (`docs/POST_X.md`), garder le run 8 et le cas refusé du run 9b tels que décrits, et enregistrer avec ce qui est prouvé. Une mention non prouvée est pire qu'une absence.

### Plan horaire du jeudi soir au vendredi 13 novembre (organisé autour de la VIDÉO)

**La vidéo est obligatoire** : HACKATHON.md (relu le 2026-11-12) exige de la joindre au post X ; des captures seules ne suffisent pas. Tout le vendredi sert à produire une vidéo vraie. Heures en UTC (Paris = UTC+1).

| Heure (UTC) | Quoi | Référence | Fait quand |
|---|---|---|---|
| Matin, dès 07:00 | Étapes 1 et 3 ci-dessous (version finale vérifiée, clé NEAR AI régénérée), puis **lancer le run 9c** : recharger le compte maître, sauvegarder `data/`, lancer dans un terminal séparé, surveiller, arrêter, copier le journal | `docs/RUN_9C.md` §1 à §5 (ne pas le recopier ici) ; durée maximale du run : 90 minutes | `docs/preuves/run9c-journal.jsonl` existe, sans secret (`npm run scan-secrets -- --no-history`), ou le run a échoué et vous le savez |
| **12:00 UTC (13:00 Paris) : POINT DE DÉCISION** | Un logo (ou une commande de visiteur) accepté et payé, avec hash, est-il prouvé par 9c ? **Oui** : le journal 9c sert de rejeu vitrine, les mentions du run 9c sont gardées dans la mesure exacte de ce qu'il prouve. **Non** : repli, retirer toute mention du run 9c de la vidéo et du post, rejeu du run 8 | encadré « Repli » plus haut ; `docs/RUN_9C.md` §6 et §7 | Décision prise et notée, aucune mention non prouvée |
| 12:00 à 14:00 | Mettre à jour les documents sur ce qui a réellement tourné (chef de projet, rédacteur) et vérifier le rejeu choisi (étape 1, dernière puce) | `docs/RUN_9C.md` §6 | Le bandeau « Rejeu d'un run réel testnet… » s'affiche avec le journal choisi |
| 14:00 à 17:00 | **Enregistrer la vidéo** : checklist ci-dessous, puis `docs/VIDEO_SCRIPT.md` plan par plan ; au moins 2 prises ; revoir la vidéo en entier | `docs/VIDEO_SCRIPT.md` | Fichier mp4 de 2:00 à 3:00, relu en entier, sans secret |
| 17:00 à 19:00 | Étapes 4 et 5 (historique git, dernier contrôle) ; **préparer** (sans publier) le post X : `docs/POST_X.md` avec `<REPO_URL>` remplacé et la vidéo prête à joindre ; relire `docs/FORMULAIRE.md` | étapes 4, 5 | Tout est prêt à être publié le lendemain matin |
| Soir | Dormir. Rien n'est publié le 13. Si la vidéo est ratée, il reste le 14 matin pour la refaire | | |

**Marge** : si le run 9c n'est pas lancé avant 09:00 UTC, ne pas l'attendre au-delà de 12:00 : le repli est prévu et honnête.

### CHECKLIST AVANT ENREGISTREMENT (à cocher, plan par plan : un plan = un mode)

1. **Mode affiché dans l'en-tête = celui du plan filmé, jamais un autre** : `MODE MOCK` pour les plans en mock en direct (plans 1 à 6 du script), `REJEU` pour les plans en rejeu (7 et 8), `TESTNET NEAR` seulement si vous filmez un run testnet réel en direct (déconseillé : un tick dure environ une minute). Vérifier aussi `curl http://127.0.0.1:3000/api/health` : `"mode":"mock"`, `"mode":"replay"` ou `"mode":"testnet"`.
2. **`.env`** : pour filmer en mock, le renommer d'abord (PowerShell `Rename-Item .env .env.testnet`), puis vérifier `/api/health` → `"mode":"mock"` ; le remettre après (`Rename-Item .env.testnet .env`). Pour un run testnet, le laisser en place. Dans les deux cas : ne jamais l'ouvrir ni l'afficher.
3. **Journal chargé (rejeu)** : `DARWIN_REPLAY_FILE` = `docs/preuves/run8-journal.jsonl` (défaut) ou `docs/preuves/run9c-journal.jsonl` (si le point de 12:00 l'a validé) ; commande PowerShell `$env:DARWIN_REPLAY_FILE="docs/preuves/run9c-journal.jsonl"; npm run replay`. Vérifier le bandeau « Rejeu d'un run réel testnet du … » et la pastille « REJEU » ; choisir la vitesse (x1, x5, x20) et la garder pendant la prise.
4. **Port 3000 libre** avant de lancer (`netstat -ano | findstr :3000` ne doit rien afficher), un seul serveur Darwin à la fois.
5. **Notifications système coupées** (Windows : Ne pas déranger), messageries et mails fermés.
6. **Navigateur** : fenêtre en 1920x1080 (ou 1280x720), zoom 100 % (ou 110 % si le texte est petit), thème sombre ou clair, **le même pour toute la vidéo**, barre des signets masquée (Ctrl+Maj+B), aucun autre onglet visible, profil sans extensions affichées.
7. **Aucun secret visible** : pas de `.env`, pas de terminal avec une clé, pas de jeton (`DARWIN_ADMIN_TOKEN`) ni de clé dans la barre d'adresse, pas la page API Keys de cloud.near.ai.
8. **Onglet Preuves** ouvert à l'avance sur un lien nearblocks **réel** (hashes de `docs/PREUVES_TESTNET.md` §8 ou §11) : vérifier qu'il s'affiche.
9. **Chaque plan en rejeu dit « not live »** (voix et texte incrusté : « Replay of our recorded testnet run 8, not live. »). Le mock est dit mock. Le client payeur est dit simulé. NEAR Intents n'a pas été exécuté.
10. **Durée cible 2 à 3 minutes** (2:50 visé, `docs/VIDEO_SCRIPT.md`) ; le « wow » dans les 10 premières secondes.
11. **Export** en mp4 (H.264, 1080p ou 720p). **Limites de X non vérifiées par moi** (la page d'aide de X est inaccessible à mes outils) : à ma connaissance la durée et la taille maximales dépendent du type de compte (un compte gratuit est limité à environ 2 min 20 ; plus long avec un abonnement), et la taille maximale est de l'ordre de 512 Mo. **Vérifier dans l'éditeur de X avant le 14** en téléversant la vidéo sans publier ; si la durée dépasse la limite de votre compte, raccourcir (couper le plan 9, raccourcir le plan 7) ou publier la vidéo ailleurs et mettre le lien dans le post.
12. Revoir la vidéo exportée en entier une fois : aucun secret, mode correct à chaque plan, durée lue dans le lecteur.

### Samedi 14 novembre : publication (repère : tout soumis avant 12:00 UTC, limite 23:59 UTC)

Voir les étapes 6 à 9 plus bas : 1) rendre le dépôt public (étape 6, vérifier le clone neuf, `npm run replay` inclus) ; 2) publier le post X avec la **vidéo** jointe, @NEARProtocol et #NEARHackathon (étape 7) ; 3) soumettre le formulaire une seule fois (étape 8) ; 4) vérification finale en navigation privée (étape 9). Marge : si une étape échoue à 12:00 UTC, il reste plus de 11 heures.

### Vendredi 13 novembre : détail des étapes 1 à 5

**1. Récupérer la version finale et vérifier qu'elle tourne.**
- Action : `git checkout main`, `npm install`, `npm test`, `npm run typecheck`, `npm run scan:secrets -- --no-history`. Si possible, faites-le sur un **clone neuf** (`git clone <REPO_URL> /tmp/darwin-check`), c'est ce que fera le jury.
- Fait quand : les tests passent, `typecheck` ne signale aucune erreur, le scan sort avec le code 0 (`echo $?` sous Git Bash, `$LASTEXITCODE` sous PowerShell).
- **Avant tout lancement en mock** : votre `.env` local contient `DARWIN_MODE=testnet`. `npm run start:demo` force désormais `DARWIN_MODE=mock`, mais mettez le `.env` de côté par précaution : PowerShell `Rename-Item .env .env.testnet` (à remettre après : `Rename-Item .env.testnet .env`).
- Puis : `npm run start:demo`, ouvrir `http://127.0.0.1:3000/` : la page s'affiche avec la pastille MODE MOCK et des agents qui naissent. **Vérifier** : `curl http://127.0.0.1:3000/api/health` doit contenir `"mode":"mock"` ; sinon arrêter, la vidéo serait fausse.
- Puis, arrêter (Ctrl+C) et vérifier le rejeu : `npm run replay`, ouvrir la page : pastille « REJEU » et bandeau « Rejeu d'un run réel testnet du 10 novembre 2026 » avec barre de progression ; `curl http://127.0.0.1:3000/api/health` contient `"mode":"replay"`. Aucune clé n'est nécessaire.

**2. Enregistrer la vidéo (2 à 3 minutes, voix off en anglais).**
- Action : appliquer d'abord la **CHECKLIST AVANT ENREGISTREMENT** ci-dessus, puis suivre `docs/VIDEO_SCRIPT.md`, plan par plan. Mettre le `.env` de côté (`Rename-Item .env .env.testnet`), lancer `npm run start:demo` 2 minutes avant et vérifier `/api/health` → `"mode":"mock"` (remettre le `.env` après la vidéo avec `Rename-Item .env.testnet .env`). Les plans de lignées et de preuves se tournent avec `npm run replay` (le composeur de missions y est désactivé) : voir `docs/VIDEO_SCRIPT.md`. Ouvrir à l'avance les liens nearblocks de la section « Préparation » du script. Enregistrer avec l'outil d'écran de votre choix (Windows : Win+G, ou OBS). Avant de filmer : fermer `.env`, le terminal avec des clés, les onglets privés.
- **La vidéo est obligatoire** : HACKATHON.md (relu le 2026-11-12) exige de la joindre au post X ; des captures seules ne suffisent pas.
- Règles : dire que le mock est mock, que tout plan en rejeu est « not live », que le client payeur est simulé, que NEAR Intents n'a pas été exécuté, que le run testnet est une seule exécution. Ne pas dire « premier ». Retirer ou confirmer chaque mention « À CONFIRMER ».
- Fait quand : un fichier vidéo de **2:00 à 3:00** (vérifier la durée dans le lecteur), lisible, sans clé ni `.env` visible (le revoir en entier une fois), « wow » dans les 10 premières secondes.

**3. Faire pivoter la clé NEAR AI (obligatoire avant de rendre le dépôt public).**
- Pourquoi : l'ancienne clé `sk-…` a été collée en clair dans la conversation avec les agents.
- Étapes : (a) ouvrir https://cloud.near.ai et se connecter ; (b) menu **API Keys** : créer une nouvelle clé, la copier tout de suite (elle ne s'affiche en général qu'une fois) ; (c) ouvrir `.env` (non versionné) et remplacer la valeur de `NEARAI_API_KEY` par la nouvelle ; (d) revenir dans **API Keys** et **supprimer ou révoquer l'ancienne clé** ; (e) vérifier que la nouvelle fonctionne :
  `curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $(grep '^NEARAI_API_KEY=' .env | cut -d= -f2-)" https://cloud-api.near.ai/v1/model/list` doit afficher `200` ; (f) la même commande avec l'ancienne clé doit afficher `401` (à confirmer par vous : le code exact dépend de la plateforme).
- Ne jamais coller la clé dans un chat, un commit, une capture ou la vidéo. L'écran du navigateur sur la page API Keys ne doit pas apparaître dans la vidéo.
- Fait quand : l'ancienne clé n'apparaît plus dans API Keys, la nouvelle répond `200`, `.env` seul la contient (`git status` ne montre pas `.env`).
- **La clé du compte maître testnet a déjà été changée** (`docs/SECURITE.md` §6, 2026-11-11 : nouvelle clé en place, ancienne supprimée on-chain). Il reste, d'après SECURITE §6.3 : (1) supprimer l'ancienne clé dans `~/.near-credentials/testnet/darwin-master-7k2.testnet*` ; (2) supprimer les sauvegardes hors dépôt de la rotation (elles contiennent l'**ancienne clé NEAR AI**, encore valide tant que vous ne l'avez pas régénérée) ; (3) régénérer la clé NEAR AI (ci-dessus) et le jeton `DARWIN_ADMIN_TOKEN` s'il a quitté ce poste. Autres copies de `.env` (autres postes, worktrees) : elles ont l'ancienne clé maître, à mettre à jour.

**4. Traiter l'historique git (verdict de l'agent sécurité : voir `docs/SECURITE.md` §2.1 et §5.2).**
- Contexte : `npm run scan:secrets` échoue sur 7 valeurs **factices** de l'historique (commit `4eb92ea`, `backend/backend.test.ts`) ; les fichiers sont propres.
- **Verdict de l'agent sécurité (`docs/SECURITE.md` §2.1, 2026-11-11)** : les 7 valeurs sont **factices** (format non réel : longueurs, motifs, entropie vérifiés sans les afficher) ; **l'exception documentée est appliquée** (`scripts/scan-secrets.allowlist.json`, empreintes sha256 sans valeur, une entrée par commit, fichier et règle) ; **aucune réécriture d'historique**. Le scan complet (176 fichiers, 75 commits) sort à **0** ; `--no-allowlist` retrouve les 7 détections. Rien à faire de plus, sauf si vous voulez un historique sans aucune de ces valeurs (option B ci-dessous, facultative, irréversible : un scanner tiers comme gitleaks pourrait lever une alerte factice sur la ligne 42, règle générique).
- Option B (facultative, irréversible, à faire sur une copie ; procédure dans `docs/SECURITE.md` §2.1, non répétée par l'agent sécurité) : sauvegarder (`git clone --mirror . ../darwin-backup.git`), retirer les worktrees de `.claude/worktrees/`, réécrire le seul commit concerné comme décrit dans `docs/SECURITE.md` §2.1, puis `git reflog expire --expire=now --all && git gc --prune=now`.
- Option appliquée (C, exception documentée) : vérifier que `npm run scan:secrets` (historique inclus) sort avec le code 0.
- Fait quand : `npm run scan:secrets` (historique inclus) sort avec le code 0 et vous savez qu'un scanner tiers peut lever des alertes factices ; si vous choisissez l'option B, le scan sans exception sort aussi à 0 et `npm test` passe encore.

**5. Dernier contrôle avant publication.**
- Action : `git ls-files | grep -E "\.env$|\.key$|\.pem$|^data/"` ne doit rien afficher (seul `.env.example` est suivi). Relire `.env.example` : secrets vides, `INTENTS_ENABLED=false`. Relancer `npm run scan:secrets -- --no-history`.
- Fait quand : aucune ligne affichée, scan à 0.

### Samedi 14 novembre (viser une fin avant 12:00 UTC)

**6. Rendre le dépôt GitHub public.**
- Action : sur GitHub, ouvrir le dépôt, **Settings** > **General** > tout en bas **Danger Zone** > **Change repository visibility** > **Make public**, confirmer. Pousser d'abord `main` si ce n'est pas fait : `git push origin main`.
- Fait quand : en navigation privée (sans connexion), `<REPO_URL>` affiche le README, le fichier `LICENSE` est présent, et un `git clone <REPO_URL> /tmp/darwin-check && cd /tmp/darwin-check && npm install && npm run start:mock` démarre avec les trois lignes `[darwin]` du README (section 7). Vérifier aussi le rejeu sur ce clone : `npm run replay` doit afficher `MODE REPLAY (1819 événements de run8-journal.jsonl ...)` puis `rejeu démarré`, et la page doit montrer la pastille « REJEU ». Le dépôt doit **rester public** jusqu'à la fin du jugement.

**7. Publier le post X avec la vidéo.**
- **La vidéo est obligatoire** (HACKATHON.md du 2026-11-12 : des captures seules ne suffisent pas).
- Action : ouvrir `docs/POST_X.md`, remplacer `<REPO_URL>`, joindre la vidéo (étape 2), vérifier que le texte contient « Built at NEAR HACKATHON », **@NEARProtocol** et **#NEARHackathon** et reste sous 280 caractères (l'éditeur de X l'indique), puis publier depuis votre compte.
- Fait quand : le post est visible en navigation privée, la vidéo se lit, @NEARProtocol et #NEARHackathon apparaissent ; **copier l'URL du post** (nécessaire pour `demoUrl`).

**8. Soumettre le formulaire unique.**
- Préparation : relire la page https://nearhackathon.com/HACKATHON.md (les champs ont pu changer), puis `docs/FORMULAIRE.md`. Lancer `node scripts/check-formulaire.mjs` : doit afficher `OK` (le champ `idea` fait 20 à 2000 caractères).
- Champs à fournir par vous : `leadName`, `email`, `size`, `tracks` (recommandé : `swarms` et `agents`, éventuellement `open`), `nearAddress` (compte NEAR **mainnet** à vous, jamais créé par un agent), `projectUrl` = `<REPO_URL>`, `demoUrl` = URL du post X, `consent`. Laisser `website` vide.
- Divulgations (README §11) : confirmer « aucun code antérieur à la fenêtre du hackathon », et nommer un éventuel second projet dans les deux README.
- Action : formulaire https://nearhackathon.com/#apply, copier le texte du bloc `idea`, relire le JSON final, soumettre **une seule fois**.
- Fait quand : réponse « 201 enregistré » ou message de confirmation ; noter l'heure. Erreurs : 400 corriger et renvoyer avec le même `requestId` ; 409 doublon, ne pas contourner ; 503 réessayer avec le même `requestId`. Corrections après coup : https://nearhackathon.com/request-changes.

**9. Vérification finale (avant 23:59 UTC, idéalement tout de suite après l'étape 8).**
- Action : en navigation privée, rouvrir `<REPO_URL>` et l'URL du post X. Garder le dépôt public et le post en ligne. Ne plus pousser de commit susceptible de casser le démarrage.
- Fait quand : dépôt, post et accusé de réception du formulaire sont tous les trois en ligne et notés quelque part.

## À faire par vous (autres, non ordonnés)
| Priorité | Action | Pourquoi | Détail |
|---|---|---|---|
| P1 | Vérifier la facture réelle sur https://cloud.near.ai | Nos chiffres (environ 0,034 USD) sont une comptabilité locale ; la facture n'a pas été relue | Comparer avec `npm run ai:usage-report -- --dir data` |
| P2 | Optionnel : clé/abonnement RPC testnet dédié ; plusieurs URL possibles séparées par des virgules (fastnear.com ou un autre fournisseur listé sur https://docs.near.org/api/rpc/providers) | Évite les 429 du RPC gratuit | `NEAR_RPC_URL` dans `.env` |
| P2 | Démo mainnet NEAR Intents (hors V1) | — | **Aucun feu vert donné, rien dépensé.** Pour l'obtenir : écrire ici le montant maximal (plafond du code : 5 USD), la paire et le compte de dev ; voir `intents/DEMO_MAINNET.md` |

## État de l'environnement local (utile pour reprendre)
- Outils installés pendant la session : `near-cli-rs` 0.31.1 (npm global) ; Node portable **22.23.4** dans `<dossier-node>\node-v22.23.4-win-x64` (la machine reste en 22.17.1 : à mettre en tête de `PATH` pour le mode testnet, `near-api-js` exige >= 22.22.2) ; Rust 1.99.1 + cible `wasm32-unknown-unknown` dans `~/.cargo` (à ajouter au `PATH`).
- `.env` (non versionné) contient : clé NEAR AI, compte maître + clé, `NEAR_CONTRACT_ID`, `DARWIN_MODE=testnet` et les réglages de run. Pour revenir au mock, supprimer ou renommer `.env` (`Rename-Item .env .env.testnet`) ; `npm run start:mock`, `start:demo` et `replay` ignorent déjà `DARWIN_MODE=testnet` du `.env` (mode forcé par la commande).
- Comptes testnet : `darwin-master-7k2.testnet` (maître, solde à relire avec `near account view-account-summary`), `darwin-contract-7k2.testnet` (contrat). Le maître finance les sous-comptes des agents et le client simulé : un run de 40 minutes en consomme environ 0,7 NEAR (3,12 NEAR après le run 8). Un nouveau compte maître = un appel au robinet.
- Les décalages d'ids sont automatiques (horloge) : ne pas remettre `DARWIN_AGENT_SEQ_START` ni `DARWIN_TASK_SEQ_START` dans `.env`.
- Journaux locaux (ignorés par git) : `data/journal.jsonl`, `data/archive/*`, `data/ai-usage.jsonl`, `data/ai-budget.json`. Copies commitées : `docs/preuves/run5-journal.jsonl` à `run9b-journal.jsonl`.

## Décisions encore ouvertes
1. **Historique git** : réécrire ou documenter (étape 4).
2. **Option `trust proxy`** pour les plafonds par IP derrière un proxy : non codée, seulement si la démo est exposée derrière un proxy.
3. Choix des tracks et de la taille d'équipe (étape 8).

## Feux verts demandés
- **Démo mainnet NEAR Intents** : aucun feu vert, aucune dépense.
- **Rendre le dépôt public / poster / soumettre le formulaire** : à faire par vous (étapes 6 à 8).
