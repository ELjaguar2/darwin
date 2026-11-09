# CONFORMITE — grille à cocher

> Propriétaire : gardien-des-specs. Vert = conforme `[x]`, rouge = non conforme `[ ]` avec justification. Les identifiants renvoient à `docs/SPECS.md` (lu le 2026-11-09). Rien n'est coché tant que le gardien n'a pas vérifié le code, les tests ou l'exécution (pas de validation sans vérification).

## A. Définition de la V1 (CLAUDE.md)
- [ ] Clone neuf + commandes du README = tout tourne (mock sans clé, testnet avec clés)
- [ ] >= 3 générations naissent, travaillent, paient leur IA, se reproduisent, meurent, sans intervention
- [ ] Marché : publication, enchères, séquestre, validation, paiement, réputation
- [ ] Lettres parent -> enfant générées et consultables
- [ ] Page web en direct : arbre généalogique, soldes, naissances, morts, flux de transactions, formulaire de tâche
- [ ] Tests verts
- [ ] README conforme, étapes « faites X, vous verrez Y » toutes vérifiées par la QA
- [ ] Cette grille au vert (ou rouge justifié)

## B. Exigences officielles : dépôt et livrables (L-xx)
- [ ] L-01 Dépôt public (rendu public par l'humain, avant 2026-11-14 23:59 UTC) avec README reproductible
- [ ] L-02 Fichier LICENSE présent à la racine
- [ ] L-03 Démo ouvrable par les juges : installation locale reproductible, vidéo ou démo hébergée (captures seules insuffisantes)
- [ ] L-04 Si démo hébergée : en ligne au moins jusqu'au 2026-11-18 (idéal 2026-11-25) (humain)
- [ ] L-05 Post X rédigé (`docs/POST_X.md`) : « built at NEAR HACKATHON », @NEARProtocol, #NEARHackathon, vidéo ou captures ; publié par l'humain
- [ ] L-07 README : section de divulgation (code antérieur au 1er nov. s'il y en a, code tiers, code généré par IA, bibliothèques et gabarits, travail NEAR antérieur)
- [ ] L-07 Si l'humain a un second projet : les deux README se citent
- [ ] L-08 Historique git cohérent avec la fenêtre (tag ou branche pré-hackathon si du code existe avant)
- [ ] L-09 README lisible par machine et humain : produit, problème, étapes « faites X, voyez Y »
- [ ] Tout le code est écrit depuis l'annonce (H-07)

## C. Exigences officielles : soumission (S-xx), humain uniquement
- [ ] S-02 `docs/FORMULAIRE.md` fournit chaque champ conforme : projectName 2-80, leadName 2-80, email, size (`1`, `2 - 4`, ...), tracks (ids valides), nearAddress mainnet, projectUrl, demoUrl, idea 20-2000 car., consent
- [ ] S-03 Aucun champ en trop ; `website` laissé vide ; corps < 12000 octets
- [ ] S-04 Texte de consentement verbatim présenté à l'humain
- [ ] S-07 Le JSON final est affiché à l'humain, qui confirme ; aucune soumission automatique
- [ ] S-08 Compte NEAR mainnet de paiement fourni par l'humain (jamais créé par un agent)
- [ ] S-01 Soumission effectuée une seule fois avant la clôture (humain)
- [ ] Tracks cochés décidés (recommandation : `swarms`, `agents`, éventuellement `business`, `open`)

## D. Exigences officielles : jugement (J-xx)
- [ ] J-01 Un agent IA neuf peut cloner, lancer et reproduire chaque étape du README sans aide (test QA)
- [ ] J-01 Chaque fonction annoncée dans le README existe et fonctionne (pas d'écart README/code)
- [ ] J-03 Les critères indicatifs sont couverts : implémentation technique, design, impact, originalité, durabilité

## E. NEAR AI Cloud (C-xx)
- [ ] C-01 Appels vers `https://cloud-api.near.ai/v1` (`/chat/completions`, `/models`), URL configurable
- [ ] C-02 Auth par `Authorization: Bearer` avec clé lue dans une variable d'environnement, jamais en dur
- [ ] C-04 Modèle choisi par configuration et vérifié via `GET /v1/models` (pas d'id codé sans vérification) ; prix lus depuis `/v1/models`
- [ ] C-05 Coût IA débité du solde de l'agent à partir de `usage` (prompt + completion, y compris tokens de raisonnement)
- [ ] Mode mock IA complet quand la clé est absente
- [ ] Clé absente documentée dans `docs/BESOINS_HUMAIN.md`

## F. Réseau NEAR (N-xx, T-xx)
- [ ] T-05 / N-01 Tout tourne sur testnet NEAR ; faucet documenté dans le README
- [ ] N-02 URL RPC testnet vérifiées sur la liste officielle des fournisseurs
- [ ] T-04 Contrat(s) NEAR personnalisé(s) cohérent(s) avec les tracks choisis
- [ ] T-02 / T-03 Le projet démontre réellement des enchères et sous-comptes (Swarms) ainsi que des agents qui gagnent, dépensent et sous-traitent (Agent Economy)
- [ ] Mode mock chaîne complet (sans réseau ni clé)

## G. NEAR Intents (I-xx), hors V1
- [ ] I-01 Si intégré : base `https://1click.chaindefuser.com`, `assetId` pris de `/v0/tokens`
- [ ] I-03 Aucun appel `dry:false` ni dépôt mainnet sans feu vert humain écrit dans `docs/BESOINS_HUMAIN.md` ; feature flag off par défaut
- [ ] I-05 Frais re-vérifiés au moment d'une éventuelle exécution (sources divergentes, voir SPECS E-07)

## H. Concept Darwin (CLAUDE.md) et règles communes
- [ ] Génome : métier, modèle d'IA, prix, appétit du risque, seuil de reproduction, générosité, coopération, personnalité
- [ ] Cycle : naissance (sous-compte + capital + génome), travail, reproduction (mutations + lettre), mort (solde sous le minimum vital, lignée conservée)
- [ ] Économie : tâches de visiteurs (séquestre, validation, réputation), sous-traitance, client simulé étiqueté comme simulé
- [ ] Jamais de crédit sans preuve vérifiée
- [ ] Aucune dérive de périmètre : pas d'ajout hors concept sans décision validée par le gardien
- [ ] R3 Aucun secret dans le dépôt, les logs ou les commits (scan `scripts/scan-secrets.*` vert)
- [ ] R4 Aucune dépense réelle sans feu vert humain écrit
- [ ] R5 Rien n'est publié automatiquement (dépôt, X, formulaire = humain)
- [ ] R2 Chaque secret manquant a une ligne dans `docs/BESOINS_HUMAIN.md`

## I. Avis par lot
| Lot | Avis (VALIDÉ / REFUSÉ) | Date | Raisons |
|---|---|---|---|
| L0 | n/a (rédaction des specs) | 2026-11-09 | SPECS.md et CONFORMITE.md rédigés ; réserves : pages `authentication.md` 1Click, OpenAPI, RPC providers, `private-inference` non lues ; fiabilité des résumés WebFetch à re-vérifier avant soumission. |
