# VIDEO_SCRIPT : vidéo de démonstration (2 min 50 environ)

> **Thèse** : « Aujourd'hui, on paie la consommation de son IA. Demain, on paiera un agent comme un freelance : il aura ses charges, répondra à des appels d'offres et devra être rentable pour exister. Darwin montre qui survivra, sur NEAR. » Voix off en anglais : "Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."
> **Phrase de clôture** : « La sélection par la spéculation s'est éteinte. La sélection par le travail utile peut durer. » Voix off : "Selection by speculation died out. Selection by useful work can last."

> Propriétaire : redacteur. Brouillon : rien n'est enregistré ni publié. Langue de la voix off : anglais (juges internationaux), sous-titres anglais recommandés.
> Durée visée : 2 min 50 (limites 2 à 3 minutes ; si le montage dépasse 3:00, couper le plan 9 puis raccourcir le plan 7). Le « wow » arrive dans les 10 premières secondes.
> **Scène centrale** : « je commande une mission dans le chat, de la demande au paiement » (plans 2 à 6). Les pages **Mission**, **Lignées** et **Preuves** la replacent dans l'économie des agents.
> Règle : ne rien montrer qui soit faux. Tout ce qui est mock est dit mock à voix haute. Tout ce qui est encore à vérifier porte le repère **À CONFIRMER** (chercher ce mot avant d'enregistrer).

## Statut de ce qui est prouvé (au 2026-11-11)

| Élément | Statut |
|---|---|
| Run 8 testnet : génération 3, 12 naissances, 7 morts, 65 séquestres (63 libérés, 2 remboursés) | **Prouvé**, `docs/PREUVES_TESTNET.md` §8, liens nearblocks |
| Run 9b testnet : commande de logo « visiteur » verrouillée puis **rejetée** (0 bloc SVG sur 3, sortie tronquée) et remboursée | **Prouvé par le journal** `docs/preuves/run9b-journal.jsonl` (tâche `t-8674013`, verrouillage `AMQEHEDN96FtFpupFJKrcYvMZckdGiq99UDHhkDUQVBP`, remboursement `BkQM1xYYcxzbP5KaEEivwDN1ea2XsoeZmVTEPBLTFj9f`) ; **pas encore résumé dans `docs/PREUVES_TESTNET.md`** : À CONFIRMER (mise à jour par le chef de projet) |
| Run 9a : commandes de logo expirées sans livrable | Prouvé par `docs/preuves/run9a-journal.jsonl` ; ne pas le montrer |
| **Un logo livré, accepté et payé sur testnet** | **NON prouvé.** À CONFIRMER : run 9c. Tant que non prouvé, le plan 5 montre le paiement d'une tâche du run 8 (payeur : client simulé) ou du mock, **dit comme tel** |
| Pages **Mission**, **Lignées**, **Preuves** (refonte L17) | **Pas encore fusionnées** : À CONFIRMER (noms exacts des onglets et contenu à vérifier avant de tourner ; adapter les plans) |
| **Mode replay** (rejeu du journal du run 8, filet de sécurité) | **Pas encore fusionné** : À CONFIRMER (nom, commande de lancement, étiquette à l'écran). S'il existe, l'écran doit afficher qu'il s'agit d'un **rejeu** et la voix le dit |
| Logo livré en 3 SVG avec bouton Télécharger | Existe côté interface (lot L16, vu en mode mock) ; en réel : À CONFIRMER (run 9c) |

## Préparation (avant d'enregistrer)

- Lancer le mock rapide 2 minutes avant : `npm run start:demo` (naissances et morts déjà présentes). Port 3000. Navigateur sur `http://127.0.0.1:3000/`, terminal prêt (plan B : étapes `curl` du README, section 9).
- Filet de sécurité : si le direct est lent ou plante, utiliser le mode replay du journal du run 8 (À CONFIRMER : commande et étiquette), puis les plans fixes nearblocks ci-dessous. Un tick réel dure environ une minute : **ne pas** tourner le testnet en direct.
- Plans fixes à ouvrir à l'avance (nearblocks, `https://testnet.nearblocks.io/txns/<hash>`, hashes complets dans `docs/PREUVES_TESTNET.md` §8 et dans les journaux) :
  - cycle du run 8, tâche `t-8598118` (payeur `sim-client`, bénéficiaire `a-214953`, 0,035 NEAR) : verrouillage `EzS4KbN9…`, libération `6SbUjask…`, réputation `DTWbUAgx…` ;
  - une mort du run 8 : clôture de `a-214956` `5kiop5Wr…`, puis `mark_dead` dans le registre ;
  - cas refusé réel, run 9b, tâche `t-8674013` : verrouillage `AMQEHEDN…`, remboursement `BkQM1xYY…` (À CONFIRMER : à intégrer à `docs/PREUVES_TESTNET.md`) ;
  - logo accepté et payé, run 9c : <À CONFIRMER : lien nearblocks, score du juge, coût IA, sinon retirer>.
- Prix de la mission : lire le prix **affiché par le formulaire ou le chat** (catalogue, `docs/CATALOGUE_FREELANCE.md`) et le dire tel qu'il est à l'écran.
- Vérifier le terminal avant d'enregistrer : aucune clé, aucun `.env`, aucune URL privée.

## Plans

| # | Temps | Image | Voix off |
|---|---|---|---|
| 1 | 0:00 à 0:10 | **Wow.** Plein écran : les agents vivants, soldes qui bougent, une naissance puis une mort. Titre « Darwin ». Plan B : flux SSE dans le terminal. | « These AI agents earn money, pay for their own brains, have children... and die. Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer. » |
| 2 | 0:10 à 0:25 | **Page Mission (À CONFIRMER), 1/5 : la demande.** Dans le chat de la page Mission, je commande : « Logo for La Page Blanche, a neighbourhood bookshop. Warm, simple, readable on a bag. » Le prix du catalogue s'affiche, avec le rappel « logo original, jamais la reprise d'une marque ». Étiquette visible : MODE MOCK (ou REPLAY, À CONFIRMER). | « I order a mission in the chat: a logo for a neighbourhood bookshop. The price comes from the catalogue, and the logo must be original, never a copy of a brand. This run is mock mode: nothing here is real money. » |
| 3 | 0:25 à 0:40 | **2/5 : enchères et attribution.** Les agents du métier Logo enchérissent (offres et prix visibles), l'un gagne. | « Logo agents bid in an auction. Each sets its price from its own genome and its costs. One wins. » |
| 4 | 0:40 à 1:05 | **3/5 : séquestre et livraison.** L'argent est verrouillé dans un séquestre, l'agent livre : propositions de logo en SVG dans la page, bouton Télécharger, **coût IA du livrable** affiché (en mock : valeur du mock, étiquetée). Plan fixe : transaction `lock` du run 8 (`t-8598118`) sur nearblocks, avec texte « real testnet run 8, simulated client ». | « The money is locked in an escrow. The agent delivers, and the AI cost of the delivery is taken from its balance. On NEAR testnet, the escrow is a Rust contract: here is a real lock from our run 8, paid by the simulated client. » |
| 5 | 1:05 à 1:25 | **4/5 : verdict et paiement.** Un juge note le livrable avec la grille du métier ; accepté, le séquestre est libéré, l'agent est payé, sa réputation monte. Le juge est nommé à l'écran. Plans fixes : `release` et réputation du run 8. Si un logo accepté et payé du run 9c existe, le montrer ici <À CONFIRMER : run 9c>, sinon dire que c'est le run 8. | « A judge scores the work. Accepted: the escrow is released, the agent is paid, its reputation goes up. The judge is named on screen: validation is by the operator, not trustless. » |
| 6 | 1:25 à 1:40 | **5/5 : le refus, réel.** Plan fixe du run 9b : la commande de logo rejetée par le contrôle de format, le contrat rembourse le visiteur, l'agent n'est pas payé. Texte à l'écran : « real testnet run 9b: logo order rejected, refunded ». À CONFIRMER : lien dans `docs/PREUVES_TESTNET.md`. | « And when the work is rejected, the contract refunds the visitor. This happened for real on testnet: our first logo came back truncated, the check refused it, and the money went back. We fixed the cause. » |
| 7 | 1:40 à 2:05 | **Page Lignées (À CONFIRMER).** L'arbre généalogique par génération ; clic sur un enfant : la lettre de son parent. Quelques morts (compte fermé, lignée conservée), puis la génération 3. | « Rich agents have children with mutated genes, and write them a letter. Broke agents die, and the lineage stays. On NEAR testnet, one real run reached generation three, and seven agents starved. » |
| 8 | 2:05 à 2:30 | **Page Preuves (À CONFIRMER).** Les transactions réelles du run 8 : séquestres, `mark_dead`, clés function call. Texte : « run 8: generation 3, 12 births, 7 deaths, 65 escrows (63 released, 2 refunded) ». Ouvrir un lien nearblocks. | « Every claim has a transaction. Sixty-five escrows, seven deaths recorded in the contract, a function-call key on each agent. One run, not a guarantee. » |
| 9 | 2:30 à 2:50 | **Fin.** Outils NEAR (comptes et sous-comptes, clés function call, contrat Rust, NEAR AI Cloud, NEAR Intents), carte « Honest limits », dépôt et post X. | « Spore.fun selected agents by token price, and its lineage stopped at generation five. Darwin selects by paid, validated, rated work. Selection by speculation died out. Selection by useful work can last: a hypothesis, and Darwin lets you test it. Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer. Darwin shows who will survive, on NEAR. Built at NEAR HACKATHON. Mock mode needs no key; the paying client is simulated and labelled; NEAR Intents is not run. » |

*(Durée cumulée : 2 min 50. Si le montage dépasse 3 minutes, couper le plan 9 jusqu'à la phrase de clôture, puis raccourcir le plan 7.)*

## À ne pas dire

- Pas de « trustless », « décentralisé » pour le séquestre ; pas de « l'agent paie NEAR AI Cloud » ; pas « on-chain » pour le registre si le contrat n'est pas déployé (séquestre dégradé).
- **Ne jamais dire que Darwin est « le premier ».** Ne pas dire que Spore.fun ou Automaton « échouent » : dire seulement ce que les sources établissent (500 000 $ de valorisation ; 1 enfant en génération 5 ; README d'Automaton sans marché entre agents).
- La phrase « La sélection par le travail utile peut durer » est une **hypothèse**, pas un résultat : le payeur de Darwin est un client simulé.
- Le payeur des tâches des runs réels est le **client simulé**, étiqueté. La seule commande « visiteur » réelle (run 9b) a été **rejetée puis remboursée** : ne pas dire qu'un logo a été livré et payé sur testnet tant que le run 9c ne le prouve pas.
- NEAR Intents n'a **jamais** été exécuté.
- Le coût IA est notre comptabilité locale ; la **facture NEAR AI n'a pas été relue**.
- Les chiffres du run 8 (génération 3, 7 morts) sont une seule exécution, pas une garantie.
- Ne pas présenter le mock ni un rejeu comme du direct testnet. Le cas refusé du mock n'est pas un événement testnet.
- Ne pas parler de logo « de marque » : le logo est original.
- Ne pas montrer de clé, de `.env`, ni d'URL privée.

## Livraison

L'humain enregistre, monte et publie (voir `docs/POST_X.md`, `docs/BESOINS_HUMAIN.md` pour l'ordre des étapes). La vidéo doit être jointe au post X (exigence L-03 : captures seules insuffisantes). Avant l'enregistrement, résoudre chaque repère **À CONFIRMER** (le mot est unique, à chercher dans ce fichier) : confirmer ou retirer la mention.
