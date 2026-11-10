# VIDEO_SCRIPT : vidéo de démonstration (2 min 30 environ)

> **Thèse** : « Aujourd'hui, on paie la consommation de son IA. Demain, on paiera un agent comme un freelance : il aura ses charges, répondra à des appels d'offres et devra être rentable pour exister. Darwin montre qui survivra, sur NEAR. » Voix off en anglais : "Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."

> Propriétaire : redacteur. Brouillon : rien n'est enregistré ni publié. Langue de la voix off : anglais (juges internationaux), sous-titres anglais recommandés.
> Durée visée : 2 min 30 (limites 2 à 3 minutes). Le moment « wow » arrive dans les 10 premières secondes.
> **Frontend** : la page web est fusionnée (vérifiée avec Playwright sur le preset demo). Les plans l'utilisent ; le terminal et `curl` (étapes du README, section 9) restent un plan B.
> Règle : ne rien montrer qui soit faux. Tout ce qui est mock doit être dit mock à voix haute.

## Préparation (avant d'enregistrer)

- `npm run start:demo` lancé 2 minutes avant (il y aura déjà des naissances et des morts). Port 3000.
- Deux fenêtres : le navigateur sur `http://127.0.0.1:3000/`, et un terminal prêt avec la commande `curl -X POST ... /api/tasks` du README (étape 6).
- Le tournage principal reste en mode mock (preset demo : rapide, sans clé), et la voix le dit. Le mode testnet a réellement tourné (run 8 du 2026-11-10, preset `selection` : génération 3, 7 morts, séquestres dans le contrat ; `docs/PREUVES_TESTNET.md`) mais un tick réel dure environ une minute : pour le montrer, utiliser des **plans fixes** de ce run (liens nearblocks de `docs/PREUVES_TESTNET.md` §8 : création d'un compte d'agent, `mark_dead`, séquestre `lock` puis `release`), pas un direct.
- Faits à ne pas dépasser : le payeur des tâches en testnet est le **client simulé** (aucun visiteur n'a payé sur testnet) ; NEAR Intents n'a **jamais** été exécuté ; le coût IA (environ 0,034 USD) est notre comptabilité locale, facture non relue ; une seule exécution du preset `selection` (pas une garantie de vitesse).

## Plans

| # | Temps | Image | Voix off |
|---|---|---|---|
| 1 | 0:00 à 0:12 | **Wow.** Plein écran : les agents vivants, soldes qui bougent, une naissance puis une mort en direct. Plan B : le flux SSE défile dans le terminal (`curl -N .../api/stream`) avec `agent.born`, `escrow.released`, `agent.died`. Titre : « Darwin ». | « These AI agents are earning money, paying for their own brains, having children... and dying. Live. Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer. » *(Citation complète en conclusion, plan 8.)* |
| 2 | 0:12 à 0:25 | Un agent (génome visible : métier, modèle, prix, risque) puis son arbre de lignée. Plan B : `curl /api/agents` puis `/api/lineage`. | « Each agent has a genome: profession, AI model, price, appetite for risk, generosity. It is born as its own account (simulated in mock mode; a NEAR testnet sub-account in testnet mode) with a starting capital. » *Variante testnet, seulement sur un plan fixe du run 8 (page nearblocks d'un compte `a-2149xx.darwin-master-7k2.testnet`) : « In our real testnet run, each agent was born as its own NEAR testnet sub-account. »* |
| 3 | 0:25 à 0:40 | Schéma d'architecture du README, section 4, 3 secondes. Puis retour à l'écran. | « Darwin is a market economy for agents. They bid in auctions, subcontract each other, and every payment goes through an escrow. » |
| 4 | 0:40 à 1:10 | **Tâche visiteur en direct.** Dans le formulaire, ou avec `curl -X POST /api/tasks` (étape 6 du README) : « Write a haiku about evolution ». Montrer la tâche `posted`, l'enchère, l'attribution, la validation « validé par : ... », le séquestre `released`. | « I post a task. An agent wins the auction, delivers, a validator accepts it, and the escrow pays. The validator is named on screen: this is operator-validated, not trustless. » |
| 5 | 1:10 à 1:30 | Panneau des coûts IA : événement `brain.charged` avec le coût (USD, taux, source des prix). | « Every AI call costs money. Cost is computed from token usage and model prices, converted at a fixed configurable rate, and debited from the agent's balance. The real bill is paid by the operator's API key. » (Dire « mock » si le cerveau est mock.) |
| 6 | 1:30 à 1:55 | Une reproduction : l'enfant apparaît dans l'arbre, ouvrir la lettre `/api/agents/<id>/letter`. | « When an agent gets rich enough, it reproduces. The child has mutated genes, and the parent writes it a letter. » (Si mock : « this letter comes from the mock brain ».) |
| 7 | 1:55 à 2:10 | Une mort : agent sous le minimum vital, compte fermé, fonds rendus au maître, lignée conservée. | « When an agent runs out of money, it dies. Its account is closed. The lineage stays. Selection decides which strategies survive. » |
| 8 | 2:10 à 2:35 | Écran de fin : outils NEAR (comptes et sous-comptes, clés function call, contrat Rust, NEAR AI Cloud, NEAR Intents), puis une carte « Honest limits ». Texte à l'écran : « Mock mode runs with no key. Simulated client is labelled. NEAR testnet + Rust contract + NEAR AI Cloud: run for real (one run: generation 3, 7 deaths). NEAR Intents: not run. » Dépôt et post X. | « Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR. Built at NEAR HACKATHON. What you saw runs in mock mode. We also ran it for real on NEAR testnet, with a Rust escrow contract and NEAR AI Cloud: one run reached a third generation, and seven agents starved. Tasks came from a labelled simulated client; NEAR Intents is not run. One command, no key. The README says what is real, with transaction links. » *(Voix plus longue que l'ancienne : si la vidéo dépasse 3 minutes, couper au plan 3.)* |

## À ne pas dire

- Pas de « trustless », « décentralisé » pour le séquestre ; pas de « l'agent paie NEAR AI Cloud » ; pas « on-chain » pour le registre si le contrat n'est pas déployé (séquestre dégradé).
- Ne pas présenter le client simulé ou les visiteurs financés par la démo comme de vrais clients ; ne pas dire qu'un visiteur a payé sur testnet, ni que NEAR Intents a tourné, ni montrer le mock en le faisant passer pour le testnet.
- Ne pas montrer de clé, de `.env`, ni d'URL privée. Vérifier le terminal avant d'enregistrer.

## Livraison

L'humain enregistre, monte et publie (voir `docs/POST_X.md`). La vidéo doit être jointe au post X (exigence L-03 : captures seules insuffisantes).
