# Besoins pour l'humain — mis à jour le 2026-11-11 (lot L17-docs)

**Échéance : samedi 14 novembre 2026, 23:59 UTC** (soit 00:59 le 15 novembre à Paris, heure d'hiver UTC+1). **Marge de sécurité conseillée : avoir tout soumis le 14 novembre avant 12:00 UTC (13:00 à Paris)**, pour absorber une panne de X, de GitHub ou du formulaire. Le formulaire est à soumettre **une seule fois** et corrigé ensuite via https://nearhackathon.com/request-changes : ne pas le garder pour la dernière heure.

## Résumé
- **Prouvé en réel (voir `docs/PREUVES_TESTNET.md` §8)** : run 8 du 2026-11-10, preset `selection`, génération 3, 12 naissances, 8 reproductions, 7 morts par famine, 65 séquestres (63 libérés, 2 remboursés), contrat `darwin-contract-7k2.testnet`, clés function call vérifiées, appels réels NEAR AI Cloud (environ 0,034 USD en comptabilité locale), une attestation TEE.
- **Run 9 (2026-11-11, journaux `docs/preuves/run9a-journal.jsonl` et `run9b-journal.jsonl`, pas encore résumés dans `docs/PREUVES_TESTNET.md`)** : commandes de logo « visiteur ». 9a : expirées. 9b : un logo verrouillé puis **rejeté** (sortie tronquée, 0 bloc SVG sur 3) et **remboursé** par le contrat ; deux livrables texte acceptés et payés (payeur : client simulé). **Aucun logo livré, accepté et payé sur testnet n'est prouvé** (run 9c à faire, par le chef de projet).
- **Jamais prouvé** : NEAR Intents (jamais exécuté, aucune dépense), facture réelle NEAR AI relue, second run confirmant la génération 3, tâche de visiteur acceptée et payée sur testnet.
- **Rien n'est publié** : dépôt, post X et formulaire sont à vous (règle 5). Aucune dépense mainnet.
- Les clés (NEAR AI, compte maître) sont uniquement dans `.env`, ignoré par git. La clé NEAR AI a transité par la conversation : **à régénérer avant publication** (étape 3).

## Liste ordonnée à faire par vous

Tout se fait depuis le dossier du dépôt. Remplacer `<REPO_URL>` par l'adresse GitHub du dépôt. Avant de commencer, demander au chef de projet (ou lire `docs/STATUS.md`) que les lots L17 (pages Mission, Lignées, Preuves, mode replay), le run 9c et la mise à jour de `docs/PREUVES_TESTNET.md` sont fusionnés dans `main`, puis lire chaque repère « À CONFIRMER » de `docs/VIDEO_SCRIPT.md`.

### Vendredi 13 novembre

**1. Récupérer la version finale et vérifier qu'elle tourne.**
- Action : `git checkout main`, `npm install`, `npm test`, `npm run typecheck`, `npm run scan:secrets -- --no-history`.
- Fait quand : les tests passent, `typecheck` ne signale aucune erreur, le scan sort avec le code 0 (`echo $?` sous Git Bash, `$LASTEXITCODE` sous PowerShell).
- Puis : `npm run start:demo`, ouvrir `http://127.0.0.1:3000/` : la page s'affiche avec le bandeau MODE MOCK et des agents qui naissent.

**2. Enregistrer la vidéo (2 à 3 minutes, voix off en anglais).**
- Action : suivre `docs/VIDEO_SCRIPT.md`, plan par plan. Lancer `npm run start:demo` 2 minutes avant. Ouvrir à l'avance les liens nearblocks de la section « Préparation » du script. Enregistrer avec l'outil d'écran de votre choix (Windows : Win+G, ou OBS). Avant de filmer : fermer `.env`, le terminal avec des clés, les onglets privés.
- Règles : dire que le mock est mock, que le client payeur est simulé, que NEAR Intents n'a pas été exécuté, que le run testnet est une seule exécution. Ne pas dire « premier ». Retirer ou confirmer chaque mention « À CONFIRMER ».
- Fait quand : un fichier vidéo de **2:00 à 3:00** (vérifier la durée dans le lecteur), lisible, sans clé ni `.env` visible (le revoir en entier une fois), « wow » dans les 10 premières secondes.

**3. Faire pivoter la clé NEAR AI (obligatoire avant de rendre le dépôt public).**
- Pourquoi : l'ancienne clé `sk-…` a été collée en clair dans la conversation avec les agents.
- Étapes : (a) ouvrir https://cloud.near.ai et se connecter ; (b) menu **API Keys** : créer une nouvelle clé, la copier tout de suite (elle ne s'affiche en général qu'une fois) ; (c) ouvrir `.env` (non versionné) et remplacer la valeur de `NEARAI_API_KEY` par la nouvelle ; (d) revenir dans **API Keys** et **supprimer ou révoquer l'ancienne clé** ; (e) vérifier que la nouvelle fonctionne :
  `curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $(grep '^NEARAI_API_KEY=' .env | cut -d= -f2-)" https://cloud-api.near.ai/v1/model/list` doit afficher `200` ; (f) la même commande avec l'ancienne clé doit afficher `401` (à confirmer par vous : le code exact dépend de la plateforme).
- Ne jamais coller la clé dans un chat, un commit, une capture ou la vidéo. L'écran du navigateur sur la page API Keys ne doit pas apparaître dans la vidéo.
- Fait quand : l'ancienne clé n'apparaît plus dans API Keys, la nouvelle répond `200`, `.env` seul la contient (`git status` ne montre pas `.env`).
- Optionnel (compte maître testnet, sans valeur monétaire) : régénérer la clé du compte `darwin-master-7k2.testnet` seulement si vous partagez la session ; `near account list-keys darwin-master-7k2.testnet network-config testnet now` liste les clés, ajouter la nouvelle avec `near account add-key`, puis supprimer l'ancienne avec `near account delete-key`, et mettre `NEAR_MASTER_PRIVATE_KEY` à jour dans `.env`.

**4. Traiter l'historique git (verdict de l'agent sécurité : voir `docs/SECURITE.md` §2.1 et §5.2).**
- Contexte : `npm run scan:secrets` échoue sur 7 valeurs **factices** de l'historique (commit `4eb92ea`, `backend/backend.test.ts`) ; les fichiers sont propres.
- Verdict de l'agent sécurité : <EMPLACEMENT : à remplir d'après `docs/SECURITE.md` (option A : garder et documenter, ou option B : réécrire `4eb92ea`) ; recopier ici la ou les commandes exactes validées par l'agent sécurité>.
- Si option B (recommandation initiale de la sécurité, irréversible, à faire sur une copie) : sauvegarder (`git clone --mirror . ../darwin-backup.git`), retirer les worktrees de `.claude/worktrees/`, réécrire le seul commit concerné comme décrit dans `docs/SECURITE.md` §2.1, puis `git reflog expire --expire=now --all && git gc --prune=now`.
- Si option A : vérifier que le paragraphe d'explication est dans `docs/SECURITE.md` et `docs/DECISIONS.md`.
- Fait quand : option B, `npm run scan:secrets` (historique inclus) sort avec le code 0 et `npm test` passe encore ; option A, la décision est écrite et vous savez qu'un scanner tiers peut lever 7 alertes factices.

