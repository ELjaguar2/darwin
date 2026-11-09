# SECURITE

> Propriétaire : agent securite. Revue L10, première passe, 2026-11-09. Lecture seule sur le code des autres lots : les constats sont des signalements au chef de projet, rien n'a été corrigé. Aucune valeur secrète n'apparaît dans ce document.

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

Hors périmètre de cette passe : `accounts/` (L2), `intents/` (L9), `backend/` (L7), `frontend/` (L8) ; à revoir dès qu'ils sont terminés (clés de sous-comptes, jeton admin, XSS, limites IP).

## 2. État du scan de secrets

Script : `scripts/scan-secrets.mjs` (`npm run scan:secrets`, alias `npm run scan-secrets`). Sans dépendance. Il scanne les fichiers suivis par git et les lignes ajoutées de l'historique (`git log -p`) : clés NEAR `ed25519:`/`secp256k1:`, clés PEM, phrases de récupération de 12 à 24 mots précédées d'un mot-clé, clés `sk-`, `Bearer` long, JWT, affectation non vide (16 caractères ou plus) de `NEAR_MASTER_PRIVATE_KEY`, `NEARAI_API_KEY`, `INTENTS_JWT`, `DARWIN_ADMIN_TOKEN` ; fichier `.env*` suivi (hors `.env.example`). Valeurs toujours masquées (4 premiers caractères + longueur). Code de sortie 1 si détection. Options : `--ref <branche>` (arbre et historique de cette branche), `--no-history`, `--no-files`.

Le script a été vérifié sur un dépôt jetable contenant des valeurs factices de chaque type (détection de chacun, rien d'affiché en clair). Limites connues : une phrase de récupération sans mot-clé voisin n'est pas détectée ; un secret de moins de 16 caractères non préfixé non plus.

| Cible | Fichiers | Commits | Résultat |
|---|---|---|---|
| `main` (dossier de travail + historique de toutes les refs) | 43 | 22 | propre |
| `lot/L3-contrats` | 53 | 7 | propre |
| `lot/L4-moteur` | 52 | 8 | propre |
| `lot/L5-cerveau` | 49 | 8 | propre |
| `lot/L6-marche` | 50 | 8 | propre |
| `lot/L2-comptes`, `lot/L9-intents` (bonus) | 47 / 51 | 5 / 5 | propre |

Un premier passage avec un seuil plus bas signalait des valeurs factices de test dans `shared/shared.test.ts:50` ; le seuil de 16 caractères les écarte. `.gitignore` couvre `.env`, `.env.*` (sauf `.env.example`), `*.key`, `*.pem`, `.near-credentials/`, `data/`, `*.log`. `.env.example` : variables secrètes présentes, sans valeur.

## 3. Constats par lot

Gravité : **BLOQUANT** (interdit la fusion), **À CORRIGER** (corriger avant démo testnet ou avant fusion finale, fusion possible), **NOTE**.

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

## 4. Verdicts

| Lot | Verdict | Constats bloquants |
|---|---|---|
| L3-contrats | FUSIONNABLE APRÈS CORRECTIFS | aucun (squat de `task_id` et malus d'expiration à traiter avant le déploiement testnet) |
| L4-moteur | FUSIONNABLE APRÈS CORRECTIFS | aucun (dette perdue dans `flushAgent`, fonds orphelins dans `bear`) |
| L5-cerveau | FUSIONNABLE APRÈS CORRECTIFS | aucun (plafond global de dépense, délimiteur contournable, https obligatoire) |
| L6-marche | FUSIONNABLE APRÈS CORRECTIFS | aucun (juge en échec ouvert) |

Aucun secret détecté, aucun crédit sans preuve constaté, aucune libération sans verdict constatée. Les « à corriger » de L5 (plafond global) et L6 (échec fermé) touchent à de l'argent réel ou à la règle « jamais de libération sans validation » : à faire avant la fusion finale.

## 5. Checklist de fusion (à cocher avant chaque fusion dans `main`)

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
- [ ] Frontend : aucun `innerHTML` sur du contenu d'agent ou de visiteur.
- [ ] Avant la publication du dépôt (par l'humain) : `node scripts/scan-secrets.mjs` (toutes branches) propre.
