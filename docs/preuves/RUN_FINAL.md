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
