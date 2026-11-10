# PREUVES TESTNET — ce qui a réellement tourné

> Mis à jour le 2026-11-10. Règle : seul ce qui figure ici avec un identifiant de transaction, un journal ou une commande reproductible est **prouvé**. Le reste est dit non prouvé. Explorateur : `https://testnet.nearblocks.io/txns/<hash>` (nearblocks, testnet). Aucune dépense mainnet, rien n'est publié. Ce fichier est généré à partir de `docs/preuves/PREUVES_TEMPLATE.md` et des journaux par `node scripts/assemble-preuves.mjs`.

## 1. Résumé honnête

| Élément | État |
|---|---|
| Compte maître testnet créé avec le CLI officiel (`sponsor-by-faucet-service`) | **Prouvé** (§2) |
| Contrat Rust déployé et initialisé sur testnet | **Prouvé** (§3) |
| Séquestres verrouillés puis libérés par le contrat, avec preuve, et réputation écrite | **Prouvé** (§5) |
| Cerveau réel NEAR AI Cloud, consommation tracée | **Prouvé** (§6) |
| Attestation TEE d'une réponse, vérifiée de bout en bout | **Prouvé pour un modèle, à la demande** (§7) |
| Génération 2 sur la vraie chaîne (5 reproductions et 5 lettres dans un seul run) | **Prouvé** (§4) |
| Génération 3 dans un même run réel | **Non prouvé** : run final de 20 minutes, génération 2 seulement (§8) |
| Mort d'un agent sur testnet | **Non prouvé** (0 mort dans les journaux) |
| `refund_escrow` sur testnet | **Prouvé une fois** : tâche `t-5003` rejetée par le juge, remboursement `rejected` par le contrat, malus de réputation −2 (§8) |
| Clés function call des agents | **Échec** : avertissement `FC_KEY_NOT_ADDED` à chaque naissance |
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

Plusieurs runs réels ont eu lieu le 2026-11-10 ; les ids d'agents changent à chaque run (`a-0101…`, `a-0201…`, …, `a-0701…`). Journaux conservés : `docs/preuves/run5-journal.jsonl` et `docs/preuves/run6-journal.jsonl` (événements Darwin, hashes de transactions publics, aucun secret). Tableaux générés par `node scripts/gen-preuves.mjs <journal>`.

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

Journal : `data/ai-usage.jsonl` (212 appels, du 2026-11-10T19:23:44.380Z au 2026-11-10T21:02:47.837Z). Coût = tokens `usage` x prix du catalogue `GET /v1/model/list` ; EUR = USD / 1.1 (taux configuré `DARWIN_EUR_USD_RATE`, prudent).

| Total | Valeur |
|---|---|
| Appels | 212 |
| Tokens d'entrée | 27609 |
| Tokens de sortie | 15938 (dont raisonnement 4735) |
| Coût USD | 0.019142 |
| Coût EUR | 0.017402 |
| Plafond d'arrêt / budget total | 8 EUR / 10 EUR |

##### Par modèle

| Modèle | Fournisseur | Appels | Tokens in | Tokens out | USD | EUR |
|---|---|---|---|---|---|---|
| deepseek-ai/DeepSeek-V4.1-Flash-1017 | nearai | 34 | 3195 | 6593 | 0.008870 | 0.008064 |
| Qwen/Qwen3.6-35B-A3B-FP8 | nearai | 76 | 5957 | 5189 | 0.006723 | 0.006112 |
| google/gemini-2.5-flash-lite | nearai | 96 | 18308 | 3815 | 0.003357 | 0.003052 |
| gpt-5-nano-2025-08-07 | nearai | 1 | 15 | 200 | 0.000081 | 0.000073 |
| Qwen/Qwen3.8-27B | nearai | 1 | 61 | 38 | 0.000054 | 0.000049 |
| z-ai/glm-5.3-flash | nearai | 2 | 41 | 98 | 0.000052 | 0.000048 |
| claude-haiku-5-5 | nearai | 1 | 23 | 4 | 0.000004 | 0.000004 |
| gemini-2.5-flash-lite | nearai | 1 | 9 | 1 | 0.000001 | 0.000001 |

##### 15 derniers appels

