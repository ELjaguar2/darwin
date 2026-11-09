# Repli D-016 / D-022 (contrat non deploye)

Echeance : 2026-11-11 23:59 UTC. Si le contrat n'est pas compile par `cargo near build` ET deploye sur testnet a cette date, le chef de projet active le mode degrade :

- `NearChain` : sequestre = sous-compte `escrow.<maitre>` pilote par le moteur ; registre et reputation tenus dans le journal local.
- `GET /api/health` expose `escrow: "operator-account"` ; badge permanent UI : « Sequestre degrade : compte pilote par l'operateur, sans contrat ».
- Textes interdits en mode degrade : « on-chain » et « contrat intelligent » pour le registre, la reputation et le sequestre.
- Le code du contrat reste dans le depot, presente comme « teste en unitaire, non deploye ».

Regle de preuve conservee en degrade : le moteur n'appelle jamais le transfert de liberation sans preuve `accepted` (garde `PROOF_REQUIRED` cote `Chain`).

Etat au 2026-11-09 : voir `contracts/README.md` (section Etat verifie) avant d'activer ce repli.
