# Besoins pour l'humain — mis à jour le 2026-11-09 21:34

## Résumé en 5 lignes
La V1 tourne **en mode mock sans aucune clé** : 183 tests verts, recette QA réussie depuis un clone neuf (docs/QA_RAPPORT.md), page web en direct, 3+ générations autonomes, marché complet, lettres parent -> enfant. **Jamais exécuté en vrai** : le mode testnet, le contrat Rust (compilé et testé en natif, non déployé), NEAR AI Cloud (aucun appel `chat/completions` réel), NEAR Intents (aucune opération réelle). Le séquestre est en **mode dégradé** tant que le contrat n'est pas déployé (échéance interne : **2026-11-11 23:59 UTC**, voir D-022). Le README le dit honnêtement. Priorité : fournir le compte testnet maître + la clé NEAR AI, puis publier le dépôt, le post X et soumettre le formulaire **avant le 2026-11-14 23:59 UTC**.

## À fournir
| Priorité | Besoin | Pourquoi | Où l'obtenir (lien officiel) | Variable d'env. ou fichier | Bloquant pour |
|---|---|---|---|---|---|
| P0 | Compte NEAR **testnet** « maître » financé (faucet, à la main : aucune API de faucet documentée) | Créer les sous-comptes des agents, jouer le mode testnet | https://near-faucet.io ou le formulaire de https://docs.near.org/getting-started/faucet | NEAR_MASTER_ACCOUNT_ID, NEAR_MASTER_PRIVATE_KEY (dans `.env`, jamais commité) | mode testnet |
| P0 | Node **>= 22.22.2** (la machine a 22.17.1) + `npm install near-api-js@7.4.0` | Le client NEAR l'exige ; le backend refuse sous 22.12 et avertit en testnet sous 22.22.2 | https://nodejs.org | — | mode testnet |
| P1 | Clé API NEAR AI Cloud (optionnelle : le mock suffit à la V1) | Confirmer `usage` sur une vraie réponse (case C-05) et jouer le cerveau réel ; plafonds par défaut 2 USD/run, 1 USD/heure | cloud.near.ai (crédits à acheter, ou 10 USD via NEAR Builders selon SPECS.md) | NEARAI_API_KEY | mode IA réel |
| P1 | Pour déployer le contrat : `cargo-near`, CLI `near`, un compte contrat testnet financé, `near login` | Sortir du séquestre dégradé (D-016) | docs.near.org | NEAR_CONTRACT_ID | contrat déployé |
| P1 | Compte GitHub + dépôt **public avant la clôture** | Livrable obligatoire (les juges ne lisent pas un dépôt privé) ; il doit le rester pendant le jugement | github.com | — | livraison |
| P1 | Compte X, publication du post (@NEARProtocol, #NEARHackathon, « built at NEAR HACKATHON ») avec la vidéo | Livrable obligatoire | x.com — brouillon : docs/POST_X.md, script vidéo : docs/VIDEO_SCRIPT.md | — | livraison |
| P1 | Compte NEAR **mainnet** (adresse qui reçoit le prix) + e-mail + nom du chef d'équipe + taille d'équipe + choix des tracks | Champs du formulaire (aucune clé 1Click n'est requise) | nearhackathon.com | — | soumission |
| P1 | Confirmation « aucun code antérieur » (README §11) et mention d'un éventuel second projet | Divulgation exigée | — | — | soumission |
| P2 | Mainnet avec ~2 NEAR de dev, adresse EVM de destination valide (casse EIP-55), JWT 1Click optionnel | Démo NEAR Intents réelle (hors V1) | docs.near-intents.org — procédure : intents/DEMO_MAINNET.md | INTENTS_JWT (optionnel) | démo mainnet |

## Décisions à prendre
1. **Historique git** : 7 valeurs factices (fixtures d'un test de masquage de secrets, commit `4eb92ea`, `backend/backend.test.ts`) font échouer `npm run scan:secrets` sur l'historique (les fichiers actuels sont propres). Recommandation de l'équipe (securite) : **réécrire ce seul commit en toute dernière étape avant la publication**, après sauvegarde du dépôt, puis `git reflog expire` + `git gc` et relancer le scan. Alternative : garder l'historique tel quel et le documenter (le scan reste en échec, un scanner tiers du jury pourrait alerter). Réécrire l'historique est irréversible : rien n'est fait sans ton accord.
2. **Contrat : déployer ou rester en dégradé ?** Recommandation : tenter le déploiement testnet avant le 2026-11-11 23:59 UTC (le WASM est construit avec cargo simple, pas avec `cargo near build` : compatibilité runtime non vérifiée). Sinon le séquestre dégradé reste, avec son badge et sa section README.
3. **Option `trust proxy`** pour les plafonds par IP derrière un proxy : non codée. À demander seulement si la démo est exposée derrière un proxy.

## Feux verts demandés
- **Démo mainnet NEAR Intents** (hors V1) : **aucun feu vert donné, rien n'a été dépensé.** Pour l'obtenir, écris ici : montant maximal (le code plafonne à 5 USD), paire (proposée : wNEAR sur near vers USDC sur Base) et compte de dev. Voir intents/DEMO_MAINNET.md : tu envoies toi-même les fonds depuis ton wallet.
- **Rendre le dépôt public** : à faire par toi (règle 5), après la décision n°1 et un dernier `npm run scan:secrets`.
- **Soumettre le formulaire** (une seule fois, non modifiable) : à faire par toi, après vérification de docs/FORMULAIRE.md (`node scripts/check-formulaire.mjs`).
