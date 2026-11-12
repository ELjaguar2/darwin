# PREUVES TESTNET — ce qui a réellement tourné

> Mis à jour le 2026-11-12 : §8 = run 8 du 2026-11-10 (génération 3 et morts), §10 = validation du logo du 2026-11-11, §11 = résumé des runs 9a et 9b du 2026-11-11. Règle : seul ce qui figure ici avec un identifiant de transaction, un journal ou une commande reproductible est **prouvé**. Le reste est dit non prouvé. Explorateur : `https://testnet.nearblocks.io/txns/<hash>` (nearblocks, testnet). Aucune dépense mainnet, rien n'est publié. Ce fichier est généré à partir de `docs/preuves/PREUVES_TEMPLATE.md` et des journaux par `node scripts/assemble-preuves.mjs`.

## 1. Résumé honnête

| Élément | État |
|---|---|
| Compte maître testnet créé avec le CLI officiel (`sponsor-by-faucet-service`) | **Prouvé** (§2) |
| Contrat Rust déployé et initialisé sur testnet | **Prouvé** (§3) |
| Séquestres verrouillés puis libérés par le contrat, avec preuve, et réputation écrite | **Prouvé** (§5) |
| Cerveau réel NEAR AI Cloud, consommation tracée | **Prouvé** (§6) |
| Attestation TEE d'une réponse, vérifiée de bout en bout | **Prouvé pour un modèle, à la demande** (§7) |
| Génération 2 sur la vraie chaîne (5 reproductions et 5 lettres dans un seul run) | **Prouvé** (§4) |
| Génération 3 dans un même run réel | **Prouvé** (run 8, preset `selection`, 59 ticks : génération 3, 12 naissances, 8 reproductions ; §8) |
| Mort d'un agent sur testnet | **Prouvé** : 7 morts par famine au run 8, `mark_dead` et clôture de compte avec transactions (§8) |
| `refund_escrow` sur testnet | **Prouvé une fois** : tâche `t-5003` rejetée par le juge, remboursement `rejected` par le contrat, malus de réputation −2 (§8) |
| Clés function call des agents | **Prouvé au run 8** : clé ajoutée dans la transaction de création, 0 avertissement, 2 clés vérifiées sur la chaîne (échec aux runs 5 à 7, corrigé) |
| NEAR Intents, mainnet | **Jamais exécuté** (aucune dépense) |

## 2. Compte maître

