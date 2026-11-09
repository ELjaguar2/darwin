# accounts/ (lot L2) : comptes, clés, plafonds, archivage, `NearChain`

Propriétaire : dev-comptes-wallets. Sans aucune clé, `createChain(config)` renvoie le `MockChain` de `shared/` ; `npm test` et `npm run typecheck` passent sans clé ni réseau (le testnet est testé avec un faux backend, `fake-backend.ts`, qui reproduit les règles du contrat L3).

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.ts` | `createChain(config, extra?)` : mock (défaut) ou `NearChain` ; réexporte tout. |
| `near-chain.ts` | `NearChain implements Chain` (testnet). Deux modes : `contract` (si `NEAR_CONTRACT_ID`) et `degraded` (D-016/D-022, séquestre = sous-compte `escrow.<maître>`, registre et réputation dans `ledger.ts`, à ne jamais présenter comme « on-chain »). `chain.mode` l'indique. `await chain.checkReady()` au démarrage : vérifie réseau = testnet, compte maître existant, charge le ledger. |
| `near-backend.ts` | Seul fichier qui touche `near-api-js` (import dynamique, paquet optionnel, Node >= 22.22.2). API vérifiée dans les types de near-api-js 7.4.0 (`Account`, `createSubAccount`, `deleteAccount`, `addFunctionCallAccessKey`, `callFunctionRaw`, `provider.callFunction`). Traduit les paniques du contrat en `ChainError` typées. |
| `keys.ts`, `base58.ts` | Génération ed25519 au format NEAR, `Secret` (masqué en `toString`/JSON/`inspect`), `MemoryKeyStore`, `FileKeyStore`. |
| `policy.ts` | `SpendPolicy` : plafond par transaction et par fenêtre glissante, maître exempté. |
| `archive.ts` | `FileArchive` : `<dataDir>/accounts-archive.jsonl`, une ligne par compte clos (jamais de clé privée). |
| `ledger.ts` | État local du mode dégradé (`<dataDir>/ledger.json`). |
| `faucet.ts` | `Faucet`, `MockFaucet`, `ManualFaucet`, `ensureFunded`. |

## Garde des clés
- Clé maître : variable `NEAR_MASTER_PRIVATE_KEY` (jamais dans le dépôt), enveloppée dans `Secret` dès `createChain`.
- Clés des agents : générées par `generateKey()`, enregistrées dans `<dataDir>/keys/<compte>.<full|fc>.key` (dossier `data/` et `*.key` ignorés par git, droits 0600 sous POSIX ; sous Windows, dossier protégé par les ACL de l'utilisateur). La clé est écrite AVANT la transaction de création (jamais de compte sans clé).
- Aucune clé dans un message d'erreur, un journal, un événement ou l'archive ; les messages RPC sont nettoyés (`ed25519:[REDACTED]`). Testé.

## Droits : clé complète et clé function call
Chaque sous-compte reçoit une clé complète (gardée par le moteur : virements, `lock_escrow` avec dépôt, suppression à la mort) et, si un contrat est configuré, une clé *function call* limitée au contrat Darwin, à une liste de méthodes explicite (défaut `["lock_escrow"]`, jamais vide car vide = toutes les méthodes en NEAR) et à une allocation de gaz de 0,05 NEAR. Limite protocolaire : une clé function call ne peut pas attacher de dépôt, donc elle ne peut pas déplacer d'argent ; les dépôts (séquestre) se signent avec la clé complète. La clé function call est destinée à un runtime d'agent moins privilégié (aujourd'hui sans usage dans le moteur).

## Plafonds de dépense
`SpendPolicy` s'applique à `transfer`, `lockEscrow` et au financement d'un enfant par son parent (`createAccount({fundFrom})`). Par défaut (`createChain`) : 4 x capital de naissance par sortie, 50 x par heure. Un dépassement lève `SpendCapError` (code `ChainError` `SPEND_CAP_EXCEEDED`, D-031, distinct d'`INSUFFICIENT_FUNDS` pour ne pas faire mourir un agent). Le plafond du compte `visitors.<maître>` (D-025) se règle par `perAccount`.

## Mort
`closeAccount` : vérifie que le bénéficiaire existe (supprimer vers un compte inexistant détruirait les fonds), supprime le compte (solde au bénéficiaire), retire les clés, archive. Si la suppression échoue : balayage du solde moins 0,001 NEAR, état `frozen` dans l'archive. `swept` est une borne haute (le gaz de suppression est prélevé sur le solde).

## Écarts du contrat L3 pris en compte
`registerAgent` envoie `record{… genome_hash, genome_json}` (JSON canonique, hash vérifié côté client) ; `refundEscrow` n'admet que `rejected`/`expired` (autre motif : erreur) ; `addReputation` attend la fin du callback puis appelle (delta entier, non nul, <= 100) ; `releasing`/`refunding` : `release/refundEscrow` attendent l'état final (10 sondes d'1 s) et `getEscrow` les voit comme `locked` ; `lockEscrow` enchaîne en interne `reserve_task` (signé par l'opérateur, anti-squat des ids de tâche, sauté si la réservation identique existe déjà) puis `lock_escrow` signé par le payeur ; id réservé pour un autre payeur : `ESCROW_EXISTS`. Le malus de réputation est accepté après remboursement `rejected` ou `expired`. Le mode dégradé applique la même réservation dans le ledger local. À noter : `MockChain` (shared) est plus permissif que le contrat (motifs de remboursement libres, réputation sans séquestre) ; les tests du marché en mock doivent respecter les règles strictes.

## Vérifications R2 (2026-11-09, doc officielle)
| Point | Constat | Source |
|---|---|---|
| RPC testnet | `https://test.rpc.fastnear.com` (déjà D-006). | docs.near.org/api/rpc/providers |
| Faucet | Formulaire intégré à la page de la doc (NEAR testnet seulement) et https://near-faucet.io, « might be out of tokens at times ». **Aucune API, quantité ni limite documentée** : pas d'appel automatique codé. Financement du maître = action humaine (voir BESOINS_HUMAIN). | docs.near.org/getting-started/faucet |
| Explorateur | Testnet NearBlocks : `https://testnet.nearblocks.io` ; format `.../txns/<hash>` (supposé, non confirmé par la doc : à contrôler visuellement avec une vraie transaction). | docs.near.org/integrations/testing ; thirdweb |
| Gaz | Doc : plancher `1 Tgas = 0,0001 NEAR` ; table : transfert 0,45 Tgas (0,000045 NEAR), création de compte 7,92 Tgas (0,00707 NEAR), clé 0,42 Tgas, appel de fonction jusqu'à 1000 Tgas. `min_gas_purchase_price = 0,001 NEAR/Tgas` y est aussi cité, et une PR near/docs évoque un plancher protocolaire relevé à 10^9 yocto/gaz : prix réel à lire sur le RPC (`gas_price`). | docs.near.org/concepts/basics/transactions/gas ; github.com/near/docs/pull/3140 |
| Sous-comptes | Le parent crée `label.<maître>` ; le financement vient forcément du parent (d'où le rapatriement vers le maître quand un agent finance son enfant). | near-api-js 7.4.0 `createSubAccount` |

## minVital = 0,05 NEAR en testnet : suffisant ?
Oui, avec marge, à une condition. Le gaz est payé par le signataire ; au prix plancher le plus élevé cité (0,001 NEAR/Tgas) : un transfert coûte environ 0,00045 NEAR (0,45 Tgas), un appel de contrat quelques centièmes de NEAR au pire. La suppression du compte rend tout le solde (stockage compris). Mais le gaz attaché est **prépayé** : near-api-js attache 30 Tgas par défaut, soit 0,03 NEAR bloqués au prix de 0,001, le solde doit les couvrir (le non consommé est remboursé). `lock_escrow` est le seul appel signé par un agent (30 Tgas) : 0,05 > 0,03 donc il reste possible tant que l'agent est vivant. Valeur retenue : **garder `minVital = 0.05`**, et ne pas attacher plus de 30 Tgas aux appels signés par un agent (`GAS_CALL`). Si le RPC indique un prix de gaz supérieur à 0,001 NEAR/Tgas, monter `minVital` à 0,08. Le métabolisme testnet (0,002 à 0,004 NEAR/tick) dépasse largement le gaz d'un virement regroupé (0,00045 par 4 ticks). Non mesuré en réel (aucune clé) : à confirmer avec un premier lancement testnet (`gas_burnt` d'une transaction visible dans l'explorateur).

## Configuration testnet
Variables : `NEAR_MASTER_ACCOUNT_ID`, `NEAR_MASTER_PRIVATE_KEY` (SECRET), `NEAR_CONTRACT_ID` (vide : mode dégradé), `NEAR_RPC_URL`. Installer `npm install near-api-js@7.4.0` avec Node >= 22.22.2 ; sans lui : erreur claire. Testé uniquement contre le faux backend : le premier lancement réel (création d'un sous-compte, clé function call, suppression) reste à faire dès que les clés existent.

## Séquestre dégradé : règlement sûr (D-016)
`releaseEscrow`/`refundEscrow` en mode dégradé : verrou par taskId (les appels concurrents s'exécutent l'un après l'autre, le second reçoit `ESCROW_SETTLED`), statut `releasing`/`refunding` écrit et sauvegardé AVANT le transfert, retour à `locked` si le transfert échoue, statut final après succès. `getEscrow` voit l'état transitoire comme `locked`, mais une nouvelle libération est refusée tant qu'il n'est pas résolu. Après un plantage, `recover()` (appelé par `checkReady()`) compare le solde du compte `escrow.<maître>` à celui noté avant le transfert : baissé du montant, le transfert a eu lieu (état final) ; sinon retour à `locked`. Limite : cette comparaison suppose que ce compte ne sert qu'aux règlements ; un dépôt concurrent pendant la fenêtre de plantage rendrait la reprise ambiguë (conclusion « non payé »), à vérifier à la main dans l'explorateur.
