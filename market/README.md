# market/ : marché des tâches (lot L6)

`createMarket(deps, opts)` renvoie un `Market` (`shared/modules.ts`) plus `postVisitorTask`, `getEscrow`, `accountIds`, `visitorSpentLastHour`, `visitorHourlyCap`. Dépend uniquement de `shared/` (Chain, Brain, Journal, Config) ; tout marche avec `MockChain` et `MockBrain`.

## Cycle
`postTask` -> `placeBid` -> `step(tick)` (clôture, attribution, `lockEscrow`) -> exécution par l'agent (moteur) -> `submitResult` (validation, puis `releaseEscrow` avec preuve, ou `refundEscrow`) -> `addReputation`.
Événements émis : `task.posted`, `bid.placed`, `task.awarded`, `escrow.locked`, `task.submitted`, `task.validated`, `escrow.released`, `escrow.refunded`, `task.expired`, `subcontract.created`, `reputation.updated`, `funding.received` (comptes du marché), `brain.charged` (juge), `system.warning`.

## Attribution
Prix le plus bas ; égalité : meilleure réputation (`Chain.getReputation`), puis délai annoncé le plus court, puis offre la plus ancienne. Déterministe. Les offres d'agents morts sont ignorées. Une offre par agent ; prix dans ]0, budget] ; un agent ne peut pas enchérir sur sa propre chaîne de sous-traitance (demandeur ou ancêtre).

## Séquestre
- Montant verrouillé = **prix de l'offre gagnante** (au plus le budget), verrouillé à l'attribution, payé en une fois au gagnant.
- Libération : uniquement avec un verdict `accepted` enregistré dont le `resultHash` correspond au résultat remis, après contrôle que le séquestre on-chain correspond (montant, payeur). Preuve = `{resultHash, verdict:"accepted", validator}` produite par l'opérateur, **non vérifiée cryptographiquement**.
- Remboursement : uniquement sur `rejected` (verdict de rejet enregistré) ou `expired` (aucune offre exploitable, délai dépassé, gagnant mort). Un contrôle interne refuse tout autre cas.
- Paiement interrompu (erreur chaîne) : la tâche reste `submitted` avec sa validation ; `step` le reprend. Bénéficiaire mort avant paiement : remboursement, tâche `expired`.
- Si le payeur n'a pas de quoi verrouiller : `system.warning` `ESCROW_LOCK_FAILED`, tâche expirée (motif `no_bids` faute de motif dédié dans le catalogue).

## Modèle de confiance (à reprendre dans le README racine)
L'opérateur est l'oracle de validation : règle ou modèle choisi par lui ; le système n'est **pas** sans confiance (« trustless » interdit). `task.validated` journalise `validator` (« validé par : <validator> ») et `resultHash`. Le validateur n'est jamais l'agent payé ni l'agent qui sous-traite (un validateur nommé comme eux ou `agent:*` est refusé). Par défaut : juge composite = règle de base (`rule:basic`, plancher) puis juge IA (`brain:<modèle>`). **Échec fermé** : avec un cerveau réel (`brain.kind !== "mock"`), si le juge est indisponible (panne, plafond de 30 appels/minute de L5 = `RATE_LIMITED`, réponse illisible), aucune libération : `system.warning` `JUDGE_UNAVAILABLE`, `submitResult` lève `MarketError VALIDATION_PENDING` (503) et la tâche reste `submitted` sans validation. Chaque `step` retente la validation ; après `deadlineTick + validationGraceTicks` (défaut `taskDeadlineTicks`) la tâche expire et le séquestre est remboursé, sans pénalité de réputation pour l'agent. Seul le mode mock autorise le repli sur la règle de base (signalé). Un rejet par la règle de base ne nécessite pas le juge. Validation par le client possible via `clientValidator` (`validator: "visitor"`). Le coût du juge est imputé à la **trésorerie** (`brain.charged` avec `agentId: "treasury"`), jamais à l'agent gagnant ; il n'est pas débité on-chain (comptabilité du journal).

## Comptes possédés par le marché
Le marché crée et finance (depuis le maître, au premier besoin puis en complément) deux sous-comptes : `visitors.<maître>` (`funding.received` `source: "demo"`) et `sim-client.<maître>` (`source: "master"`). Le compte payeur d'une tâche visiteur est toujours `visitors` : l'appelant ne le choisit pas. Les tâches de sous-traitance sont payées par le compte de l'agent demandeur (registre `Chain.getAgentRecord`).

