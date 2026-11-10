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

{{RUN6}}

### Run 5 (résumé)

{{RUN5}}

## 5. Séquestres et réputation

Le tableau « Séquestres » du run 6 donne, pour chaque tâche, la transaction de verrouillage (`lock_escrow`, dépôt attaché par le payeur), de libération (`release_escrow` avec preuve) et d'écriture de réputation (`add_reputation`). Les 26 cycles du run 6 et les 30 du run 5 sont complets (verrouillé, libéré, réputation) dans les journaux. Le payeur est le compte `sim-client` : client **simulé**, étiqueté, financé depuis le compte maître. Aucune tâche d'un visiteur humain n'a été exécutée en réel.

## 6. NEAR AI Cloud : consommation réelle

Source : `data/ai-usage.jsonl` (une ligne par appel réel : tokens `usage` x prix de `GET /v1/model/list`), tableau régénéré par `npm run ai:usage-report -- --dir data`. Ce journal est local (ignoré par git) ; le tableau ci-dessous en est la copie datée.

{{USAGE}}

- Plafond global : arrêt propre à 8 EUR (`DARWIN_AI_BUDGET_EUR_STOP`), budget total 10 EUR. **Le plafond n'a jamais été approché.**
- Ces chiffres sont notre **comptabilité locale** : la facture réelle de la plateforme n'a pas été relue sur cloud.near.ai, à vérifier par l'humain.
- Les appels du juge (`validate`, modèle `google/gemini-2.5-flash-lite`, agent `treasury`) sont comptés dans le budget global mais **non débités aux agents** (avertissement `JUDGE_COST_UNKNOWN`) : bug connu.

## 7. Attestation TEE

Exécutée le 2026-11-10 sur `z-ai/glm-5.3-flash` : 20 contrôles PASS, 0 FAIL, 0 SKIP (quote Intel TDX de la passerelle et du modèle, statut TCB `UpToDate`, preuve GPU NVIDIA NRAS vraie, signature ECDSA de la réponse valide ; test négatif : un octet ajouté fait échouer la vérification). Id de réponse attestée : `1c1ea6068280496f8ef8d050c98dbe6d`, signataire `0x3b753b4406613c5e70ae640508632b600424fa0c`. Commande : `npm run ai:verify-attestation -- --model z-ai/glm-5.3-flash --save-evidence data/attestation-glm`, puis `-- --offline data/attestation-glm`. Méthode et **limites** (un seul modèle ; pas d'attestation par appel de la simulation ; pas de liaison TLS ; pas d'allowlist de mesures) : `docs/ATTESTATION_TEE.md`.

## 8. Run final

{{FINAL}}

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
