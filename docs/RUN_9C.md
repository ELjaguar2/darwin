# Run 9c — run vitrine réel (testnet)

> Préparé le 2026-11-12. Lancé **par l'humain**, dans un terminal séparé, sans observateur en arrière-plan.
> Objectifs : (1) valider en réel le preset `selection` recalibré (D-043, calibré en mock seulement) ; (2) produire le journal vitrine du replay : pitchs d'enchère et contenus de livrables enregistrés (D-045), au moins une commande de visiteur menée jusqu'au paiement.
> Aucun feu vert mainnet n'est impliqué. Tout est testnet.

## 0. Ce que l'on sait des runs précédents (pour ne pas se raconter d'histoires)

| Run | Preset | Résultat |
|---|---|---|
| 8 | `selection` (4 fondateurs, capital 0,1, métabolisme 0,005, client 1,5/tick) | Génération 3, 12 naissances, 7 morts, 65 séquestres, 92 enchères, 138 appels IA (0,0149 USD), 59 ticks (39 min) |
| 9a | 4 fondateurs (journal : 4 naissances), métiers L16 | Extinction en génération 1 (4 naissances, 4 morts au tick 14), 7 enchères seulement, logos rejetés |
| 9b | 6 fondateurs, 6 métiers | Extinction en génération 1 (6 morts au tick 19), 9 enchères seulement, 7 rejets (logos) |

