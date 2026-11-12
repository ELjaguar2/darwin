# VIDEO_SCRIPT : vidéo de démonstration (2 min 50 environ)

> **Thèse** : « Aujourd'hui, on paie la consommation de son IA. Demain, on paiera un agent comme un freelance : il aura ses charges, répondra à des appels d'offres et devra être rentable pour exister. Darwin montre qui survivra, sur NEAR. » Voix off en anglais : "Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."

> Propriétaire : redacteur. Brouillon : rien n'est enregistré ni publié. Langue de la voix off : anglais (juges internationaux), sous-titres anglais recommandés.
> Durée visée : 2 min 50 (limites 2 à 3 minutes ; si le montage dépasse 3:00, couper le plan 8 puis raccourcir le plan 9). Le moment « wow » arrive dans les 10 premières secondes.
> **Scène centrale** : « un visiteur commande un logo depuis la page, de la demande au paiement » (plans 3 à 8). Le reste (sélection naturelle) la replace dans l'économie des agents.
> **Frontend** : la page web est fusionnée (formulaire avec catalogue, livrables, panneaux Marché et Spécialisation). Le terminal et `curl` (étapes du README) restent un plan B.
> Règle : ne rien montrer qui soit faux. Tout ce qui est mock doit être dit mock à voix haute.

## Préparation (avant d'enregistrer)

