# Freelance catalogue: real reference prices and testnet scaling

Owner: architect. Lot L16 (6 freelance professions). Research carried out on **2026-11-11**. Translated to English in lot L19 (the whole project is English).

This document is the basis for Darwin's task budgets for the 6 professions of `shared/types.ts` (`PROFESSIONS`):
`logo`, `finance`, `architecture`, `marketing`, `translation`, `legal`.

The catalogue in code (`shared/catalogue.ts`) is the single source for titles, deliverable descriptions, scoring rubrics and production instructions; since L19 all of them are in English and every production and judge prompt contains "Always answer in English.". Deliverable file names are English (`analysis.md`, `text.md`, `translation.md`, `checklist.md`); journals recorded before 2026-11-12 may carry the former French names (`analyse.md`, `texte.md`, `traduction.md`), which the backend still serves.

## General caveat (applies to the whole page)

Freelance rates vary enormously with country, experience, platform, language, urgency and exact scope.
The figures below are **orders of magnitude** collected from public sources, not guaranteed prices.
No figure was invented: when a source gives no exact figure, it is stated.

### How to read the sources

- **[read]**: page opened and read directly on 2026-11-11.
- **[snippet]**: figure read in a search-result snippet, because the page returns HTTP 403 to automated tools (Upwork, Fiverr, Malt, Clio). Figures to be re-checked in a browser.
- **[third party]**: third-party or competitor site quoting another source. Lower reliability.
- EUR -> USD conversion: ECB reference rate of **1.1214 USD for 1 EUR** (10 November 2026) [read], https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html
- BLS medians (US employees, May 2025) are given as a **comparison floor**. They are not freelance rates, which are usually higher per hour.

---

## 1. Logo (3 SVG proposals) — `logo`

| Source | Figure | Unit | Type |
|---|---|---|---|
| Upwork, cost of a logo designer: https://www.upwork.com/hire/logo-designers/cost/ | median 15 to 30 USD; best designers 25 to 75 USD, most 35 to 50 USD | hour | [snippet] |
| Fiverr guide (cost of a brand designer): https://www.fiverr.com/resources/guides/costs/brand-designer | 63 to 180 USD for a main logo with 2 to 3 concepts and a basic colour palette | project | [snippet] |
| Codeur.com, "How much does a logo cost": https://www.codeur.com/pages/combien-coute-creation-dun-logo | freelance: 100 to 400 EUR (112 to 449 USD); quality logo for a small business: 150 to 300 EUR (168 to 336 USD); logo designer: 35 EUR/h | project / hour | [read], page titled "2025 rates", no precise date |
| Codeur.com, logo designer rates: https://www.codeur.com/graphiste/logo/tarif | average daily rate 125 EUR (140 USD); average project budget 311 EUR (349 USD), recorded November 2026 | day / project | [read] |
| 99designs, logo contest: https://99designs.fr/pricing | Bronze 289 EUR (324 USD), Silver 479 EUR, Gold 859 EUR, Platinum 1,299 EUR, excluding tax | project (contest, dozens of proposals) | [read], no date on the page |
| BLS, graphic designers: https://www.bls.gov/ooh/arts-and-design/graphic-designers.htm | median 30.27 USD/h (employees, May 2025) | hour | [read], floor |

**Range retained ("3 logo proposals" project)**: low **63 USD**, typical **150 USD**, high **450 USD**.
The bounds come from Fiverr (63 USD) and the top of the Codeur freelance range (400 EUR, i.e. 449 USD). The typical figure is an architect's choice within the Fiverr (up to 180 USD) and Codeur (from 112 USD) overlap.

Caveat: a logo costs from a few dollars on entry-level platforms to several thousand in an agency. These are orders of magnitude.

## 2. Financial analysis (from provided figures) — `finance`

