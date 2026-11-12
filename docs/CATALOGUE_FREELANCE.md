# Catalogue freelance : prix de référence réels et mise à l'échelle testnet

Propriétaire : architecte. Lot L16 (6 métiers freelance). Recherches effectuées le **2026-11-11**.

Ce document sert de base aux budgets des tâches de Darwin pour les 6 métiers de `shared/types.ts` (`PROFESSIONS`) :
`logo`, `finance`, `architecture`, `marketing`, `translation`, `legal`.

## Réserve générale (valable pour toute la page)

Les tarifs freelance varient très fortement selon le pays, l'expérience, la plateforme, la langue, l'urgence et le périmètre exact.
Les chiffres ci-dessous sont des **ordres de grandeur** relevés dans des sources publiques, et non des prix garantis.
Aucun chiffre n'a été inventé : quand une source ne donne pas de chiffre exact, c'est indiqué.

### Comment lire les sources

- **[lu]** : page ouverte et lue directement le 2026-11-11.
- **[extrait]** : chiffre lu dans l'extrait de résultat de recherche, parce que la page renvoie HTTP 403 aux outils automatiques (Upwork, Fiverr, Malt, Clio). Les chiffres sont à revérifier dans un navigateur.
- **[tiers]** : site tiers ou concurrent qui cite une autre source. Fiabilité plus faible.
- Conversion EUR -> USD : taux de référence BCE de **1,1214 USD pour 1 EUR** (10 novembre 2026) [lu], https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html
- Les médianes BLS (salariés américains, mai 2025) sont données comme **plancher de comparaison**. Ce ne sont pas des tarifs freelance, qui sont en général plus élevés à l'heure.

---

## 1. Logo (3 propositions SVG) — `logo`

| Source | Chiffre | Unité | Type |
|---|---|---|---|
| Upwork, coût d'un designer de logo : https://www.upwork.com/hire/logo-designers/cost/ | médiane 15 à 30 USD ; les meilleurs designers de 25 à 75 USD, la plupart de 35 à 50 USD | heure | [extrait] |
| Guide Fiverr (coût d'un brand designer) : https://www.fiverr.com/resources/guides/costs/brand-designer | 63 à 180 USD pour un logo principal avec 2 à 3 concepts et une palette de couleurs de base | projet | [extrait] |
| Codeur.com, « Combien coûte la création d'un logo » : https://www.codeur.com/pages/combien-coute-creation-dun-logo | freelance : 100 à 400 EUR (112 à 449 USD) ; logo de qualité pour une petite entreprise : 150 à 300 EUR (168 à 336 USD) ; graphiste logo : 35 EUR/h | projet / heure | [lu], page titrée « tarifs 2025 », sans date précise |
| Codeur.com, tarif des graphistes logo : https://www.codeur.com/graphiste/logo/tarif | TJM moyen 125 EUR (140 USD) ; budget moyen des projets 311 EUR (349 USD), relevé de novembre 2026 | jour / projet | [lu] |
| 99designs, concours de logo : https://99designs.fr/pricing | Bronze 289 EUR (324 USD), Silver 479 EUR, Gold 859 EUR, Platinum 1 299 EUR, hors taxe | projet (concours, dizaines de propositions) | [lu], pas de date sur la page |
| BLS, graphic designers : https://www.bls.gov/ooh/arts-and-design/graphic-designers.htm | médiane de 30,27 USD/h (salariés, mai 2025) | heure | [lu], plancher |

**Fourchette retenue (projet « 3 propositions de logo »)** : basse **63 USD**, typique **150 USD**, haute **450 USD**.
Les bornes viennent de Fiverr (63 USD) et du haut de la fourchette freelance Codeur (400 EUR, soit 449 USD). Le chiffre typique est un choix d'architecte situé dans le recouvrement Fiverr (jusqu'à 180 USD) et Codeur (dès 112 USD).

Réserve : un logo coûte de quelques dollars sur les plateformes d'entrée de gamme à plusieurs milliers en agence. Ce sont des ordres de grandeur.

## 2. Analyse financière (à partir de chiffres fournis) — `finance`

