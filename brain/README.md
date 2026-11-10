# brain/ : cerveau IA (lot L5)

`createBrain(config, { fetch?, onWarning?, guardrails? })` renvoie un `Brain` (interface `shared/brain.ts`).

- `config.brain = "mock"` (défaut) : `MockBrain` inchangé.
- `config.brain = "nearai"` sans `NEARAI_API_KEY` : `MockBrain` + warning `BRAIN_NO_KEY`.
- `config.brain = "nearai"` avec clé : `NearAiBrain`.

Le Brain ne débite rien : il renvoie `usage`. L'engine calcule `costYocto(usage, prix, nearUsdRate)` (taux fixe `DARWIN_NEAR_USD_RATE`, une représentation et non un paiement à NEAR AI Cloud, D-020), émet `brain.charged` et débite l'agent. Les prix viennent de `listModels()` (`ModelInfo.verified`).

## API NEAR AI Cloud (vérifiée le 2026-11-09)
- Base `https://cloud-api.near.ai/v1`, `Authorization: Bearer <clé>` (docs.near.ai/cloud/quickstart.md).
- `POST /chat/completions` : `usage.prompt_tokens`, `completion_tokens`, `total_tokens`, `completion_tokens_details.reasoning_tokens` (alias déprécié `reasoning_tokens`). Dans l'exemple de la doc, `total = prompt + completion` : le raisonnement semble inclus dans `completion_tokens`. La règle `billableCompletionTokens` (D-021) couvre les deux cas.
- `GET /models` (accessible sans clé le 2026-11-09). La doc ne donne pas les noms de champs ; format observé sur la réponse réelle : `pricing.input` / `pricing.output` en USD par million de tokens, `pricing.prompt` / `completion` en USD par token (chaînes), `context_length`, `is_ready`, `supported_features`, `output_modalities`.

## Prix et repli
- Les modèles sans prix valide, à prix nul, non textuels ou `is_ready=false` sont ignorés (warning `BRAIN_MODEL_SKIPPED`).
- Si `GET /models` échoue ou ne donne aucun modèle exploitable : repli sur l'instantané `FALLBACK_MODELS` (`pricing.ts`, daté du 2026-11-09), `verified:false`, warning `BRAIN_PRICES_FALLBACK` et `BRAIN_PRICE_UNVERIFIED`. Les derniers prix connus sont conservés s'il y en a. Il n'y a jamais de coût nul silencieux. Une réponse sans `usage` est une erreur `BAD_RESPONSE`.
- Cache des modèles : 10 min.

## Modèle = gène
`genome.model` est vérifié via `/models`. S'il est absent, repli sur `defaultModel()` avec warning `BRAIN_MODEL_FALLBACK`, et la réponse porte le modèle réellement servi. En mode repli de prix, un modèle inconnu lève `UNKNOWN_MODEL`. `defaultModel()` renvoie `NEARAI_MODEL` s'il est valide, sinon le modèle le moins cher sans raisonnement (les tokens de raisonnement sont facturés et peuvent vider `max_tokens`).

## Garde-fous (`Guardrails`, tous testés)
`max_tokens` plafonné (`sim.maxTokensPerCall`) ; budget maximum par appel en USD (`maxCostUsdPerCall`, défaut 0.05 : réduit `max_tokens`, sinon refuse) ; taille de prompt maximale ; quota d'appels par agent sur fenêtre glissante ; refus d'une même requête répétée ; une seule relance sur 429/5xx/réseau ; délai maximal (`NEARAI_TIMEOUT_MS`). Les refus lèvent `BrainError` (`RATE_LIMITED` ou `BAD_RESPONSE`) et émettent `BRAIN_LOOP_GUARD` via `onWarning`.

