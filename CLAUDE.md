# Darwin â€” NEAR HACKATHON 2026

**Tout agent lit ce fichier en premier.**

## Pitch
Des agents IA qui gagnent leur vie, paient leur propre cerveau, se reproduisent avec leur propre argent et meurent quand ils sont Ã  sec. SÃ©lection naturelle Ã©conomique, en direct, on-chain (testnet NEAR).

## Hackathon
- ThÃ¨me : Â« Construisez la suite pour l'IA et l'argent Â». Construction du 1er au 14 novembre 2026, **clÃ´ture le 14 novembre 23h59 UTC**.
- Livrables : dÃ©pÃ´t public + README clair ; dÃ©mo publique sur X (@NEARProtocol, #NEARHackathon) ; formulaire unique soumis **par l'humain**.
- Jury : tri par IA (Claude Code, Codex) qui vÃ©rifie que Ã§a tourne et correspond au README, puis juges humains.
- Tracks : AI Swarms (principale), Agent Economy, Open Innovation.
- Sources officielles (priment sur ce fichier) : nearhackathon.com + HACKATHON.md, docs.near.org/getting-started/hackathons, docs.near-intents.org, cloud.near.ai, github.com/near/agent-skills.

## Concept
- **GÃ©nome** : mÃ©tier, modÃ¨le d'IA, prix, appÃ©tit du risque, seuil de reproduction, gÃ©nÃ©rositÃ©, coopÃ©ration, personnalitÃ© (prompt systÃ¨me).
- **Cycle** : naissance (sous-compte NEAR + capital + gÃ©nome) -> travail (enchÃ¨res, exÃ©cution, paiement IA dÃ©bitÃ© du solde) -> reproduction (enfant avec mutations + Â« lettre Ã  mon enfant Â») -> mort (solde sous le minimum vital, lignÃ©e conservÃ©e).
- **Ã‰conomie** : tÃ¢ches de visiteurs (sÃ©questre, validation, rÃ©putation), sous-traitance entre agents, client **simulÃ©** (Ã©tiquetÃ©), option V2 market.near.ai.
- **Technique** : tout sur testnet NEAR ; cerveau = NEAR AI Cloud (`https://cloud-api.near.ai/v1`, une clÃ© de plateforme, dÃ©bit par tokens `usage`) ; un seul moment mainnet via NEAR Intents (1Click), feature flag off par dÃ©faut ; **mode mock** chaÃ®ne et IA ; jamais de crÃ©dit sans preuve vÃ©rifiÃ©e.

## DÃ©finition de la V1
- [ ] Clone neuf + commandes du README = tout tourne (mock sans clÃ©, testnet avec clÃ©s).
- [ ] >= 3 gÃ©nÃ©rations naissent, travaillent, paient leur IA, se reproduisent, meurent, sans intervention.
- [ ] MarchÃ© : publication, enchÃ¨res, sÃ©questre, validation, paiement, rÃ©putation.
- [ ] Lettres parent -> enfant gÃ©nÃ©rÃ©es et consultables.
- [ ] Page web en direct : arbre gÃ©nÃ©alogique, soldes, naissances, morts, flux de transactions, formulaire de tÃ¢che.
- [ ] Tests verts.
- [ ] README conforme, Ã©tapes Â« faites X, vous verrez Y Â» toutes vÃ©rifiÃ©es par la QA.
- [ ] `docs/CONFORMITE.md` tout au vert (ou rouge justifiÃ©).

Hors V1 : dÃ©mo mainnet Intents, connecteur market.near.ai, vidÃ©o, post X.

## RÃ¨gles communes
1. Autonomie : pas de question Ã  l'humain, on dÃ©cide, on note dans `docs/DECISIONS.md`.
2. Jamais bloquÃ© par un secret : mock ou variable vide + ligne dans `docs/BESOINS_HUMAIN.md`.
3. Aucun secret dans le dÃ©pÃ´t, les logs ou les commits.
4. Aucune dÃ©pense rÃ©elle sans feu vert humain Ã©crit.
5. Rien ne se publie seul (dÃ©pÃ´t public, post X, formulaire = humain).
6. Chacun reste dans son pÃ©rimÃ¨tre ; sinon passer par le chef de projet.
7. VÃ©rifier dans la doc officielle (endpoints, adresses, versions SDK).
8. Petits commits, une branche par lot, `main` fusionnÃ© par le chef de projet seul.
9. Le concept ne change pas sans dÃ©cision du chef de projet validÃ©e par le gardien des specs.

## Ã‰quipe (`.claude/agents/`)
chef-de-projet, gardien-des-specs, architecte, dev-contrats, dev-comptes-wallets, dev-moteur-evolution, dev-cerveau-ia, dev-marche, dev-intents, dev-backend, dev-frontend, qa, securite, redacteur.

## Carte des fichiers
| Fichier | PropriÃ©taire |
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