| Source | Chiffre | Unité | Type |
|---|---|---|---|
| Upwork, coût d'un modélisateur financier : https://www.upwork.com/hire/financial-modelers/cost/ | médiane de 25 à 65 USD | heure | [extrait] |
| Upwork, page analystes financiers : https://www.upwork.com/hire/financial-analysts/ | pas de fourchette officielle ; mentionne 95 USD/h pour des missions courtes ou exploratoires | heure | [extrait] |
| Fiverr, catégorie analyse financière (block.fiverr.com/hire/financial-analysis, qui redirige aujourd'hui vers l'accueil de Fiverr) | moyenne d'environ 90 USD pour « analysis and valuation » et 73 USD pour « financial forecasting and modeling » | projet | [extrait], page plus consultable |
| goLance, guide des tarifs des analystes financiers : https://golance.com/hiring/best-freelance-financial-analysts-hourly-rate | 35 à 300 USD/h, environ 90 USD/h en milieu de gamme | heure | [tiers], plateforme concurrente |
| BLS, financial analysts : https://www.bls.gov/ooh/business-and-financial/financial-analysts.htm | médiane de 49,79 USD/h (salariés, mai 2025) | heure | [lu], plancher |

Aucune source ne donne de prix forfaitaire officiel pour « une analyse à partir de chiffres fournis ».
**Fourchette retenue (projet court)** : basse **73 USD**, typique **120 USD**, haute **300 USD**.
Les bornes viennent de Fiverr (73 USD) et d'environ 3 h au tarif haut d'Upwork (65 USD/h). Le chiffre typique est un choix d'architecte : un peu plus de 2 h à la médiane BLS ou au milieu de la fourchette Upwork.