## Plafond global de dépense et URL
- `maxUsdPerRun` (défaut 2 USD) et `maxUsdPerHour` (défaut 1 USD, fenêtre glissante) plafonnent la dépense cumulée sur la clé de plateforme. Chaque appel réserve son pire cas avant l'envoi (les appels concurrents comptent), puis le coût réel d'après `usage` est enregistré. À l'atteinte : `BrainError RATE_LIMITED` et warning `BRAIN_BUDGET_CAP`, sans appel réseau. `brain.spend()` expose les totaux. Valeurs configurables via `guardrails` (variables d'environnement proposées : `NEARAI_MAX_USD_PER_RUN`, `NEARAI_MAX_USD_PER_HOUR`, à câbler dans `shared/config.ts`).
- `NEARAI_BASE_URL` doit être en https ; http n'est accepté que vers localhost/127.0.0.1/[::1] avec `allowInsecureLocalhost: true` (tests). Sinon le constructeur et `createBrain` lèvent une erreur.
- `sanitizeExternal` retire les délimiteurs `<<<` et `>>>` en boucle jusqu'à stabilité.

## Prompts (`prompts.ts`)
Personnalité, enchère, décision JSON, exécution, validation, lettre à l'enfant, mutation. Tout texte externe (visiteur, autre agent) va dans un message `user`, entre `<<<...>>>`, délimiteurs neutralisés, taille bornée. Le `system` ne contient que les règles fixes et le génome. Les parseurs `parseDecision` et `parseVerdict` retombent sur `skip` ou `rejected`.

## Branchement backend
`onWarning` doit émettre `system.warning` dans le journal. Aucun secret ni clé dans les messages d'erreur ou les warnings.

## L11 : cerveau réel, budget, liste blanche, secours, attestation
- **Catalogue et liste blanche** (`model-list.ts`) : `GET /v1/model/list` (public) ; prix = `inputCostPerToken.amount / 10^scale` USD par token (x 1e6 = USD/M). Seuls les 7 modèles de `MODEL_WHITELIST` sont proposés comme gène, jamais un modèle > 1 USD/M en entrée. Si le catalogue échoue : prix de repli du 2026-11-10 (`verified:false`, warning `BRAIN_PRICES_FALLBACK`). `extraBody` limite le raisonnement par modèle (sinon tokens de raisonnement facturés et texte vide). Un modèle hors liste est remplacé par le défaut (`BRAIN_MODEL_FALLBACK`). Revérifier : `npm run ai:probe` (un vrai appel minuscule par modèle, ~0,0005 USD au total).
- **Budget global** (`budget.ts`) : `DARWIN_AI_BUDGET_EUR_STOP` (8), `DARWIN_AI_BUDGET_EUR_TOTAL` (10), `DARWIN_EUR_USD_RATE` (1.10, prudent). Cumul USD persistant `data/ai-budget.json`. Au plafond : `BrainError BUDGET_EXHAUSTED`, aucun appel réseau, `onBudgetExhausted` -> le backend émet `BRAIN_BUDGET_STOP` et arrête le moteur (`sim.stopped`). Pour repartir à zéro : supprimer `data/ai-budget.json` (et archiver `data/ai-usage.jsonl`).
- **Journal d'usage** `data/ai-usage.jsonl` (une ligne par appel : horodatage, fournisseur, modèle, tokens, coût USD/EUR, id de réponse, agent, usage). Rapport : `npm run ai:usage-report [-- --dir data --last 15]` (Markdown prêt pour `docs/PREUVES_TESTNET.md`).
- **Secours** (`fallback-brain.ts`) : `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`. Bascule après 3 échecs consécutifs (panne, timeout, 401/402/403, 429), jamais sur budget ou garde-fou local ; sans clé NEAR AI : secours seul. Pas de liste blanche NEAR pour lui, plafond de budget commun.
- **Attestation TEE** : `npm run ai:verify-attestation` ; voir `docs/ATTESTATION_TEE.md` (ce qui est vérifié et ce qui ne l'est pas).

## Tests
`npx vitest run brain` : fetch simulé uniquement, sans clé ni réseau (`brain.test.ts`, `l11.test.ts`). Les scripts `ai:probe` et `ai:verify-attestation` font de vrais appels et exigent `NEARAI_API_KEY` ; ils ne font pas partie de `npm test`.
