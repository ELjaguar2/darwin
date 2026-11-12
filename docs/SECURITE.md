# SECURITE

> **English summary.** Security review by the `securite` agent: threat model (keys, escrow funds, reputation, prompt injection, public API), secret-scan status (`scripts/scan-secrets.mjs`), per-work-package findings (L2 to L9, frontend L8), verdicts, checklists, master-key rotation (L17, §6) and the pre-merge review of `lot/L17-integration` (§7, fixes recorded in D-046).
> **State:** passes 1 to 3 recorded no blocking finding; the 7 dummy values found in git history are exempted by `scripts/scan-secrets.allowlist.json` (the full scan exits 0 since L17); no secret value appears in this document or in the repository. The rest of this file is kept in its original French (internal security report).

> Propriétaire : agent securite. Revue L10 : première passe (L3-L6) puis deuxième passe (L2, L7, L9 et vérification des correctifs, `main` au commit `98a30a3`), troisième passe (L8 `frontend/`, après fusion dans `main`), 2026-11-09. Lecture seule sur le code des autres lots : les constats sont des signalements au chef de projet, rien n'a été corrigé. Aucune valeur secrète n'apparaît dans ce document.

## 1. Modèle de menace (court)

| Actif | Menace | Mesure attendue |
|---|---|---|
| Clé du compte maître (`NEAR_MASTER_PRIVATE_KEY`), clés des sous-comptes | fuite par dépôt, log, événement du journal, message d'erreur | `.env` ignoré, `redactConfig`, scan de secrets avant fusion, aucun message d'erreur ne reprend une clé |
| Clé API NEAR AI (`NEARAI_API_KEY`) | fuite ; consommation de crédit réel par boucle ou abus | en-tête seulement, plafonds par appel, par agent et global |
| Fonds du séquestre | libération sans preuve, double règlement, réentrance, détournement par un tiers | contrat : opérateur seul, états `locked/releasing/released`, callbacks ; marché : verdict enregistré avant libération |
| Crédit de solde | crédit sans dépôt prouvé | aucun crédit sans preuve vérifiée (D-015) |
| Réputation | gonflement sans travail validé | écriture liée à un séquestre libéré, preuve identique, une fois par tâche |
| Cerveau des agents | injection de prompt par texte visiteur ou résultat d'agent | texte externe en message `user`, délimité, jamais dans `system` |
| API publique (formulaire) | spam, épuisement du compte de démo | plafond horaire visiteurs, 10 tâches ouvertes par IP (backend, L7) |
| Opérateur (modèle de confiance D-024) | l'opérateur est oracle : ce n'est pas du trustless | divulgation, `validator` et `resultHash` journalisés |

Deuxième passe : `accounts/` (L2), `intents/` (L9) et `backend/` (L7) sont revus au §3.5 à 3.7. `frontend/` (L8) est revu au §3.8 (troisième passe, après fusion).

## 2. État du scan de secrets

Script : `scripts/scan-secrets.mjs` (`npm run scan:secrets`, alias `npm run scan-secrets`). Sans dépendance. Il scanne les fichiers suivis par git et les lignes ajoutées de l'historique (`git log -p`) : clés NEAR `ed25519:`/`secp256k1:`, clés PEM, phrases de récupération de 12 à 24 mots précédées d'un mot-clé, clés `sk-`, `Bearer` long, JWT, affectation non vide (16 caractères ou plus) de `NEAR_MASTER_PRIVATE_KEY`, `NEARAI_API_KEY`, `INTENTS_JWT`, `DARWIN_ADMIN_TOKEN` ; fichier `.env*` suivi (hors `.env.example`). Valeurs toujours masquées (4 premiers caractères + longueur). Code de sortie 1 si détection. Options : `--ref <branche>` (arbre et historique de cette branche), `--no-history`, `--no-files`, `--no-allowlist`. Depuis L17 (voir §2.1) les 7 valeurs factices de l'historique sont exemptées par `scripts/scan-secrets.allowlist.json` : le scan complet sort 0, et `--no-allowlist` les fait réapparaître.

Le script a été vérifié sur un dépôt jetable contenant des valeurs factices de chaque type (détection de chacun, rien d'affiché en clair). Limites connues : une phrase de récupération sans mot-clé voisin n'est pas détectée ; un secret de moins de 16 caractères non préfixé non plus.

| Cible | Fichiers | Commits | Résultat |
|---|---|---|---|
| `main` première passe (commit `14bf182`) | 43 | 22 | propre |
| `lot/L3`, `L4`, `L5`, `L6`, `L2`, `L9` (première passe) | 47 à 53 | 5 à 8 | propre |
| `main` deuxième passe (commit `98a30a3`, historique de toutes les refs) | 112 | 42 | fichiers propres ; **7 détections dans l'historique** (voir ci-dessous) |

### 2.1 Détections de l'historique : `backend/backend.test.ts`, commit `4eb92ea`

Le scan signale 7 valeurs (la consigne en annonçait 6 ; la 7e est `cle-api-sk` à la ligne 403, même commit, même fixture) : lignes 42, 53 (deux valeurs de plus), 229, 376 et 403. Aucune n'est présente dans l'arbre actuel : le commit `bffc038` assemble désormais les fausses valeurs à l'exécution (`FAKE(...)`), et le scan des fichiers est propre.

**Elles sont factices**, vérifié sans les afficher :
- ce sont des paramètres de tests qui vérifient le masquage (`redactText`, `/api/config`, jeton admin) ; chaque ligne est dans un `setup({...})`, un `expect(redactText(...))` ou une affectation de fixture ;
- les motifs sont des mots de bourrage reconnaissables (préfixes `sk-`, `tok-`, `jwt-`, mots « secret », alphabet `ABCDEFGHIJ...`), pas des chaînes aléatoires ;
- la « clé NEAR » fait 30 caractères au total ; une vraie clé ed25519 NEAR en fait environ 96 (`ed25519:` + base58 de 64 octets) ;
- la valeur « jwt » fait 21 caractères et n'a pas les trois segments d'un JWT ; aucune clé réelle n'a jamais été saisie dans le dépôt (le scan est propre sur les 41 autres commits, et `.env` n'a jamais été suivi : `git ls-files` ne contient que `.env.example`).

**Verdict L17 (2026-11-11) : format NON réel, option C appliquée (exception ciblée), pas de réécriture.** Vérification sans afficher les valeurs (script de mesure local, longueur, entropie, test de motifs) sur les 9 chaînes des lignes 42, 53, 229, 376, 403 du commit `4eb92ea` :

| Valeur (fragment) | Longueur | Motif de secret réel correspondant ? |
|---|---|---|
| `sk-s...` (lignes 42, 53) | 29 | non : ni OpenAI (`sk-...T3BlbkFJ...` ou `sk-proj-` + 40 car. ou plus), ni Anthropic (`sk-ant-api03-` + 80 car. ou plus) |
| `sk-t...` (376), `sk-a...` (403) | 28, 25 | non (mêmes motifs) |
| `tok-...` (42, 53), `le-b...` (229) | 17, 16 | non : jetons inventés, aucun format de fournisseur |
| `ed25...` (53) | 30 | non : une clé NEAR réelle fait 96 caractères (`ed25519:` + base58 de 64 octets) ; le corps contient des caractères hors base58 |
| `jwt-...` (53) | 21 | non : pas de trois segments `eyJ...eyJ...` |

Le push protection de GitHub (secret scanning) repose sur des motifs de fournisseurs à préfixe et longueur fixes ; aucune de ces valeurs n'en satisfait un. Il n'existe pas, à ma connaissance, de motif NEAR dans cette liste (non vérifié en ligne : la liste publique de GitHub n'a pas été consultée depuis ce poste), et la valeur « ed25519 » est de toute façon trop courte pour être décodable en clé. `gitleaks` et `trufflehog` ne sont pas installés sur ce poste : non testés. Réserve : la règle générique `generic-api-key` de gitleaks (mot-clé `api_key` + chaîne d'entropie élevée) pourrait signaler la ligne 42 (`NEARAI_API_KEY: "sk-s..."`, entropie 4,1) ; c'est un faux positif de scanner tiers, pas un secret. Exception appliquée : `scripts/scan-secrets.allowlist.json`, une entrée par (commit, fichier, type de règle) avec l'empreinte sha256 (16 premiers hex) de chaque valeur, aucune valeur stockée, justification écrite dans le fichier ; une autre valeur, un autre fichier, un autre commit ou un secret de l'arbre actuel reste détecté. Les exceptions ne s'appliquent qu'à l'historique. Scan complet après exception : 176 fichiers, 75 commits, sortie 0 ; `--no-allowlist` retrouve les 7 détections.

Si l'humain préfère malgré tout un historique sans aucune de ces valeurs (jury avec gitleaks), l'option B ci-dessous reste valable (procédure : sauvegarde `git clone --mirror`, retrait des worktrees, `git filter-repo --replace-text <fichier>` ou `git filter-branch --tree-filter` limité au commit `4eb92ea`, `git reflog expire --expire=now --all && git gc --prune=now`, scan sans allowlist, `npm test`). `git filter-repo` n'est pas installé ici : la procédure n'a pas été répétée, rien n'a été réécrit.

Options (analyse initiale, avant L17) :

| Option | Avantages | Inconvénients |
|---|---|---|
| A. Garder l'historique et documenter (ce paragraphe + `docs/DECISIONS.md`) | Aucun risque pour les branches et worktrees, historique « petits commits » intact | `node scripts/scan-secrets.mjs` reste en échec (code 1) ; un scanner tiers (gitleaks, trufflehog) du jury peut lever une alerte et faire douter un tri automatique |
| B. Réécrire l'historique avant la publication (remplacer ces valeurs dans le seul commit `4eb92ea`, par `git filter-repo --replace-text` ou `git filter-branch --tree-filter`, sur une copie de sauvegarde) | Scan propre de bout en bout, preuve nette « aucun secret, jamais » | Tous les identifiants de commits après `4eb92ea` changent ; à faire en toute dernière étape, par le chef de projet, après la dernière fusion, sur les branches `lot/*` aussi (ou après leur suppression) ; les worktrees `.claude/worktrees/` doivent être retirés avant ; aucun dépôt distant n'existe encore, donc aucun coût de synchronisation |
| C. Liste d'exceptions revue dans le scanner (empreinte commit + fichier + ligne) | Le scan passe sans toucher à l'historique | Affaiblit l'outil et ne rassure pas un scanner tiers |

