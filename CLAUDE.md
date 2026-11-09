# Darwin — NEAR HACKATHON 2026

**Tout agent lit ce fichier en premier.**

## Pitch
Des agents IA qui gagnent leur vie, paient leur propre cerveau, se reproduisent avec leur propre argent et meurent quand ils sont à sec. Sélection naturelle économique, en direct, on-chain (testnet NEAR).

## Hackathon
- Thème : « Construisez la suite pour l'IA et l'argent ». Construction du 1er au 14 novembre 2026, **clôture le 14 novembre 23h59 UTC**.
- Livrables : dépôt public + README clair ; démo publique sur X (@NEARProtocol, #NEARHackathon) ; formulaire unique soumis **par l'humain**.
- Jury : tri par IA (Claude Code, Codex) qui vérifie que ça tourne et correspond au README, puis juges humains.
- Tracks : AI Swarms (principale), Agent Economy, Open Innovation.
- Sources officielles (priment sur ce fichier) : nearhackathon.com + HACKATHON.md, docs.near.org/getting-started/hackathons, docs.near-intents.org, cloud.near.ai, github.com/near/agent-skills.

## Concept
- **Génome** : métier, modèle d'IA, prix, appétit du risque, seuil de reproduction, générosité, coopération, personnalité (prompt système).
- **Cycle** : naissance (sous-compte NEAR + capital + génome) -> travail (enchères, exécution, paiement IA débité du solde) -> reproduction (enfant avec mutations + « lettre à mon enfant ») -> mort (solde sous le minimum vital, lignée conservée).
- **Économie** : tâches de visiteurs (séquestre, validation, réputation), sous-traitance entre agents, client **simulé** (étiqueté), option V2 market.near.ai.
- **Technique** : tout sur testnet NEAR ; cerveau = NEAR AI Cloud (`https://cloud-api.near.ai/v1`, une clé de plateforme, débit par tokens `usage`) ; un seul moment mainnet via NEAR Intents (1Click), feature flag off par défaut ; **mode mock** chaîne et IA ; jamais de crédit sans preuve vérifiée.

## Définition de la V1
- [ ] Clone neuf + commandes du README = tout tourne (mock sans clé, testnet avec clés).
- [ ] >= 3 générations naissent, travaillent, paient leur IA, se reproduisent, meurent, sans intervention.
- [ ] Marché : publication, enchères, séquestre, validation, paiement, réputation.
- [ ] Lettres parent -> enfant générées et consultables.
- [ ] Page web en direct : arbre généalogique, soldes, naissances, morts, flux de transactions, formulaire de tâche.
- [ ] Tests verts.
- [ ] README conforme, étapes « faites X, vous verrez Y » toutes vérifiées par la QA.
- [ ] `docs/CONFORMITE.md` tout au vert (ou rouge justifié).

Hors V1 : démo mainnet Intents, connecteur market.near.ai, vidéo, post X.

## Règles communes
1. Autonomie : pas de question à l'humain, on décide, on note dans `docs/DECISIONS.md`.
2. Jamais bloqué par un secret : mock ou variable vide + ligne dans `docs/BESOINS_HUMAIN.md`.
3. Aucun secret dans le dépôt, les logs ou les commits.
4. Aucune dépense réelle sans feu vert humain écrit.
5. Rien ne se publie seul (dépôt public, post X, formulaire = humain).
6. Chacun reste dans son périmètre ; sinon passer par le chef de projet.
7. Vérifier dans la doc officielle (endpoints, adresses, versions SDK).
8. Petits commits, une branche par lot, `main` fusionné par le chef de projet seul.
9. Le concept ne change pas sans décision du chef de projet validée par le gardien des specs.

## Équipe (`.claude/agents/`)
chef-de-projet, gardien-des-specs, architecte, dev-contrats, dev-comptes-wallets, dev-moteur-evolution, dev-cerveau-ia, dev-marche, dev-intents, dev-backend, dev-frontend, qa, securite, redacteur.

## Carte des fichiers
| Fichier | Propriétaire |
|---|---|
| `CLAUDE.md`, `docs/PLAN.md`, `docs/STATUS.md`, `docs/BESOINS_HUMAIN.md` | chef-de-projet |
| `docs/SPECS.md`, `docs/CONFORMITE.md` | gardien-des-specs |
| `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` | architecte |
| `contracts/` | dev-contrats |
| `accounts/` | dev-comptes-wallets |
| `engine/` | dev-moteur-evolution |
| `brain/` | dev-cerveau-ia |
| `market/` | dev-marche |
| `intents/` | dev-intents |
| `backend/`, scripts de lancement | dev-backend |
| `frontend/` | dev-frontend |
| `tests/e2e/`, `docs/QA_RAPPORT.md` | qa |
| `docs/SECURITE.md`, `.gitignore`, `scripts/scan-secrets.*` | securite |
| `README.md`, `docs/FORMULAIRE.md`, `docs/VIDEO_SCRIPT.md`, `docs/POST_X.md` | redacteur |
| `.env.example` | architecte + securite |

Les noms de dossiers de code sont provisoires : l'architecte les fixe dans `docs/ARCHITECTURE.md`.