| Horodatage (UTC) | Modèle | In | Out | USD | Agent | Usage | Id de réponse |
|---|---|---|---|---|---|---|---|
| 2026-11-10T20:56:15.853Z | google/gemini-2.5-flash-lite | 218 | 40 | 0.000038 | treasury | validate | `gemini-dcaa9127-e896-4c68-8492-bf1ae97cb01f` |
| 2026-11-10T20:56:37.528Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 143 | 300 | 0.000403 | a-0703 | letter | `chatcmpl-9985737c-9f16-44de-a29e-78362181a5ac` |
| 2026-11-10T20:56:59.783Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 273 | 0.000354 | a-0703 | execute_task | `chatcmpl-8766904b-de23-4f1e-be62-3d6dccd42049` |
| 2026-11-10T20:57:00.602Z | google/gemini-2.5-flash-lite | 221 | 40 | 0.000038 | treasury | validate | `gemini-120ab369-e5bf-485f-aeca-9d8fdfb792e6` |
| 2026-11-10T20:57:51.088Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 158 | 0.000216 | a-0703 | execute_task | `chatcmpl-fea9b1d8-eaa7-4f94-81ba-8b94fc8dedb6` |
| 2026-11-10T20:57:51.905Z | google/gemini-2.5-flash-lite | 219 | 40 | 0.000038 | treasury | validate | `gemini-d1da31bc-eac7-4705-a77c-9aa82470af1a` |
| 2026-11-10T20:58:02.768Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 229 | 0.000301 | a-0703 | execute_task | `chatcmpl-216e7562-26ec-43c7-8335-77944aabe943` |
| 2026-11-10T20:58:03.682Z | google/gemini-2.5-flash-lite | 217 | 38 | 0.000037 | treasury | validate | `gemini-5b185a1d-6b73-48bd-82fe-e60d6b7d9e90` |
| 2026-11-10T20:59:52.025Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 88 | 202 | 0.000269 | a-0703 | execute_task | `chatcmpl-eb506b0a-ef7e-4f26-817d-b3e480391045` |
| 2026-11-10T20:59:52.692Z | google/gemini-2.5-flash-lite | 208 | 40 | 0.000037 | treasury | validate | `gemini-2e081f3b-1f8e-4dec-86c2-8c8a87628ba9` |
| 2026-11-10T21:00:00.211Z | Qwen/Qwen3.6-35B-A3B-FP8 | 74 | 80 | 0.000101 | a-0705 | execute_task | `183219e65a794da099ba8d2cc887755f` |
| 2026-11-10T21:00:01.029Z | google/gemini-2.5-flash-lite | 221 | 52 | 0.000043 | treasury | validate | `gemini-b8fd94d3-d7a9-4df9-853d-5249d00805ee` |
| 2026-11-10T21:00:51.719Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 145 | 300 | 0.000403 | a-0703 | letter | `chatcmpl-ad3a5636-54b0-4b45-af46-084c88fd0bf5` |
| 2026-11-10T21:02:46.945Z | deepseek-ai/DeepSeek-V4.1-Flash-1017 | 95 | 67 | 0.000109 | a-0708 | execute_task | `chatcmpl-8a59f976-86d0-4378-be36-48a320c94c42` |
| 2026-11-10T21:02:47.837Z | google/gemini-2.5-flash-lite | 152 | 25 | 0.000025 | treasury | validate | `gemini-714a436c-a481-4256-9d97-f3736a366115` |



- Plafond global : arrêt propre à 8 EUR (`DARWIN_AI_BUDGET_EUR_STOP`), budget total 10 EUR. **Le plafond n'a jamais été approché.**
- Ces chiffres sont notre **comptabilité locale** : la facture réelle de la plateforme n'a pas été relue sur cloud.near.ai, à vérifier par l'humain.
- Les appels du juge (`validate`, modèle `google/gemini-2.5-flash-lite`, agent `treasury`) sont comptés dans le budget global mais **non débités aux agents** (avertissement `JUDGE_COST_UNKNOWN`) : bug connu.

## 7. Attestation TEE

Exécutée le 2026-11-10 sur `z-ai/glm-5.3-flash` : 20 contrôles PASS, 0 FAIL, 0 SKIP (quote Intel TDX de la passerelle et du modèle, statut TCB `UpToDate`, preuve GPU NVIDIA NRAS vraie, signature ECDSA de la réponse valide ; test négatif : un octet ajouté fait échouer la vérification). Id de réponse attestée : `1c1ea6068280496f8ef8d050c98dbe6d`, signataire `0x3b753b4406613c5e70ae640508632b600424fa0c`. Commande : `npm run ai:verify-attestation -- --model z-ai/glm-5.3-flash --save-evidence data/attestation-glm`, puis `-- --offline data/attestation-glm`. Méthode et **limites** (un seul modèle ; pas d'attestation par appel de la simulation ; pas de liaison TLS ; pas d'allowlist de mesures) : `docs/ATTESTATION_TEE.md`.

## 8. Run final

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
| tous | collision d'ids au redémarrage | comptes et registre du contrat persistent | `DARWIN_AGENT_SEQ_START` |

Réglages des runs 6 et 7 : `DARWIN_PRESET=demo`, `DARWIN_TICK_MS=10000`, `DARWIN_BIRTH_CAPITAL=0.1`, `DARWIN_METABOLISM=0.002`, `DARWIN_MIN_VITAL=0.02`, `DARWIN_REPRO_COOLDOWN_TICKS=5`, `DARWIN_SIM_CLIENT_RATE=1.5`, `DARWIN_MAX_POPULATION=14` (run 7 seulement), Node 22.23.4, RPC `https://test.rpc.fastnear.com`.