**Recommandation : B, en dernière étape avant la publication** (le dépôt est local, l'impact d'une réécriture est minimal et un seul fichier est concerné). Garder A comme repli si le temps manque, avec le paragraphe ci-dessus. Ne pas faire C. Après réécriture : relancer `node scripts/scan-secrets.mjs` (doit sortir 0), `npm test`, vérifier `git log --all` et supprimer les anciennes refs (`git reflog expire --expire=now --all && git gc --prune=now`). C'est une décision de l'humain avant publication (règle 5) : rien n'a été réécrit par cet agent.

Le seuil du scanner (16 caractères) reste en place : `.gitignore` couvre `.env`, `.env.*` (sauf `.env.example`), `*.key`, `*.pem`, `.near-credentials/`, `data/`, `*.log`. `.env.example` : toutes les variables du code y figurent (y compris `DARWIN_ADMIN_TOKEN`, `INTENTS_*`, `NEARAI_MAX_USD_*`), secrets vides, `INTENTS_ENABLED=false`, `INTENTS_DRY_ONLY=true`.

## 3. Constats par lot

Gravité : **BLOQUANT** (interdit la fusion), **À CORRIGER** (corriger avant démo testnet ou avant fusion finale, fusion possible), **NOTE**.

### 3.0 Suivi des correctifs de la première passe (vérifiés dans `main`)

