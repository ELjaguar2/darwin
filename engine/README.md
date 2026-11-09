# engine/ : moteur d'évolution (lot L4)

`createEngine(deps, market, options?) : Engine` (interface `shared/modules.ts`). Il ne dépend que des interfaces `Chain`, `Brain`, `Market`, du journal et du `Rng` injectés (aucun import de `accounts/` ou `brain/`, aucun `process.env`).

| Fichier | Rôle |
|---|---|
| `index.ts` | boucle de tick (ARCHITECTURE §13), start/pause/resume/stop, `getState` |
| `genome.ts` | fondateurs, mutation (bornes de `GENOME_BOUNDS`, rapport gène -> [avant, après]) |
| `lifecycle.ts` | naissance (sous-compte + registre), reproduction, lettre parent -> enfant, mort |
| `economy.ts` | débits (métabolisme, coût IA via `costYocto`), règlement groupé, synchronisation des soldes |
| `policy.ts` | décisions d'un agent : enchère, risque, sous-traitance |
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

## Calibrage (mock, preset demo, tel que dans `shared/config.ts`, aucun changement de preset)
| Graine | 1re reproduction | 1re naissance de génération 3 | 1re mort | Générations à 900 ticks |
|---|---|---|---|---|
| 1 | tick 22 | tick 205 | tick 131 | 4 |
| 42 | tick 30 | tick 84 | tick 137 | 7 |
| 99 | tick 41 | tick 96 | tick 150 | 6 |

Cibles ARCHITECTURE §12 tenues (reproduction avant tick 60, génération 3 avant tick 300). Population stabilisée vers 9-10 vivants (plafond 16), sélection active (40-58 morts sur 900 ticks).
Limite constatée : le coût IA est négligeable (~0.01-0.03 NEAR cumulés sur 900 ticks, contre 0.08 NEAR de métabolisme par agent et par tick) : le gène « modèle » n'a quasi aucun effet sélectif. Voir demandes au chef de projet.