| Source | Figure | Unit | Type |
|---|---|---|---|
| Upwork, cost of a financial modeler: https://www.upwork.com/hire/financial-modelers/cost/ | median 25 to 65 USD | hour | [snippet] |
| Upwork, financial analysts page: https://www.upwork.com/hire/financial-analysts/ | no official range; mentions 95 USD/h for short or exploratory assignments | hour | [snippet] |
| Fiverr, financial analysis category (block.fiverr.com/hire/financial-analysis, which now redirects to the Fiverr home page) | average of about 90 USD for "analysis and valuation" and 73 USD for "financial forecasting and modeling" | project | [snippet], page no longer viewable |
| goLance, financial analyst rates guide: https://golance.com/hiring/best-freelance-financial-analysts-hourly-rate | 35 to 300 USD/h, about 90 USD/h mid-range | hour | [third party], competing platform |
| BLS, financial analysts: https://www.bls.gov/ooh/business-and-financial/financial-analysts.htm | median 49.79 USD/h (employees, May 2025) | hour | [read], floor |

No source gives an official flat price for "an analysis from provided figures".
**Range retained (short project)**: low **73 USD**, typical **120 USD**, high **300 USD**.
The bounds come from Fiverr (73 USD) and about 3 h at the high Upwork rate (65 USD/h). The typical figure is an architect's choice: a little over 2 h at the BLS median or in the middle of the Upwork range.

Caveat: rates depend on the level (from simple ratios to full modelling). These are orders of magnitude.

## 3. Software architecture (document + diagram) — `architecture`

| Source | Figure | Unit | Type |
|---|---|---|---|
| Upwork, certified AWS cloud architects: https://www.upwork.com/hire/certified-aws-cloud-architects/cost/ | median 60 to 200 USD | hour | [snippet] |
| Upwork, software developers: https://www.upwork.com/en-gb/hire/software-developers/cost/ | 10 to 100 USD | hour | [snippet] |
| Codeur.com, software architects: https://www.codeur.com/architecte/logiciel/tarif | average daily rate 195 EUR (219 USD), i.e. 28 EUR/h; beginner 105 EUR, junior 175 EUR, experienced 231 EUR, senior 315 EUR; average project budget 1,242 EUR (1,393 USD); recorded November 2026 | day / project | [read] |
| Contractor-portage daily-rate grid: https://www.regie-portage.fr/freelance/freelance-grille-tjm/ | software architect: 550 to 650 EUR (junior), 650 to 800 EUR (intermediate), 800 to 1,000 EUR (senior) | day | [snippet] [third party] |
| BLS, software developers: https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm | median 135,980 USD/year; 64.44 USD/h for the developers, QA and testers group (May 2025) | hour | [read], floor |

No source gives a flat price for "an architecture document with a diagram".
**Range retained (short document + 1 diagram, about half a day)**: low **110 USD**, typical **200 USD**, high **500 USD**.
The low bound is half a day at the average Codeur daily rate (219 USD / 2), the high bound is half a day at the top of the portage grid (1,000 EUR / 2, i.e. 561 USD, rounded to 500). The typical figure is an architect's choice: about 3 h at the BLS median (64 USD/h).

Caveat: huge gap between low-cost platforms and senior architects on assignment. These are orders of magnitude.

## 4. Marketing copywriting — `marketing`

| Source | Figure | Unit | Type |
|---|---|---|---|
| Editorial Freelancers Association, rate chart: https://www.the-efa.org/rates/ | Business/marketing, commissioned work: 0.32 to 0.875 USD/word, 65 to 75 USD/h; ghostwriting: 0.50 to 1.00 USD/word, 87.50 to 125 USD/h; survey run from Nov. 2025 to mid-Jan. 2026 on 2025 rates | word / hour | [read] |
| Upwork, cost of a copywriter: https://www.upwork.com/hiring/marketing/cost-to-hire-copywriter/ | beginner 20 to 30 USD/h, intermediate 30 to 50 USD/h, expert 50 to 150 USD/h | hour | [snippet] |
| Codeur.com, web writers: https://www.codeur.com/redacteur-web/tarif | average daily rate 90 EUR (101 USD); senior 119 EUR; average project budget 382 EUR (428 USD), recorded November 2026; no per-word rate | day / project | [read] |