| Réf. | Correctif demandé | État dans `main` | Preuve |
|---|---|---|---|
| L3 | `lock_escrow` squattable : réservation opérateur | APPLIQUÉ | `contracts/darwin/src/lib.rs:146-176` (`reserve_task` réservé à l'opérateur, `lock_escrow` exige la réservation pour CE payeur et la consomme) ; enchaîné dans `accounts/near-chain.ts:366-375` ; `MockChain` aligné (D-031) |
| L3/L6 | malus d'expiration refusé par le contrat | APPLIQUÉ | `lib.rs:285` accepte `Rejected` ou `Expired` ; `market/index.ts:58` |
| L4 | dette perdue dans `flushAgent` | APPLIQUÉ | `engine/economy.ts:41-53` : la dette n'est remise à 0 qu'après transfert réussi |
| L4 | fonds orphelins si `registerAgent` échoue | APPLIQUÉ | `engine/lifecycle.ts:25-37` : `closeAccount` vers le financeur, événements `BIRTH_ABORTED` / `BIRTH_ORPHAN_ACCOUNT` |
| L5 | plafond global de dépense IA | APPLIQUÉ | `brain/near-ai-brain.ts:38-39,122-126` (2 USD par run, 1 USD par heure par défaut, `NEARAI_MAX_USD_PER_RUN/HOUR`, câblé dans `backend/runtime.ts:377-383`) |
| L5 | `sanitizeExternal` contournable | APPLIQUÉ | `brain/prompts.ts:10-18` : boucle jusqu'à stabilité |
| L5 | https obligatoire pour `NEARAI_BASE_URL` | APPLIQUÉ | `brain/near-ai-brain.ts:56-73` (http seulement vers localhost avec opt-in) |
| L6 | juge en échec ouvert | APPLIQUÉ | `market/validation.ts:120-153` : cerveau réel = `JudgeUnavailableError`, validation différée, aucune libération ; repli règle seulement en mock, signalé |

Non revérifiés (NOTES de la première passe) : gaz statique du callback `on_settled`, pas de pause d'urgence du contrat. `engine/index.ts:117` n'utilise toujours pas les gabarits anti-injection de `brain/prompts.ts` (le texte visiteur reste en message `user`, donc sans risque pour le `system`). Reste vrai : le juge IA consomme le quota de l'identifiant `treasury` (`market/validation.ts:133,168`), partagé avec d'autres appels : une saturation retarde les validations (échec fermé, donc sans fuite d'argent) mais ne les corrompt plus.

### 3.1 `lot/L3-contrats` (Rust) : FUSIONNABLE APRÈS CORRECTIFS

Points conformes : opérateur seul pour registre, release, refund, réputation (`lib.rs:67-69`) ; le statut passe à `Releasing`/`Refunding` AVANT le transfert, donc pas de double règlement ni de réentrance par re-appel pendant la Promise (`lib.rs:178-185`, `192-198`) ; callback `#[private]` avec `#[callback_result]`, retour à `Locked` si le transfert échoue (`lib.rs:202-234`) ; preuve `accepted`, hash et validateur non vides exigés (`lib.rs:168-176`) ; remboursement limité à `rejected`/`expired` par le type `RefundReason` ; réputation positive liée à un séquestre `Released`, au bon bénéficiaire et au même `result_hash`, une seule fois par tâche et agent (`lib.rs:244-264`) ; `overflow-checks = true`, déploiement testnet seulement et sans clé dans le script.

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER | `contracts/darwin/src/lib.rs:142-148` : `lock_escrow` est appelable par n'importe quel compte qui se déclare `payer`. Les `task_id` sont prévisibles (`t-0001`...) : un tiers peut verrouiller un id avant l'opérateur (`ESCROW_EXISTS`), la tâche légitime échoue (`ESCROW_LOCK_FAILED`), et un remboursement irait au tiers. Griefing sans vol de fonds. | Réserver `lock_escrow` à l'opérateur (le moteur déplace d'abord les fonds du payeur vers l'opérateur), ou n'accepter que des `task_id` préalablement ouverts par l'opérateur, ou clé du séquestre = `payer\|task_id`. Ajouter un test « un tiers ne peut pas squatter un id ». |
| À CORRIGER (intégration) | `lib.rs:258-262` : le malus (delta < 0) exige un séquestre `Refunded` pour `Rejected`. Or `market/index.ts:271` (L6) applique aussi un malus à l'expiration (`deltas.expired = -2`) : le contrat refusera (`REPUTATION_FAILED`, avertissement non fatal). | Décision à acter par le chef de projet : accepter aussi `Expired` côté contrat pour les tâches attribuées, ou supprimer le malus d'expiration côté marché. |
| NOTE | `lib.rs:185`, `198` : le callback `on_settled` n'a pas de gaz statique réservé ; s'il manquait de gaz, le séquestre resterait en `Releasing`/`Refunding` sans sortie. | Ajouter un gaz statique au callback (ex. 10 Tgas) et une méthode opérateur de reprise réservée aux états bloqués. |
| NOTE | `lib.rs:166`, `244` : `payee` de la libération est libre (choisi par l'opérateur) ; le malus ne vérifie pas que l'agent pénalisé est le gagnant. Cohérent avec D-024 (l'opérateur est l'oracle). | Divulguer dans le README ; option : mémoriser l'agent gagnant à l'attribution. |
| NOTE | Pas de rotation de l'opérateur ni de pause d'urgence. | Optionnel : `set_operator` en deux étapes. |
| NOTE | `contracts/deploy-testnet.sh` non exécuté de bout en bout (dit le README) ; refuse un compte non `.testnet`, signature par trousseau CLI, aucun secret. | À rejouer avant démo ; confirmer la chaîne d'outils Rust (échéance D-022, 2026-11-11 23:59 UTC). |

### 3.2 `lot/L4-moteur` : FUSIONNABLE APRÈS CORRECTIFS

Points conformes : montants en `bigint` ; `debit` plafonné au solde ; solde logique = solde on-chain moins dettes ; `die` règle les dettes puis balaie le reste vers le maître ; aucun import de `near-api-js`, aucune lecture de `process.env`, aucune clé dans les événements ; texte de tâche envoyé en message `user` (`engine/index.ts:117`).

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER | `engine/economy.ts:47` : `flushAgent` remet la dette à 0 AVANT le transfert (`:49`). Si le transfert échoue, la dette est perdue : l'agent n'a jamais payé (conservation faussée, coût IA offert). | Ne remettre à 0 qu'après succès, ou restaurer la dette dans un `catch`. Test : transfert qui échoue puis réessai. |
| À CORRIGER | `engine/lifecycle.ts:14-21` : `bear()` crée et finance le compte enfant, puis appelle `registerAgent` sans protection. Si `registerAgent` échoue, les fonds restent dans un compte orphelin hors du moteur (`ctx.agents.set` n'a pas eu lieu). | `try/catch` autour de `registerAgent` : en cas d'échec, `closeAccount` vers le parent/maître et événement `system.error`. |
| NOTE | `engine/economy.ts:26` : `debit` plafonne au solde ; un appel IA plus cher que le solde est facturé au solde restant seulement (sous-facturation bornée, mort au même tick). | Accepté ; ou refuser l'appel si `estimateCost > solde - réserve`. |
| NOTE | `engine/index.ts:115-117` : le moteur envoie `genome.personality` seule en `system` et `t.prompt` brut en `user`, sans les règles fixes ni le délimiteur de `brain/prompts.ts`. Pas une faille (le texte visiteur reste en `user`) mais l'anti-injection de L5 n'est pas utilisé. | À l'intégration, utiliser `executeMessages`/`letterMessages` de `brain/prompts.ts` ou `taskMessages` du marché. |
| NOTE | `engine/index.ts:198-199` : sur erreur de tick, `finish("error")` arrête la simulation, laissant d'éventuels séquestres `locked`. | Au `finish`, demander au marché de rembourser les séquestres ouverts (`expired`). |
| NOTE | `engine/economy.ts:11`, `index.ts:81,106,133` : des `e.message` sont journalisés (`system.warning`). Sûr si les erreurs de `Chain`/`Brain` ne contiennent jamais de clé (à vérifier sur L2). | Filtre central de masquage dans le journal (motifs `ed25519:`, `Bearer`, `sk-`). |
| NOTE | Personnalité mutée par gabarit (`genome.ts:26,94-97`), pas par IA : pas d'injection de second ordre. | Aucun. |

### 3.3 `lot/L5-cerveau` : FUSIONNABLE APRÈS CORRECTIFS

Points conformes : la clé n'est utilisée que dans l'en-tête `Authorization` (`near-ai-brain.ts:125`, `229`) ; les erreurs réseau ne reprennent que le nom de l'exception (`:112`), le message `NO_API_KEY` ne contient pas la valeur ; aucun `console.*` ; `createBrain` retombe sur le mock sans clé ; plafonds : `max_tokens` borné, budget USD par appel avec réduction ou refus (`:212-221`), taille de prompt (`:197`), garde-fou anti-boucle par agent et requête identique (`:170-191`), prix invalides refusés, jamais de coût nul (`:209`, `252-255`), verdict illisible = `rejected`.

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER | `brain/near-ai-brain.ts:170-191` : aucun plafond GLOBAL de dépense (la clé de plateforme consomme du crédit réel). Le plafond est par agent (30 appels/min) : 24 agents x 30 appels/min x 0,05 USD reste une exposition élevée. | Budget global par fenêtre (USD/heure et total de session, avec valeur par défaut basse), refus `RATE_LIMITED` au-delà ; consigner dans `docs/BESOINS_HUMAIN.md` (règle 4). |
| À CORRIGER | `brain/prompts.ts:10` : `sanitizeExternal` retire `<<<` et `>>>` en une seule passe ; `<<>>><` redonne `<<<` après retrait (contournement du délimiteur). | Répéter le remplacement jusqu'à stabilité, ou neutraliser par substitution (`< < <`). Test unitaire sur cette chaîne. |
| À CORRIGER | `brain/near-ai-brain.ts:94-96`, `125`, `229` : `NEARAI_BASE_URL` configurable, aucune exigence de `https:` ; une URL `http://` enverrait la clé en clair. | Refuser toute URL non `https:` (sauf `localhost` en test) dans `createBrain`. |
| NOTE | `near-ai-brain.ts:246-247` : le message d'erreur du serveur (200 caractères) est recopié dans l'erreur puis journalisé par l'appelant. | Passer le texte dans le masquage central. |
| NOTE | `prompts.ts:72` : `parseVerdict` n'est pas ancré au début ; le marché utilise son propre `parseJudgeVerdict` (ancré). | Un seul parseur ancré. |
| NOTE | `near-ai-brain.ts:234-266` : relance sur 5xx/429 sans clé d'idempotence ; double facturation possible côté fournisseur (une relance au plus). | Accepté. |

### 3.4 `lot/L6-marche` : FUSIONNABLE APRÈS CORRECTIFS

Points conformes : séquestre verrouillé à l'attribution (`index.ts:227`) ; libération uniquement après verdict `accepted` enregistré, résultat inchangé depuis la validation et séquestre on-chain concordant (`:285-291`) ; validateur jamais l'agent payé, le demandeur ni un `agent:*` (`:360-361`) ; remboursement seulement sur `rejected` (verdict rejeté exigé) ou `expired` (statut exigé) (`:258-259`) ; plafond horaire visiteurs (`:160-162`), compte payeur jamais fourni par l'appelant (`:159`) ; budgets bornés ; anti auto-contrat sur toute la chaîne de sous-traitance (`:201-203`) ; texte visiteur et résultat de l'agent passés au juge dans un JSON de message `user` (`validation.ts:66-70`) ; verdict de juge ancré au début ; étiquettes `simulé` et visiteur normalisées ; réputation écrite une fois (`:243-244`).

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER | `market/validation.ts:136-139` : si le juge IA est indisponible ou illisible, le marché se rabat sur la règle de base, qui accepte tout résultat de 20 caractères ou plus qui ne recopie pas la demande (`:35-38`), et libère l'argent. Un agent peut être payé pour du texte sans valeur dès que le juge échoue, y compris par saturation : tous les appels du juge portent l'`agentId` `treasury`, soumis au plafond de 30 appels/min de L5 (`near-ai-brain.ts:175`). | Échec fermé quand le cerveau est réel : pas de libération tant que le juge ne répond pas ; la tâche reste `submitted` et `step` réessaie (mécanisme présent, `index.ts:323`) jusqu'à l'échéance, puis remboursement `expired`. Repli règle seule uniquement en mock, étiqueté. Donner au juge son propre quota. |
| À CORRIGER (intégration) | `market/index.ts:271` : malus d'expiration refusé par le contrat (voir 3.1). | Décision commune L3/L6. |
| NOTE | `market/index.ts:173` : aucun plafond de tâches ouvertes dans le marché (`tasks` croît sans borne) ; le plafond « 10 tâches ouvertes par IP » est prévu au backend (L7). Le plafond horaire en NEAR borne la dépense, pas le nombre de tâches. | Plafond global de tâches `posted` (ex. 200) dans `postTask`. Vérifier le plafond par IP à la revue de L7. |
| NOTE | `market/validation.ts:59-70` : la défense anti-injection du juge repose sur le modèle ; un résultat d'agent hostile peut tenter de forcer `accepted`. Le plancher de règle ne protège que contre le rejet. | Accepté ; divulgation « validé par : brain:<modèle> » (D-024). Option : score minimal pour payer (ex. >= 0,5). |
| NOTE | `market/index.ts:236,250,312` : `e.message` des erreurs de chaîne dans des `system.warning` (300 caractères max). | Masquage central (3.2). |
| NOTE | `visitorHourlyCap` : défaut dans `shared/config.ts` (20 ou 30 NEAR/h selon le preset) ; en testnet le compte `visitors` ne doit pas dépasser ce que le faucet fournit. | Vérifier en L7. |

### 3.5 `accounts/` (L2) : FUSIONNABLE (corrections avant le déploiement testnet)

Points conformes : `Secret` masque la valeur à `toString`, `JSON.stringify` et `util.inspect` (`keys.ts:12-29`) ; les messages d'erreur ne reprennent jamais une clé (`keys.ts:51-58,125`, `near-backend.ts:52-55`) ; `FileKeyStore` écrit en `0600` dans `data/keys` (ignoré par git), nom de fichier validé contre `..` et `/` (`keys.ts:102-110`) ; la clé d'un sous-compte est enregistrée AVANT la transaction et retirée en cas d'échec (`near-chain.ts:182-192`) ; `checkReady` refuse tout réseau autre que testnet (`near-chain.ts:130`), donc pas de mainnet par erreur ; `closeAccount` refuse le compte maître et vérifie l'existence du bénéficiaire avant de supprimer (anti-destruction de fonds, `:229-231`), l'archive ne contient aucune clé privée (`archive.ts`) ; plafonds par transaction et par fenêtre glissante hors compte maître (`policy.ts`, `index.ts:65`) ; `releaseEscrow` exige une preuve `accepted` avec hash et validateur (`near-chain.ts:412-414`) ; `refundEscrow` limité à `rejected`/`expired` (`:90-94`) ; `reserve_task` avant `lock_escrow`, avec contrôle de la réservation existante (`:366-375`) ; réputation : preuve identique, séquestre dans son état final, une écriture par couple (tâche, agent) ; la clé du payeur ne signe que `lock_escrow` ; le compte maître est la seule clé qui signe release, refund et réputation.

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER | `accounts/near-chain.ts:415-424` et `:440-448` (mode dégradé D-016, vraisemblablement le mode de la démo testnet si Rust n'est pas prêt) : `releaseEscrow` et `refundEscrow` n'écrivent le statut (`released`/`refunded`) qu'APRÈS le transfert, sans verrou par tâche. Deux appels concurrents, ou un plantage entre le transfert et `ledger.save()`, paient deux fois depuis le compte `escrow.<maître>`, qui contient aussi les fonds des autres tâches. Le marché sérialise via `busy`, mais `Chain` doit être sûre seule. | Passer le séquestre à `releasing`/`refunding` AVANT le transfert (comme le contrat), restaurer `locked` dans un `catch`, sauvegarder avant et après. Test : deux `releaseEscrow` simultanés ne paient qu'une fois. |
| À CORRIGER (faible) | `accounts/policy.ts:16` : `SpendCapError` utilise le code `RPC_ERROR` avec un préfixe de message, alors que D-031 et `shared/chain.ts:30` définissent `SPEND_CAP_EXCEEDED` (« ne jamais faire mourir un agent »). Le marché et le moteur ne peuvent pas distinguer proprement un plafond atteint d'une panne RPC. | `super("SPEND_CAP_EXCEEDED", ...)` ; adapter les tests (`accounts.test.ts:132` passe déjà sur le message). |
| NOTE | `policy.ts:48-59`, `near-chain.ts:217-225` : `check` puis `record` ne sont pas atomiques ; deux transferts concurrents depuis un même compte peuvent chacun passer le contrôle et dépasser ensemble `perWindow`. | Réserver le montant dans `check` et le libérer en cas d'échec. |
| NOTE | `near-chain.ts:196-209` : la clé function call par agent n'est jamais utilisée pour signer (`signerFor` n'utilise que la clé complète) et, selon D-032, ne peut pas attacher de dépôt, donc ne peut pas appeler `lock_escrow` avec succès. Elle n'apporte aucune fonction et ajoute une clé secrète stockée par agent (allocation de gaz 0,05 NEAR). Sans danger : `lock_escrow` exige réservation opérateur et dépôt non nul. | Ne pas la créer tant qu'aucun usage n'existe, ou le documenter. |
| NOTE | `near-backend.ts:52-55` : `safeMessage` ne masque que `ed25519:` (pas `secp256k1:`, `Bearer`, `sk-`) ; `near-chain.ts:207` recopie 200 caractères de l'erreur. Compensé par `backend/redact.ts` et le journal (§3.7), mais la défense propre au module est incomplète. | Réutiliser les mêmes motifs. |
| NOTE | `keys.ts:115` : clés privées en clair (JSON) dans `data/keys` ; sous Windows `chmod 0600` est sans effet (dit le commentaire). Acceptable : testnet seulement, comptes jetables ; ne jamais réutiliser ce stockage pour une clé mainnet. | Documenter ; limiter l'accès au dossier par ACL. |
| NOTE | `near-chain.ts:228-262` : en cas de repli « gelé », la clé est retirée alors que 0,001 NEAR reste dans le compte (irrécupérable, voulu) ; un plantage entre la suppression du compte et `archive.add` perd la ligne d'archive. | Écrire l'archive avant de retirer la clé. |
| NOTE | `near-chain.ts:352-355` (dégradé) : n'importe quel appelant du `Chain` en processus peut réserver un id pour n'importe quel payeur ; la séparation opérateur/payeur du contrat n'existe pas en dégradé. Sans impact tant que seul le marché appelle `lockEscrow`. | Aucun (documenté D-016). |

### 3.6 `intents/` (L9) : FUSIONNABLE (corrections avant la démo mainnet)

Points conformes : verrous cumulés `INTENTS_ENABLED` (défaut faux) puis `INTENTS_DRY_ONLY` (défaut vrai, seul `"false"` le lève) vérifiés dans la classe de base commune au mock et au client réel (`guard.ts:15-27`, `base.ts:109-160`) ; devis `dry:true` identique exigé avant `dry:false` (`base.ts:111-114`), plafond de 5 USD par défaut non réglable par variable d'environnement, valeur USD illisible = refus ; adresse de dépôt acceptée seulement si émise par cette instance (`base.ts:125`) ; aucune signature, aucune clé privée, aucun transfert dans le module ; la clé partenaire part uniquement dans l'en-tête `x-api-key` (`oneclick.ts:37`), n'est jamais journalisée (le journal `intents.quote` ne contient que des actifs et montants) et les erreurs HTTP ne reprennent que le message du serveur (200 caractères, `:50`) ; `/api/config` ne publie que `enabled` et `dryOnly` ; aucun appel du module depuis le backend, le moteur ou le marché : pas de chemin automatique vers une dépense. Preuve de dépôt : jamais fournie par l'utilisateur, tirée de `/v0/status` et recoupée avec le devis (statut `SUCCESS`, adresse, destinataire, actifs, `amountOut >= minAmountOut`, aucun remboursement, hash de destination présent, `proof.ts:15-40`) ; le registre de crédit n'accepte que des preuves émises par `verifyDeposit` (objet gelé, `WeakSet`), une seule fois par dépôt (`:62-72`) ; preuves `mock:true` étiquetées. `demo.ts` : ne signe rien, exige l'activation et (pour `run`) `DRY_ONLY=false`, n'affiche ni clé ni jeton.

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER (avant la démo mainnet) | `intents/base.ts:115-116` : le plafond USD est contrôlé sur le devis `dry:true` seulement. Le devis `dry:false`, qui crée l'adresse de dépôt réellement utilisée, n'est pas recontrôlé : son `amountInUsd`, son `amountIn` ou ses actifs peuvent différer (prix mouvant, réponse inattendue). | Après `postQuote(dry:false)`, refuser (avant de renvoyer l'adresse) si `amountInUsd` est illisible ou > plafond, si `amountIn` diffère de `params.amountIn`, ou si `minAmountOut` est inférieur à celui du devis dry. Test dédié. |
| À CORRIGER (avant la démo mainnet) | `intents/base.ts:64,88` : le devis dry n'a pas de durée de validité ; un dry vieux de plusieurs heures autorise un live sur un prix périmé. | Horodater l'entrée et exiger un devis dry de moins de 5 minutes. |
| À CORRIGER | `intents/proof.ts:24-26` : la comparaison du `correlationId` utilise `&&` : la preuve est acceptée si L'UN des deux identifiants du statut correspond. | Exiger `status.quoteResponse.correlationId === quote.response.correlationId` (et, s'il est présent, `status.correlationId`). |
| À CORRIGER (avant tout crédit réel) | `intents/proof.ts:62-72` : `DepositLedger` est en mémoire ; après un redémarrage, le même dépôt peut être crédité de nouveau. De plus la preuve repose uniquement sur la réponse de l'API 1Click (aucune vérification de la transaction de destination). Aujourd'hui rien ne crédite un solde (module non branché), donc sans impact immédiat. | Persister les clés `adresse|correlationId` dans `data/` ; ne brancher le crédit qu'avec un recoupement indépendant (explorateur de la chaîne de destination ou solde du destinataire) et ne jamais créditer une preuve `mock:true` sur un solde réel. |
| NOTE | `intents/oneclick.ts:30,37` : `INTENTS_BASE_URL` n'impose pas `https:` ; avec `http://`, la clé partenaire partirait en clair (même défaut que L5, corrigé dans le cerveau). | Même contrôle que celui du cerveau. |
| NOTE | `intents/demo.ts:15-20` : `refundTo` et `recipient` ne sont pas validés ; une faute de frappe envoie le remboursement ou le produit au mauvais compte. La procédure `DEMO_MAINNET.md` est humaine. | Afficher un récapitulatif et exiger une confirmation avant `dry:false` ; utiliser un compte de test. |
| NOTE | Le « feu vert écrit » (`docs/BESOINS_HUMAIN.md`) est une règle de procédure : le code ne peut pas le vérifier. Seuls les deux drapeaux et le plafond le protègent. | Garder les drapeaux désactivés partout sauf pendant la démo, sur la machine de l'humain. |

### 3.7 `backend/` (L7) : FUSIONNABLE (corrections avant le déploiement testnet public)

Points conformes : `DARWIN_ADMIN_TOKEN` obligatoire dès que `HOST` n'est pas `127.0.0.1`, démarrage refusé sinon, vérifié deux fois (`app.ts:28-32`, `main.ts:31`) ; comparaison du jeton en temps constant sur des condensats (`app.ts:317-318`), blocage par IP après 10 échecs par minute (`:312-316`) ; les quatre routes d'administration (`start`, `pause`, `resume`, `stop`) sont derrière le jeton, aucune ne lit le corps ; contrôle `Origin` sur toutes les méthodes non-GET de `/api/*` (`:99-114`) ; en-têtes `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, CSP restrictive (`default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, `base-uri 'none'`, `:88-98`) ; `Cache-Control: no-store` sur l'API ; `/api/config` en liste blanche (jamais de clé, de jeton ni de `dataDir`, vérifié par `backend.test.ts`) ; adresse IP lue sur la socket, jamais `X-Forwarded-For` (`:35,45-51`) ; `POST /api/tasks` : corps limité à 16 Ko, `Content-Type` JSON exigé, schéma zod (titre 120, texte 4000, budget numérique), 6 publications par minute et par IP, 10 tâches ouvertes par IP, 100 tâches de visiteurs ouvertes au total, plafond horaire de dépense du marché ; identifiants de route validés (`^[a-z]-\d{1,9}$`) ; réponses d'erreur génériques (`INTERNAL`) et messages passés par `safeErrorMessage` ; la page de repli (`/`) échappe toutes les valeurs (`:371`) ; fichiers cachés jamais servis (`:363-364`) ; SSE : 8 flux par IP et 300 au total (`:238`), file bornée à 5 000 événements puis fermeture (`sse.ts:9,31-32`), nettoyage à la déconnexion ; `data/` : le journal persistant est masqué ligne par ligne (`store.ts:61`), écritures atomiques de l'état, aucune clé écrite par le backend ; le journal masque `ed25519:`/`secp256k1:`, `Bearer`, `sk-` et les JWT (`redact.ts:3-8`) pour les avertissements et erreurs ; 161 tests verts, `tsc` propre.

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER | `backend/app.ts:99-113` et `:309-325` : sur boucle locale sans `DARWIN_ADMIN_TOKEN` (le défaut du clone neuf), les routes d'administration sont ouvertes, et le contrôle `Origin` compare l'origine au seul en-tête `Host`, que l'attaquant contrôle. Une page web visitée par l'opérateur peut, par rebond DNS (DNS rebinding), appeler `POST /api/sim/stop` ou publier des tâches sur `127.0.0.1`. Pas de fuite de secret, mais arrêt ou spam de la démo. | Liste blanche des valeurs de `Host` acceptées (`localhost`, `127.0.0.1`, `[::1]` avec le port, ou celles de la configuration) pour toutes les routes ; option : générer un jeton aléatoire par défaut et l'imprimer au démarrage. |
| À CORRIGER (déploiement) | `app.ts:28-32` : seul « jeton non vide » est exigé ; un jeton d'un caractère passe. Le jeton circule en `Authorization: Bearer` sur HTTP simple si `HOST` est exposé sans TLS. | Longueur minimale (24 caractères) au démarrage ; documenter l'exposition derrière un proxy TLS ; ne jamais exposer `HOST=0.0.0.0` en HTTP clair. |
| À CORRIGER (déploiement) | `app.ts:45-51` : l'IP vient de la socket. Derrière un proxy inverse (cas d'un déploiement public), tous les visiteurs partagent l'IP du proxy : les plafonds par IP deviennent globaux (6 publications par minute pour tout le monde, 10 tâches ouvertes pour tout le monde, blocage admin pour tous après 10 échecs, opérateur compris). | Option `TRUST_PROXY` explicite avec liste d'adresses de proxys de confiance, sinon documenter « déployer sans proxy » ou limiter au niveau du proxy. |
| NOTE | `runtime.ts:68-69` : le masquage vise seulement `system.warning`/`system.error` pour le flux SSE et `/api/events` ; le fichier `data/journal.jsonl` est, lui, masqué en entier (`store.ts:61`). Un événement d'un autre type embarquant un texte venu d'une IA ou d'un visiteur serait diffusé tel quel. Aucun secret n'y circule aujourd'hui (le cerveau ne reçoit jamais de clé dans ses messages). | Appliquer `redactText` à toute la ligne sérialisée avant diffusion, comme pour le fichier. |
| NOTE | `sse.ts:50` : chaque nouveau flux rejoue tout le journal depuis `since` (`journal.since(since, 1_000_000)`) ; avec 300 flux et un journal volumineux, amplification mémoire et processeur. Le journal en mémoire et `journal.jsonl` ne sont pas bornés (`store.ts:61`), seulement par le débit d'événements de la simulation et le plafond de tâches. | Borner le rejeu (par exemple 5 000 derniers événements, puis `reset`), faire tourner `journal.jsonl` par taille. |
| NOTE | `store.ts:42-44` : au démarrage, `journal.prev.jsonl` écrase le précédent ; l'historique d'un lancement plus ancien est perdu (V1 : voulu). | Aucun. |
| NOTE | `app.ts:95` : `style-src 'unsafe-inline'` ; pas de `Strict-Transport-Security` (normal sans TLS). | Retirer `unsafe-inline` quand le frontend (L8) n'en a plus besoin ; HSTS au niveau du proxy TLS. |
| NOTE | Les textes des tâches de visiteurs, les noms d'affichage (`requesterLabel`), les lettres et les prompts de personnalité sont publics (`/api/state`, `/api/events`, SSE). | Annoncer dans le formulaire : « ne saisissez aucune donnée personnelle ». |
| NOTE | `app.ts:368` : `serveStatic` n'est monté que si `frontend/index.html` existe ; `frontend/` n'est pas dans `main`. La protection contre la traversée de chemin repose alors sur `@hono/node-server` 2.x (D-007) et sur le rejet des segments cachés. | À tester à la fusion de L8 (`/..%2f`, `/%2e%2e/`, fichiers `.env`). |
| NOTE | Injection par texte visiteur : le texte n'atteint les modèles qu'en message `user` (JSON pour le juge et `taskMessages`, bloc délimité pour les enchères) ; aucune clé ni donnée sensible n'est dans le contexte d'un modèle. Le pire effet d'une injection est un résultat de mauvaise qualité ou un juge trompé (D-024), pas une fuite. | Accepté, divulgué. |

### 3.8 `frontend/` (L8) : FUSIONNABLE (aucun bloquant ; trois points faibles à corriger avant le déploiement public)

Méthode : lecture de `index.html`, `app.js`, `store.js`, `format.js`, `tree.js`, `theme-init.js`, `favicon.svg` ; backend lancé en mock sur le port 39871 (arrêté ensuite) ; tâches visiteurs réelles publiées par `POST /api/tasks` ; page ouverte avec Playwright (Chromium) sous la CSP réelle du backend, dialogues et erreurs console surveillés ; pages « forgées » (`/api/state` et `/api/stream` simulés) pour injecter lettres, noms d'agents, personnalités, modèles, labels, hashes et URL hostiles et des flux malformés.

Points conformes (vérifiés, pas seulement lus) :
- **Aucun `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`** (recherche `grep` sur tous les fichiers). Le seul constructeur DOM est `h()` (`format.js:72-87` : `setAttribute` avec des noms d'attributs fixes dans le code, textes via `createTextNode`) et `textContent` pour le SVG (`tree.js:6-11`). Le SVG de l'arbre est construit par `createElementNS` : pas de `foreignObject`, pas de `<use href>` ; les noms d'agents n'entrent que dans `textContent`, `aria-label` et `<title>`.
- **Charges utiles hostiles inertes** : titre `<img src=x onerror=...>`, consigne `</script><script>...`, `javascript:`, entités `&lt;` et `&#60;`, label `<svg onload=...>`, publiés pour de vrai (201) puis rendus : 0 dialogue, `window.__pwn` jamais défini, 0 `img`/`script`/`svg` injecté, texte affiché littéralement. Même résultat avec une page forgée (nom d'agent, personnalité, modèle, lettre, titre, résultat, validateur, raison, badge serveur, hash de résultat, avertissement système, `kind` de transaction hostiles).
- **Liens d'explorateur** : seuls deux endroits créent un `<a href>` (`app.js:280`, `349`), les deux avec `target="_blank" rel="noopener noreferrer"`. Une URL explicite n'est acceptée que si elle commence par `https://` (`format.js:39`) ; sinon l'URL est construite sur `testnet.nearblocks.io/txns/` + `encodeURIComponent(hash)` : un hash `javascript:alert(1)` donne `.../txns/javascript%3Aalert(1)`. Aucun lien pour les hashes `mock_`/`local_`. Aucun autre `href`/`src` dynamique.
- **CSP** : `index.html` n'a ni script ni style inline, ni attribut `style=`, ni gestionnaire `on...=` ; un `<script src>` (`theme-init.js`) et un module (`app.js`) ; styles dynamiques par `el.style.width` (CSSOM, non bloqué par la CSP). Aucune violation CSP ni erreur console sous `script-src 'self'` pendant tous les tests. Aucune ressource externe (pas de CDN, de police, d'image distante).
- **Dépendances vendorisées : aucune** (pas de bibliothèque copiée, pas de police), donc aucune licence à vérifier ; `favicon.svg` est statique (cercles), sans script.
- **Stockage local** : seulement `darwin-theme`, relu avec liste blanche `light`/`dark` (`theme-init.js:2`), accès dans `try/catch` (`app.js:22`). Aucun jeton ni donnée de tâche stockés.
- **Formulaire** (`app.js:417-464`) : `preventDefault`, validation locale (longueurs, budget `^\d+(\.\d{1,6})?$`), bouton désactivé pendant l'envoi (pas de double envoi ; l'envoi implicite par Entrée est aussi bloqué), verrouillage sur 429/503 avec `Retry-After` plafonné à 60 s, corps JSON seul, statuts 400/403/413/415/429/503 affichés via `textContent`. Aucun secret ni information interne exposé (messages venant du backend, déjà filtrés par `safeErrorMessage`). Budget hors bornes : le serveur renvoie 400 `BUDGET_OUT_OF_RANGE` (testé).
- **Statique côté backend** : traversée impossible. Testé sur le serveur lancé : `/%2e%2e/package.json`, `/..%2fpackage.json`, `/%2e%2e%2f%2e%2e%2f.env`, `/..%5cpackage.json`, `/dev/../../package.json`, `/..\..\package.json`, `/.env` : tous 404. Un `Host: evil.com` reçoit 403 (liste blanche `allowedHostSet`, `app.ts:40-49,117-122`) : le constat « rebond DNS » du §3.7 est donc corrigé pour toutes les routes.

| Gravité | Constat | Correctif proposé |
|---|---|---|
| À CORRIGER (faible) | `backend/app.ts:~375-376` : `serveStatic({ root: frontendDir })` sert TOUT `frontend/` hors fichiers cachés. Vérifié en HTTP 200 : `/dev/e2e.cjs`, `/dev/fake-server.mjs`, `/dev/real.cjs`, `/dev/shot.cjs`, `/screens/*.png` (277 Ko), `/README.md`. Aucun secret dans ces fichiers (relus), pas de traversée, mais des scripts de test et un faux serveur n'ont rien à faire sur une instance publique. | Dans `app.ts` (dev-backend) : refuser `/dev/` et `/screens/`, ou ne servir qu'une liste blanche (`index.html`, `app.js`, `store.js`, `tree.js`, `format.js`, `theme-init.js`, `style.css`, `favicon.svg`) ; ou sortir `dev/` et `screens/` de `frontend/` (dev-frontend). Test : `GET /dev/e2e.cjs` = 404. |
| À CORRIGER (faible, avant déploiement public) | `backend/app.ts:112` : `style-src 'self' 'unsafe-inline'` reste alors que le frontend n'a plus de style inline (NOTE du §3.7 : « retirer quand L8 n'en a plus besoin »). Seule la page de repli de `/` (balise `<style>`, utilisée quand `frontend/index.html` est absent) l'exige. | Retirer `'unsafe-inline'` ; pour la page de repli, un hachage `'sha256-...'` ou une CSP propre à cette route. Non testé sans `unsafe-inline` : à valider avec `frontend/dev/real.cjs` (console). |
| À CORRIGER (faible) | `frontend/index.html:97` : le formulaire n'avertit toujours pas que titre, consigne et nom affiché sont **publics** (visibles via `/api/state`, `/api/events`, SSE) ; reprise du NOTE §3.7. | Ajouter : « Ne saisissez aucune donnée personnelle : tout est public. » (dev-frontend). |
| NOTE | `frontend/format.js:39` : une `explorerUrl` fournie par un événement `chain.tx` est acceptée sur n'importe quel hôte `https://` (testé : `https://evil.example/x` devient un lien cliquable). Pas de XSS (`https` seulement, `noopener noreferrer`) et l'événement vient du backend, mais ce serait un hameçonnage discret si un texte visiteur atteignait ce champ. | Liste d'hôtes (`testnet.nearblocks.io`, `nearblocks.io`) ou construction locale de l'URL. |
| NOTE | `frontend/app.js:80-87` : (1) un message SSE `null` (JSON valide) lève `TypeError` (`ev.seq`, `:83`) ; (2) un message illisible ne consomme pas son `seq` : l'événement suivant déclenche `connect()` aussitôt, sans délai (`:83-85`), et le rejeu depuis `lastSeq` renvoie le même message, d'où une boucle de reconnexions serrée si le serveur émettait durablement un événement non analysable (testé : seconde requête `/api/stream` immédiate). Le backend n'en produit pas (tous les types du journal sont dans `EVENT_TYPES`, vérifié) ; (3) `BigInt(d.delta)` (`app.js:126`, `store.js:153,168`) lève sur une valeur non numérique après `store.apply`, sans rafraîchissement. Aucun cas n'exécute de code ni ne casse la page (testé). | `if (!ev \|\| typeof ev !== "object") return;` ; backoff sur la reconnexion de rattrapage ; `try/catch` autour de `handleEvent` ; conversion `BigInt` tolérante. |
| NOTE | `frontend/store.js` : `tasks`, `letters`, `bidCount`, `agents` non bornés (5 000 `task.posted` envoyés : 5 000 entrées, rendu limité à 14 lignes ; flux et chronique bornés à 120). Message de 3 Mo accepté. Pas de gel observé ; flux de confiance et plafonné côté serveur (§3.7). | Limiter `tasks` à environ 300 entrées ; ignorer un `m.data` trop long. |
| NOTE | `frontend/app.js:469` : `window.__darwin = { store, tree }` exposé « pour tests ». Aucun secret dans le store. | Derrière `?debug=1` ou supprimé pour la démo publique. |
| NOTE | `frontend/app.js:26-32` : `api()` sans délai (`AbortController`) ; une réponse bloquée gèle `loadState`. | Délai de 10 s. |

## 4. Verdicts

BLOQUANT = interdit la fusion ; À CORRIGER = avant l'étape indiquée ; FUSIONNABLE = aucun bloquant.

| Lot | État | Verdict | Constats bloquants | À corriger avant (étape) |
|---|---|---|---|---|
| L3-contrats | fusionné, correctifs appliqués | FUSIONNABLE | aucun | testnet : gaz du callback (NOTE), rejeu de `deploy-testnet.sh`, échéance D-022 |
| L4-moteur | fusionné, correctifs appliqués | FUSIONNABLE | aucun | notes seulement |
| L5-cerveau | fusionné, correctifs appliqués | FUSIONNABLE | aucun | quota propre au juge (NOTE) |
| L6-marche | fusionné, correctifs appliqués | FUSIONNABLE | aucun | notes seulement |
| L2-comptes | fusionné | FUSIONNABLE | aucun | testnet : double paiement possible en séquestre dégradé (`near-chain.ts:415-448`), code `SPEND_CAP_EXCEEDED` |
| L9-intents | fusionné | FUSIONNABLE | aucun | démo mainnet : recontrôle du devis live, durée de validité du dry, `correlationId`, registre persistant |
| L7-backend | fusionné | FUSIONNABLE | aucun | testnet public : liste blanche `Host`, jeton fort, IP derrière proxy |
| L8-frontend | fusionné | FUSIONNABLE | aucun | déploiement public : ne pas servir `frontend/dev` ni `screens`, retirer `style-src 'unsafe-inline'`, avertissement « données publiques » dans le formulaire |

**Historique git : 7 valeurs factices (§2.1).** Verdict L17 : format non réel, exemptées dans `scripts/scan-secrets.allowlist.json` ; le scan complet sort 0. La réécriture (option B) reste facultative, au choix de l'humain.

Aucun secret réel détecté, aucun crédit sans preuve constaté (le module Intents n'est branché à aucun solde), aucune libération sans verdict `accepted` constatée, `NearChain` refuse tout réseau autre que testnet. Les trois points « À corriger » qui touchent à l'argent (séquestre dégradé, recontrôle du devis Intents, preuve persistée) sont à faire avant la mise en service de l'étape correspondante ci-dessous.

## 5. Checklists

### 5.1 Checklist de fusion (à cocher avant chaque fusion dans `main`)

- [ ] `node scripts/scan-secrets.mjs --ref lot/<branche>` propre (fichiers et historique).
- [ ] Aucun fichier `.env*` suivi (hors `.env.example`), `.env.example` complet et sans valeur.
- [ ] `npm test` et `npm run typecheck` verts sur la branche.
- [ ] Aucun `console.log` ni événement qui contienne une clé, un jeton, un en-tête `Authorization` ou une phrase de récupération.
- [ ] Les erreurs remontées au journal ou à l'API passent par le masquage (pas de clé dans `e.message`).
- [ ] Aucun crédit de solde sans preuve vérifiée ; toute libération de séquestre passe par un verdict `accepted` enregistré ; tout remboursement par `rejected` ou `expired`.
- [ ] Texte de visiteur ou d'agent jamais dans un message `system`.
- [ ] Plafonds en place : tokens par appel, budget par appel, budget global IA, plafond horaire visiteurs, tâches ouvertes.
- [ ] Mainnet et `dry:false` désactivés (`INTENTS_ENABLED` absent ou faux, `INTENTS_DRY_ONLY` vrai) ; aucune dépense réelle sans feu vert écrit dans `docs/BESOINS_HUMAIN.md`.
- [ ] Routes d'administration derrière `DARWIN_ADMIN_TOKEN` dès que `HOST` n'est pas `127.0.0.1` ; aucune route ne renvoie la configuration brute.
- [ ] Frontend : aucun `innerHTML` sur du contenu d'agent ou de visiteur (vérifié sur L8 par `grep` et test Playwright, §3.8).

### 5.2 Avant la publication du dépôt (par l'humain, règle 5)

- [x] Historique (§2.1) : valeurs factices de format non réel, exception ciblée appliquée (L17), scan complet à 0. Facultatif pour l'humain : option B (réécriture) si le jury utilise gitleaks.
- [ ] `node scripts/scan-secrets.mjs` (toutes branches, fichiers et historique) sort 0 ; plus d'ancienne ref (`git reflog expire --expire=now --all && git gc --prune=now`).
- [ ] `git ls-files` : aucun `.env`, `data/`, `*.key`, `*.pem`, `.near-credentials/`.
- [ ] `.env.example` : secrets vides, `INTENTS_ENABLED=false`, `INTENTS_DRY_ONLY=true`, `HOST=127.0.0.1`.
- [ ] README : modèle de confiance (l'opérateur est oracle, D-024), mode `mock` / `dégradé` signalé, limites connues, aucune promesse « trustless ».
- [ ] Clés et jetons utilisés pendant le développement : clé du compte maître testnet FAITE (§6) ; clé NEAR AI et jeton admin : régénérés ou révoqués s'ils ont servi hors de ce poste (HUMAIN, §6.3).
- [ ] Aucune donnée personnelle dans `docs/` ni dans les journaux versionnés.

### 5.3 Avant le déploiement testnet

- [ ] Compte maître testnet dédié et jetable (jamais un compte mainnet) ; `NEAR_MASTER_PRIVATE_KEY` dans `.env` ou l'environnement, jamais dans un fichier suivi ; `checkReady` confirme `chain_id = testnet`.
- [ ] Corriger le séquestre dégradé (`accounts/near-chain.ts:415-448`) ou déployer le contrat avant l'échéance D-022 (2026-11-11 23:59 UTC) ; rejouer `contracts/deploy-testnet.sh` de bout en bout.
- [ ] `SpendCapError` renvoie `SPEND_CAP_EXCEEDED` ; plafonds par défaut vérifiés pour `visitors.<maître>` et `sim-client.<maître>`.
- [ ] `NEARAI_MAX_USD_PER_RUN` et `NEARAI_MAX_USD_PER_HOUR` fixés (défauts 2 USD et 1 USD) et consignés dans `docs/BESOINS_HUMAIN.md` ; `NEARAI_BASE_URL` en https.
- [ ] Backend : `HOST=127.0.0.1` derrière un proxy TLS, ou `DARWIN_ADMIN_TOKEN` d'au moins 24 caractères ; liste blanche `Host` ajoutée ; adresses IP du proxy gérées ; `data/` hors dépôt, dossier `data/keys` protégé.
- [ ] `DARWIN_VISITOR_HOURLY_CAP_NEAR` en accord avec le faucet (défaut testnet 0,5 NEAR par heure).
- [ ] `GET /dev/e2e.cjs` et `/screens/...` renvoient 404 ; CSP sans `style-src 'unsafe-inline'` (§3.8).
- [ ] Le formulaire prévient que les textes sont publics ; badge « dégradé » / « mock » visible (D-022).
- [ ] `npm test`, `npm run typecheck` verts ; scan de secrets propre sur l'arbre.

### 5.4 Avant la démo mainnet (Intents, V2, jamais sans feu vert humain écrit)

- [ ] Feu vert écrit dans `docs/BESOINS_HUMAIN.md` (montant maximal, actifs, comptes, date) ; démo lancée par l'humain, sur sa machine.
- [ ] Corrections L9 faites : recontrôle du devis `dry:false`, durée de validité du dry, `correlationId` strict, registre de crédit persistant, `https` imposé sur `INTENTS_BASE_URL`.
- [ ] `INTENTS_ENABLED=true` et `INTENTS_DRY_ONLY=false` posés seulement pour la durée de la démo, puis remis à `false` / `true` ; vérifier le retour dans `GET /api/config`.
- [ ] Plafond de 5 USD conservé ; montant de la démo bien inférieur ; compte d'origine dédié et peu financé ; `refundTo` et `recipient` relus deux fois.
- [ ] Preuve de dépôt recoupée à la main (explorateur de la chaîne de destination) avant d'annoncer quoi que ce soit ; une preuve `mock:true` n'est jamais présentée comme réelle.
- [ ] Clé partenaire `INTENTS_JWT` : jamais dans un fichier suivi, jamais collée dans un chat ou un post ; révoquée après la démo si elle a été exposée.
- [ ] Aucun lien entre le module Intents et les soldes des agents (le crédit mainnet n'est pas branché) : le dire dans le README.

## 6. Rotation de la clé du compte maître testnet (L17, 2026-11-11)

Compte `darwin-master-7k2.testnet`, testnet seulement. Script réutilisable : `scripts/rotate-master-key.mjs` (dry-run par défaut ; `--apply` exécute ; `--keep-old` garde l'ancienne clé ; `--resume <fichier>` reprend après un arrêt ; `--backup-dir` ; `--rpc url1,url2` ou `NEAR_RPC_URL`). Refuse tout réseau autre que testnet, n'affiche que des fragments de clés publiques, sauvegarde le `.env` et la nouvelle clé hors dépôt avant toute transaction, réessaie avec délai croissant sur 429. Lancer depuis un dossier où `near-api-js` est installé (`node scripts/rotate-master-key.mjs`).

### 6.1 Déroulé et preuves

| Étape | Résultat | Preuve (testnet, publique) |
|---|---|---|
| Dry-run | une seule clé full access (`ed25519:Hag7...17o8`) | aucune écriture |
| a) sauvegarde `.env` | faite, hors dépôt (dossier temporaire de la session) | : |
| b) nouvelle paire ed25519 | générée, sauvegardée hors dépôt AVANT toute transaction (`ed25519:4dXQ...nReh`) | : |
| c) AddKey full access, signée par l'ancienne clé | OK. Le 1er passage a arrêté à l'étape d) : la finalité du RPC avait quelques secondes de retard, la clé figurait bien on-chain au contrôle suivant. Le script interroge maintenant jusqu'à 60 s, et `--resume` a permis de reprendre sans régénérer. Le hash de cette transaction n'a pas été relevé (arrêt avant l'affichage) ; la clé est visible dans la liste des clés d'accès du compte | liste des clés (RPC `view_access_key_list`) |
| d) vérification RPC | nouvelle clé présente en FullAccess (2 clés à cet instant) | idem |
| e) `.env` mis à jour (ligne `NEAR_MASTER_PRIVATE_KEY`, valeur non affichée) | relecture du fichier cohérente, clé publique dérivée = nouvelle clé | : |
| f) contrôle avec la NOUVELLE clé seule | OK : 1 yoctoNEAR du compte vers lui-même | `2umNF7mMRM37HgbFozbEtyYxnJFyk5P8f2xRDaAbKgQ1` |
| g) DeleteKey de l'ancienne clé, signée par la nouvelle | OK | `CGW41ncCqP7QryKXBL83ygtDjMsnohbWB75v8wxCDLFd` |
| Vérification finale | seule clé restante : `ed25519:4dXQ...nReh` (full) ; l'ancienne a disparu | liste des clés |
| Contrôle après suppression | OK, compte utilisable | `EajzUV4zx5579aVngK7wEVAmEQJepm1iovEowaQ15yif` |

