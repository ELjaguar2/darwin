# contracts/darwin (lot L3)

Contrat NEAR unique (Rust, `near-sdk` 5.30.1) : registre des agents et genealogie, sequestre des taches, reputation. Modele de confiance : l'operateur (compte maitre) est l'oracle de validation (D-015, D-024), ce n'est pas « trustless ».

## Etat verifie (2026-11-09)
| Element | Etat |
|---|---|
| Chaine d'outils | Rust 1.99.1 (toolchain `stable-x86_64-pc-windows-gnu`, installee dans `~/.rustup`, `~/.cargo`, sans droits admin) + cible `wasm32-unknown-unknown`. |
| Tests unitaires | `cargo test` : **35 tests verts** (natif). Sur cette machine il faut `AWS_LC_SYS_PREBUILT_NASM=1` (sinon `aws-lc-sys` exige NASM). |
| Compilation WASM | `cargo build --target wasm32-unknown-unknown --release` : OK, `darwin.wasm` ~447 Ko. |
| `cargo-near` | **Non installe, non utilise.** Le WASM n'a pas ete produit par `cargo near build` ; compatibilite du WASM (rustc 1.99, jeu d'instructions) avec le runtime NEAR **non verifiee**. |
| Simulation sandbox / testnet | **Non faite.** Aucun deploiement, aucun appel reel : les transferts (`Promise`) ne sont testes qu'en unitaire (callback appele a la main). |
| Deploiement testnet | **Non fait** : exige un compte maitre/contrat finance (voir `docs/BESOINS_HUMAIN.md`). |

## Methodes
Ecritures (operateur = `NEAR_MASTER_ACCOUNT_ID`, sauf mention) :
- `new(operator)` : initialisation.
- `register_agent(record)` : `agent_id`, `account_id`, `parent_id?`, `generation`, `genome_hash` (sha256 hex de `genome_json`, verifie), `genome_json` (JSON canonique), `birth_tick`. Parent connu et generation = parent+1 ; fondateur = generation 1 ; doublon refuse.
- `mark_dead(agent_id, death_tick, cause)` : cause `starvation|manual|reset`. L'enregistrement reste (lignee conservee).
- `reserve_task(task_id, payer)` : l'operateur reserve l'id de tache pour un payeur (anti-squat : les ids sont previsibles). `get_reservation` en vue.
- `lock_escrow(task_id, payer)` payable : exige une reservation de CET id pour CE payeur (consommee au verrouillage) ; appelant = payeur (signataire, sous-compte d'agent ou compte visiteurs) ou operateur. Le payeur n'a donc pas besoin de l'operateur pour verrouiller, mais ne peut pas prendre un id non reserve.
- `release_escrow(task_id, payee, proof{result_hash, verdict:"accepted", validator})` : preuve obligatoire ; transfert puis callback (`releasing` -> `released`, ou retour a `locked` si le transfert echoue).
- `refund_escrow(task_id, reason)` : `reason` = `"rejected"` ou `"expired"` uniquement (enum).
- `add_reputation(agent_id, task_id, delta, proof_hash)` : delta != 0, |delta| <= 100 ; credit seulement si le sequestre est `released` vers cet agent et `proof_hash` = `result_hash` de la preuve ; malus (delai manque inclus) apres remboursement `rejected` ou `expired` ; une ecriture par (tache, agent).
- `on_settled` : callback prive.

Vues : `get_agent`, `list_agents(from, limit)` (max 100), `agents_count`, `get_escrow`, `get_reputation`, `get_operator`. Evenements NEP-297 `EVENT_JSON:{"standard":"darwin","version":"1.0.0",...}` pour chaque ecriture.

## Ecarts avec ARCHITECTURE.md / `shared/chain.ts` (a traiter par dev-comptes-wallets, L2)
1. `registerAgent` : le contrat attend `genome_json` (JSON canonique, `canonicalJson`) en plus de `genome_hash` ; `NearChain` doit envoyer la chaine canonique dont `genomeHash` est le sha256.
2. `refundEscrow({reason})` : le contrat n'accepte que `rejected` ou `expired` ; `NearChain` doit mapper.
3. `addReputation` est plus strict que `MockChain` : il exige un sequestre libere (ou rembourse pour rejet) pour la meme tache. Le marche doit liberer avant de crediter, et appeler `reserve_task` (operateur) avant chaque `lock_escrow` (nouvel appel, absent de `Chain` : `NearChain` doit l'enchainer dans `lockEscrow`) ; delta entier.
4. Statuts transitoires `releasing`/`refunding` en plus de `locked/released/refunded` (a traiter comme « en cours »). Montants en chaine decimale (`U128`).
5. `lock_escrow` : le depot vient du compte qui signe (operateur ou payeur). Si l'operateur signe, les fonds sont ceux de l'operateur, pas ceux du sous-compte payeur : pour un vrai debit du payeur, le moteur doit signer avec la cle du sous-compte.

## Commandes
- Tests : `cd contracts/darwin && cargo test` (Windows sans NASM : `AWS_LC_SYS_PREBUILT_NASM=1`).
- Build : `npm run contracts:build` (cargo-near requis).
- Deploiement : `NEAR_CONTRACT_ID=... NEAR_MASTER_ACCOUNT_ID=... bash contracts/deploy-testnet.sh`. Signature par le trousseau du CLI NEAR (`near login`), aucune cle dans le depot. La syntaxe `near contract deploy ... with-init-call` n'a pas pu etre verifiee contre la doc officielle ni executee.

Repli : `contracts/FALLBACK.md`.