Depuis 9b : plafond dur de `max_tokens` pour les livrables (7cb869d), calibrage mock D-043 (capital 0,12, métabolisme 0,0035, client 2/tick), pitch d'enchère en réel (D-045, **un appel IA par enchère**). Le logo a été validé par un appel réel isolé (docs/PREUVES_TESTNET.md §10), pas en run complet.
**Risque principal : une nouvelle extinction en génération 1** (peu d'offres, revenus trop faibles). Le mock donne 92 % de réussite ; le réel est plus dur (latence, rejets du juge).

## 1. Avant de lancer (checklist)

1. Code final fusionné dans `main` (revues sécurité et gardien faites), puis :
   ```powershell
   cd <dépôt>
   git checkout main
   npm ci
   npm test        # doit être vert
   ```
2. `.env` : `.env` réel présent avec la **nouvelle** clé maître (rotation du 2026-11-11), `NEARAI_API_KEY` valide, `NEAR_RPC_URL` (un ou plusieurs fournisseurs, séparés par des virgules, pour limiter les 429). `INTENTS_ENABLED=false`.
3. **Solde du compte maître** `darwin-master-7k2.testnet` : 1,909 NEAR au 2026-11-12 (après le test de recette). Besoin estimé ci-dessous : **recharger pour avoir au moins 8 NEAR**.
   ```powershell
   curl.exe -s -X POST https://test.rpc.fastnear.com -H "Content-Type: application/json" -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"darwin-master-7k2.testnet\"}}'
   ```
   Le champ `amount` est en yoctoNEAR (1 NEAR = 10^24). Recharge via le robinet testnet habituel (celui des runs précédents, qui avait donné 10 NEAR).
4. Sauvegarde : le démarrage renomme `data/journal.jsonl`, `state.json` et `lineage.json` en `*.prev` (et **écrase** l'ancien `journal.prev`). Copie d'abord :
   ```powershell
   Copy-Item -Recurse data "data-sauvegarde-$(Get-Date -Format yyyyMMdd-HHmm)"
   ```
5. Budget IA : `data/ai-budget.json` cumul ≈ 0,05 USD, plafond d'arrêt 8 EUR : large.
6. Fermer les autres serveurs Darwin (port 3000 libre).

## 2. Commande exacte

Dans un terminal PowerShell séparé :
```powershell
cd <dépôt>
$env:DARWIN_PRESET = "selection"
$env:DARWIN_ADMIN_TOKEN = "<chaine-aleatoire-de-24-caracteres-ou-plus>"   # facultatif, sert à mettre en pause proprement
npm run start:testnet
```
Aucune autre variable de réglage (comme au run 8). Les ids sont décalés automatiquement. La page est sur http://127.0.0.1:3000 (vérifier que l'en-tête affiche **TESTNET NEAR**, pas MOCK ni REJEU). Un tick dure environ 1 minute réelle.

Parcours conseillé pendant le run :
- **Ticks 1 à 8** : laisser naître les 6 fondateurs. Vérifier la page Mission (cartes) et la page Preuves (liens nearblocks).
- **Vers le tick 8-10, si ≥ 5 agents sont vivants** : passer une commande de visiteur depuis la barre de la page Mission. D'abord un **marketing ou une traduction** (métiers déjà prouvés en réel), budget 1 NEAR. Puis, quand le premier est payé, **un logo** (c'est lui qui prouve le plafond de tokens corrigé). Le métier doit avoir un agent vivant, sinon la commande expire.
- **Arrêt** quand : génération 3 atteinte **et** au moins une mort **et** au moins une commande de visiteur payée ; ou à 90 minutes maximum ; ou arrêt anticipé (ci-dessous).

## 3. Estimation des coûts

**IA (NEAR AI Cloud).** Run 8 : 138 appels, 0,0149 USD. Chaque enchère en réel ajoute un appel de ~120 tokens de sortie (mesuré à la recette : 13 appels = 0,0046 USD, soit ~0,0004 USD l'appel). Pour 150 à 300 enchères : 0,06 à 0,12 USD. Total attendu du run : **0,1 à 0,25 USD**, soit moins de 0,25 EUR contre 8 EUR de plafond. Le coût IA n'est pas un sujet ; la surveillance porte sur la **santé économique des agents** (le pitch est débité de chaque agent, y compris les perdants).

**NEAR (testnet, sans valeur).** Run 8 : sorties brutes du compte maître ≈ 2,9 NEAR (1,23 pour les comptes, 1,70 pour financer le client simulé), dont ~0,2 revenait par clôture de compte. Pour 9c : fondateurs 6 × 0,12 = 0,72 ; jusqu'à 18 agents ; client simulé à 2 tâches/tick au lieu de 1,5 (+33 %) ; durée jusqu'à 90 ticks ; commandes de visiteur ≤ 1 NEAR chacune. **Estimation brute : 5 à 7 NEAR.** Solde actuel 1,909 → **recharger de 6 NEAR au moins** (cible ≥ 8). Si le solde passe sous 1 NEAR en cours de run, pause et arrêt.

## 4. Ce qu'il faut surveiller (et quoi faire)

| Signal | Où | Seuil / action |
|---|---|---|
| Extinction précoce | Page Mission / Lignées | ≥ 3 morts sur 6 avant le tick 20 sans aucune reproduction = le schéma des runs 9a/9b → pause, garder le journal, revenir au replay du run 8 pour la vidéo |
| Offres | fil de la page Mission, `bid.placed` | doit y avoir plusieurs offres par tâche (run 8 : ~0,8 offre/tâche). 9a/9b n'en avaient presque pas |
| Pitchs | `bid.placed.bid.pitch` | présents sur (presque) toutes les offres ; surveiller `PITCH_FALLBACK` (ok si rare) |
| Logos | `task.validated`, `deliverable.produced` | `finish_reason` non tronqué ; un rejet `rule:logo` répété = problème de modèle, noter lequel |
| Livrables | `deliverable.produced.files[].content` | tous les fichiers portent `content` (sinon le replay ne sert pas le livrable) ; `truncated` rare |
| 429 RPC | `system.warning`, console du terminal | des réessais sont normaux ; des échecs en série = changer `NEAR_RPC_URL` |
| `BRAIN_EMPTY_TEXT` | `system.warning` | vu une fois sur `openai/gpt-5-nano` (réponse vide, `finish_reason=length`) ; si fréquent, noter le modèle |
| Budget IA | `data/ai-budget.json` | doit rester à quelques centimes |
| Solde maître | RPC (commande §1.3) | pause si < 1 NEAR |
| Commande visiteur | fil Mission | séquestre → livrable → verdict → « payé ✓ » avec lien ; un rejet suivi d'un remboursement reste une preuve valable, à dire comme telle |
| Mémoire / taille | gestionnaire de tâches, taille de `data/journal.jsonl` | les contenus de livrables grossissent le journal (≤ 64 ko par livrable) |

## 5. Arrêt et récupération du journal

```powershell
curl.exe -X POST http://127.0.0.1:3000/api/sim/pause -H "Authorization: Bearer <votre-jeton>"
```
(sans jeton défini, la même commande sans l'en-tête). Puis `Ctrl+C` dans le terminal du run. **Avant tout autre démarrage** :
```powershell
Copy-Item data\journal.jsonl docs\preuves\run9c-journal.jsonl
```
Vérifier qu'il ne contient ni clé ni jeton : `npm run scan-secrets -- --no-history`.

Rejeu du journal vitrine :
```powershell
$env:DARWIN_REPLAY_FILE = "docs/preuves/run9c-journal.jsonl"
npm run replay
```

## 6. Après le run (à faire faire à l'équipe)

1. `node scripts/gen-preuves.mjs docs/preuves/run9c-journal.jsonl` puis compléter `docs/PREUVES_TESTNET.md` : section run 9c avec réglages, résultat exact (même en cas d'échec), hashes des transactions, coût IA (`data/ai-budget.json`), solde maître avant/après.
2. Brancher le journal sur le replay (`DARWIN_REPLAY_FILE`), vérifier la page Mission en rejeu : pitchs et livrables s'affichent, bandeau « Rejeu » présent.
3. Aligner README, FORMULAIRE, VIDEO_SCRIPT et POST_X sur ce qui a **réellement** tourné. Si le run n'a pas atteint la génération 3, ne rien promettre : la vidéo s'appuie sur le run 8 (génération 3 prouvée) et le journal 9c n'est cité que pour ce qu'il prouve.

## 7. Repli

Si 9c échoue (extinction, panne RPC, budget) avant 12:00 UTC le 13 novembre : on garde le replay du run 8 comme démo, les mentions du run 9c sont retirées de la vidéo et du post, et le logo reste « prochaine étape » dans le README (il n'est validé que par l'appel réel isolé de la piste C).