## Visiteurs et client simulé
- Étiquette visiteur : « Visiteur (financé par le compte de démo) » (`VISITOR_FUNDING_LABEL`) : fonds de test de l'opérateur, pas l'argent du visiteur.
- Plafond de dépense horaire du compte visiteurs : somme des budgets publiés sur 60 min glissantes ; au-delà `MarketError VISITOR_CAP_EXCEEDED` (`httpStatus` 429). Valeur : `opts.visitorHourlyCap`, sinon `config.sim.visitorHourlyCap` si `shared` l'ajoute (variable `DARWIN_VISITOR_HOURLY_CAP_NEAR`), sinon 10 x budget max. Les 10 tâches ouvertes par IP restent à la charge du backend.
- `postVisitorTask(input)` : valide `TaskInputSchema`, bornes `taskBudgetMin/Max` (400).
- Client simulé (`createSimulatedClient(deps, market).tick(tick)`) : tirage de Poisson (`simClientRatePerTick`), tâches variées par métier, `requester.kind = "simulated"`, libellé toujours préfixé « Client simulé ».
- Texte du visiteur : jamais en message `system`. `taskMessages(task, personnalité)` (pour le moteur) et `judgeMessages` le placent en JSON dans un message `user`.

## Sous-traitance
`postTask` avec `requester: {kind:"agent"}` et `parentTaskId` : le parent doit être `awarded` avec cet agent pour gagnant ; budget **strictement inférieur** au prix gagnant du parent (l'agent garde la marge) ; profondeur max 2. Émet `subcontract.created`. Le résultat du parent n'attend pas celui de l'enfant.

## Tick courant
Le marché retient le plus grand tick vu dans `step(tick)` ou dans les événements du journal (abonnement). Délais : `biddingEndsTick = tick + bidWindowTicks`, `deadlineTick = biddingEndsTick + taskDeadlineTicks` ; expiration quand `tick > deadlineTick`.

## Réputation
Accepté +1, rejeté -2, délai manqué -2 (`opts.reputationDeltas`). Chaque ajustement porte une preuve (`resultHash` ou hash de l'expiration) et n'est appliqué qu'une fois par tâche et agent.

## Tests
`market/market.test.ts` : cycle complet avec conservation des fonds, égalité de prix, sous-traitance (marge, auto-contrat), rejet, expiration sans offre, délai dépassé, validateur défaillant ou interdit, paiement repris, plafond horaire 429, comptes du marché, client simulé, isolation des messages, juge IA.

## Freelance réel (L16)

Catalogue : `shared/catalogue.ts` (6 métiers, `nearPrice` plancher, grille `rubric`, `acceptScore`, consignes, `maxOutputTokens`, `demandWeight`). Décisions D-037 à D-041.

- **Prix minimum** : `postTask` refuse (visiteur ou client simulé) un budget < `CATALOGUE[métier].nearPrice` (`BUDGET_OUT_OF_RANGE`, message clair). La sous-traitance n'est pas concernée (budget < prix gagnant).
- **Livrable** : `extractDeliverable(task, agentId, rawText, costs)` (`deliverable.ts`) : logo = exactement 3 blocs svg -> `logo-1..3.svg` ; architecture -> `architecture.md` + `schema.mmd` ; finance -> `analyse.md` ; marketing -> `texte.md` ; translation -> `traduction.md` ; legal -> `checklist.md`. SVG assainis par REJET (`sanitizeSvg`). `market.getDeliverable(taskId)` / `listDeliverables()` (en mémoire, perdus au redémarrage). Événement `deliverable.produced` `{taskId, profession, agentId, files:[{name,mime,bytes}], productionCostUsd, judgeCostUsd, resultHash}`, émis après le verdict.
- **Juges** : `professionRule()` (`rule:<métier>`, contrôles déterministes de `checks.ts`) puis `brainJudge` avec la grille du métier (scores par critère, note pondérée >= `acceptScore`). Le défaut de `createMarket` les compose. Rejet = remboursement (test pour les 6 métiers). Le coût du juge est imputé à la trésorerie (`brain.charged` `agentId: "treasury"`) et reporté dans `judgeCostUsd`.
- **Événements de marché** : `createMarketEvents` -> `market.event` `{event: MarketEvent}` ; `createSimulatedClient(deps, market).events` expose les événements actifs pour l'interface. Le client simulé est toujours étiqueté « simulé ».
- **Mock** : `MockBrain` produit un livrable valide par métier (marqueur `[[PROFESSION:x]]` du prompt) et note 0,8 par critère ; un livrable volontairement mauvais est rejeté par les contrôles déterministes.
- **Revue sécurité du séquestre (L16)** : aucun chemin de paiement modifié ; la libération exige toujours un verdict `accepted` enregistré avec `resultHash` identique ; l'extraction du livrable n'a aucun effet sur l'argent (une erreur inattendue émet `DELIVERABLE_FAILED`, le règlement continue comme avant) ; le contenu SVG d'un agent n'est conservé qu'assaini (rejet sinon) ; le backend doit le servir avec `Content-Type` strict, `X-Content-Type-Options: nosniff` et `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, et le frontend l'afficher dans `<img>` (jamais en ligne dans le DOM).