Les hashes se consultent sur `https://testnet.nearblocks.io/txns/<hash>`. Aucune clé complète dans ce document, les journaux ni les commits ; `.env` reste ignoré par git.

### 6.2 Résidus constatés

- `~/.near-credentials/testnet/darwin-master-7k2.testnet/` (trousseau near-cli) contient encore l'ANCIENNE clé, désormais morte on-chain donc sans danger ; à supprimer pour éviter la confusion. Le compte contrat `darwin-contract-7k2.testnet` a sa propre clé (non touchée ; `contracts/deploy-testnet.sh` signe avec elle).
- Les sauvegardes hors dépôt (ancien `.env` avec ancienne clé et ancienne clé NEAR AI encore valide, nouvelle clé) sont dans le dossier temporaire de la session de l'agent : les supprimer une fois la rotation validée.
- Le nouveau `NEAR_MASTER_PRIVATE_KEY` n'est que dans le `.env` du dépôt principal. Les autres copies de `.env` (autres postes, worktrees) auraient l'ancienne clé : à mettre à jour.

### 6.3 À FAIRE PAR L'HUMAIN (à reprendre dans `docs/BESOINS_HUMAIN.md`)

1. Relancer un test testnet complet avec le nouveau `.env` (ex. `npm run start`) pour confirmer, côté application, que le compte maître signe bien ; supprimer `~/.near-credentials/testnet/darwin-master-7k2.testnet*` (clé morte).
2. Supprimer les sauvegardes hors dépôt de la rotation (voir 6.2) après vérification.
3. Régénérer la clé NEAR AI (`NEARAI_API_KEY`, console cloud.near.ai) et le jeton `DARWIN_ADMIN_TOKEN` s'ils ont quitté ce poste : une rotation de clé de plateforme se fait dans la console du fournisseur, pas par cet agent. Non faite.
4. Facultatif : réécriture de l'historique (§2.1, option B) si le jury doit scanner avec gitleaks ; décision irréversible réservée à l'humain.

