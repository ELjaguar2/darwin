# Besoins pour l'humain — mis à jour le 2026-11-11 (run 8 : génération 3 et morts prouvés)

## Résumé en 8 lignes
- **Tourné en réel le 2026-11-10 (preuves : `docs/PREUVES_TESTNET.md`, §8 = run 8)** : compte maître testnet, contrat Rust déployé (`darwin-contract-7k2.testnet`), **un seul run réel avec génération 3, 12 naissances, 8 reproductions et 7 morts par famine** (preset `selection`, 59 ticks, environ 40 minutes), 65 séquestres verrouillés (63 libérés, 2 remboursés) avec réputation, clé function call à droits limités ajoutée à la naissance (vérifiée sur la chaîne), appels réels à NEAR AI Cloud (environ 0,034 USD cumulés en comptabilité locale ; budget 10 € très loin d'être touché), une attestation TEE vérifiée (un seul modèle).
- **Toujours pas prouvé** : tâches de visiteurs humains en réel (le payeur est le client simulé `sim-client`), NEAR Intents (jamais exécuté, aucune dépense), facture réelle NEAR AI (non relue), un second run qui confirme la génération 3 (un seul run).
- **Correctifs faits (lot L15)** : clé function call dans la transaction de création, ids décalés automatiquement, `NEAR_RPC_URL` multi-fournisseurs (bascule non testée en réel), cache court des états de compte, coût du juge comptabilisé, preset `selection`.
- **Revues** : gardien des specs GO (README, FORMULAIRE, VIDEO_SCRIPT, CONFORMITE alignés sur ce qui a tourné), sécurité GO (aucun secret ; 3 réserves mineures : R1 corrigée, R2 test ajouté, R3 à documenter dans `docs/SECURITE.md`).
- **Rien n'est publié** : dépôt, post X et formulaire sont à vous (règle 5). Aucune dépense mainnet.
- `testnet-reel` est fusionné dans `main` par le chef de projet (instruction de cette session).
- Les clés (NEAR AI, compte maître) sont uniquement dans `.env`, ignoré par git. Elles ont transité par la conversation : **régénérez-les avant de rendre le dépôt public ou de partager la session**.
- Échéance : **2026-11-14 23:59 UTC** (livrables : dépôt public, démo X, formulaire).

## À faire par vous (par priorité)
| Priorité | Action | Pourquoi | Détail |
|---|---|---|---|
| P0 | Vérifier la facture réelle sur https://cloud.near.ai | Nos chiffres (0,015 USD) sont une comptabilité locale ; la facture réelle n'a pas été relue | Comparer avec `npm run ai:usage-report -- --dir data` |
| P0 | **Régénérer la clé NEAR AI** (sk-…) et la clé du compte maître si vous partagez la conversation ou publiez | La clé NEAR AI a été collée en clair dans la conversation ; la clé du compte maître est dans `.env` et le trousseau du CLI | Mettre les nouvelles valeurs dans `.env` uniquement. Le compte maître testnet ne vaut rien (testnet), la clé NEAR AI si |
| P1 | Décider de l'historique git (7 valeurs factices, commit `4eb92ea`) | `npm run scan:secrets` échoue sur l'historique (pas sur les fichiers) | Recommandation de l'équipe sécurité : réécrire ce seul commit juste avant publication, après sauvegarde. Irréversible : rien n'est fait sans accord. `npm run scan:secrets -- --no-history` est propre |
| P1 | Rendre le dépôt GitHub **public** avant la clôture et le laisser public | Livrable obligatoire | À faire par vous, après la décision ci-dessus et un dernier scan |
| P1 | Publier le post X avec la vidéo (@NEARProtocol, #NEARHackathon) | Livrable obligatoire | Brouillon `docs/POST_X.md`, script `docs/VIDEO_SCRIPT.md` (aligné sur le run 8 par le gardien des specs) |
| P1 | Soumettre le formulaire (une seule fois, non modifiable) | Livrable obligatoire | `docs/FORMULAIRE.md` (champ `idea` : 1913 caractères sur 2000, aligné sur le run 8) ; vérifier avec `node scripts/check-formulaire.mjs` |
| P1 | Infos du formulaire : compte NEAR **mainnet** (réception du prix), e-mail, nom du chef d'équipe, taille d'équipe, tracks | Champs du formulaire | nearhackathon.com |
| P1 | Confirmer « aucun code antérieur » (README §11) et mentionner un éventuel second projet | Divulgation exigée | — |
| P2 | Optionnel : clé/abonnement RPC testnet dédié ; plusieurs URL possibles séparées par des virgules (fastnear.com ou un autre fournisseur listé sur https://docs.near.org/api/rpc/providers) | Évite les 429 du RPC gratuit | `NEAR_RPC_URL` dans `.env`. Le lot L15 sait aussi chercher un fournisseur sans clé |
| P2 | Démo mainnet NEAR Intents (hors V1) | — | **Aucun feu vert donné, rien dépensé.** Pour l'obtenir : écrire ici le montant maximal (plafond du code : 5 USD), la paire et le compte de dev ; voir `intents/DEMO_MAINNET.md` |

## État de l'environnement local (utile pour reprendre)
- Outils installés pendant la session : `near-cli-rs` 0.31.1 (npm global) ; Node portable **22.23.4** dans `C:\Users\aymer\node22\node-v22.23.4-win-x64` (la machine reste en 22.17.1 : à mettre en tête de `PATH` pour le mode testnet, `near-api-js` exige >= 22.22.2) ; Rust 1.99.1 + cible `wasm32-unknown-unknown` dans `~/.cargo` (à ajouter au `PATH`).
- `.env` (non versionné) contient : clé NEAR AI, compte maître + clé, `NEAR_CONTRACT_ID`, `DARWIN_MODE=testnet` et les réglages de run (ticks, économie, plafond de population, décalages d'ids `DARWIN_AGENT_SEQ_START`/`DARWIN_TASK_SEQ_START`). Pour revenir au mock, supprimer ou renommer `.env`.
- Comptes testnet : `darwin-master-7k2.testnet` (maître, solde à relire avec `near account view-account-summary`), `darwin-contract-7k2.testnet` (contrat). Le maître finance les sous-comptes des agents et le client simulé : son solde baisse à chaque run (environ 1 NEAR par run observé, 10 NEAR reçus au départ). Un nouveau compte maître = un appel au robinet.
- Les décalages d'ids sont maintenant automatiques (horloge) : supprimer `DARWIN_AGENT_SEQ_START` et `DARWIN_TASK_SEQ_START` de `.env` (déjà fait). Le solde du maître était de 3,12 NEAR après le run 8 : un run de 40 minutes en consomme environ 0,7.
- Journaux locaux (ignorés par git) : `data/journal.jsonl`, `data/archive/*` (runs 1 à 6), `data/ai-usage.jsonl`, `data/ai-budget.json`. Copies commitées : `docs/preuves/run5-journal.jsonl`, `docs/preuves/run6-journal.jsonl`.

## Décisions encore ouvertes
1. **Historique git** : réécrire ou documenter (voir P1).
2. ~~Fusion de `testnet-reel`~~ : faite après les avis du gardien et de la sécurité.
3. **Option `trust proxy`** pour les plafonds par IP derrière un proxy : non codée, seulement si la démo est exposée derrière un proxy.

## Feux verts demandés
- **Démo mainnet NEAR Intents** : aucun feu vert, aucune dépense.
- **Rendre le dépôt public / poster / soumettre le formulaire** : à faire par vous.