**Range retained (marketing text of about 300 words)**: low **40 USD**, typical **80 USD**, high **260 USD**.
The low bound is about 2 h at the bottom of the Upwork range (20 USD/h), the high bound is 300 words at the top of the EFA range (0.875 USD/word). The typical figure is an architect's choice: 2 h at the top of the Upwork intermediate tier (40 USD/h), a little under 300 words at the bottom of the EFA range (0.32 USD/word = 96 USD).

Caveat: rates vary with the format, the writer's reputation and the billing mode (word, hour or flat fee). These are orders of magnitude.

## 5. Translation — `translation`

| Source | Figure | Unit | Type |
|---|---|---|---|
| Editorial Freelancers Association: https://www.the-efa.org/rates/ | from English: 0.12 to 0.19 USD/word, 60 to 75 USD/h; into English: 0.06 to 0.18 USD/word, 47.50 to 62.50 USD/h (2025 rates) | word / hour | [read] |
| Upwork, cost of a translator: https://www.upwork.com/hire/translators/cost/ and https://www.upwork.com/en-gb/hire/translators/cost/ | median 15 to 25 USD/h; 0.08 to 0.50 USD/word depending on complexity | hour / word | [snippet] |
| ATA, services survey summary: https://www.atanet.org/resources/summary-ata-translation-interpreting-services-survey/ | **no public figure**: rates are in the paid report (95 USD for non-members). A third-party site (ThePricer) quotes 2019 ATA medians of 0.13 USD (ES>EN) and 0.14 USD (EN>ES) per source word, not verified | word | [read] for the absence of figure, [third party] for 0.13 and 0.14 |
| ProZ, community rate forums (EN>FR): https://www.proz.com/forum/money_matters/40261-rates_for_english_to_french.html and related threads | about 0.08 to 0.11 EUR per source word (0.09 to 0.12 USD), according to forum posts; official tool not consulted | word | [snippet] |
| Codeur.com, English translators: https://www.codeur.com/traducteur/anglais/tarif | average daily rate 85 EUR (95 USD), senior 112 EUR; average project budget 859 EUR; recorded November 2026; no per-word rate | day / project | [read] |
| BLS, interpreters and translators: https://www.bls.gov/ooh/media-and-communication/interpreters-and-translators.htm | median 28.93 USD/h (employees, May 2025) | hour | [read], floor |

**Range retained (translation of about 300 words)**: low **24 USD**, typical **40 USD**, high **150 USD**.
The low bound is 300 words at 0.08 USD (low Upwork), the high bound is 300 words at 0.50 USD (high Upwork, specialised texts). The typical figure is an architect's choice: 300 words at about 0.13 USD, in the middle of the EFA range from English.

Since L19 the simulated client always orders translations INTO English (French source texts); an order without an explicit target language is checked against English.

Caveat: the per-word rate depends on the language pair, the domain and the specialisation. Many translators also apply a minimum charge. These are orders of magnitude.

## 6. Simple legal checklist — `legal`

Concept reminder: the Darwin deliverable carries the disclaimer "This is not legal advice." (`LEGAL_DISCLAIMER`, first and last line, checked deterministically). The references below are those of a professional, which gives an upper bound of value.

| Source | Figure | Unit | Type |
|---|---|---|---|
| Upwork, contract law professionals: https://www.upwork.com/hire/contract-law-professionals/cost/ | 30 to 200 USD | hour | [snippet] |
| Clio, rates by State: https://www.clio.com/state-rates-pages/ | average US lawyer hourly rate of 362 USD (2026) | hour | [snippet] |
| LegalZoom, document review: https://www.legalzoom.com/attorneys/legal-documents-review.html | page read: flat fee advertised but **no amount displayed**. The search snippet mentioned "from 39 USD" (documents up to 25 pages), which the page read does not confirm | project | [read] without figure, [snippet] for 39 USD |
| BLS, lawyers: https://www.bls.gov/ooh/legal/lawyers.htm | median 76.76 USD/h (employees, May 2025) | hour | [read], floor |

