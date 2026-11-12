# engine/ : moteur d'évolution (lot L4)

`createEngine(deps, market, options?) : Engine` (interface `shared/modules.ts`). Il ne dépend que des interfaces `Chain`, `Brain`, `Market`, du journal et du `Rng` injectés (aucun import de `accounts/` ou `brain/`, aucun `process.env`).

| Fichier | Rôle |
|---|---|
| `index.ts` | boucle de tick (ARCHITECTURE §13), start/pause/resume/stop, `getState` |
| `genome.ts` | fondateurs, mutation (bornes de `GENOME_BOUNDS`, rapport gène -> [avant, après]) |
| `lifecycle.ts` | naissance (sous-compte + registre), reproduction, lettre parent -> enfant, mort |
| `economy.ts` | débits (métabolisme, coût IA via `costYocto`), règlement groupé, synchronisation des soldes |
| `policy.ts` | décisions d'un agent : enchère (son métier seulement, jamais sous le prix plancher du métier), risque, sous-traitance |
| `stub-market.ts` | `Market` minimal pour les tests (l'implémentation réelle est dans `market/`, L6) |

## Règles de comportement
- **Métabolisme** débité à chaque tick vers le compte maître. **Coût IA** débité au solde de l'agent (`brain.charged`, D-013/D-020) ; modèle non vérifié : repli sur le modèle par défaut avec `system.warning`, jamais de coût nul.
- **Enchère** : un agent libre de la bonne profession demande `askRatio x budget`, plancher = coût IA estimé x 1,1 ; il s'abstient si son solde après coût passe sous `minVital x (1 + 2(1 - risque))` (le gène de risque règle cette réserve).
- **Exécution** dans le tick de l'attribution : appel `Brain`, débit, `Market.submitResult`. Le moteur ne crédite jamais un solde : les gains sont lus dans `escrow.released` (journal) et dans le solde on-chain.
- **Sous-traitance** : avec probabilité `cooperation/2`, tâche fille (25 % du prix, `requester: agent`). Simplification : le parent n'attend pas le résultat de la tâche fille.
- **Reproduction** : solde >= `reproThreshold x birthCapital`, population < max, délai écoulé (aussi après la naissance), et le parent doit garder >= 2 x `minVital`. Capital de l'enfant = `birthCapital + generosity x surplus` (plafonné). Ordre des événements : `agent.born`, `agent.reproduced`, `letter.written` (lettre écrite par le cerveau du parent, coût débité au parent ; repli étiqueté si le cerveau échoue).
- **Mort** : solde logique < `minVital` -> dettes réglées, `markAgentDead`, `closeAccount` vers le maître, `agent.died`. Plus de vivant : `sim.stopped(extinction)`. La lignée reste dans le registre et dans `getState().agents`.
- **Solde logique et gaz (R4)** : solde logique = solde on-chain relu à chaque tick moins les dettes en attente (`settleEveryTicks > 1`). Le gaz payé par un sous-compte réduit donc le solde relu (`balance.changed`, raison `chain_fee`). `minVital` sert de réserve de gaz pour le balayage de mort : il doit rester nettement supérieur au gaz de quelques transactions (testnet : 0.05 NEAR, à confirmer par dev-comptes).
- **Déterminisme** : tous les tirages passent par `Deps.rng` ; même graine = même journal (hors `ts`).

## Options
`autoRun` (défaut true : boucle temporisée `sim.tickMs` ; false : tests, `tick()` manuel) ; `emitChainTx` (défaut : vrai seulement avec une chaîne mock, `NearChain` journalise elle-même).

## Tests
`engine/simulation.test.ts` : 3+ générations en preset demo (naissances, travail, reproduction, morts, lettres), invariant de conservation de l'argent, catalogue d'événements, déterminisme par graine, règlement groupé, mutations. Durée : quelques secondes.

## Calibrage (mock, preset demo, 900 ticks)
Mesuré avec `nearUsdRate=0.01` (valeur du preset demo décidée par l'architecte ; reproduite ici par `DARWIN_NEAR_USD_RATE=0.01` car ces changements de `shared/` n'étaient pas encore commités sur `main`). Avec l'ancien taux de 3, le coût IA était négligeable ; à 0.01 il pèse 2 à 7 NEAR cumulés sur la population, donc le gène « modèle » devient sélectif.

| Graine | 1re reproduction | 1re naissance de génération 3 | 1re mort | Morts | Générations |
|---|---|---|---|---|---|
| 1 | tick 22 | tick 135 | tick 131 | 23 | 6 |
| 42 | tick 30 | tick 84 | tick 137 | 54 | 12 |
| 99 | tick 41 | tick 96 | tick 150 | 44 | 6 |

Cibles ARCHITECTURE §12 tenues (reproduction avant tick 60, génération 3 avant tick 300). Avec 0.02 : génération 3 aux ticks 199, 84, 96, également conforme.

## Robustesse
- Règlement groupé : la dette n'est effacée qu'après un transfert réussi (sinon elle reste due et l'erreur remonte). Test dans `failures.test.ts`.
- `registerAgent` en échec : la naissance est annulée, le compte orphelin est clos et ses fonds retournent à celui qui les a donnés (parent ou maître), avec `system.warning BIRTH_ABORTED` (ou `system.error BIRTH_ORPHAN_ACCOUNT` si le rapatriement échoue aussi). Le parent n'est pas débité et la lettre n'est pas écrite.

## L16 : freelance réel, 6 métiers
- Métiers : `logo, finance, architecture, marketing, translation, legal`. Fondateurs répartis à tour de rôle (index % 6) ; chaque métier a une personnalité de freelance courte (`personalityWith(profession, trait?)`). Un changement de métier par mutation réécrit la personnalité (trait conservé).
- Enchère : prix = max(askRatio x budget, coût IA x 1,1, `CATALOGUE[métier].nearPrice`) ; au-dessus du budget, l'agent s'abstient.
- Spécialisation : événement `population.snapshot { tick, byProfession, byGeneration }` toutes les 5 ticks (`POPULATION_SNAPSHOT_EVERY`), émis juste avant `sim.tick`, vivants uniquement.
