# Attestation TEE des réponses du cerveau (NEAR AI Cloud)

> Propriétaire : dev-cerveau-ia (lot L11). Protocole vérifié le 2026-11-10 sur docs.near.ai/cloud/verification (pages « Gateway attestation », « NEAR model attestations », « Response signatures », « Quote, nonce, and signer bindings »). Exécution réelle du 2026-11-10 décrite en section 3.

## 1. Ce que l'on peut prouver, et ce que l'on ne prouve pas

Les modèles marqués `attestationSupported: true` dans `GET /v1/model/list` (dans notre liste blanche : `Qwen/Qwen3.8-27B`, `z-ai/glm-5.3-flash`, `Qwen/Qwen3.6-35B-A3B-FP8`, `deepseek-ai/DeepSeek-V4.1-Flash-1017`) tournent dans un environnement d'exécution de confiance (Intel TDX + GPU NVIDIA). Les trois autres (`openai/gpt-5-nano`, `anthropic/claude-haiku-5-5`, `google/gemini-2.5-flash-lite`) sont des modèles externes : **aucune attestation, rien n'est prouvé pour eux**.

Important : le cerveau de Darwin **n'atteste pas chaque appel**. L'attestation est un contrôle à la demande (`npm run ai:verify-attestation`) sur une requête dédiée, pas une propriété de toute la simulation. Une démo ne doit pas affirmer « chaque réponse d'agent est prouvée ».

## 2. Comment vérifier soi-même

```bash
npm install
# la clé NEARAI_API_KEY est lue depuis .env ou l'environnement (jamais affichée) ; elle ne sert qu'à la requête et à la signature
npm run ai:verify-attestation -- --model z-ai/glm-5.3-flash --save-evidence data/attestation-glm
# re-vérifier plus tard la partie signature à partir des preuves enregistrées (sans clé)
npm run ai:verify-attestation -- --offline data/attestation-glm
```

Options : `--accept UpToDate,SWHardeningNeeded` (statuts TCB acceptés, défaut `UpToDate` seul), `--skip-gpu`, `--max-tokens N` (<= 200), `--env-file chemin`. Code de sortie 1 s'il y a un FAIL. Chaque contrôle est affiché `PASS`, `FAIL` ou `SKIP` ; un `SKIP` n'est jamais une réussite.

Le script suit le protocole officiel :

1. Génère un nonce de 32 octets aléatoires et appelle `GET /v1/attestation/report?model=<id>&provider=near&signing_algo=ecdsa&nonce=<nonce>` avec l'en-tête `x-no-aliasing: true`. La réponse contient `gateway_attestation` (passerelle) et `model_attestations[]` (modèle).
2. Pour la passerelle et chaque rapport modèle : vérifie la quote Intel TDX avec `@phala/dcap-qvl` (collatéral récupéré chez le PCCS de Phala), le statut TCB, l'absence de mode debug, que `report_data` de la quote = adresse du signataire + nonce du client, que `MRCONFIGID` = `01` + SHA-256(`app_compose`), et que le rejeu de l'event log (RTMR3, SHA-384) égale le RTMR3 de la quote.
3. Preuve GPU : vérifie que le nonce du `nvidia_payload` est le nôtre, puis envoie le payload à NVIDIA NRAS (`https://nras.attestation.nvidia.com/v3/attest/gpu`) et exige `x-nvidia-overall-att-result: true`.
4. Fait une vraie requête de chat avec les octets exacts conservés (modèle canonique, `x-no-aliasing: true`, `Accept-Encoding: identity`), puis `GET /v1/signature/<id>?model=<id>&signing_algo=ecdsa`.
5. Vérifie que le texte signé vaut `<modèle>:SHA-256(requête exacte):SHA-256(réponse exacte)`, que la signature ECDSA (EIP-191) se récupère en l'adresse `signing_address`, que `signature_kind` vaut `provider_tee`, et que cette adresse correspond à exactement un rapport modèle vérifié en amont.

## 3. Ce qui a été réellement vérifié (exécution du 2026-11-10, modèle `z-ai/glm-5.3-flash`)