- Compte : `darwin-master-7k2.testnet`, créé le 2026-11-10 par le robinet testnet avec `near account create-account sponsor-by-faucet-service darwin-master-7k2.testnet autogenerate-new-keypair --signature-scheme ed25519 save-to-legacy-keychain network-config testnet create` (near-cli-rs 0.31.1).
- Transaction de création : [`5SiBQfZp…`](https://testnet.nearblocks.io/txns/5SiBQfZpuCzJcUGgLBhcRWYB5Ad8LvBi5qMyzYDjVAi4) (10 NEAR de testnet reçus).
- La clé privée est dans `.env` (ignoré par git) et dans le dossier d'identifiants local du CLI. Elle n'est pas dans le dépôt : `node scripts/scan-secrets.mjs --no-history` propre, et recherche de la valeur exacte dans les fichiers suivis : 0 occurrence.

## 3. Contrat

- Compte contrat : `darwin-contract-7k2.testnet`, créé par le robinet : [`DMmmRkir…`](https://testnet.nearblocks.io/txns/DMmmRkirNdreqTY68SroCm9Uv1hUP9csqNSZNrMmxMcQ).
- Déploiement + appel `new {"operator":"darwin-master-7k2.testnet"}` : [`EAiE25tj…`](https://testnet.nearblocks.io/txns/EAiE25tjN2LmZkxbNekigvHT4rw6eJsmmMi3vqY9mpxb), 36 Tgas, frais 0,0036 NEAR.
- WASM de 469 113 octets construit avec `cargo build --target wasm32-unknown-unknown --release` (Rust 1.99.1), **pas** avec `cargo near build`. Le runtime NEAR l'a accepté et exécuté. Pas de build reproductible.
- Commande réellement utilisée : `near contract deploy darwin-contract-7k2.testnet use-file <wasm> with-init-call new json-args '{"operator":"darwin-master-7k2.testnet"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send` (`sign-with-legacy-keychain` au lieu de `sign-with-keychain` dans `contracts/deploy-testnet.sh`).
- Vérification indépendante en lecture seule (`near contract call-function as-read-only`, 2026-11-10) : `agents_count` = 32 agents enregistrés ; `get_escrow t-4001` = `status: released`, payeur `sim-client`, bénéficiaire `a-0602`, preuve `verdict: accepted`, validateur `brain:gemini-2.5-flash-lite`, `result_hash 7dd629b9…` ; `get_reputation a-0602` = 7 ; `get_agent a-0604` = génération 2, parent `a-0602`, vivant.
- Limite de confiance : l'opérateur (compte maître) est l'oracle de validation ; le juge est un modèle externe (non TEE).

## 4. Génération 2 sur la vraie chaîne

Plusieurs runs réels ont eu lieu le 2026-11-10 ; les ids d'agents changent à chaque run (`a-0101…`, …, `a-0701…`, puis `a-214953…` au run 8, décalage automatique). **Le run 8 (§8) est le plus complet : génération 3 et morts.** Journaux conservés : `docs/preuves/run5-journal.jsonl` et `docs/preuves/run6-journal.jsonl` (événements Darwin, hashes de transactions publics, aucun secret). Tableaux générés par `node scripts/gen-preuves.mjs <journal>`.

### Run 6 (le plus complet : 8 naissances, 5 reproductions, 26 cycles de séquestre)

Journal : `docs/preuves/run6-journal.jsonl` (792 événements, du 2026-11-10T20:24:06.536Z au 2026-11-10T20:43:35.823Z).

Génération maximale née : **2** ; naissances : 8 ; reproductions : 5 ; lettres : 5 ; morts : 0.
Transactions par type : create_account 8, register_agent 8, transfer 61, escrow_lock 26, escrow_release 26, add_reputation 26.

#### Naissances

| Agent | Génération | Parent | Compte | Tx de création |
|---|---|---|---|---|
| a-0601 | 1 | — | `a-0601.darwin-master-7k2.testnet` | [`5zZvYrXR…`](https://testnet.nearblocks.io/txns/5zZvYrXRQ8mtWtrqu1AYpB3NNrEXQv2co1somWcUpeDk) |
| a-0602 | 1 | — | `a-0602.darwin-master-7k2.testnet` | [`EBYeBvK6…`](https://testnet.nearblocks.io/txns/EBYeBvK69SHM2Pivx2DrFfrrSe41urPmo5jZsYQwm5eS) |
| a-0603 | 1 | — | `a-0603.darwin-master-7k2.testnet` | [`BzvkJvXK…`](https://testnet.nearblocks.io/txns/BzvkJvXKJGUwp1AmicDk8GUQdkS4HqQdp4zV4qUvewDK) |
| a-0604 | 2 | a-0602 | `a-0604.darwin-master-7k2.testnet` | [`9rcEU1oc…`](https://testnet.nearblocks.io/txns/9rcEU1ocVGjadMeqqBygLdSWJTnsqJNbMYyu4US7dzwi) |
| a-0605 | 2 | a-0601 | `a-0605.darwin-master-7k2.testnet` | [`8SCpeQGn…`](https://testnet.nearblocks.io/txns/8SCpeQGnVep8AP74WmQPQuDgXfJVWkMCtVGZVYnJEzXq) |
| a-0606 | 2 | a-0602 | `a-0606.darwin-master-7k2.testnet` | [`7ok3abAn…`](https://testnet.nearblocks.io/txns/7ok3abAnFDpY3LaSvemCJgEzNdznhHa48PEoWE9BN65L) |
| a-0607 | 2 | a-0603 | `a-0607.darwin-master-7k2.testnet` | [`6ApCrqTw…`](https://testnet.nearblocks.io/txns/6ApCrqTw6kaEoP4AK7F6qqd4t9GnSFz1AMSFLKkcMkiz) |
| a-0608 | 2 | a-0603 | `a-0608.darwin-master-7k2.testnet` | [`4A7XZt4P…`](https://testnet.nearblocks.io/txns/4A7XZt4Pi3ZMB5nwNuPtGxhPgmJnYiDzW3jZZXvcyGyb) |

#### Reproductions

| Parent | Enfant | Transféré (NEAR) |
|---|---|---|
| a-0602 | a-0604 | 0.1026 |
| a-0601 | a-0605 | 0.1005 |
| a-0602 | a-0606 | 0.1034 |
| a-0603 | a-0607 | 0.1016 |
| a-0603 | a-0608 | 0.1024 |

#### Morts

| Agent | Cause | Solde final (NEAR) | Récupéré par le maître (NEAR) | Tx de clôture |
|---|---|---|---|---|

#### Séquestres : 26 verrouillés, 26 libérés, 26 réputations écrites (5 premiers cycles listés)

| Tâche | Payeur | Bénéficiaire | Montant (NEAR) | Verrouillage | Libération | Réputation |
|---|---|---|---|---|---|---|
| t-4001 | `sim-client` | `a-0602` | 0.0199 | [`tPWEd8ZL…`](https://testnet.nearblocks.io/txns/tPWEd8ZLSXmqYsDuwt1zLVJw3ihyJV74FudEjupKQMN) | [`HEHecxC6…`](https://testnet.nearblocks.io/txns/HEHecxC6XMGcBXh2jJTh6WybCn9w4mCAXyCsuDyvzK4g) | [`836a9cBn…`](https://testnet.nearblocks.io/txns/836a9cBnyJFH6eHTHK35uxa2eNFNkKWSr2FcTCa2RC66) |
| t-4002 | `sim-client` | `a-0601` | 0.0460 | [`4pw5gFg4…`](https://testnet.nearblocks.io/txns/4pw5gFg4bBCgCnpeDXe7TQGJjR94yzdWBNrGhKKHJGUu) | [`GZ1dptdH…`](https://testnet.nearblocks.io/txns/GZ1dptdH3caubQ1oSvsYwUXA5jZvNdSq5WQDpywMKkgY) | [`9j6mzTmA…`](https://testnet.nearblocks.io/txns/9j6mzTmAdN2uK5qbSi4SwFfuKvY8tCVapokSi9Q1JgLw) |
| t-4003 | `sim-client` | `a-0603` | 0.0150 | [`3FStc98p…`](https://testnet.nearblocks.io/txns/3FStc98pEKZK627p6Sge4qTBLVeFwfWZuYo166vzbviB) | [`ETFyky3M…`](https://testnet.nearblocks.io/txns/ETFyky3MbTAW7pyDBauiu1VY9owvv3uYCicC7jg26DzB) | [`8wL1pjjr…`](https://testnet.nearblocks.io/txns/8wL1pjjrebfVw5qtVULrghuk1YNUs5vXXoBu2gKo7Z43) |
| t-4004 | `sim-client` | `a-0601` | 0.0348 | [`FP1XC8ij…`](https://testnet.nearblocks.io/txns/FP1XC8ijptB9crthg5b7532XqTucRaLkhTJpau2p3DZ2) | [`A7SCo3Gi…`](https://testnet.nearblocks.io/txns/A7SCo3GipDEUxkYoVkgMiP5Jkn5Xqgaj1aKzUi2GjXoR) | [`CZLsLnSb…`](https://testnet.nearblocks.io/txns/CZLsLnSbp8BgEWWUBe8CYydVSxs2896Z6jSiNXYz4Bie) |
| t-4005 | `sim-client` | `a-0602` | 0.0321 | [`DSLHufKn…`](https://testnet.nearblocks.io/txns/DSLHufKnQpVniwtC2cWAi1rfHs4rQLi25kf5eGZdcJGG) | [`Hg7MwFuK…`](https://testnet.nearblocks.io/txns/Hg7MwFuKfFh4wwq7foRfCbLz6K2dHmBNuvji1vsf1U7R) | [`H8CKbGUP…`](https://testnet.nearblocks.io/txns/H8CKbGUPvuwfDG5bDGoR4J92vs1tU9h8pijTZJeSL4p8) |

#### Cerveau (débits dans ce journal)

31 appels facturés aux agents (0 mock), coût réel cumulé 0.00548 USD. Par modèle : Qwen/Qwen3.6-35B-A3B-FP8 ×18, deepseek-ai/DeepSeek-V4.1-Flash-1017 ×13.


### Run 5 (résumé)

Journal : `docs/preuves/run5-journal.jsonl` (821 événements, du 2026-11-10T20:04:38.265Z au 2026-11-10T20:23:43.289Z).

Génération maximale née : **2** ; naissances : 4 ; reproductions : 1 ; lettres : 1 ; morts : 0.
Transactions par type : create_account 4, register_agent 4, transfer 56, escrow_lock 30, escrow_release 30, add_reputation 30.

### Naissances

## 5. Séquestres et réputation

Le tableau « Séquestres » du run 6 donne, pour chaque tâche, la transaction de verrouillage (`lock_escrow`, dépôt attaché par le payeur), de libération (`release_escrow` avec preuve) et d'écriture de réputation (`add_reputation`). Les 26 cycles du run 6 et les 30 du run 5 sont complets (verrouillé, libéré, réputation) dans les journaux. Le payeur est le compte `sim-client` : client **simulé**, étiqueté, financé depuis le compte maître. Aucune tâche d'un visiteur humain n'a été exécutée en réel.

## 6. NEAR AI Cloud : consommation réelle

Source : `data/ai-usage.jsonl` (une ligne par appel réel : tokens `usage` x prix de `GET /v1/model/list`), tableau régénéré par `npm run ai:usage-report -- --dir data`. Ce journal est local (ignoré par git) ; le tableau ci-dessous en est la copie datée.

#### Consommation IA réelle (NEAR AI Cloud)

Journal : `data/ai-usage.jsonl` (350 appels, du 2026-11-10T19:23:44.380Z au 2026-11-10T23:29:08.975Z). Coût = tokens `usage` x prix du catalogue `GET /v1/model/list` ; EUR = USD / 1.1 (taux configuré `DARWIN_EUR_USD_RATE`, prudent).

| Total | Valeur |
|---|---|
| Appels | 350 |
| Tokens d'entrée | 46913 |
| Tokens de sortie | 28167 (dont raisonnement 8649) |
| Coût USD | 0.034041 |
| Coût EUR | 0.030946 |
| Plafond d'arrêt / budget total | 8 EUR / 10 EUR |

##### Par modèle

| Modèle | Fournisseur | Appels | Tokens in | Tokens out | USD | EUR |
|---|---|---|---|---|---|---|
| deepseek-ai/DeepSeek-V4.1-Flash-1017 | nearai | 64 | 6013 | 13018 | 0.017425 | 0.015841 |
| Qwen/Qwen3.6-35B-A3B-FP8 | nearai | 119 | 9366 | 8238 | 0.010656 | 0.009687 |
| google/gemini-2.5-flash-lite | nearai | 161 | 31385 | 6570 | 0.005767 | 0.005242 |
| gpt-5-nano-2025-08-07 | nearai | 1 | 15 | 200 | 0.000081 | 0.000073 |
| Qwen/Qwen3.8-27B | nearai | 1 | 61 | 38 | 0.000054 | 0.000049 |
| z-ai/glm-5.3-flash | nearai | 2 | 41 | 98 | 0.000052 | 0.000048 |
| claude-haiku-5-5 | nearai | 1 | 23 | 4 | 0.000004 | 0.000004 |
| gemini-2.5-flash-lite | nearai | 1 | 9 | 1 | 0.000001 | 0.000001 |

##### 15 derniers appels

| Horodatage (UTC) | Modèle | In | Out | USD | Agent | Usage | Id de réponse |
|---|---|---|---|---|---|---|---|
| 2026-11-10T23:24:06.996Z | google/gemini-2.5-flash-lite | 209 | 50 | 0.000041 | treasury | validate | `gemini-e628ed0d-3fff-4a5c-a01f-6287e37c0bd9` |
| 2026-11-10T23:24:22.102Z | Qwen/Qwen3.6-35B-A3B-FP8 | 125 | 204 | 0.000246 | a-214953 | letter | `2f37101442364942bf2b0d629f79c576` |
| 2026-11-10T23:24:53.179Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 175 | 0.000236 | a-214962 | execute_task | `chatcmpl-908cc4c3-7cbb-4551-8508-5c95b6a1aa5f` |
| 2026-11-10T23:24:53.895Z | google/gemini-2.5-flash-lite | 232 | 56 | 0.000046 | treasury | validate | `gemini-00c58f82-a0e5-446c-9631-b66c9a521804` |
| 2026-11-10T23:26:08.341Z | Qwen/Qwen3.6-35B-A3B-FP8 | 71 | 90 | 0.000111 | a-214953 | execute_task | `9aaf1b56cf9a4df7b90bb16d7504f50e` |
| 2026-11-10T23:26:09.263Z | google/gemini-2.5-flash-lite | 231 | 55 | 0.000045 | treasury | validate | `gemini-fd7ea023-a79b-407d-8df2-bef75d7ba0e2` |
| 2026-11-10T23:26:43.463Z | Qwen/Qwen3.6-35B-A3B-FP8 | 71 | 76 | 0.000096 | a-214953 | execute_task | `dbc0905362c6440599ca15a7a1e346d8` |
| 2026-11-10T23:26:44.180Z | google/gemini-2.5-flash-lite | 218 | 52 | 0.000043 | treasury | validate | `gemini-4f131bff-d002-43ab-96a5-efa7a32d696c` |
| 2026-11-10T23:27:21.248Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 162 | 0.000221 | a-214962 | execute_task | `chatcmpl-afe5d0d8-fc8d-4503-8741-8ad1c52af03e` |
| 2026-11-10T23:27:22.171Z | google/gemini-2.5-flash-lite | 232 | 40 | 0.000039 | treasury | validate | `gemini-f6058966-437c-4493-9b10-d487dd0dae0d` |
| 2026-11-10T23:28:35.591Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 155 | 0.000212 | a-214962 | execute_task | `chatcmpl-e2f27c0c-1e8d-4b1a-a1cc-d5311fc9084e` |
| 2026-11-10T23:28:36.411Z | google/gemini-2.5-flash-lite | 205 | 42 | 0.000037 | treasury | validate | `gemini-f81ec629-4b79-4190-9867-be1949c48a6c` |
| 2026-11-10T23:28:46.660Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 167 | 0.000227 | a-214962 | execute_task | `chatcmpl-ab28c7c2-b838-4ac9-9690-402797c132d7` |
| 2026-11-10T23:28:47.471Z | google/gemini-2.5-flash-lite | 212 | 43 | 0.000038 | treasury | validate | `gemini-2c600b69-a9fa-4cab-9d59-a16eaa37d459` |
| 2026-11-10T23:29:08.975Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 142 | 300 | 0.000403 | a-214962 | letter | `chatcmpl-ad5fb9fd-01c9-43e9-b06b-b54b9465f063` |



- Plafond global : arrêt propre à 8 EUR (`DARWIN_AI_BUDGET_EUR_STOP`), budget total 10 EUR. **Le plafond n'a jamais été approché.**
- Ces chiffres sont notre **comptabilité locale** : la facture réelle de la plateforme n'a pas été relue sur cloud.near.ai, à vérifier par l'humain.
- Les appels du juge (`validate`, modèle `google/gemini-2.5-flash-lite`, agent `treasury`) sont comptés dans le budget global et journalisés (`brain.charged`, agent `treasury`) ; ils ne sont **pas débités aux agents**, par conception. L'avertissement `JUDGE_COST_UNKNOWN` des runs 5 à 7 est corrigé (0 au run 8).

## 7. Attestation TEE

Exécutée le 2026-11-10 sur `z-ai/glm-5.3-flash` : 20 contrôles PASS, 0 FAIL, 0 SKIP (quote Intel TDX de la passerelle et du modèle, statut TCB `UpToDate`, preuve GPU NVIDIA NRAS vraie, signature ECDSA de la réponse valide ; test négatif : un octet ajouté fait échouer la vérification). Id de réponse attestée : `1c1ea6068280496f8ef8d050c98dbe6d`, signataire `0x3b753b4406613c5e70ae640508632b600424fa0c`. Commande : `npm run ai:verify-attestation -- --model z-ai/glm-5.3-flash --save-evidence data/attestation-glm`, puis `-- --offline data/attestation-glm`. Méthode et **limites** (un seul modèle ; pas d'attestation par appel de la simulation ; pas de liaison TLS ; pas d'allowlist de mesures) : `docs/ATTESTATION_TEE.md`.

## 8. Run final

**Objectif** : une seule exécution réelle (testnet, séquestre dans le contrat, cerveau NEAR AI réel) montrant la sélection : naissances, morts, génération 3.

**Résultat (run 8, 2026-11-10, 22:50 à 23:29 UTC, 59 ticks, preset `selection`)** : **objectif atteint**. Génération maximale **3** (`a-214964`, fille de `a-214962`, née au tick 59), 12 naissances (4 fondateurs, 7 de génération 2, 1 de génération 3), 8 reproductions, 8 lettres parent vers enfant, **7 morts par famine** (premier décès au tick 14), 65 séquestres verrouillés dont 63 libérés et 2 remboursés, 65 réputations écrites. Simulation mise en pause (`POST /api/sim/pause`, tick 59), processus arrêté, journal sauvegardé dans `docs/preuves/run8-journal.jsonl`.

**Réglages** : `DARWIN_PRESET=selection` sans aucune autre variable de réglage ; ids décalés **automatiquement** (aucune variable `*_SEQ_START`) ; Node 22.23.4 ; RPC `https://test.rpc.fastnear.com`. Le preset est défini dans `shared/config.ts` (testnet : 4 fondateurs, population max 16, capital de naissance 0,1 NEAR, métabolisme 0,005/tick, minimum vital 0,03, cooldown de reproduction 4 ticks, client simulé 1,5 tâche/tick, budgets 0,02 à 0,06 NEAR, tick de 10 s).

**Correctifs vérifiés par ce run** :
- `FC_KEY_NOT_ADDED` : **0 avertissement** (le run 7 en avait 2). La clé function call est ajoutée dans la transaction de création du compte (créer, financer, clé complète, clé limitée : une seule transaction). Vérification indépendante en lecture seule : `near account list-keys a-214964.darwin-master-7k2.testnet` montre 2 clés : « full access » et « only do ["lock_escrow"] function calls on darwin-contract-7k2.testnet with an allowance of 0.05 NEAR ».
- `JUDGE_COST_UNKNOWN` : **0 avertissement** (26 sur 26 appels du juge au run 7). La cause : le modèle servi (`gemini-2.5-flash-lite`) n'a pas le préfixe de l'identifiant demandé (`google/gemini-2.5-flash-lite`) ; le prix est maintenant cherché sur l'identifiant demandé. Le coût du juge est imputé à la trésorerie (agent `treasury`), pas aux agents : c'est voulu.
- Aucun avertissement système du tout dans ce journal (`system.warning` : 0) : pas de 429 bloquant.

**Vérification sur la chaîne (lecture seule, après le run)** : `get_agent a-214956` = mort, cause `starvation`, tick de mort 14 ; `get_agent a-214964` = génération 3, parent `a-214962`, vivant, né au tick 59 ; solde du compte maître 3,12 NEAR après le run (3,82 avant ; les fonds des agents morts reviennent au maître).

**Consommation IA** : 138 appels facturés aux agents ce run (0 mock), 0,0149 USD ; cumul local depuis le début 0,034 USD (`data/ai-budget.json`), contre un plafond d'arrêt de 8 EUR. Comptabilité locale : la facture de la plateforme n'a pas été relue.

**Limites honnêtes** : le payeur des tâches reste le client **simulé** `sim-client` ; une seule graine de population (pas de répétition) donc la vitesse d'apparition de la génération 3 (tick 59) n'est pas une garantie ; les agents morts le sont par famine (soldes de 0,025 à 0,030 NEAR, sous le minimum vital de 0,03) ; une seule génération 3 est née dans la fenêtre. Run mis en pause juste après sa naissance.

Journal : `docs/preuves/run8-journal.jsonl` (1819 événements, du 2026-11-10T22:50:13.222Z au 2026-11-10T23:29:14.645Z).

Génération maximale née : **3** ; naissances : 12 ; reproductions : 8 ; lettres : 8 ; morts : 7.
Transactions par type : create_account 12, register_agent 12, transfer 133, escrow_lock 65, escrow_release 63, add_reputation 65, mark_dead 7, close_account 7, escrow_refund 2.

#### Naissances

| Agent | Génération | Parent | Compte | Tx de création |
|---|---|---|---|---|
| a-214953 | 1 | — | `a-214953.darwin-master-7k2.testnet` | [`3RyLbkaK…`](https://testnet.nearblocks.io/txns/3RyLbkaKnN7VDkNw9KXGWtMVsAjchKo5oAGt1keWXiN6) |
| a-214954 | 1 | — | `a-214954.darwin-master-7k2.testnet` | [`Ay8rfwrN…`](https://testnet.nearblocks.io/txns/Ay8rfwrNwMtkMpAqYu3jKRAmWcfYm9GxmYJ1xdcYVWqF) |
| a-214955 | 1 | — | `a-214955.darwin-master-7k2.testnet` | [`J2xqGMdx…`](https://testnet.nearblocks.io/txns/J2xqGMdxH3mEEnHpyFtVYaWrzDQeKDa6QbZQgoCVDiHD) |
| a-214956 | 1 | — | `a-214956.darwin-master-7k2.testnet` | [`8NqtcnP6…`](https://testnet.nearblocks.io/txns/8NqtcnP6e4DimdXkoNzqH4Z4tzPw53bRD3kf6s9J3XW9) |
| a-214957 | 2 | a-214953 | `a-214957.darwin-master-7k2.testnet` | [`DFEmEWdN…`](https://testnet.nearblocks.io/txns/DFEmEWdNy1qSwyxreA3M1JtUtTkgVH7bXmfySKe9fVgq) |
| a-214958 | 2 | a-214954 | `a-214958.darwin-master-7k2.testnet` | [`FSXVrped…`](https://testnet.nearblocks.io/txns/FSXVrpedeopdPQBnrXpfnCZpbHwDPhXaKW8ruv7ZQb9S) |
| a-214959 | 2 | a-214954 | `a-214959.darwin-master-7k2.testnet` | [`ExKT7QBe…`](https://testnet.nearblocks.io/txns/ExKT7QBe3yAXUsefLp21DgBVLM8k4oWvjU6wazqBA142) |
| a-214960 | 2 | a-214955 | `a-214960.darwin-master-7k2.testnet` | [`37HJ7E1K…`](https://testnet.nearblocks.io/txns/37HJ7E1KVuwPXqnn5dPvGfHRMDhyK6A8b3BW8K91YgCv) |
| a-214961 | 2 | a-214954 | `a-214961.darwin-master-7k2.testnet` | [`BDxg6JTd…`](https://testnet.nearblocks.io/txns/BDxg6JTdFAgnLuw9ToX2A7VhHU2yWsHyLYR46VEHnKK4) |
| a-214962 | 2 | a-214955 | `a-214962.darwin-master-7k2.testnet` | [`7mU7Digi…`](https://testnet.nearblocks.io/txns/7mU7DigiRuLQaFxd9y5fQLB3ApnhLui9YnDTaRPrxvi5) |
| a-214963 | 2 | a-214953 | `a-214963.darwin-master-7k2.testnet` | [`Ex9e2oSj…`](https://testnet.nearblocks.io/txns/Ex9e2oSjfzZWVEu98FfRWmJMoFjmU7Kkh1ZbHcMVN2s6) |
| a-214964 | 3 | a-214962 | `a-214964.darwin-master-7k2.testnet` | [`ESeDRA8y…`](https://testnet.nearblocks.io/txns/ESeDRA8yuxn2T7Fzj66ZETrgB5ABRE5jDXKGgjQ16XAV) |

#### Reproductions

| Parent | Enfant | Transféré (NEAR) |
|---|---|---|
| a-214953 | a-214957 | 0.1003 |
| a-214954 | a-214958 | 0.1068 |
| a-214954 | a-214959 | 0.1073 |
| a-214955 | a-214960 | 0.1000 |
| a-214954 | a-214961 | 0.1099 |
| a-214955 | a-214962 | 0.1001 |
| a-214953 | a-214963 | 0.1031 |
| a-214962 | a-214964 | 0.1003 |

#### Morts

| Agent | Cause | Solde final (NEAR) | Récupéré par le maître (NEAR) | Tx de clôture |
|---|---|---|---|---|
| a-214956 | starvation | 0.0299 | 0.0298 | [`5kiop5Wr…`](https://testnet.nearblocks.io/txns/5kiop5Wr14mGAM6tnhBqS59RU9Ra182FecAdLrV7eJsW) |
| a-214957 | starvation | 0.0251 | 0.0251 | [`GuRgxaaM…`](https://testnet.nearblocks.io/txns/GuRgxaaMF2hJuCDSmF758L6q5SBKhF8UTV8zjjVSXoo2) |
| a-214958 | starvation | 0.0266 | 0.0266 | [`913L6ii3…`](https://testnet.nearblocks.io/txns/913L6ii3mYYzH6htYE7hcb7SPFDaTgabxfi2zY6GmB4x) |
| a-214960 | starvation | 0.0299 | 0.0298 | [`AgTh3ywx…`](https://testnet.nearblocks.io/txns/AgTh3ywxJsWEaTu3R9iZVY3mtTMSQyysJuDk3SbF1eRq) |
| a-214959 | starvation | 0.0271 | 0.0271 | [`6bTdtkx5…`](https://testnet.nearblocks.io/txns/6bTdtkx57jwHgZFEYQitof2spYZpBfjwXRx1VK2NEZes) |
| a-214961 | starvation | 0.0298 | 0.0297 | [`CU8Mktmx…`](https://testnet.nearblocks.io/txns/CU8MktmxJ6i3TdqMRXKT5BGMs24tSm6hNTfryNNrkVXD) |
| a-214954 | starvation | 0.0280 | 0.0280 | [`GuMzUie1…`](https://testnet.nearblocks.io/txns/GuMzUie1EsoPfH6YLpb9j8QFsXCYJDDWTGc2wiGVaw5N) |

Inscription de la mort dans le registre du contrat (`mark_dead`) : [`6dKx1z2m…`](https://testnet.nearblocks.io/txns/6dKx1z2me78H6p21LjHM7Rv5FXq9WCRZKR77cRumZT7A), [`Bxwt2eT4…`](https://testnet.nearblocks.io/txns/Bxwt2eT41cs5E5mTREXYheLMFjgycsHE9KHh4Wjs5Kw6), [`FNWBBCiA…`](https://testnet.nearblocks.io/txns/FNWBBCiAnDWKLREfXPihES9vwH1un7zL6TcYWuXZo5J6), [`FmfuivNX…`](https://testnet.nearblocks.io/txns/FmfuivNXbb4w34HpbRroN46czKUD8ChrCRky768bAEA7), [`NMpvK2fm…`](https://testnet.nearblocks.io/txns/NMpvK2fmDZmHtFiXCnG4GtsiNE4x5stU7VGCtyY61JG), [`ETabqkHn…`](https://testnet.nearblocks.io/txns/ETabqkHnN6gHPzDKvikMEvuMkYDXTrd3CbREKhRWeQft), [`8VdAh54S…`](https://testnet.nearblocks.io/txns/8VdAh54SKWKAJD7zW8V7UBph6SrQxFNRUrucNvubDwA4).

#### Séquestres : 65 verrouillés, 63 libérés, 65 réputations écrites (5 premiers cycles listés)

| Tâche | Payeur | Bénéficiaire | Montant (NEAR) | Verrouillage | Libération | Réputation |
|---|---|---|---|---|---|---|
| t-8598118 | `sim-client` | `a-214953` | 0.0350 | [`EzS4KbN9…`](https://testnet.nearblocks.io/txns/EzS4KbN9h7qpWPPfhMMpAMaRG8fm4vGcaUTQ7wtRpnaL) | [`6SbUjask…`](https://testnet.nearblocks.io/txns/6SbUjaskGV6DieSiN4yidg1m2j8XWiDGLKj8r6dsfep) | [`DTWbUAgx…`](https://testnet.nearblocks.io/txns/DTWbUAgxgcCARnJrMGHDgbcEyrMqn2tbRrb3K2HYMyWv) |
| t-8598119 | `sim-client` | `a-214955` | 0.0145 | [`2zCXBhp4…`](https://testnet.nearblocks.io/txns/2zCXBhp4atraaak8ERBDyBvbvSGcy7j2VLP8SRiycPfw) | [`6U2thqDn…`](https://testnet.nearblocks.io/txns/6U2thqDninPYsx9EYH2w7Hxnqi8wurE8f9SpsBpVRTa9) | [`EJ6aA6aS…`](https://testnet.nearblocks.io/txns/EJ6aA6aSSn3f1XMoy93Kars6hKLScDTfBVVPDGzc8eqY) |
| t-8598120 | `sim-client` | `a-214953` | 0.0276 | [`7CCk4JRr…`](https://testnet.nearblocks.io/txns/7CCk4JRrmkAFwkSazsUTKPNBQv6yncn3Hw7iMpY3Wrxb) | [`2s2ZW8ph…`](https://testnet.nearblocks.io/txns/2s2ZW8phBFNNEbBAQBAPpkqESH56U6x61yrHverFWTM8) | [`CzCYGCCU…`](https://testnet.nearblocks.io/txns/CzCYGCCU5Ei52HYbYWmqFNemkCpybJVHuPXuftC5eiEa) |
| t-8598121 | `sim-client` | `a-214954` | 0.0270 | [`6jU7KaNg…`](https://testnet.nearblocks.io/txns/6jU7KaNgZJKsmejG7nDQruREAZD6WxDkrhWJqJeB3rCh) | [`6ZUh1kz5…`](https://testnet.nearblocks.io/txns/6ZUh1kz53kQxb6o7nzKPszk7dVTZE6BemoJiWWriAG4e) | [`AnXvewvS…`](https://testnet.nearblocks.io/txns/AnXvewvSddBWZ3zy8XZWApKHhC6k1TdU3ZkPYDqvCuhR) |
| t-8598122 | `sim-client` | `a-214954` | 0.0266 | [`9riEr2Rq…`](https://testnet.nearblocks.io/txns/9riEr2Rqefu7D4D3DqF3dN2ziWyCPLt3xAAM8v221B61) | [`WvMW9Ut3…`](https://testnet.nearblocks.io/txns/WvMW9Ut3riXhRpABYFyaynotjvrCtVJjvyn5AjLu5co) | [`BsnhjCRd…`](https://testnet.nearblocks.io/txns/BsnhjCRd9z4Ms55BrbJmkrK65Zxs95y5awtV4E8w7bZb) |

#### Cerveau (débits dans ce journal)

138 appels facturés aux agents (0 mock), coût réel cumulé 0.01490 USD. Par modèle : Qwen/Qwen3.6-35B-A3B-FP8 ×43, gemini-2.5-flash-lite ×65, deepseek-ai/DeepSeek-V4.1-Flash-1017 ×30.


### Run 7 (historique : génération 3 non atteinte)

**Objectif** : atteindre la génération 3 dans un même run réel (testnet, séquestre dans le contrat, cerveau NEAR AI réel).
**Résultat (2026-11-10, run 7, 20:43 à 21:03 UTC, arrêté au bout de 15 minutes de fenêtre)** : **génération 3 NON atteinte**. Génération maximale : 2 ; 3 fondateurs + 5 enfants vivants (8 agents), 5 reproductions, 5 lettres parent vers enfant, **0 mort**. Simulation mise en pause (`POST /api/sim/pause`, tick 26) puis processus arrêté ; journal sauvegardé dans `docs/preuves/run7-journal.jsonl`.

Réglages : `DARWIN_PRESET=demo` (testnet), `DARWIN_TICK_MS=10000`, `DARWIN_BIRTH_CAPITAL=0.1`, `DARWIN_METABOLISM=0.002`, `DARWIN_MIN_VITAL=0.02`, `DARWIN_REPRO_COOLDOWN_TICKS=5`, `DARWIN_SIM_CLIENT_RATE=1.5`, `DARWIN_MAX_POPULATION=14`, ids décalés (`DARWIN_AGENT_SEQ_START=700`, `DARWIN_TASK_SEQ_START=5000`), Node 22.23.4.

**Pourquoi pas de génération 3** : le rythme réel est d'environ un tick par minute (chaque tick enchaîne des transactions et des appels IA). En 26 ticks, aucun enfant de génération 2 n'a atteint son seuil de reproduction (capital de naissance x gène `reproThreshold`). Cette hypothèse n'est pas démontrée par un test ; la suite est dans `docs/PLAN.md` (L15).

**Remboursement réel prouvé (`refund_escrow`)** : la tâche `t-5003` (agent `a-0703`) a été rejetée par le juge (`verdict: rejected`, score 0,2). Verrouillage [`8KNATwXk…`](https://testnet.nearblocks.io/txns/8KNATwXkb7DMhdn3FSYQ6XPBMmBsXsHHnr51zPc8MX5q), remboursement [`5RbxQANe…`](https://testnet.nearblocks.io/txns/5RbxQANeUc8NctcpjKozbVUKZ1EFfMJVgkF9f67ipEup), malus de réputation −2 [`4NXru7ab…`](https://testnet.nearblocks.io/txns/4NXru7abTEqc9sFwyWVbSFcZ6V22r6nWvJMDwqPzYFmV). Lecture du contrat : `get_escrow t-5003` = `status: refunded`, `refund_reason: rejected`.

**État de la chaîne à la fin du run** : `agents_count` = 36 agents enregistrés dans le contrat (cumul de tous les runs) ; solde du compte maître 3,82 NEAR (10 NEAR reçus au départ).

**Consommation IA cumulée à la fin** (journal local) : 0,0191 USD dépensés selon `data/ai-budget.json`, contre un plafond d'arrêt de 8 EUR.

Journal : `docs/preuves/run7-journal.jsonl` (810 événements, du 2026-11-10T20:43:48.543Z au 2026-11-10T21:03:34.590Z).

Génération maximale née : **2** ; naissances : 8 ; reproductions : 5 ; lettres : 5 ; morts : 0.
Transactions par type : create_account 8, register_agent 8, transfer 61, escrow_lock 26, escrow_release 25, add_reputation 26, escrow_refund 1.

#### Naissances

| Agent | Génération | Parent | Compte | Tx de création |
|---|---|---|---|---|
| a-0701 | 1 | — | `a-0701.darwin-master-7k2.testnet` | [`A7LHeDPo…`](https://testnet.nearblocks.io/txns/A7LHeDPoy8HtvXaEAsbnFeym85AzKvKbCLaUXhMcWX3h) |
| a-0702 | 1 | — | `a-0702.darwin-master-7k2.testnet` | [`2vaSihU9…`](https://testnet.nearblocks.io/txns/2vaSihU9t6J5QMwaynS3hvyf8XfKZaUKiAnCRUY7LaFi) |
| a-0703 | 1 | — | `a-0703.darwin-master-7k2.testnet` | [`3V9exHsF…`](https://testnet.nearblocks.io/txns/3V9exHsFjTZ3agBbnS2pCLqKQZXvSe8nq7KiTiRQKXcm) |
| a-0704 | 2 | a-0702 | `a-0704.darwin-master-7k2.testnet` | [`2oPY9usQ…`](https://testnet.nearblocks.io/txns/2oPY9usQE8LsGwZHyVCfhJFTjrR8ZHPXkFSnMnx42zQ9) |
| a-0705 | 2 | a-0701 | `a-0705.darwin-master-7k2.testnet` | [`2RjTFEq7…`](https://testnet.nearblocks.io/txns/2RjTFEq7EvXUQAsaPULKeodEYcZLpQgaXbocfMubSQHt) |
| a-0706 | 2 | a-0702 | `a-0706.darwin-master-7k2.testnet` | [`3adcr2hg…`](https://testnet.nearblocks.io/txns/3adcr2hgVUkHKFHorwJ29ADXbDL2mpzbggF5kSfi31Vp) |
| a-0707 | 2 | a-0703 | `a-0707.darwin-master-7k2.testnet` | [`EV69x1kS…`](https://testnet.nearblocks.io/txns/EV69x1kS8GwLRKhKtUbtiEfJtrdgvif9HYHgVMyc7tvr) |
| a-0708 | 2 | a-0703 | `a-0708.darwin-master-7k2.testnet` | [`5mLLSEgC…`](https://testnet.nearblocks.io/txns/5mLLSEgC3mTPQbaHV4UkGtrqNJzjgkTSHrYsqfqH1btW) |

#### Reproductions

| Parent | Enfant | Transféré (NEAR) |
|---|---|---|
| a-0702 | a-0704 | 0.1027 |
| a-0701 | a-0705 | 0.1005 |
| a-0702 | a-0706 | 0.1035 |
| a-0703 | a-0707 | 0.1009 |
| a-0703 | a-0708 | 0.1017 |

#### Séquestres : 26 verrouillés, 25 libérés, 26 réputations écrites (3 premiers cycles listés)

| Tâche | Payeur | Bénéficiaire | Montant (NEAR) | Verrouillage | Libération | Réputation |
|---|---|---|---|---|---|---|
| t-5001 | `sim-client` | `a-0702` | 0.0199 | [`AGMstD9K…`](https://testnet.nearblocks.io/txns/AGMstD9KzmNhTUwoo3w59485NMvJzjHcwNutXWwSZ1UX) | [`HcSEPi6d…`](https://testnet.nearblocks.io/txns/HcSEPi6dXYeRvbpwaHyCHJAtrNyDtNiUxEcJzxToiRds) | [`2tfENQtg…`](https://testnet.nearblocks.io/txns/2tfENQtgtMvR5AitcboFYHp1LCh2GY46uNf6LMUxS13x) |
| t-5002 | `sim-client` | `a-0701` | 0.0460 | [`GWNdqhDu…`](https://testnet.nearblocks.io/txns/GWNdqhDuLjY1UE1AWNMn6ukbj3XEGu9XCJMaUAHf4j4f) | [`DiRbujfK…`](https://testnet.nearblocks.io/txns/DiRbujfK3iKczzjSgs8gihgXnmcL7dgX7k1s4eo9GqwK) | [`BeS3JUiK…`](https://testnet.nearblocks.io/txns/BeS3JUiKoeFNuHkimi5FcmsDh368k7czex7sfwD1x6uh) |
| t-5004 | `sim-client` | `a-0701` | 0.0348 | [`76WsmmRJ…`](https://testnet.nearblocks.io/txns/76WsmmRJJJEYuXhbGRqYZbKFRgRrWGGTUE2LzLn1jnkM) | [`AuMdjhZF…`](https://testnet.nearblocks.io/txns/AuMdjhZFcmET4cToKo7gFcPpZVAPJssjsbPy8qQoyjMN) | [`8LA1yaQD…`](https://testnet.nearblocks.io/txns/8LA1yaQDne6NzWH5QEhLHHbxbnHGrTft4YK1GwKYSvV3) |

#### Cerveau (débits dans ce journal)

31 appels facturés aux agents (0 mock), coût réel cumulé 0.00545 USD. Par modèle : Qwen/Qwen3.6-35B-A3B-FP8 ×18, deepseek-ai/DeepSeek-V4.1-Flash-1017 ×13.


## 9. Incidents rencontrés (utiles pour la suite)

| Run | Constat | Cause | Correctif |
|---|---|---|---|
| 1 | arrêt au tick 11 | RPC public fastnear : HTTP 429 | ticks plus lents |
| 2 | arrêt au tick 2 | `rpc.testnet.near.org` répond 429 « deprecated » | retour à fastnear |
| 3 | séquestres refusés | ids de tâches `t-0001…` déjà dans le contrat (panique du contrat sur `ESCROW_EXISTS`) | `DARWIN_TASK_SEQ_START` |
| 3 | `ESCROW_LOCK_FAILED` | compte `sim-client` sous-financé (prix sans gaz ni réserve de stockage) | marge de financement 0,2 NEAR (`fundingMargin`) |
| 4 | arrêt au tick 18 | 429 | réessais à délai croissant (`accounts/near-backend.ts`) |
| 5 | pas d'arrêt, génération 2 lente | gains 0,02 à 0,08 NEAR contre 0,004 de métabolisme par tick | économie réglée par variables d'environnement |
| 6 | pas d'arrêt, plus de naissance | population plafonnée à 8 par le preset demo | `DARWIN_MAX_POPULATION=14` |
| tous | collision d'ids au redémarrage | comptes et registre du contrat persistent | `DARWIN_AGENT_SEQ_START` ; **depuis le run 8, décalage automatique** (horloge) |
| 5 à 7 | `FC_KEY_NOT_ADDED` | clé limitée ajoutée après coup, le RPC ne voyait pas encore la clé du nouveau compte | clé ajoutée dans la transaction de création (run 8 : 0 échec) |
| 5 à 7 | `JUDGE_COST_UNKNOWN` | préfixe du modèle servi différent de l'identifiant du catalogue | prix cherché sur l'identifiant demandé (run 8 : 0) |

Réglages du run 8 : `DARWIN_PRESET=selection` seul. Réglages des runs 6 et 7 : `DARWIN_PRESET=demo`, `DARWIN_TICK_MS=10000`, `DARWIN_BIRTH_CAPITAL=0.1`, `DARWIN_METABOLISM=0.002`, `DARWIN_MIN_VITAL=0.02`, `DARWIN_REPRO_COOLDOWN_TICKS=5`, `DARWIN_SIM_CLIENT_RATE=1.5`, `DARWIN_MAX_POPULATION=14` (run 7 seulement), Node 22.23.4, RPC `https://test.rpc.fastnear.com`.

## 10. Validation du logo par un appel NEAR AI réel (L17, piste C)

Date : 2026-11-11 (22:32 UTC). **Un seul appel réel** (aucun second), `npm run ai:logo-validation` (`brain/tools/logo-validation.ts`). Chemin de code réel : `executeMessages` (consignes du catalogue `logo`), `max_tokens` = `max(sim.maxTokensPerCall, CATALOGUE.logo.maxOutputTokens)` = 3000 comme `engine/index.ts`, garde-fous et budget du `NearAiBrain`, puis `extractDeliverable` et `runChecks` du marché. Brief : « Logo pour Atelier Lumio » (entreprise fictive, secteur luminaires, style chaleureux et minimal). Modèle : `Qwen/Qwen3.6-35B-A3B-FP8` (liste blanche, prix du catalogue en direct, `verified=true` : 0,17 USD/M en entrée, 1,10 USD/M en sortie). Pire cas calculé avant l'appel : 0,00339 USD pour un plafond par appel de 0,05 USD.

| Contrôle | Résultat |
|---|---|
| `finish_reason` | `stop` (pas `length`) ; `max_tokens` envoyé : 3000 |
| Tokens (`usage`) | prompt 424, completion 788 (dont raisonnement 0), total 1212 |
| Coût | 0,000939 USD (environ 0,00085 EUR à 1,10), soit 0,3 % du plafond par appel ; cumul du budget IA après l'appel : 0,0412 USD |
| Blocs ```svg | 3 exactement (408, 416 et 491 caractères) |
| Parseur XML (Python `xml.etree`, indépendant du code du dépôt) | 3 documents bien formés, racine `svg` avec xmlns, `viewBox="0 0 256 256"`, 5 éléments chacun |
| Contenu actif | aucun script, foreignObject, image, `on*=`, href ou `url()` externe (contrôle par regex indépendant et par `sanitizeSvg`) |
| `extractDeliverable` et `runChecks` (règle `rule:logo`) | acceptés : 3 SVG distincts, aucune marque de `BRANDS_TO_AVOID` |
| Troncature due au plafond de coût | non : 788 tokens produits pour 3000 autorisés, plafond de coût jamais atteint |

**Verdict : VALIDÉ** pour le chemin production + extraction + contrôles déterministes. Cause de la troncature du run 9b : `max_tokens` plafonné à 300 dans le preset `selection` des journaux 9a/9b (400 dans le preset normal ; `maxTokensPerCall`) pour un livrable de 3 SVG ; corrigée par le plafond dur `maxTokensHardCap` (commit 7cb869d), confirmée ici (788 tokens suffisent, marge de 3,8 fois). Aucune correction supplémentaire n'a été nécessaire.

Réserves : (1) un seul échantillon, un seul modèle ; un modèle plus bavard ou à raisonnement peut consommer davantage (les modèles à raisonnement de la liste blanche sont bridés par `extraBody`). (2) Qualité modeste : le texte entre blocs reprend le gabarit littéral « Idee du logo » au lieu d'une phrase d'idée, sans effet sur l'extraction. (3) Le juge IA (grille d'originalité, pertinence) n'a pas été appelé ici : seuls les contrôles déterministes sont validés. (4) Les prix de ce modèle sont ceux du catalogue du jour, pas une valeur figée.

Fichiers : `docs/preuves/logo-validation/` (`reponse-brute.txt` réponse brute du modèle, `logo-1.svg` à `logo-3.svg` extraits, `meta.json` usage/coût/`finish_reason`/identifiant de réponse). Ni clé ni en-tête d'autorisation ne sont écrits. Test sans réseau : `brain/l17-logo.test.ts` rejoue cette réponse réelle dans l'extraction et les contrôles.

## 11. Runs 9a et 9b : commandes de logo, tous rejetés par le contrôle de format (résumé factuel des journaux)

Date : 2026-11-11 (UTC), testnet NEAR, `mode=testnet`, `preset=selection` (version de l'époque), `chain=near`, `brain=nearai`, graine 42. Sources : `docs/preuves/run9a-journal.jsonl` (270 événements, 00:49:30 à 00:54:39 UTC, 14 ticks) et `docs/preuves/run9b-journal.jsonl` (377 événements, 00:56:41 à 01:03:51 UTC, 19 ticks). Ce résumé ne reprend que ce qui est lisible dans ces deux journaux. Les deux runs se sont arrêtés par **extinction** (`sim.stopped`, `reason: extinction`, `generations: 1`) : aucune naissance au-delà des fondateurs (4 en 9a, 6 en 9b), aucune génération 2. Ils ne contredisent ni n'améliorent le run 8 (§8).

| | Run 9a | Run 9b |
|---|---|---|
| Fondateurs, morts | 4, 4 morts (tick 14) | 6, 6 morts (ticks 14, 14, 14, 14, 17, 19) |
| Verdicts de validation | **7 rejetés** (`rule:logo`), 0 accepté | **2 acceptés** (`brain:gemini-2.5-flash-lite`, textes marketing et traduction, payeur : client simulé), **7 rejetés** (6 `rule:logo`, 1 `rule:architecture`) |
| Séquestres | 7 verrouillés, **7 remboursés**, 0 libéré | 9 verrouillés, 2 libérés, 7 remboursés |
| Commandes de logo « visiteur » (`visitors.darwin-master-7k2.testnet`) | 3 publiées : 1 rejetée puis remboursée (`t-8669702`, verrouillage `9SGVgFKxwV4bsRE82oRToib4j7eFZKMtWh1pyR4EKFYR`, remboursement `A8jjAF4B9zp9ogPtPmbeNQcxgNAFYGgU2B12q2ngUEzX`), **2 expirées sans offre** (`t-8669704`, `t-8669719`) | 1 publiée, rejetée puis remboursée (`t-8674013`, verrouillage `AMQEHEDN96FtFpupFJKrcYvMZckdGiq99UDHhkDUQVBP`, remboursement `BkQM1xYYcxzbP5KaEEivwDN1ea2XsoeZmVTEPBLTFj9f`) ; une commande de rédaction d'un post LinkedIn par un visiteur (`t-8674030`) a expiré sans offre |
| Motif du rejet des logos | « exactement 3 blocs ```svg attendus, 0 trouvé(s) » (parfois 1) | idem |
| Appels IA débités (`brain.charged`) | 7, tous de production, 300 tokens de sortie chacun, total 0,00285 USD (comptabilité locale) | 11 (9 de production, 2 de validation), total 0,00333 USD (comptabilité locale) |

À retenir :
- **Aucun logo n'a été livré, accepté ni payé sur testnet** dans ces deux runs. Les seuls paiements du run 9b (2 séquestres libérés, `t-8674011` et `t-8674012`) concernent des livrables texte commandés par le **client simulé**, pas par un visiteur.
- La commande de logo d'un visiteur du run 9b (`t-8674013`) a bien suivi le chemin : verrouillage depuis `visitors.<maître>`, rejet par la règle de format, remboursement par le contrat. C'est la preuve d'un cas refusé réel, pas d'un cas réussi.
- Cause du rejet : la sortie du modèle était tronquée et ne contenait pas les 3 blocs SVG attendus. Le §10 l'attribue à un plafond de tokens de sortie trop bas, corrigé ensuite (commit `7cb869d`) puis validé par un appel réel isolé (§10). **Nuance** : le §10 cite un plafond de 400 ; dans ces journaux chaque appel de production s'arrête à exactement 300 tokens de sortie (valeur du preset `selection` de l'époque). Le plafond a été relevé depuis ; il n'a pas été rejoué dans un run complet.
- Enchères : 7 (`bid.placed`) en 9a et 9 en 9b, très peu face aux 92 du run 8 ; les deux runs se sont éteints en génération 1 (extinction), schéma que `docs/RUN_9C.md` §0 et §4 demande de surveiller. Écart de comptage avec `docs/RUN_9C.md` §0 : `docs/RUN_9C.md` §0 donnait une version antérieure à 6 fondateurs pour 9a ; `run9a-journal.jsonl` n'en contient que 4 (`agent.born` : 4, `agent.died` : 4), comme le tableau ci-dessus ; les journaux font foi.
- Vérifiable : `https://testnet.nearblocks.io/txns/<hash>` avec les hashes ci-dessus ; les hashes complets des autres événements sont dans les journaux.

## 12. Empreintes sha256 des journaux de preuve

Le bandeau « run réel testnet » de l'interface se déduit du champ `chain` du journal lui-même : un journal modifié à la main serait étiqueté « réel ». Ces empreintes permettent de vérifier qu'un fichier est identique à celui publié (la seule preuve des transactions reste leur hash sur `testnet.nearblocks.io`). Calculées sur les fichiers du dépôt à la date du 2026-11-12.

| Fichier | sha256 |
|---|---|
| `docs/preuves/run5-journal.jsonl` | `7b2218013c9a59eaf6c4a137438023f3edf1263f5fe4c1011fde7e78df367cef` |
| `docs/preuves/run6-journal.jsonl` | `4acc398b036ab7da18680533dfe58e5ec6aeafb9e6d4232daae8a486100be84f` |
| `docs/preuves/run7-journal.jsonl` | `af255a9f0a037baba87b24cbb5be04f318144f0ec459ffcd50d9989d3214c486` |
| `docs/preuves/run8-journal.jsonl` | `9647d982663bc2493a2ecf562d17837ef7ad1d32b9169bbf704afcedf3ba2110` |
| `docs/preuves/run9a-journal.jsonl` | `b82aa257e853b076a01501c92b40319b6a4503a3f5977cb6998a94ff0a6628fb` |
| `docs/preuves/run9b-journal.jsonl` | `fdb06603b6571207bcf11fc2b175826c798d85a61906829c83efdaffaf7dbf69` |

Vérification (depuis la racine du dépôt) :

```bash
sha256sum docs/preuves/*.jsonl          # Linux, macOS, Git Bash
# PowerShell : Get-FileHash -Algorithm SHA256 docs/preuves/*.jsonl
```

Les valeurs doivent être identiques à celles du tableau. Une conversion de fins de ligne au checkout (`core.autocrlf`) change l'empreinte : cloner avec `git -c core.autocrlf=false clone ...` en cas de doute.