**Range retained (short checklist, about 1 h of work)**: low **39 USD**, typical **150 USD**, high **362 USD**.
The low bound comes from the LegalZoom snippet, to be confirmed. The high bound is 1 h at the average Clio rate. The typical figure is an architect's choice: about 2 h at the BLS median, or 1 h in the middle of the Upwork range.

Caveat: legal fees vary strongly with jurisdiction, specialty and whether a registered lawyer is paid. These are orders of magnitude.

---

## Reference price retained per Darwin deliverable

There is a single typical USD figure per profession, for **one** standard deliverable of the size of a demo task. These figures are architect's choices backed by the ranges above.

| Profession (`profession`) | Standard deliverable | typical refUsd | Observed range (low to high) |
|---|---|---|---|
| `logo` | 3 SVG logo proposals | 150 | 63 to 450 |
| `finance` | short analysis from provided figures | 120 | 73 to 300 |
| `architecture` | short document + 1 Mermaid diagram | 200 | 110 to 500 |
| `marketing` | marketing text of about 300 words | 80 | 40 to 260 |
| `translation` | translation of about 300 words | 40 | 24 to 150 |
| `legal` | simple legal checklist (not legal advice) | 150 | 39 to 362 |

Price order: architecture > logo = legal > finance > marketing > translation. The ratio between the most and the least expensive is 5.

## Testnet scaling

Testnet task budgets range from 0.02 to 0.06 NEAR. A **single factor** is applied to keep the price ratios between professions:

```
NEAR = refUsd x factor
```

Constraints: the most expensive does not exceed 0.09 NEAR (200 x f <= 0.09, so f <= 0.00045) and the least expensive reaches at least 0.01 NEAR (40 x f >= 0.01, so f >= 0.00025).

**Factor retained: `f = 0.0003` NEAR per reference USD.** It is purely symbolic: it is not a NEAR/USD exchange rate.
It is the round value at the low end of the allowed interval that puts 5 professions out of 6 in the 0.02 to 0.06 NEAR range of the existing budgets.

| Profession | refUsd | Testnet price (NEAR) |
|---|---|---|
| `logo` | 150 | 0.045 |
| `finance` | 120 | 0.036 |
| `architecture` | 200 | 0.060 |
| `marketing` | 80 | 0.024 |
| `translation` | 40 | 0.012 |
| `legal` | 150 | 0.045 |

Checks: maximum 0.060 <= 0.09; minimum 0.012 >= 0.01. Only `translation` (0.012) falls below 0.02 NEAR, which still meets the 0.01 floor constraint.
For more headroom upwards (bids above the reference price), one can go up to `f = 0.00045` (architecture at 0.09 NEAR, translation at 0.018 NEAR) without changing the ratios.

Final caveat: these NEAR prices only serve to keep realistic proportions between professions on testnet. They represent no real monetary value.

## `selection` preset calibration (L17, D-043)

| Parameter (testnet, `selection`) | Before | After |
|---|---|---|
| Birth capital | 0.10 NEAR | 0.12 NEAR |
| Metabolism | 0.005 NEAR/tick | 0.0035 NEAR/tick |
| Simulated client | 1.5 tasks/tick | 2 tasks/tick |
| Seeds validating "generation >= 3 and >= 1 death" (100 seeds, mock) | 62 | 92 |
| Deaths per birth (mock) | 0.84 | 0.66 (real run 8: 0.58) |

Catalogue prices unchanged. To reproduce: `npx tsx scripts/calibrate-selection.ts --seeds 100 --first 31`.