**5. Dernier contrôle avant publication.**
- Action : `git ls-files | grep -E "\.env$|\.key$|\.pem$|^data/"` ne doit rien afficher (seul `.env.example` est suivi). Relire `.env.example` : secrets vides, `INTENTS_ENABLED=false`. Relancer `npm run scan:secrets -- --no-history`.
- Fait quand : aucune ligne affichée, scan à 0.

### Samedi 14 novembre (viser une fin avant 12:00 UTC)

**6. Rendre le dépôt GitHub public.**
- Action : sur GitHub, ouvrir le dépôt, **Settings** > **General** > tout en bas **Danger Zone** > **Change repository visibility** > **Make public**, confirmer. Pousser d'abord `main` si ce n'est pas fait : `git push origin main`.
- Fait quand : en navigation privée (sans connexion), `<REPO_URL>` affiche le README, le fichier `LICENSE` est présent, et un `git clone <REPO_URL> /tmp/darwin-check && cd /tmp/darwin-check && npm install && npm run start:mock` démarre avec les trois lignes `[darwin]` du README (section 7). Le dépôt doit **rester public** jusqu'à la fin du jugement.

**7. Publier le post X avec la vidéo.**
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
- Outils installés pendant la session : `near-cli-rs` 0.31.1 (npm global) ; Node portable **22.23.4** dans `C:\Users\aymer\node22\node-v22.23.4-win-x64` (la machine reste en 22.17.1 : à mettre en tête de `PATH` pour le mode testnet, `near-api-js` exige >= 22.22.2) ; Rust 1.99.1 + cible `wasm32-unknown-unknown` dans `~/.cargo` (à ajouter au `PATH`).
- `.env` (non versionné) contient : clé NEAR AI, compte maître + clé, `NEAR_CONTRACT_ID`, `DARWIN_MODE=testnet` et les réglages de run. Pour revenir au mock, supprimer ou renommer `.env`.
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