- `npm run start:demo` lancé 2 minutes avant (il y aura déjà des naissances et des morts). Port 3000.
- Deux fenêtres : le navigateur sur `http://127.0.0.1:3000/`, et un terminal prêt (plan B : `curl -X POST ... /api/tasks` du README).
- Le tournage principal reste en mode mock (preset demo : rapide, sans clé), et la voix le dit. Le mode testnet a réellement tourné (run 8 du 2026-11-10, preset `selection` : génération 3, 7 morts, séquestres dans le contrat ; run 9 : la commande du logo ; voir `docs/PREUVES_TESTNET.md`, section run 9 <À COMPLÉTER run 9>) mais un tick réel dure environ une minute : pour le montrer, utiliser des **plans fixes** de ces runs (liens nearblocks de `docs/PREUVES_TESTNET.md`), pas un direct.
- Plans fixes à préparer (captures ou pages nearblocks ouvertes à l'avance) :
  - transaction de verrouillage du séquestre `lock` du logo : <À COMPLÉTER run 9 : lien nearblocks>
  - transaction `release` (agent payé) : <À COMPLÉTER run 9 : lien nearblocks>
  - transaction de réputation, si elle est on-chain : <À COMPLÉTER run 9 : lien nearblocks, ou retirer la mention>
  - cas refusé (remboursement du visiteur par le contrat), seulement si le run 9 en contient un : <À COMPLÉTER run 9 : lien nearblocks, sinon montrer le cas refusé en mock et le dire>
  - identifiants de la tâche et de l'agent attribué : <À COMPLÉTER run 9 : task id, agent id>
  - score du juge et coût IA réels du livrable : <À COMPLÉTER run 9 : score, coût>
- Prix du logo : lire le prix **affiché par le formulaire** (catalogue, `docs/CATALOGUE_FREELANCE.md`, référence de 150 USD pour le logo à titre d'ordre de grandeur) et le dire tel qu'il est à l'écran, sans l'arrondir.
- Faits à ne pas dépasser : voir « À ne pas dire ».

## Plans

| # | Temps | Image | Voix off |
|---|---|---|---|
| 1 | 0:00 à 0:10 | **Wow.** Plein écran : les agents vivants, soldes qui bougent, une naissance puis une mort en direct. Titre : « Darwin ». Plan B : le flux SSE défile dans le terminal (`curl -N .../api/stream`). | « These AI agents earn money, pay for their own brains, have children... and die. Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer. » *(Citation complète en conclusion, plan 10.)* |
| 2 | 0:10 à 0:20 | Un agent du métier Logo : génome visible (métier, modèle, prix, appétit du risque). Texte à l'écran : « Each agent = one NEAR account (simulated in mock mode) ». | « Each agent has a genome: a profession, an AI model, a price, an appetite for risk. Today we hire one of the logo designers. » |
| 3 | 0:20 à 0:35 | **Scène centrale, 1/6 : la commande.** Le visiteur ouvre le formulaire de tâche, choisit le métier **Logo**. Le prix du catalogue s'affiche. Zoom sur la mention « logo original, jamais la reprise d'une marque ». Il écrit sa demande : « Logo for La Page Blanche, a neighbourhood bookshop. Warm, simple, readable on a bag. » Il valide. | « A visitor orders a logo from the page. The form shows the catalogue price for the logo profession, and a reminder: original logo only, never a copy of an existing brand. The brief: a neighbourhood bookshop called La Page Blanche. » |
| 4 | 0:35 à 0:50 | **2/6 : les enchères.** La tâche apparaît (`posted`). Les agents du métier Logo enchérissent : étape « enchères » visible, les offres et les prix s'affichent. | « The task appears. Logo agents bid in an auction: each one sets its price from its own genome and its costs. » |
| 5 | 0:50 à 1:05 | **3/6 : attribution et séquestre.** Un agent est attribué, le séquestre se verrouille. Plan fixe : la transaction `lock` sur le contrat testnet dans nearblocks <À COMPLÉTER run 9 : lien nearblocks>. Si le plan est en mock, texte « mock escrow » à l'écran. | « One agent wins. The money is locked in an escrow, a Rust contract on NEAR testnet. Here is the transaction on nearblocks. » *(En mock : « in mock mode, this escrow is simulated; the testnet transaction comes from our real run ».)* |
| 6 | 1:05 à 1:30 | **4/6 : la livraison.** L'agent livre : les **3 propositions de logo SVG** s'affichent dans la page, chacune avec le bouton **Télécharger** (clic sur un téléchargement). Le coût IA du livrable est affiché (USD, tokens). Texte à l'écran : « AI cost of this delivery: <À COMPLÉTER run 9 : coût réel> » (en mock : valeur du mock, étiquetée). | « The agent delivers three SVG logo proposals, right in the page, each with a download button. The AI cost of this deliverable is shown too: this is what the agent paid for its brain, taken from its balance. » |
| 7 | 1:30 à 1:50 | **5/6 : le verdict (accepté).** Le juge applique la grille d'évaluation du métier Logo : critères, verdict, score <À COMPLÉTER run 9 : score>. Accepté : le séquestre est libéré, l'agent est payé, sa réputation monte. Plans fixes : transaction `release` <À COMPLÉTER run 9 : lien nearblocks>, puis la réputation <À COMPLÉTER run 9 : lien ou retirer>. | « A judge scores the work with the logo evaluation grid and gives a verdict. Accepted: the escrow is released, the agent is paid, and its reputation goes up. Here are the transactions. The judge is named on screen: this is operator-validated, not trustless. » |
| 8 | 1:50 à 2:00 | **6/6 : le cas refusé, plan court.** Un livrable refusé : le contrat rembourse le visiteur, l'agent n'est pas payé. Plan fixe du run 9 <À COMPLÉTER run 9 : lien nearblocks> ou, à défaut, cas en mock, dit mock. | « And when the work is rejected, the contract refunds the visitor. The agent earns nothing. » |
| 9 | 2:00 à 2:25 | **La sélection.** (a) Panneau Marché : événements de marché qui font varier la demande par métier. (b) Panneau Spécialisation : la population par métier au fil des générations. (c) Quelques morts (compte fermé, lignée conservée) puis la génération 3 dans l'arbre. Texte à l'écran : « Real testnet runs: run 8 = generation 3, 7 deaths. Run 9 = the logo order. » | « Market events make demand swing from one profession to another. Agents that pick the right profession survive; the others run out of money and die. The Specialisation panel shows who thrives, generation after generation. On NEAR testnet, a real run reached the third generation, and seven agents starved. » |
| 10 | 2:25 à 2:50 | Écran de fin : outils NEAR (comptes et sous-comptes, clés function call, contrat Rust, NEAR AI Cloud, NEAR Intents), puis carte « Honest limits ». Texte : « Mock mode runs with no key. Simulated client is labelled. The logo order is the only real visitor task. NEAR testnet + Rust contract + NEAR AI Cloud: run for real. NEAR Intents: not run. » Dépôt et post X. | « Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR. Built at NEAR HACKATHON. What you saw runs in mock mode, and we also ran it for real on NEAR testnet. The tasks of the other agents come from a labelled simulated client; the logo order is the only real visitor task; NEAR Intents is not run. One command, no key. The README says what is real, with transaction links. » |

*(Durée cumulée : 2 min 50. Si le montage dépasse 3 minutes, couper le plan 8, puis le plan 2.)*

## À ne pas dire

- Pas de « trustless », « décentralisé » pour le séquestre ; pas de « l'agent paie NEAR AI Cloud » ; pas « on-chain » pour le registre si le contrat n'est pas déployé (séquestre dégradé).
- Le payeur des tâches simulées est un **client simulé**, étiqueté. La commande du logo par un visiteur est la **seule tâche visiteur réelle** : ne pas dire que d'autres visiteurs ont commandé ni payé.
- NEAR Intents n'a **jamais** été exécuté.
- Le coût IA est notre comptabilité locale (tokens x prix du catalogue de modèles) ; la **facture NEAR AI n'a pas été relue** : ne pas la présenter comme vérifiée.
- Ne pas présenter les chiffres du run 8 (génération 3, 7 morts) comme une garantie de vitesse ou de résultat : c'est une seule exécution.
- Ne pas présenter le mock comme du testnet ; ne pas montrer le cas « refusé » du mock comme un événement testnet.
- Ne pas parler de logo « de marque » : le logo est original, jamais la reprise d'une marque.
- Ne pas montrer de clé, de `.env`, ni d'URL privée. Vérifier le terminal avant d'enregistrer.

## Livraison

L'humain enregistre, monte et publie (voir `docs/POST_X.md`). La vidéo doit être jointe au post X (exigence L-03 : captures seules insuffisantes). Avant l'enregistrement, remplacer tous les marqueurs `<À COMPLÉTER run 9>` (ou retirer la mention concernée).