## 7. Revue de la branche `lot/L17-integration` avant fusion dans `main` (2026-11-12)

Périmètre : `git diff main..HEAD` (159 fichiers, HEAD 0d76273). Lecture seule sur le code ; aucun appel réseau ; aucun secret affiché. Revue de code manuelle, pas de test d'intrusion dynamique.

**Avis : GO SOUS RÉSERVES.** Aucun secret détecté, aucune faille exploitable à distance pour voler des fonds ou exécuter du code. Réserves à lever avant la démo publique : constats 1 à 4. Les autres sont des durcissements.

### 7.1 Constats

| # | Gravité | Où | Constat | Correctif |
|---|---|---|---|---|
| 1 | Moyenne | `.env.example` (aucune occurrence de `REPLAY`) | `DARWIN_REPLAY_FILE`, `_SPEED`, `_LOOP`, `_MAX_GAP_MS`, `_LABEL`, `_CONTROL` (replay-main.ts:1-2, 33-47) et `DARWIN_PRICE_SCALE`, `DARWIN_VISITOR_BID_WINDOW_TICKS`, `DARWIN_VISITOR_TASK_DEADLINE_TICKS` (shared/config.ts) ne sont pas documentés : `.env.example` n'est plus « complet ». Les valeurs sensibles restent sûres : `INTENTS_ENABLED=false`, `INTENTS_DRY_ONLY=true`, `HOST=127.0.0.1`. | Ajouter ces variables, commentées, avec `DARWIN_REPLAY_CONTROL=` vide et la mention « `locked` pour toute démo publique » (architecte + sécurité). |
| 2 | Moyenne (disponibilité de la démo, pas d'attaque distante) | `backend/replay.ts:443` (`state.apply(ev)` dans le minuteur), `replay.ts:175-309`, `:186-187`, `:216-224`, `:288` | `parseReplay` ne valide que l'enveloppe (`type`, `ts`, `tick`, `data` objet). Un événement dont `data` n'a pas la forme du type (`agent.born` sans `agent`, `task.posted` sans `task`, `deliverable.produced` sans `files` tableau) lève dans le minuteur : exception non rattrapée, le processus s'arrête en pleine lecture. Le fichier est choisi par l'opérateur, donc pas d'exposition réseau. | Entourer `state.apply` d'un try/catch (passer en `ended` + `system.warning` masqué) ou valider la forme par type au chargement. Ramener `MAX_REPLAY_BYTES` (replay.ts:17) de 200 Mo à ~20 Mo (journal entier + clones en mémoire). |
| 3 | Moyenne si exposé publiquement, acceptée en local (D-044) | `backend/app.ts:455-476`, `replay-main.ts:47-77` | Contrôle du rejeu ouvert par défaut : tout visiteur peut changer la vitesse (partagée), mettre en pause, relancer (`reset` envoyé à tous les clients). Pas de `bodyLimit` sur ces 4 POST (`c.req.json()` lit un corps de taille libre), contrairement à `POST /api/tasks` (16 Ko). Limité par le débit général (240 requêtes/min et par IP ; derrière un proxy toutes les requêtes ont la même IP : limite globale). Anti-CSRF correct (Origin refusée si différente, `Origin: null` refusée). Écriture (`/api/tasks`, `/api/sim/*`) bien refusée en 403 avant tout, même avec jeton. Aucune lecture de fichier ni SSRF possible via l'API : le fichier n'est lu qu'au démarrage, depuis l'environnement, et seul son nom sans dossier (`meta.file`) est exposé. | Ajouter `bodyLimit({maxSize: 1024})` sur `ctl(...)`. Documenter : démo publique = `DARWIN_REPLAY_CONTROL=locked` + `DARWIN_ADMIN_TOKEN` (24 caractères ou plus). |
| 4 | Faible | `replay-main.ts:47`, `app.ts:455`, `app.ts:394-410` | « locked » sans `DARWIN_ADMIN_TOKEN` s'ouvre (le garde `admin` laisse tout passer sans jeton) : échec ouvert, seulement signalé par un message. Atténué : `assertSafeBinding` impose un jeton dès que `HOST` n'est pas loopback. | Refuser le démarrage (ou répondre 403 aux contrôles) si `locked` sans jeton. |
| 5 | Faible | `app.ts:290`, `replay.ts:290-293` | En rejeu, `name` et `mime` d'un journal ne sont pas validés au chargement. La route valide le nom demandé (`FILE_RE`) et le `Content-Type` par regex (`text/html` passerait), mais la réponse porte `nosniff` + `CSP: default-src 'none'; sandbox` : aucun script ne s'exécute. `Content-Disposition` n'utilise que le nom validé. | Liste blanche des 4 types (`image/svg+xml`, `text/markdown`, `text/plain`, `text/vnd.mermaid`), repli `text/plain` ; valider `name` à l'ingestion du rejeu. |
| 6 | Faible | `backend/runtime.ts:91`, `market/index.ts:424`, `backend/store.ts:75` | Le masquage (`redactText`) couvre `system.warning/error` pour le flux SSE et l'API, et tout le JSON du fichier `data/journal.jsonl`, mais PAS le contenu des livrables, les pitchs ni le texte des tâches servis en direct. Les agents n'ont aucun secret dans leur contexte ; le risque est un secret collé par un visiteur (le formulaire prévient que tout est public). Les motifs de `redactText` ne couvrent pas une clé nue (hex, base58 sans préfixe). | Appliquer `redactText` à `content` avant l'émission (market/index.ts:424) et au pitch ; ajouter un motif pour les clés base58 longues sans préfixe. |
| 7 | Faible (trou de couverture du scanner) | `scripts/scan-secrets.mjs:57` | Les lignes de plus de 4000 caractères sont tronquées avant analyse. Avec D-045 un journal peut embarquer jusqu'à 24 000 caractères par fichier sur une seule ligne : un secret après le 4000e caractère ne serait pas vu. Les journaux actuels sont sûrs (ligne max 1433 caractères, rescannés sans limite). Les fichiers contenant un octet NUL (PNG) sont ignorés, donc les captures ne sont pas scannées. | Scanner par fenêtres de 4000 caractères avec recouvrement au lieu de tronquer. Captures : relecture visuelle (7.3). |
| 8 | Faible | `scripts/rotate-master-key.mjs:23`, `:95-96`, `:119-126` ; `.gitignore` | `--backup-dir` n'est pas contrôlé : dans le dépôt, `new-master-key-*.json` (clé en clair) et `env-backup-*` ne sont couverts ni par `.gitignore` (`.env`, `.env.*`, `*.key`, `*.pem`, `data/`). Le scanner détecterait la clé (motif `ed25519:`), mais après coup. Le mode 0600 est sans effet sous Windows. Messages d'erreur AddKey/DeleteKey tronqués sans `redactText` (la signature est locale, aucune clé n'est envoyée au RPC). Réseau : testnet et https imposés ; la clé n'est jamais affichée (fragments de clé publique). | Refuser un `--backup-dir` situé dans l'arbre git ; ajouter à `.gitignore` : `new-master-key-*.json`, `env-backup-*`, `.darwin-secure/`. |
| 9 | Faible | `docs/DECISIONS.md:8`, `docs/BESOINS_HUMAIN.md:116`, `docs/QA_RAPPORT.md:4` | Chemin local contenant le nom d'utilisateur Windows de l'opérateur, dans des documents publics (contredit la case « aucune donnée personnelle », §5.2). Pas un secret. | Remplacer par `<dépôt>` / `<dossier-node>` (propriétaires : architecte, chef de projet, qa). |
| 10 | Info | `replay.ts:93-103`, `app.js:240-243`, `darwin.js:56-61` | Le bandeau « run réel testnet » se déduit du champ `chain` du journal lui-même : un journal modifié à la main serait étiqueté « réel ». Pas de signature. Seule vérification possible : les hashes de transaction sur nearblocks. | Publier les empreintes sha256 des journaux de preuve (7.4) dans `docs/PREUVES_TESTNET.md`. |
| 11 | Info | `replay.ts:449` (app.ts) | `/api/replay/missions` reconstruit un index de tout le journal à chaque requête (O(n), débit limité) ; sans effet sur 1819 événements. | Mettre en cache par `lastSeq` si le journal grossit. |
| 12 | Info | `market/validation.ts:87-94` | Le juge IA lit le résultat de l'agent (donnée délimitée, mais un modèle peut être influencé) : un agent pourrait tenter de gonfler son score. Atténué par les contrôles automatiques (`market/checks.ts`) et le seuil `acceptScore`. Résidu hérité de L16, non aggravé. | Aucun pour la V1 ; le dire dans le README (juge = oracle de l'opérateur, D-024). |

### 7.2 Ce qui a été vérifié et jugé conforme

1. **Rejeu, SSRF et fichiers** : `DARWIN_REPLAY_FILE` vient de l'environnement seulement, lu une fois au démarrage (taille plafonnée, lecture seule) ; aucun paramètre d'API ne désigne un fichier ; messages d'erreur sans contenu du journal ; le chemin complet n'apparaît que dans les messages de démarrage de l'opérateur. `replayEnv` force mock et retire toutes les variables `*_PRIVATE_KEY|*_API_KEY|*_JWT|*_SECRET` ; `replayConfig` vide clés et `intents.enabled`. Aucune écriture possible (`journal.emit` lève, façades en lecture seule).
2. **Vitesse et boucle** : `parseSpeed` borne à 0,25-100 ; écart maximal entre événements 8 s ; une boucle ne peut pas tourner à vide (pause de 5 s entre passages, journal fini).
3. **SSE** : plafonds 8 flux par IP et 300 au total, file limitée à 5000 avec fermeture du client lent, `reset` géré, `Last-Event-ID` borné par regex.
4. **Journal enrichi (D-045)** : contenu borné (24 000 par fichier, 64 000 par livrable), SVG assaini côté serveur (`sanitizeSvg` : liste d'interdits, href et `url()` locaux seulement, balisage vérifié, rejet plutôt que réparation ; `<svg/onload=` rejeté par la vérification de balisage), nom de fichier `[a-z0-9._-]{1,64}`, écriture disque protégée contre la traversée de chemin (`store.ts` : id de tâche et nom validés, chemin résolu contrôlé).
5. **Frontend** : aucun `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `document.write` ni `srcdoc` dans `frontend/*.js` (recherche exhaustive hors `dev/`). `h()` utilise `textContent`/nœuds Text, `addEventListener` pour les `on*`, `style` via CSSOM. SVG d'agent uniquement en `<img src="data:image/svg+xml">` (aucun script en contexte image), Markdown rendu en nœuds DOM sans lien actif. Liens d'explorateur : `https`, hôtes `nearblocks.io`/`testnet.nearblocks.io` seulement, sans identifiants, sinon reconstruits depuis le hash ; tous en `target=_blank rel="noopener noreferrer"`. `boot.js` : `DOMParser` sur `CLASSIC_BODY`, constante statique du dépôt (aucune donnée externe) ; `?classique` n'est qu'un test de `location.search`. `/classique` redirige en dur vers `/?classique` (pas de redirection ouverte). Routage par `location.hash` filtré (`mission|lignees|preuves`). Bandeau de rejeu en `textContent` ; l'étiquette (`DARWIN_REPLAY_LABEL`) est bornée à 200 caractères et vient de l'opérateur.
6. **CSP** : `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. Pas d'`unsafe-inline` (0 attribut `style=` dans `index.html`, aucun script en ligne ; `theme-init.js` est externe). `data:` n'est autorisé que pour les images (SVG en `<img>`) et les polices. La CSP des fichiers de livrable (`style-src 'unsafe-inline'; sandbox`, `default-src 'none'`) n'accorde aucun script. Hôtes autorisés contrôlés (anti rebond DNS) ; statique en liste blanche (`dev/`, `screens/`, `.md` non servis, fichiers cachés refusés).
7. **Injection de prompt** : le pitch n'est jamais réinjecté dans le prompt d'un autre agent (seul usage : `engine/index.ts:130` vers `placeBid`). Le texte du visiteur arrive en message `user`, délimité `<<<TACHE ... >>>`, délimiteurs neutralisés en boucle, borné à 4000 caractères ; le message `system` ne contient que le génome et les règles fixes. Le pitch affiché est assaini (`sanitizePitch` : une ligne, balises et Markdown retirés, liens réduits au libellé, 240 caractères) puis rendu en texte. Débit des appels de pitch : un appel au plus par couple (agent, tâche), 120 tokens de sortie, refusé si la réserve de l'agent serait entamée, plafonds USD du cerveau inchangés, repli déterministe sans appel en mock. Résidu : le texte d'un visiteur peut orienter le contenu d'un pitch public (texte brut, jamais cliquable).
8. **Dépendances** : `package.json` ne change que les scripts (`replay`, `ai:logo-validation`, `start:demo`) ; dépendances d'exécution inchangées et épinglées (`@hono/node-server` 2.1.6, `hono` 4.13.17, `zod` 4.6.7). `near-api-js` n'est requis que par le script de rotation, hors `package.json` (installation manuelle épinglée 7.4.0).
9. **Plafond de dépense** : `maxTokensHardCap` (4000) ne relève que le plafond de tokens demandé ; le plafond de coût par appel et les plafonds USD par exécution et par heure s'appliquent toujours (diff de `brain/near-ai-brain.ts` relu hors fins de ligne : 5 lignes). Les gros diffs de `accounts.test.ts`, `near-ai-brain.ts`, `policy.ts`, `runtime.ts` sont en grande partie des changements de fins de ligne (CRLF vers LF), sans effet fonctionnel.
10. **Argent** : aucun changement des chemins de crédit, de séquestre ni d'Intents dans ce lot ; `INTENTS_ENABLED=false` et `INTENTS_DRY_ONLY=true` dans `.env.example` ; `intents.enabled` forcé à faux en rejeu.

### 7.3 Scans

- `npm run scan-secrets` (dossier de travail, 259 fichiers, + historique de toutes les refs, 100 commits) : **0 détection** ; 7 détections de l'historique exemptées par l'allowlist.
- `node scripts/scan-secrets.mjs --no-allowlist --no-files` : exactement ces 7 détections, toutes dans `backend/backend.test.ts` au commit `4eb92ea` (6 affectations factices et 1 chaîne `sk-` factice de 25 caractères). Valeurs non reproduites ici. L'allowlist ne vaut que pour l'historique, exige commit + fichier + type + empreinte sha256 de la valeur, ne stocke aucune valeur ; une autre valeur, un autre fichier ou un autre commit reste détecté, et un secret dans l'arbre actuel n'est jamais exempté. Réserve mineure : l'identifiant de commit est comparé par préfixe de 7 caractères (`startsWith`) ; préférer l'identifiant complet.
- Rescan indépendant sans limite de longueur de ligne (clés NEAR, JWT, `sk-`, Bearer, PEM, affectations de variables secrètes, phrases de récupération, courriels, chemins locaux, base58 longs) sur `docs/preuves/*.jsonl` (run5 à run9b), `docs/preuves/logo-validation/*` (SVG, `meta.json`, `reponse-brute.txt`), `docs/*.md` et `README.md` : **aucun secret**. Seules trouvailles : chemins locaux (constat 9) et un exemple factice `DARWIN_ADMIN_TOKEN = "<chaine-aleatoire...>"` dans `docs/RUN_9C.md:46` (marqueur de position, pas une valeur).
- Journaux `run9a`/`run9b` : métadonnées de livrables seulement (nom, type, taille, empreinte), pas de contenu ; hashes de transaction publics, comptes testnet.
- Captures `docs/captures/` : 4 relues avec `Read` (`l17-testnet-degrade`, `l17-recette-tn-preuves-t100`, `l17-rejeu-preuves-mobile`, `l17-recette-r9b-preuves-fin`; ces fichiers ont ensuite été supprimés et régénérés en anglais par la QA du 2026-11-12, sans secret visible) : interface seule, hashes de transactions et comptes testnet publics, aucun jeton, aucune clé, aucun terminal. Les 52 autres n'ont pas été ouvertes une à une (voir 7.5).
- `.gitignore` : `.env`, `.env.*` (sauf `.env.example`), `data/`, `*.key`, `*.pem`, `.near-credentials/` ; `git check-ignore` confirme `.env` et `data/` ; aucun fichier `.env`, clé ou sauvegarde suivi par git.

### 7.4 Empreintes sha256 des journaux de preuve (pour le constat 10)

| Fichier | sha256 |
|---|---|
| `docs/preuves/run8-journal.jsonl` | `9647d982663bc2493a2ecf562d17837ef7ad1d32b9169bbf704afcedf3ba2110` |
| `docs/preuves/run9a-journal.jsonl` | `b82aa257e853b076a01501c92b40319b6a4503a3f5977cb6998a94ff0a6628fb` |
| `docs/preuves/run9b-journal.jsonl` | `fdb06603b6571207bcf11fc2b175826c798d85a61906829c83efdaffaf7dbf69` |

(Calculées sur les fichiers de l'arbre de travail à HEAD 0d76273 ; une conversion de fins de ligne au checkout peut changer l'empreinte.)

### 7.5 Non vérifié

- Aucun test dynamique : pas de lancement du serveur, pas de requête, pas de fuzzing d'un journal hostile ; les constats 2, 3 et 5 viennent de la lecture du code.
- `npm test` et `npm run typecheck` n'ont pas été relancés par cette revue.
- 52 captures sur 56 non relues visuellement ; `frontend/screens/*.png` non relus.
- `frontend/dev/` (faux serveur, scripts de recette) non relu : il n'est pas servi par le backend (liste blanche), donc hors surface publique.
- Lecture intégrale de `frontend/lignees.js`, `mission.js`, `store.js`, `preuves.js` non faite ; vérification par recherche des motifs dangereux (innerHTML, eval, setAttribute de valeurs externes, `href`) et lecture de `format.js`, `deliverable.js`, `chat-deliverable.js`, `boot.js`.
- `market/checks.ts`, `shared/catalogue.ts`, `scripts/assemble-preuves.mjs` et le contrat non relus ; l'effet réel d'une injection de prompt sur le modèle NEAR AI n'a pas été éprouvé (pas d'appel réseau).
- Le format réel des clés NEAR AI (motif de masquage) n'a pas été vérifié dans la documentation du fournisseur.
- L'accord humain pour l'appel payant déjà effectué par `ai:logo-validation` (preuves `logo-validation`) n'a pas été recontrôlé dans `docs/BESOINS_HUMAIN.md`.