Résultat : 20 PASS, 0 FAIL, 0 SKIP.

| Contrôle | Résultat |
|---|---|
| Rapport d'attestation récupéré (1 candidat modèle) | PASS |
| Passerelle : quote TDX DCAP, statut TCB `UpToDate`, debug désactivé, report_data = signataire + nonce, nonce renvoyé, MRCONFIGID, rejeu RTMR3 | PASS (6 contrôles) |
| Modèle : mêmes 6 contrôles sur la quote du modèle (statut TCB `UpToDate`) | PASS (6 contrôles) |
| Preuve GPU NVIDIA : nonce du payload, verdict NRAS `x-nvidia-overall-att-result=true` | PASS |
| Requête réelle (id de réponse `1c1ea6068280496f8ef8d050c98dbe6d`) | PASS |
| Signature récupérée : `signature_kind=provider_tee`, ECDSA | PASS |
| Texte signé = modèle:SHA-256(requête exacte):SHA-256(réponse exacte) | PASS |
| Signature ECDSA valide pour `signing_address` `0x3b753b4406613c5e70ae640508632b600424fa0c` | PASS |
| Signataire = exactement un rapport modèle vérifié en amont | PASS |

Test négatif réalisé : en ajoutant un seul octet à la réponse enregistrée, la vérification hors ligne échoue sur « texte signé différent ».

Cette exécution est un fait daté, pas une garantie permanente : relancer la commande pour obtenir une preuve fraîche. Le coût de l'exécution (de l'ordre de 0,00001 USD) est journalisé dans `data/ai-usage.jsonl` avec l'agent `attestation`.

## 4. Ce qui n'est PAS vérifié (limites)

- **Autres modèles de la liste** : seul `z-ai/glm-5.3-flash` a été attesté de bout en bout. Les trois autres modèles TEE (`Qwen3.8-27B`, `Qwen3.6-35B-A3B-FP8`, `DeepSeek-V4.1-Flash-1017`) disposent du même mécanisme mais n'ont pas été passés au script. Les modèles externes n'ont pas d'attestation.
- **Pas de contrôle par appel de simulation** : les réponses produites par les agents pendant la simulation ne sont pas signées-vérifiées une à une.
- **Liaison TLS** : la connexion TLS à `cloud-api.near.ai` n'est pas liée à l'attestation de la passerelle (`include_tls_fingerprint` non utilisé).
- **Provenance des images / politique de mesures** : les mesures (MRTD, RTMR, `app_compose`) sont vérifiées pour leur cohérence interne avec la quote, mais **pas comparées à une liste de valeurs de référence acceptées** (pas de politique d'allowlist ni de provenance d'image). Un vérificateur de production devrait en définir une.
- **Jeton NVIDIA** : on s'appuie sur le verdict de NRAS reçu en TLS ; le jeton JWT n'est pas revalidé localement (signature des claims non vérifiée).
- **Collatéral Intel** : récupéré chez le PCCS de Phala (service tiers) par défaut ; on peut passer `INTEL_PCS_URL` pour utiliser le PCS d'Intel, non fait ici.
- **Instance de service** : tous les exemplaires d'un même modèle partagent la clé de signature ; une signature valide n'établit pas que le rapport et la réponse viennent de la même instance (avertissement de la documentation officielle).
- **Chaîne complète** : la signature `provider_tee` ne lie pas les octets signés par le modèle à la passerelle ni au TLS (limite documentée par NEAR AI Cloud).
- **Mode hors ligne** (`--offline`) : ne refait que le hachage et la signature ; la quote, l'event log et le GPU sont marqués `SKIP` et le rapprochement du signataire avec un rapport vérifié aussi.
- **Vulnérabilités de dépendances** : `npm audit` signale 2 alertes faibles (paquet `elliptic`, via `@phala/dcap-qvl`) dans les dépendances de développement uniquement.
- Confidentialité : l'attestation prouve l'environnement d'exécution annoncé, pas que le fournisseur ne conserve pas les données ; la page de vérification de NEAR AI Cloud (cloud.near.ai/verify) permet une vérification dans le navigateur.
