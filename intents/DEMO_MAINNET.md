# Démo mainnet NEAR Intents (1Click) — procédure pour l'humain

Un seul moment réel, petites sommes, **mainnet** (Intents n'a pas de testnet). Rien de ceci n'est exécuté par les agents. Le code ne signe jamais : c'est vous qui envoyez le dépôt depuis votre wallet.

## 0. Feu vert
Rien ne se passe sans que vous ayez écrit un feu vert dans `docs/BESOINS_HUMAIN.md` (section « Feux verts accordés »), par exemple : « Feu vert intents : 1 NEAR maximum, wNEAR(near) -> USDC(base), compte X, date ». Plafond du code : 5 USD par opération (`maxUsd`).

## 1. Préparer (gratuit)
- Un compte NEAR **mainnet de dev**, séparé de vos comptes principaux, avec environ 2 NEAR (1 NEAR pour le swap + frais de gaz). Un wallet qui vous permet de **transférer des wNEAR** ou de faire un `ft_transfer` (voir note ci-dessous).
- Une adresse de destination valide sur la chaîne cible (ex. adresse EVM sur Base, casse EIP-55 correcte, sinon l'API répond « recipient is not valid »).
- Optionnel : clé partenaire sur https://partners.near-intents.org -> `INTENTS_JWT` (envoyée en en-tête `X-API-Key`, jamais journalisée). Sans clé, frais un peu plus élevés.
- `npm install`, Node >= 22.22.2.

## 2. Vérifier sans rien dépenser (dry-run public)
```
INTENTS_ENABLED=true npx tsx intents/demo.ts tokens
INTENTS_ENABLED=true npx tsx intents/demo.ts dry wNEAR near USDC base 1000000000000000000000000 <votre_compte.near> <adresse_0x_destination>
```
Vous obtenez `amountOut`, `minAmountOut`, `appFeeBps`. Exemple réel observé le 2026-11-09 : 1 wNEAR (3,55 USD) -> 3 532 493 USDC (6 décimales), `appFeeBps: 20` sans clé (la doc fees.md annonce 25 ; on lit la valeur réelle). Si `dry` échoue, ne continuez pas.

## 3. Swap réel (après feu vert)
```
INTENTS_ENABLED=true INTENTS_DRY_ONLY=false npx tsx intents/demo.ts run wNEAR near USDC base 1000000000000000000000000 <votre_compte.near> <adresse_0x_destination>
```
Le script fait : dry:true, puis dry:false (affiche une **adresse de dépôt** valable ~15 min), puis attend.
1. Depuis votre compte de dev, envoyez **exactement** le montant indiqué d'actif d'origine à l'adresse de dépôt (pour wNEAR : `ft_transfer` sur `wrap.near` vers l'adresse, 1 yocto joint ; si l'adresse de dépôt n'a pas de compte NEAR enregistré, un `storage_deposit` préalable peut être exigé par le contrat wNEAR). Un dépôt envoyé après l'échéance ou d'un mauvais montant sera remboursé (`REFUNDED`) à `refundTo`.
2. Collez le hash de transaction dans le terminal (si l'origine est NEAR, définissez `NEAR_SENDER_ACCOUNT=<votre_compte.near>` avant de lancer). Le script appelle `/v0/deposit/submit` puis suit `/v0/status` (PENDING_DEPOSIT -> KNOWN_DEPOSIT_TX -> PROCESSING -> SUCCESS).
3. Vous verrez « Preuve acceptée » avec le hash de destination, ou « Preuve REFUSÉE : raison ». Seule une preuve acceptée peut créditer quoi que ce soit dans Darwin.

## 4. Suivre et conserver les preuves
- Statut à tout moment : `INTENTS_ENABLED=true npx tsx intents/demo.ts status <adresse_de_dépôt>`.
- Explorateurs : https://nearblocks.io (hash NEAR), explorateur de la chaîne de destination pour le hash cible. Capturez-les pour la vidéo/le post.
- Statuts terminaux : SUCCESS, REFUNDED, FAILED, INCOMPLETE_DEPOSIT. Si FAILED ou INCOMPLETE_DEPOSIT, les fonds sont remboursables : gardez l'adresse de dépôt et le hash, contactez le support Intents.

## 5. Ensuite
Repassez `INTENTS_DRY_ONLY` à sa valeur par défaut (retirez la variable). Ne committez jamais de clé, d'adresse de dépôt de test ni de `.env`.

## Garde-fous du code
INTENTS_ENABLED=false par défaut ; dry:false et submit refusés si `INTENTS_DRY_ONLY` != `false` ; dry:true identique obligatoire avant dry:false ; plafond 5 USD ; preuve = statut SUCCESS de `/v0/status` recoupé avec NOTRE devis (correlationId, adresse, destinataire, actif, `amountOut >= minAmountOut`, hash de destination, aucun remboursement) ; crédit unique par dépôt, refusé sans preuve émise par `verifyDeposit`.