Réserve : les tarifs dépendent du niveau (de simples ratios jusqu'à la modélisation complète). Ce sont des ordres de grandeur.

## 3. Architecture logicielle (document + schéma) — `architecture`

| Source | Chiffre | Unité | Type |
|---|---|---|---|
| Upwork, architectes cloud AWS certifiés : https://www.upwork.com/hire/certified-aws-cloud-architects/cost/ | médiane de 60 à 200 USD | heure | [extrait] |
| Upwork, développeurs logiciels : https://www.upwork.com/en-gb/hire/software-developers/cost/ | 10 à 100 USD | heure | [extrait] |
| Codeur.com, architectes logiciels : https://www.codeur.com/architecte/logiciel/tarif | TJM moyen 195 EUR (219 USD), soit 28 EUR/h ; débutant 105 EUR, junior 175 EUR, confirmé 231 EUR, senior 315 EUR ; budget moyen des projets 1 242 EUR (1 393 USD) ; relevé de novembre 2026 | jour / projet | [lu] |
| Grille TJM de régie-portage : https://www.regie-portage.fr/freelance/freelance-grille-tjm/ | architecte logiciel : 550 à 650 EUR (junior), 650 à 800 EUR (intermédiaire), 800 à 1 000 EUR (senior) | jour | [extrait] [tiers] |
| BLS, software developers : https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm | médiane de 135 980 USD/an ; 64,44 USD/h pour le groupe développeurs, QA et testeurs (mai 2025) | heure | [lu], plancher |

Aucune source ne donne de prix forfaitaire pour « un document d'architecture avec schéma ».
**Fourchette retenue (document court + 1 schéma, environ une demi-journée)** : basse **110 USD**, typique **200 USD**, haute **500 USD**.
La borne basse correspond à une demi-journée au TJM moyen Codeur (219 USD / 2), la borne haute à une demi-journée au haut de la grille régie-portage (1 000 EUR / 2, soit 561 USD, arrondi à 500). Le chiffre typique est un choix d'architecte : environ 3 h à la médiane BLS (64 USD/h).

Réserve : écart énorme entre les plateformes à bas coût et les architectes seniors en mission. Ce sont des ordres de grandeur.

## 4. Rédaction marketing — `marketing`

| Source | Chiffre | Unité | Type |
|---|---|---|---|
| Editorial Freelancers Association, grille des tarifs : https://www.the-efa.org/rates/ | Business/marketing, travail de commande : 0,32 à 0,875 USD/mot, 65 à 75 USD/h ; ghostwriting : 0,50 à 1,00 USD/mot, 87,50 à 125 USD/h ; enquête menée de nov. 2025 à mi-janv. 2026 sur les tarifs de 2025 | mot / heure | [lu] |
| Upwork, coût d'un rédacteur publicitaire : https://www.upwork.com/hiring/marketing/cost-to-hire-copywriter/ | débutant 20 à 30 USD/h, intermédiaire 30 à 50 USD/h, expert 50 à 150 USD/h | heure | [extrait] |
| Codeur.com, rédacteurs web : https://www.codeur.com/redacteur-web/tarif | TJM moyen 90 EUR (101 USD) ; senior 119 EUR ; budget moyen des projets 382 EUR (428 USD), relevé de novembre 2026 ; pas de tarif au mot | jour / projet | [lu] |

**Fourchette retenue (texte marketing d'environ 300 mots)** : basse **40 USD**, typique **80 USD**, haute **260 USD**.
La borne basse correspond à environ 2 h au bas de la fourchette Upwork (20 USD/h), la borne haute à 300 mots au haut de la fourchette EFA (0,875 USD/mot). Le chiffre typique est un choix d'architecte : 2 h au haut du palier intermédiaire Upwork (40 USD/h), un peu sous 300 mots au bas de l'EFA (0,32 USD/mot = 96 USD).

Réserve : les tarifs varient selon le format, la notoriété du rédacteur et le mode de facturation (mot, heure ou forfait). Ce sont des ordres de grandeur.

## 5. Traduction — `translation`

| Source | Chiffre | Unité | Type |
|---|---|---|---|
| Editorial Freelancers Association : https://www.the-efa.org/rates/ | depuis l'anglais : 0,12 à 0,19 USD/mot, 60 à 75 USD/h ; vers l'anglais : 0,06 à 0,18 USD/mot, 47,50 à 62,50 USD/h (tarifs de 2025) | mot / heure | [lu] |
| Upwork, coût d'un traducteur : https://www.upwork.com/hire/translators/cost/ et https://www.upwork.com/en-gb/hire/translators/cost/ | médiane de 15 à 25 USD/h ; 0,08 à 0,50 USD/mot selon la complexité | heure / mot | [extrait] |
| ATA, résumé de l'enquête sur les services : https://www.atanet.org/resources/summary-ata-translation-interpreting-services-survey/ | **aucun chiffre public** : les tarifs sont dans le rapport payant (95 USD pour les non-membres). Un site tiers (ThePricer) cite des médianes ATA de 2019 de 0,13 USD (ES>EN) et 0,14 USD (EN>ES) par mot source, non vérifiées | mot | [lu] pour l'absence de chiffre, [tiers] pour 0,13 et 0,14 |
| ProZ, forums sur les tarifs de la communauté (EN>FR) : https://www.proz.com/forum/money_matters/40261-rates_for_english_to_french.html et fils associés | environ 0,08 à 0,11 EUR par mot source (0,09 à 0,12 USD), selon des messages de forum ; outil officiel non consulté | mot | [extrait] |
| Codeur.com, traducteurs anglais : https://www.codeur.com/traducteur/anglais/tarif | TJM moyen 85 EUR (95 USD), senior 112 EUR ; budget moyen des projets 859 EUR ; relevé de novembre 2026 ; pas de tarif au mot | jour / projet | [lu] |
| BLS, interpreters and translators : https://www.bls.gov/ooh/media-and-communication/interpreters-and-translators.htm | médiane de 28,93 USD/h (salariés, mai 2025) | heure | [lu], plancher |

**Fourchette retenue (traduction d'environ 300 mots)** : basse **24 USD**, typique **40 USD**, haute **150 USD**.
La borne basse correspond à 300 mots à 0,08 USD (bas Upwork), la borne haute à 300 mots à 0,50 USD (haut Upwork, textes spécialisés). Le chiffre typique est un choix d'architecte : 300 mots à environ 0,13 USD, au milieu de la fourchette EFA depuis l'anglais.

Réserve : le tarif au mot dépend de la paire de langues, du domaine et de la spécialisation. Beaucoup de traducteurs appliquent aussi un minimum de facturation. Ce sont des ordres de grandeur.

## 6. Checklist juridique simple — `legal`

Rappel concept : le livrable Darwin porte l'avertissement « pas un avis juridique ». Les références ci-dessous sont celles d'un professionnel, ce qui donne une borne haute de valeur.

| Source | Chiffre | Unité | Type |
|---|---|---|---|
| Upwork, professionnels du droit des contrats : https://www.upwork.com/hire/contract-law-professionals/cost/ | 30 à 200 USD | heure | [extrait] |
| Clio, tarifs par État : https://www.clio.com/state-rates-pages/ | tarif horaire moyen d'un avocat américain de 362 USD (2026) | heure | [extrait] |
| LegalZoom, relecture de documents : https://www.legalzoom.com/attorneys/legal-documents-review.html | page lue : forfait annoncé mais **aucun montant affiché**. L'extrait de recherche mentionnait « à partir de 39 USD » (documents jusqu'à 25 pages), que la page lue ne confirme pas | projet | [lu] sans chiffre, [extrait] pour 39 USD |
| BLS, lawyers : https://www.bls.gov/ooh/legal/lawyers.htm | médiane de 76,76 USD/h (salariés, mai 2025) | heure | [lu], plancher |

**Fourchette retenue (checklist courte, environ 1 h de travail)** : basse **39 USD**, typique **150 USD**, haute **362 USD**.
La borne basse vient de l'extrait LegalZoom, à confirmer. La borne haute correspond à 1 h au tarif moyen Clio. Le chiffre typique est un choix d'architecte : environ 2 h à la médiane BLS, ou 1 h dans le milieu de la fourchette Upwork.

Réserve : les honoraires juridiques varient fortement selon la juridiction, la spécialité et le fait qu'on paie ou non un avocat inscrit. Ce sont des ordres de grandeur.

---

## Prix de référence retenu par livrable Darwin

Il y a un seul chiffre USD typique par métier, pour **un** livrable standard de la taille d'une tâche de démo. Ces chiffres sont des choix d'architecte appuyés sur les fourchettes ci-dessus.

| Métier (`profession`) | Livrable standard | refUsd typique | Fourchette observée (basse à haute) |
|---|---|---|---|
| `logo` | 3 propositions de logo SVG | 150 | 63 à 450 |
| `finance` | analyse courte à partir de chiffres fournis | 120 | 73 à 300 |
| `architecture` | document court + 1 schéma Mermaid | 200 | 110 à 500 |
| `marketing` | texte marketing d'environ 300 mots | 80 | 40 à 260 |
| `translation` | traduction d'environ 300 mots | 40 | 24 à 150 |
| `legal` | checklist juridique simple (pas un avis juridique) | 150 | 39 à 362 |

Ordre des prix : architecture > logo = legal > finance > marketing > translation. Le rapport entre le plus cher et le moins cher est de 5.

## Mise à l'échelle testnet

Les budgets de tâches testnet vont de 0,02 à 0,06 NEAR. On applique un **facteur unique** pour conserver les rapports de prix entre métiers :

```
NEAR = refUsd x facteur
```

Contraintes : le plus cher ne dépasse pas 0,09 NEAR (200 x f <= 0,09, donc f <= 0,00045) et le moins cher atteint au moins 0,01 NEAR (40 x f >= 0,01, donc f >= 0,00025).

**Facteur retenu : `f = 0,0003` NEAR par USD de référence.** Il est purement symbolique : ce n'est pas un taux de change NEAR/USD.
C'est la valeur ronde du bas de l'intervalle autorisé qui place 5 métiers sur 6 dans la plage 0,02 à 0,06 NEAR des budgets existants.

| Métier | refUsd | Prix testnet (NEAR) |
|---|---|---|
| `logo` | 150 | 0,045 |
| `finance` | 120 | 0,036 |
| `architecture` | 200 | 0,060 |
| `marketing` | 80 | 0,024 |
| `translation` | 40 | 0,012 |
| `legal` | 150 | 0,045 |

Vérifications : maximum 0,060 <= 0,09 ; minimum 0,012 >= 0,01. Seule `translation` (0,012) passe sous 0,02 NEAR, ce qui reste conforme à la contrainte de plancher de 0,01.
Si l'on veut plus de marge vers le haut (enchères au-dessus du prix de référence), on peut monter jusqu'à `f = 0,00045` (architecture à 0,09 NEAR, traduction à 0,018 NEAR) sans changer les rapports.

Réserve finale : ces prix NEAR servent uniquement à conserver des proportions réalistes entre métiers sur testnet. Ils ne représentent aucune valeur monétaire réelle.

## Calibrage du preset `selection` (L17, D-043)

| Paramètre (testnet, `selection`) | Avant | Après |
|---|---|---|
| Capital de naissance | 0,10 NEAR | 0,12 NEAR |
| Métabolisme | 0,005 NEAR/tick | 0,0035 NEAR/tick |
| Client simulé | 1,5 tâche/tick | 2 tâches/tick |
| Graines validant « génération >= 3 et >= 1 mort » (100 graines, mock) | 62 | 92 |
| Morts par naissance (mock) | 0,84 | 0,66 (run 8 réel : 0,58) |

Prix du catalogue inchangés. Reproduire : `npx tsx scripts/calibrate-selection.ts --seeds 100 --first 31`.
