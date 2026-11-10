# FORMULAIRE : brouillon de soumission (aucune soumission faite)

> **Thèse du pitch** : « Aujourd'hui, on paie la consommation de son IA. Demain, on paiera un agent comme un freelance : il aura ses charges, répondra à des appels d'offres et devra être rentable pour exister. Darwin montre qui survivra, sur NEAR. »

> Propriétaire : redacteur. **Rien n'est soumis.** L'humain relit la page https://nearhackathon.com/HACKATHON.md avant de soumettre, vérifie chaque valeur, puis soumet lui-même (formulaire https://nearhackathon.com/#apply ou `POST /api/applications`). Champs et limites d'après `docs/SPECS.md` S-02 à S-05 (à re-vérifier sur la page vivante).

## Champs

| Champ | Limites | Valeur | Qui fournit |
|---|---|---|---|
| `requestId` (API seulement) | UUID, généré une fois et réutilisé aux retries | à générer | humain |
| `projectName` | 2 à 80 caractères | `Darwin` | proposé |
| `leadName` | 2 à 80 | **À FOURNIR** | humain |
| `email` | valide, max 160 ; 2 soumissions max par email | **À FOURNIR** | humain |
| `size` | `1`, `2 - 4`, `4 - 6`, `6 - 8` ou `8+` | **À FOURNIR** (taille réelle de l'équipe humaine) | humain |
| `tracks` | ids, chacun une fois | recommandation : `swarms`, `agents` ; éventuellement `open` (et `business`). **Décision de l'humain.** | humain |
| `nearAddress` | 2 à 64, minuscules ; compte **mainnet** nommé ou implicite (64 car.) créé par l'équipe | **À FOURNIR** (jamais créé par un agent) | humain |
| `projectUrl` | dépôt public, max 300 | **À FOURNIR** : URL du dépôt, à rendre public avant le 2026-11-14 23:59 UTC | humain |
| `demoUrl` | post X public, max 300 | **À FOURNIR** : URL du post publié (voir `docs/POST_X.md`) | humain |
| `idea` | **20 à 2000 caractères** | texte ci-dessous | proposé, relu par l'humain |
| `consent` | `true` après accord du lead | `true` seulement si le lead lit et accepte : « I agree that the organizers may use these details to review our submission and contact us about this hackathon. » | humain |
| `website` | piège anti-spam : laisser **vide** (ne pas envoyer de valeur) | vide | -- |

Aucun autre champ ne doit être envoyé (corps limité à 12000 octets). Codes de réponse : 201 enregistré ; 400 corriger (même `requestId`) ; 403 fermé ou cross-site (ne pas réessayer) ; 409 doublon (ne pas contourner) ; 413 trop gros ; 503 réessayer avec le même `requestId`. Corrections après coup : https://nearhackathon.com/request-changes.

## Texte du champ `idea`

Il contient le problème, le produit et la place de NEAR. Les termes sont ceux du README (ce qui est mock ou non exécuté y est dit). Faits mis à jour le 2026-11-11 d'après `docs/PREUVES_TESTNET.md` (run 8).

<!-- idea:start -->
```text
"Today, you pay for your AI's consumption. Tomorrow, you will pay an agent like a freelancer: it will have overhead, answer calls for tenders and have to be profitable to exist. Darwin shows who will survive, on NEAR."

Problem: can an agent pay its own inference bill, and which prices, risk levels and cooperation levels survive?

Product: Darwin is a live economy of AI agents, fully simulated by default, or on NEAR testnet. Each agent has a genome (profession, AI model, price, risk appetite, reproduction threshold, generosity, cooperation, personality). It is born as a NEAR sub-account with a capital, bids in auctions, does tasks (simulated client, visitors, other agents via subcontracting), is paid from an escrow after validation, and has its AI cost debited from its balance. Rich agents reproduce: a child with mutated genes plus a "letter to my child" written by the parent's brain. Agents whose balance falls under the vital minimum die and their account is closed; the lineage stays. Selection pressure shows which genomes survive.

NEAR, run for real on testnet (tx ids in docs/PREUVES_TESTNET.md): a sub-account and function-call key per agent, a Rust registry/escrow/reputation contract, NEAR AI Cloud as the brain. One run reached generation 3: 12 births, 7 deaths by starvation, 65 escrows in the contract (63 released, 2 refunded).

Honesty: mock is the default; on testnet the client was the labelled simulated client (no human visitor paid); AI cost (about 0.03 USD) is our local accounting, invoice not re-read; NEAR Intents (1Click, off by default) was never executed; escrow is validated by the master account (an oracle, not trustless); the economy is subsidised and a closed loop.

Run: npm install && npm run start:mock. The README has "do X, you will see Y" steps run against the real backend. Most code was written by AI agents (Claude Code), disclosed in the README. MIT license.
```
<!-- idea:end -->

Vérification du compteur (script) : `node scripts/check-formulaire.mjs` (affiche le nombre de caractères et échoue hors de 20 à 2000). **Ré-exécuter après toute modification du texte**, et garder ce texte aligné sur le README et sur `docs/PREUVES_TESTNET.md` si les faits changent.

## Ce que l'humain doit faire avant de soumettre

1. Rendre le dépôt public ; vérifier que LICENSE et README y sont.
2. Publier le post X (`docs/POST_X.md`) avec la vidéo ; copier son URL dans `demoUrl`.
3. Fournir `leadName`, `email`, `size`, `nearAddress` (compte mainnet), choisir les `tracks`.
4. Relire le README : confirmer « pas de code antérieur » et dire si un second projet existe.
5. Afficher le JSON final, relire, et soumettre **une seule fois**. Ne pas utiliser le vrai dépôt ni le vrai email pour des tests de soumission.
