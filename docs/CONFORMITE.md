# CONFORMITE — grille à cocher

> **English summary.** Compliance grid maintained by the specs guardian (`gardien-des-specs`): each box checks the V1 definition and the official hackathon requirements (IDs refer to `docs/SPECS.md`). Green = compliant; red = non-compliant or unverifiable, with a justification.
> **State (pre-freeze final compliance review of `main`, HEAD `d66b7d4`, 2026-11-12): GO WITH RESERVATIONS.** No veto. K-1 to K-8 are mandatory before the repository is made public (text only, no engine/market/contract code); K-9 to K-16 are optional. See "Pre-freeze final review of `main`" right below. Earlier opinions follow for history. The rest of this file is kept in its original French (internal working document, translated on demand).

## Pre-freeze final review of `main`, HEAD `d66b7d4`, 2026-11-12

**Verdict: GO WITH RESERVATIONS.** Concept unchanged; every proof claim checked in the README has a hash or a journal; NEAR Intents and market.near.ai appear only as vision; the run 9c missions are disclosed as typed by an automated browser for the developer and paid by the operator's demo account; the replay is always "not live"; the closing sentence is in README:49, FORMULAIRE:38, VIDEO_SCRIPT:4 and :55. The reservations are internal contradictions and stale lines, not over-claims.

**Limit of this review (stated).** My tool set had **no shell**: I could not run `npx vitest run --maxWorkers=2`, `npx tsc --noEmit`, `node scripts/check-formulaire.mjs`, `npm run scan-secrets`, nor commit this file. **This file is edited but NOT committed**: the project lead must commit it on `main` ("Gardien: pre-freeze final review of main d66b7d4"). Condition of this GO: the project lead runs the four commands on `d66b7d4` and records in STATUS: 425 tests / 30 files green (30 test files counted by me, consistent with README:255), `tsc` 0 error, `idea` <= 2000 (my hand count: **about 1,995**, a 5-character margin, see K-8), scan exit 0. If one fails, this opinion becomes a VETO on publication.

**Official sources re-read on 2026-11-12** (nearhackathon.com, HACKATHON.md, docs.near.org/getting-started/hackathons): no change since the previous reading. Deadline 2026-11-14 23:59 UTC, repository public by then; judging 16-18 Nov; form fields and limits unchanged (`idea` 20-2000, consent text identical, `website` trap, 12000 bytes); 13 track ids unchanged; Q-000 to Q-017 unchanged; HACKATHON.md still says screenshots alone are not enough (video), homepage still says "video or screenshots". docs.near.org/getting-started/hackathons has no hackathon rule. Early work counts from the 2026-10-19 announcement (Q-001), consistent with README §11.

### Checks done by reading
1. **README vs PREUVES.** Run 9c (§14): 16 births, 10 reproductions, 4 deaths, 78/68/7 escrows, missions `t-9975872` and `t-9975887` with lock/release hashes, all present in `docs/preuves/run9c-journal.jsonl` (hashes grepped). Run 10 (§15): 3 complete cases, commission 0.0246 + 0.0210 + 0.0120 = 0.0576 NEAR stated only for accepted and paid parents (README:12,128; PREUVES:537), refused parents with commission 0 and the 0.024 NEAR loss, fallback `t-10013221`; hashes `DGHrebeg5…`, `H963jPSg…`, `CcB5xsLw…`, `HrpDeK9t…` present in the run 10 journal. Subcontracting: run 8 = paid, not integrated (README:10,130,289); run 10 = integrated (README:128,289); run 9c = not awarded, price-floor bug fixed by L21 (README:11,206,289). Post-run-10 fixes D-050 "not exercised in a real run" (README:130,289; PREUVES:562). Logo refusal "unexplained", also seen without subcontracting (`t-9975954` checked in the journal), not attributed to subcontracting (README:290). §13 English validation supports README:105. Exception: README:29 and :45 (K-1, K-2).
2. **Intents / Agent Market.** README:47,92,134-135,271,295; FORMULAIRE:42; POST_X 5/; VIDEO shot 9 and :67: vision only, "no mainnet demo is planned". Exception: the title of `intents/DEMO_MAINNET.md`, linked from README:82,92 (K-4).
3. **Visitor orders, simulated client, replay.** README:11,102,161,287; PREUVES:19,432; FORMULAIRE:42; POST_X 7/; VIDEO:19,34,48,51,64: automated browser on the developer's behalf, payer = `visitors.<master>`. Simulated client labelled everywhere (76 of 78 escrows). Replay = "not live" (README:145; VIDEO:30,47,54).
4. **Submission texts.** All English. FORMULAIRE `idea` about 1,995 characters by hand (see K-8). POST_X counted by hand with Spore.fun = 23: single post 271, 1/ ~215, 4/ 275, 5/ 267, 6/ 270, 7/ 263, 8/ 222 (URL = 23): all <= 280; @NEARProtocol, #NEARHackathon, "Built at NEAR HACKATHON", video mandatory (POST_X:3,15). VIDEO: 10+14+12+16+20+12+16+14+22 = 136 s = 2:16 < 2:20 (shot times consistent), but see K-6 (narration rate). No "first" claim (README:37 "not the first attempt"; other hits temporal or prohibitions). Spore.fun/Automaton nuanced (README:37-49; VIDEO:62).
5. **Concept.** No drift: 8 genes, cycle, escrow/validation/reputation, subcontracting, simulated client labelled, mock by default, Intents off (`.env.example`, `shared/config.ts`). Code freeze respected as far as I can read (only docs and UI changed per BESOINS:6).
6. **Previous reservations.** H-1 (425 tests) fixed; H-2 fixed but garbled (K-3); H-3 fixed (tweet 4/ = 275); H-4 fixed except one string (K-14); H-6, H-7, H-9, H-12, H-13 fixed.

### Mandatory before making the repository public (K-1 to K-8)
- **K-1 `README.md:29`** (redacteur): stale and contradicts §5/§12 known limits: "(subcontracting: paid on testnet in run 8, not awarded in run 9c; integrating the child's deliverable into the parent's work is not implemented, see **Vision** under Known limitations)". Replace with: "(subcontracting: child escrows paid without integration in run 8, not awarded in run 9c because of a price-floor bug fixed afterwards, and **integrated into the parent's deliverable in run 10**: 3 complete cases, see section 5)".
- **K-2 `README.md:45`** (redacteur): "subcontracting between agents (3 paid on testnet in run 8, none awarded in run 9c)" omits the run that proves it. Replace with "subcontracting between agents (run 8: 3 child escrows paid, not integrated; run 9c: none awarded, bug fixed; run 10: 3 complete integrated cases)".
- **K-3 `README.md:278`** (redacteur): misplaced parenthesis. Replace the line with: "- **External services**: NEAR testnet RPC and faucet, NEAR AI Cloud, Phala PCCS (collateral for the TEE attestation check). The NEAR Intents 1Click service is never called (module disabled, not run)."
- **K-4 `intents/DEMO_MAINNET.md:1-6`** (dev-intents via the project lead): the title "mainnet demo: procedure for the human" reads as a planned demo, and `:6` points to a section "Feux verts accordés" (French, nonexistent; BESOINS has "Feux verts demandés"). Insert after the title: "> **Status: vision only. Not run, not part of the hackathon demo, no mainnet demo is planned.** These notes are kept for a possible future use, which would need a written human go-ahead." and replace `(section "Feux verts accordés")` with `(section "Feux verts demandés", green lights)`.
- **K-5 `docs/VIDEO_SCRIPT.md:9`** (redacteur): French word "rejoué" -> "replayed".
- **K-6 `docs/VIDEO_SCRIPT.md:47,48,55`** (redacteur): the script caps narration at 2.5 words/s (`:7`), but shot 1 has 34 words in 10 s (3.4/s), shot 2 40 words in 14 s (2.9/s), shot 9 61 words in 22 s (2.8/s); at 2.5 words/s the edit reaches about 2:24 > 2:20. Fix: shot 1 VO "These AI agents earn money, pay for their own brains, have children, and die. A replay of our real testnet run, not live." (23 words); shot 2 VO "A mission arrives: a pitch for an organic bakery. An automated browser typed it for the developer; our demo account paid. The agents and payments are real." (27 words); shot 9 VO: drop the last sentence "Mock needs no key; … vision." (Intents stays on screen), giving 42 words.
- **K-7 Personal paths in public files** (redacteur, chef-de-projet, qa): `docs/VIDEO_SCRIPT.md:25`, `docs/BESOINS_HUMAIN.md:16,28`, `docs/RUN_9C.md:116`, `docs/QA_RAPPORT.md:224` contain `C:\Users\<user name>\…`, which exposes the local user name once the repository is public. Replace with `<user folder>\Darwin-run9c\video\…`, `<user folder>\Darwin-data-backups`, `git clone <local repository>`.
- **K-8 `docs/FORMULAIRE.md:30-46`**: run `node scripts/check-formulaire.mjs` and record the count. If it prints more than 1,980, trim for margin: in `:42` drop " (about 0.07 USD)" (-17) and in `:40` replace "(tx ids in the repo)" with "(tx ids in repo)" (-4).

### BESOINS_HUMAIN (French, internal; chef-de-projet) — mandatory for an executable checklist (part of K)
- **B-1 contradiction `:20-32` vs `:54` and `:73-75,:111-131`**: the 13 November checklist creates the public repository, posts on X and submits the form on the 13th (steps e, f, g), while `:54` says "Rien n'est publié le 13" and steps 6 to 9 schedule publication on Saturday. Fix: keep the checklist of the 13th as the reference; `:54` -> "Si les étapes a à d sont vertes, publication le 13 (étapes e à g) ; sinon le 14 avant 12:00 UTC" ; title `:73` -> "Samedi 14 novembre : repli si la publication du 13 n'a pas été faite".
- **B-2 `:13`** stale: "(correctif en préparation, non fusionné)" -> "(bug du plancher de prix corrigé par L21 ; sous-traitance réelle prouvée au run 10)".
- **B-3 `:52`, `:69`, `:86`, `:90`** stale video plan ("2 min 14", shot 8 = "onglet Preuves (12 s)"): replace the shot list with "plans : `docs/VIDEO_SCRIPT.md` (9 plans, 2 min 16 ; plan 8 = sous-traitance sur le rejeu du run 10, 14 s)" and "2:14 visé" with "2:16 visé".
- **B-4 `:30` step e**: (1) `README.md` and `docs/VIDEO_SCRIPT.md` contain no `<REPO_URL>` (only POST_X does; README:166 `<repository-url>` may stay): fix the list; (2) add "puis commit et `git push origin main`, et refaire `npm run scan-secrets`"; (3) add `npm run typecheck` and the PowerShell form `git ls-files | Select-String -Pattern '\.env$|\.key$|\.pem$|^data/'` (the `grep` form needs Git Bash).
- **B-5 `:32` step g**: add "champs humains : `requestId`, `leadName`, `email`, `size`, `tracks`, `nearAddress` (compte **mainnet** à vous), `consent` ; confirmer « aucun code antérieur » et l'éventuel second projet (README §11) ; détail : étape 8".
- **B-6 `:28` step c**: add "(commande de vérification : étape 3, (e) et (f))".
- B-7 (optional) `:38` "lot L22-docs-9c" -> "lot L24"; `:136` "environ 0,034 USD" -> "environ 0,11 USD cumulés (dont 0,066 USD run 9c, 0,029 USD run 10)".

### Optional (K-9 to K-16)
- **K-9 `README.md:5`, `docs/PREUVES_TESTNET.md:17`, `docs/FORMULAIRE.md:40`**: "two real runs reached generation 3", while run 10 also did (PREUVES:519,554; README:208). Understatement, but an inconsistency an AI judge may flag: "two real runs reached generation 3 with deaths (runs 8 and 9c; the short run 10 also reached it, with no death)".
- **K-10 `docs/PREUVES_TESTNET.md:557`**: nested parenthesis makes the sentence unreadable; rewrite as "Unexplained refusal of two logo parents: `t-10013204` (0.00, "only one logo" although 3 SVG files) and `t-10013217` (0.35). Cause not established (small AI judge, input not journalled); the same refusal happened without subcontracting in run 9c (`t-9975954`); not attributed to subcontracting; no judge fix (code freeze); D-050 not exercised."
- **K-11 `docs/POST_X.md:12`**: the single post does not say the attached video is a replay; prepare a first reply: "Video: replay of our recorded NEAR testnet runs 9c and 10, not live. The 2 missions were typed by an automated browser for the developer and paid by our demo account."
- **K-12 `docs/POST_X.md:20`** tweet 1/ "Economic natural selection, live." with a replay video attached: append nothing to the tweet but use the K-11 reply, or replace "live" by "on NEAR testnet".
- **K-13 `docs/POST_X.md:33`** tweet 4/: "Selection by speculation died out" follows Spore.fun facts without the README caveat "our reading, not a claim of the paper"; "A hypothesis to test" covers it partly. Acceptable; keep as is if no room.
- **K-14 `brain/near-ai-brain.ts:146`**: `Garde-fou budget : ${msg}` -> `Budget guard: ${msg}` (string only; code freeze allows it only if the project lead agrees; visible only when the AI cap is hit).
- **K-15** H-8, H-10, H-11, H-14 of the previous opinion: unchanged, still optional.
- **K-16** PREUVES:5 says the generator emits French table headers; the committed file is English: fine.

### V1 grid (section A) at `d66b7d4`
- [x] Fresh clone + README commands: QA fresh clone on `90c6bc0` (QA_RAPPORT); README §6b/§9 re-run on 2026-11-12 per README:145,235; **to be confirmed by the four commands above** (not run by me).
- [x] >= 3 generations without intervention: run 8 (PREUVES §8) and run 9c (PREUVES §14, generation 3, 4 deaths), mock tests (`engine/simulation.test.ts`, `engine/selection.test.ts`).
- [x] Market (publication, bids, escrow, validation, payment, reputation): run 9c (78 locks, 68 releases, 7 refunds, 75 reputations) and run 10 (subcontracting).
- [x] Letters parent -> child: 10 in run 9c, `/api/agents/<id>/letter` (README §9 step 10).
- [x] Live web page: unchanged since the previous opinion except UI fixes L21 (captures `docs/captures/l21-subcontract-*.png`, not re-viewed by me in a browser).
- [ ] Tests green: **not re-run by me** (no shell); turns green when the project lead records 425/425 and `tsc` 0 on `d66b7d4`.
- [ ] README compliant, steps verified by QA: green once K-1 to K-3 are fixed (K-4 to K-8 are on other files).
- [x] This grid up to date, red boxes justified (sections B to D depend on the human: public repository, video, X post, form, mainnet address).

### Not verified by me
Test suite, typecheck, `check-formulaire` (hand count only), secret scan, `npm run replay` and `start:mock` outputs, the web page in a browser, nearblocks pages of the hashes (only their presence in the journals), sha256 of the journals, the Rust tests, X's real video limit and character counter, and that the commits after `90c6bc0` did not touch engine/market/contract code (no `git diff`).

## Final review of `main` after L19 (English), HEAD `90c6bc0`, 2026-11-12

**Verdict: GO WITH RESERVATIONS.** Concept unchanged, no unproven public claim found, closing sentence present, Intents off, replay always labelled. Five mandatory text fixes (H-1 to H-5) before the repository is made public.

**Limit of this review (stated, not hidden).** My tool set in this session had **no shell**: I could not run `npx vitest run`, `npx tsc --noEmit`, `node scripts/check-formulaire.mjs`, `npm run scan-secrets`, `npm run replay` or `npm run start:mock`, nor commit. Everything below comes from reading the code and documents at `90c6bc0`. **Condition of this GO**: the project lead (or QA) runs these six commands on `90c6bc0` and confirms: 387 tests green, `tsc` 0 error, `idea` <= 2000 characters, scan OK, the three `[darwin]` lines of README §7 and the five lines of §6b step 1, `POST /api/tasks` -> 201 (mock) and 403 `REPLAY_READ_ONLY` (replay), then frees the ports. If one of them fails, this opinion becomes a VETO on publication.

### Checks done by reading
1. **README vs code.** Startup lines of §7 = `backend/main.ts:64-65,82`; the five lines of §6b step 1 = `backend/replay-main.ts:67-69,86-87`; 403 message of §6b step 6 = `backend/replay-runtime.ts:9` + `backend/app.ts:155`. UI labels quoted in the README exist in `frontend/`: tabs Mission/Lineage/Proof (`index.html:19-21`), "Describe your mission…" and "Missions disabled during replay" (`mission.js:374`), "Send the mission" (`index.html:52`), "Public data: …" note (`index.html:57`), pill "MOCK" + "simulated chain and AI" and "REPLAY" + "recorded real run" (`darwin.js:36-37`), banner "Replay of a real testnet run from November 10, 2026" (`darwin.js:59-61`, `index.html:33`), "playing · N%" (`darwin.js:62-69`), "Generation N · X alive · Y dead" (`lignees.js:310`), "generations/alive/missions paid" (`preuves.js:23`), "paid ✓" and "simulated" tag (`mission.js:117,183`). API badges are English (`market/index.ts:29-31`), legacy French values only mapped. Selection preset of the README = `shared/config.ts:81-84`. The README is entirely in English (no French found outside protocol values of old runs, quoted journal content and the deployed contract's error messages in `contracts/README.md:37,42`, translated there). "first" is never claimed (README:32 "not the first attempt"; other hits are temporal). §13 of PREUVES (English output validation) supports the "Language of the proof runs" paragraph (README:100).
2. **FORMULAIRE / POST_X / VIDEO_SCRIPT.** English. Closing sentence present: README:44, FORMULAIRE:38, VIDEO_SCRIPT:4 and :51 (and POST_X 4/). `idea` estimated by hand at about 1,975 characters (not run through the script). Single post: 267 characters counted by hand, @NEARProtocol and #NEARHackathon present, video marked mandatory (POST_X:3,14). Video: 10+12+10+18+16+14+20+14+22 = 136 s = 2 min 16 < 2 min 20; shots 7 and 8 (replay) say "not live" on screen and in the voice-over.
3. **Concept.** No drift: 8 genes, cycle, escrow/validation/reputation, subcontracting; simulated client labelled (`mission.js:117`, `market/index.ts:30`); replay never presented as live (pill, banner, 403); `INTENTS_ENABLED=false` and `INTENTS_DRY_ONLY=true` (`.env.example:97,102`, `shared/config.ts:231,234`); generation 3 attributed to run 8 only (README:5,9,93,172,174,255; FORMULAIRE:40; POST_X; VIDEO); runs 9a/9b stated as extinct in generation 1 (README:174,255): G-2 fixed; visitor orders of 9a and 9b stated exactly (README:9,97,133): G-1 fixed, consistent with PREUVES §11.
4. **RUN_9C.** Up to date: command (§2), variables (`DARWIN_PRESET`, `DARWIN_ADMIN_TOKEN`, `DARWIN_REPLAY_FILE`), thresholds (§4), fallback (§7), line "Result of run 9c: TO BE FILLED IN" (`docs/RUN_9C.md:109`), mirrored in README:175 and :255.

### Mandatory before making the repository public (H-1 to H-5)
- **H-1 `README.md:222`** (redacteur): "26 test files and 381 tests passed" does not match the 387 expected on `90c6bc0` (the L19 badge commit came after that count). Fix: replace with the count printed by `npx vitest run` on `90c6bc0` (e.g. "26 test files and 387 tests passed, 2026-11-12").
- **H-2 `README.md:244-245`** (redacteur), disclosure (HACKATHON.md Q-005): `package.json:37,40` has two dev dependencies not listed: `@phala/dcap-qvl` 0.7.1 and `ethers` 6.17.0 (used by `scripts/verify-attestation.mjs:114,147`), and the attestation check calls Phala's PCCS (`docs/ATTESTATION_TEE.md:26`). Fix: add to the library list "`@phala/dcap-qvl` 0.7.1 and `ethers` 6.17.0 (dev only, TEE attestation check, `scripts/verify-attestation.mjs`)" and to "External services": "Phala PCCS (collateral for the TEE attestation check)".
- **H-3 `docs/POST_X.md:32`** (redacteur), tweet 4/: 267 characters as plain text, but X auto-links "Spore.fun" (`.fun` is a valid TLD) and counts it as a 23-character URL, which gives about 281 > 280. Fix: drop "agents " ("Spore.fun selected by token price: …"), giving about 274, and check in the X editor.
- **H-4 Visible French in runtime messages** (owners: dev-backend, dev-cerveau-ia, via the project lead):
  - `backend/main.ts:41`: `AVERTISSEMENT :` -> `WARNING:`.
  - `brain/near-ai-brain.ts:276`: `Garde-fou anti-boucle : ${n} appels en ${ms} ms pour ${agent}` -> `Anti-loop guard: ${n} calls in ${ms} ms for ${agent}`.
  - `brain/near-ai-brain.ts:292`: `NEARAI_API_KEY absente : utiliser le mode mock` -> `NEARAI_API_KEY missing: use mock mode`.
  - `package.json:6` (description, shown on GitHub/npm): `Darwin : agents IA qui gagnent leur vie, …` -> `Darwin: AI agents that earn their living, pay for their brain, reproduce and die (NEAR testnet).`
  These are short string changes; tests asserting these messages, if any, must follow.
- **H-5 Re-run of the six commands** listed in "Limit of this review" above, with the counts written in STATUS.

### Optional (H-6 to H-14)
- **H-6 `frontend/app.js:430`** (classic page `/?classique`): "Lineages that specialize where demand is strong thrive, the others die out." is stated as a fact; align with `preuves.js:56`: "Hypothesis: lineages specialized where demand is strong should survive better."
- **H-7 `docs/VIDEO_SCRIPT.md:53`** and shots 4-5 (`:46-47`): shot 1 may be shot "in replay, your choice" but its voice-over does not say "not live"; shots 4-5 say "not live" on screen only. Fix: "shot 1 in live mock only", or add "Replay, not live." to the voice-over of any shot recorded in replay (as the preparation rule `:28` requires).
- **H-8 `docs/RUN_9C.md:50`**: the pill reads "NEAR TESTNET" (`frontend/darwin.js:36`), not "TESTNET NEAR". `:36`: folder name `data-sauvegarde-` -> `data-backup-`.
- **H-9 `docs/PREUVES_TESTNET.md:5`**: add "§13 = English output validation" to the header; `:19` "`refund_escrow` proven once" is stale (README:85 and §11: refunds in runs 7, 8, 9a, 9b): "Proven (§8, §11)".
- **H-10 Scripts with French output** (operator tools, not in the README steps): `scripts/rotate-master-key.mjs:78,120,145,184,217,220`; `brain/tools/probe-models.ts:18,24,26,30`; `brain/tools/logo-validation.ts:44,65`; `scripts/scan-secrets.mjs:100` (finding type `fichier-.env-suivi-par-git` -> `tracked-.env-file`).
- **H-11 Test names in French** (`*.test.ts`, e.g. `market/market.test.ts`, `brain/brain.test.ts`, `shared/pitch.test.ts`): only visible in the source or on a failure. Accepted as is; translate if time allows.
- **H-12 `README.md:153-164`**: the command table omits `npm run replay` (described in §6b); add one line.
- **H-13 `README.md:188`** says the model is checked against `/v1/models`, while §5 (`:86`, `:106`) and `brain/model-list.ts` use `/v1/model/list` (with `/models` as fallback): harmonise.
- **H-14 `.gitignore:13`**: comment `# worktrees des agents` -> `# agent worktrees`.

### V1 grid (section A) at `90c6bc0`
- [x] Fresh clone + README commands: QA fresh clone of L17 (`0d76273`); after L19, README §9 says all steps were re-run on 2026-11-12 after the translation; **to be confirmed by H-5** (I could not run it).
- [x] >= 3 generations without intervention: run 8 (PREUVES §8) and mock (`engine/simulation.test.ts`, `engine/selection.test.ts`). 9a/9b extinct, stated.
- [x] Market, [x] Letters, [x] Live web page: unchanged by L19 except language; labels checked in `frontend/`.
- [ ] Tests green: **not re-run by me** (no shell); turns green when H-5 confirms 387/387 and `tsc` 0.
- [ ] README compliant, steps verified by QA: green once H-1 and H-5 are done (H-2 to H-4 are on other files).
- [x] This grid up to date, red boxes justified (sections B to D still depend on the human: public repository, video, X post, form, mainnet address).

> **Avis final du 2026-11-12 sur `lot/L17-integration` (HEAD `787d11a`) : VETO LEVÉ, GO pour la fusion dans `main`.** Voir « Avis final L17-integration » en fin de fichier. Deux corrections de texte (G-1, G-2) sont **obligatoires avant de rendre le dépôt public** ; elles ne bloquent pas la fusion.

> **Mise à jour du 2026-11-12 (revue pré-fusion de `lot/L17-integration` = L16 + L17 + L18, HEAD `c19235a`)** : la section A ci-dessous et l'« Avis L16-L17-L18 » en fin de fichier font foi. Sources officielles relues le 2026-11-12 (nearhackathon.com, HACKATHON.md, docs.near.org/getting-started/hackathons) : dates, livrables, champs du formulaire, consentement, tracks et règles Q-000 à Q-017 inchangés ; seule nuance de rédaction, HACKATHON.md exige maintenant de joindre une **vidéo** au post X (« screenshots alone are not enough when judges cannot open the demo »), la page d'accueil dit toujours « video or screenshots » (voir SPECS L-05). Limite de cette revue : l'outil du gardien n'avait pas de shell, donc ni `npm test`, ni `typecheck`, ni `check-formulaire`, ni serveur relancés par moi ; je m'appuie sur la lecture du code et des documents, et sur `docs/QA_RAPPORT.md` du 2026-11-12 (captures relues).
>
> Propriétaire : gardien-des-specs. Vert = conforme `[x]`, rouge = non conforme ou non vérifiable `[ ]` avec justification. Les identifiants renvoient à `docs/SPECS.md`. Recette V1 du 2026-11-09 sur `main` au commit `4c94c30` : sources officielles relues le jour même (nearhackathon.com et HACKATHON.md, aucun changement constaté). Rien n'est coché sans vérification par le gardien (lecture du code, `npm test`, `npm run typecheck`, `node scripts/check-formulaire.mjs`, `node scripts/scan-secrets.mjs --no-history`, backend lancé en preset demo sur le port 3300 puis arrêté). Rust/`cargo` absent de la machine : aucun test Rust relancé.

## A. Définition de la V1 (CLAUDE.md), état au 2026-11-12 sur `lot/L17-integration`

**Mise à jour de l'avis final (2026-11-12, HEAD `787d11a`)** ; les lignes plus bas gardent l'état de la revue `c19235a` pour l'historique.
- [x] **Clone neuf + commandes du README = tout tourne** : clone neuf de la branche par la QA (`0d76273`, sans `.env` ni `data/`, Node 22.17.1) : §6b étapes 1, 2, 4 à 7 OK (étape 3 non cliquée, liens présents), §7 et §9 étapes 1 à 15 OK (`docs/QA_RAPPORT.md`, « Clone neuf 2026-11-12 »). Testnet avec clés : run 8 réel (PREUVES §8). Les commits suivants (`470851e`, `8052e38`, `787d11a`) ne touchent que des documents d'après leurs messages ; je n'ai pas pu le contrôler par `git diff` (pas de shell).
- [x] **>= 3 générations sans intervention** : inchangé (run 8 ; mock). Runs 9a et 9b éteints en génération 1 (PREUVES §11) : n'invalide pas la case, mais doit être dit au README (G-2).
- [x] **Marché**, [x] **Lettres**, [x] **Page web en direct** : inchangés ; V-6 à V-9 corrigés côté frontend (relus dans la recette QA, captures `docs/captures/clone-neuf-1112/`).
- [x] **Tests verts** : 22 fichiers, 319/319, `typecheck` 0 erreur, scan de secrets propre (QA, clone neuf `0d76273`). **Non relancés par le gardien** : mon outil n'a pas de shell.
- [x] **README conforme, étapes vérifiées par la QA** : V-1 à V-4 corrigés et vérifiés (étape 6 en `marketing`, 201 puis `settled` ; étape 14 et §12 ; messages du §6b identiques au code `backend/replay-main.ts:56-58,78` ; preset `selection` du README = `shared/config.ts:81-87`). Écarts QA E-1 à E-3 repris. Réserve : G-1 et G-2 (exactitude sur les runs 9a/9b), à corriger avant publication.
- [x] **`docs/CONFORMITE.md` tout au vert (ou rouge justifié)** : oui ; les cases rouges restantes (sections B à D) dépendent de l'humain et sont justifiées.

**État de la revue `c19235a` (historique)** :
- [ ] **Clone neuf + commandes du README = tout tourne** : ROUGE. Mock : clone neuf vérifié par la QA le 2026-11-09 (c99eab0), avant L16. Testnet avec clés : run 8 réel (PREUVES §8) et démarrage avec la clé maître changée (QA 2026-11-12 §3). Rejeu : `npm run replay` vérifié par la QA (QA 2026-11-12 §2). MAIS sur cette branche, le README §9 ne correspond plus au code : l'étape 6 envoie `"profession":"writer"`, que le schéma refuse depuis L16 (`shared/types.ts:12,146`, `PROFESSIONS` = logo/finance/architecture/marketing/translation/legal), donc HTTP 400 au lieu de 201, et l'étape 7 en dépend ; l'étape 14 décrit l'ancienne page, qui est maintenant sur `/?classique` (`frontend/boot.js:2`) ; le §6b, étape 1, cite un message de démarrage en anglais alors que le vrai est en français (`backend/replay-main.ts:56,78`). La QA n'a pas rejoué le §9 depuis L16. Voir écarts V-1 à V-3.
- [x] **>= 3 générations, sans intervention** : testnet, run 8 (génération 3, 12 naissances, 8 reproductions, 7 morts par famine avec `mark_dead` et clôture de compte, 138 appels IA débités ; PREUVES §8, `docs/preuves/run8-journal.jsonl`) ; mock : `engine/simulation.test.ts`, `engine/selection.test.ts` (D-043). Réserve : le preset `selection` a changé après le run 8 (6 fondateurs, 0,12 NEAR, métabolisme 0,0035, client 2/tick, `shared/config.ts:82-88`), il est calibré en mock seulement et n'a pas été rejoué en réel jusqu'à la génération 3 (écart V-4).
- [x] **Marché : publication, enchères, séquestre, validation, paiement, réputation** : run 8 (65 séquestres verrouillés dans le contrat, 63 libérés, 2 remboursés, 65 réputations) ; juges par métier L16 (D-039) ; garde de libération relue (`market/index.ts:306-322` : remboursement si rejeté, hash identique exigé, séquestre de la chaîne contrôlé, preuve `accepted` seulement, type `verdict` binaire `shared/types.ts:108`). Tâche de visiteur sur testnet : verrouillée puis remboursée seulement (run 9b), jamais payée : c'est dit partout.
- [x] **Lettres parent -> enfant générées et consultables** : 8 lettres au run 8 ; panneau Lignées avec lettre dépliable (QA 2026-11-12, capture `l17-recette-r8-lignees-panneau.png`).
- [x] **Page web en direct** (arbre, soldes, naissances, morts, flux de transactions, formulaire de tâche) : onglets Mission/Lignées/Preuves relus dans le code (`frontend/index.html`, `darwin.js`, `mission.js`, `preuves.js`) et sur les captures QA (`l17-recette-r8-mission-milieu`, `-lignees-fin`, `-preuves-fin`, `-tn-*`) ; aucun `innerHTML`. Réserves d'honnêteté de l'interface : V-6 à V-9.
- [ ] **Tests verts** : non vérifié sur cette branche. Dernier chiffre attesté : 208 tests sur `main` (STATUS, 2026-11-11). La recette QA du 2026-11-12 ne donne ni `npm test` ni `typecheck`. Condition de fusion : `npm test` et `npm run typecheck` verts sur `c19235a` (ou sur le HEAD corrigé), avec le compte dans STATUS.
- [ ] **README conforme, étapes « faites X, vous verrez Y » toutes vérifiées par la QA** : ROUGE, voir V-1 à V-5.
- [ ] **`docs/CONFORMITE.md` tout au vert (ou rouge justifié)** : chaque case rouge porte sa raison. Elle passera au vert quand V-1 à V-5 seront corrigés et que la QA aura rejoué §6b et §9.

### A bis. Historique (recette V1 du 2026-11-09, conservé)
- [ ] Clone neuf + commandes du README = tout tourne (mock sans clé, testnet avec clés) : mock vérifié par la QA sur clone neuf (c99eab0) et par moi sur l'arbre de travail (démarrage, health, POST /api/tasks, tâche `settled`) ; pas de re-clone par moi ; testnet jamais exécuté (pas de clés, Node 22.17.1 < 22.22.2)
- [x] >= 3 générations naissent, travaillent, paient leur IA, se reproduisent, meurent, sans intervention (mock) : `start:demo` lancé par moi, `generations: 3` en ~1 min, 94 `brain.charged`, 45 `escrow.released`, 2 `agent.reproduced`, 2 `letter.written` ; morts : test `engine/simulation.test.ts` (3 générations) et QA (15 morts, `starvation`). Testnet (mise à jour 2026-11-11) : run 8 réel, preset `selection`, génération 3, 12 naissances, 8 reproductions, 7 morts par famine avec `mark_dead` et clôture de compte, sans intervention jusqu'à la pause au tick 59 (`docs/PREUVES_TESTNET.md` §8, journal `docs/preuves/run8-journal.jsonl`). Réserve : un seul run, non rejoué par la QA
- [x] Marché : publication, enchères, séquestre, validation, paiement, réputation (mock) : tâche visiteur `t-0047` publiée, enchère, validée `brain:mock/small`, `settled` ; 45 `reputation.updated`, 6 `subcontract.created` ; code `market/index.ts` `settle()` lu
- [x] Lettres parent -> enfant générées et consultables (événements `letter.written` vérifiés ; endpoint `/api/agents/<id>/letter` vérifié par la QA)
- [ ] Page web en direct : arbre généalogique, soldes, naissances, morts, flux de transactions, formulaire de tâche : code `frontend/` lu (étiquettes d'honnêteté présentes, aucun `innerHTML`), vérifiée dans Chromium par la QA (réserve : panneau « morts » non contrôlé visuellement, puis capture `morts-desktop` ajoutée) ; je n'ai pas rendu la page moi-même
- [x] Tests verts : 183 tests, 10 fichiers, `npm run typecheck` sans erreur (2026-11-09)
- [ ] README conforme, étapes « faites X, vous verrez Y » toutes vérifiées par la QA : QA sur c99eab0 (avant les derniers correctifs) ; écarts README/code ou surpromesses restants listés dans « Avis final V1 » (E1 à E10)
- [ ] Cette grille au vert (ou rouge justifié) : rouge justifié, voir ci-dessous

## B. Exigences officielles : dépôt et livrables (L-xx)
- [ ] L-01 Dépôt public (rendu public par l'humain, avant 2026-11-14 23:59 UTC) avec README reproductible : dépôt local, rien de public ; humain
- [x] L-02 Fichier LICENSE présent à la racine (MIT, revérifié le 2026-11-09 ; HACKATHON.md Q-014 toujours en vigueur)
- [ ] L-03 Démo ouvrable par les juges : installation locale reproductible OK (mock), mais vidéo non enregistrée et dépôt non public ; humain
- [ ] L-04 Si démo hébergée : en ligne au moins jusqu'au 2026-11-18 (idéal 2026-11-25) : aucune démo hébergée prévue ; humain
- [ ] L-05 Post X : brouillon `docs/POST_X.md` contient « Built at NEAR HACKATHON », @NEARProtocol, #NEARHackathon, vidéo jointe (conforme à HACKATHON.md relu) ; non publié ; surpromesse à corriger avant publication (E1, E2) ; humain
- [x] L-07 README : section de divulgation (README §11 : code généré par IA, bibliothèques tierces, code antérieur « aucun », travail NEAR antérieur « aucun », services externes). Réserve : « aucun code antérieur » à confirmer par l'humain (indiqué dans le README)
- [ ] L-07 Si l'humain a un second projet : les deux README se citent (« à remplir par l'humain », README §11) ; humain
- [x] L-08 Historique git cohérent avec la fenêtre : premier commit du 2026-11-09, aucun code antérieur déclaré, aucun tag `pre-hackathon` nécessaire ; le tag `hackathon-submission` est facultatif (à poser par le chef de projet au moment de la soumission)
- [x] L-09 README lisible par machine et humain : produit, problème, architecture, étapes « Do X, you will see Y » (§9) ; étapes 1, 2, 6, 7, 9, 10 rejouées par moi sur le backend réel
- [ ] Tout le code est écrit depuis l'annonce (H-07) : cohérent avec l'historique git, mais attestation de l'humain requise

## C. Exigences officielles : soumission (S-xx), humain uniquement
- [x] S-02 `docs/FORMULAIRE.md` fournit chaque champ conforme (relu contre HACKATHON.md du jour : projectName 2-80, leadName 2-80, email max 160, size `1`/`2 - 4`/`4 - 6`/`6 - 8`/`8+`, tracks ids valides, nearAddress 2-64 mainnet, projectUrl, demoUrl, `idea` 20-2000 ; `check-formulaire.mjs` : 1649 caractères, OK) ; valeurs humaines restent « À FOURNIR »
- [x] S-03 Aucun champ en trop ; `website` laissé vide ; corps < 12000 octets (champ `idea` 1649 car., total très inférieur)
- [x] S-04 Texte de consentement verbatim identique à HACKATHON.md du jour
- [ ] S-07 Le JSON final est affiché à l'humain, qui confirme ; aucune soumission automatique : aucun code ne soumet (recherche de `nearhackathon.com/api` dans le code : rien) ; l'étape reste à faire par l'humain
- [ ] S-08 Compte NEAR mainnet de paiement fourni par l'humain (jamais créé par un agent) ; humain
- [ ] S-01 Soumission effectuée une seule fois avant la clôture ; humain
- [ ] Tracks cochés décidés (recommandation : `swarms`, `agents`, éventuellement `business`, `open`) ; humain (README ligne 5 les annonce déjà : E8)

## D. Exigences officielles : jugement (J-xx)
- [ ] J-01 Un agent IA neuf peut cloner, lancer et reproduire chaque étape du README sans aide : fait par la QA en mock sur c99eab0 ; non refait sur le commit final ; testnet impossible sans clés
- [ ] J-01 Chaque fonction annoncée dans le README existe et fonctionne (pas d'écart README/code) : mock oui ; testnet, contrat déployé, NEAR AI Cloud réel, Intents réel non vérifiables ; écarts de formulation E1 à E10
- [ ] J-03 Les critères indicatifs sont couverts : implémentation technique, design, impact, originalité, durabilité : jugement subjectif, non évalué par le gardien

## E. NEAR AI Cloud (C-xx)
- [ ] C-01 URL par défaut `https://cloud-api.near.ai/v1` (`shared/config.ts:171`), configurable (`NEARAI_BASE_URL`, https obligatoire), `/chat/completions` et `/models` codés et testés avec `fetch` simulé ; aucun appel `chat/completions` réel
- [x] C-02 Auth `Authorization: Bearer` avec clé lue en variable d'environnement (`NEARAI_API_KEY`), jamais en dur (`brain/near-ai-brain.ts`, test `brain.test.ts:78-86` avec fausse clé ; scan de secrets vert)
- [ ] C-04 Prix lus depuis `/v1/models` : champs `pricing.input`/`output` (USD par million de tokens) confirmés par ma lecture de la réponse réelle du jour (`brain/pricing.ts` les lit bien) ; id de modèle vérifié contre la liste, repli `verified:false` avec avertissement. Mais le modèle d'exemple du quickstart `zai-org/GLM-5.1-FP8` n'est plus dans la liste vivante (64 modèles dont `z-ai/glm-5.3-flash`) : le repli du code utilise des ids présents. Reste décoché : jamais exécuté de bout en bout avec clé
- [ ] C-05 Coût IA débité depuis `usage` : `billableCompletionTokens = max(completion, total - prompt, reasoning, 0)` (`shared/money.ts:46`, testé), `parseUsage` lit `completion_tokens_details.reasoning_tokens` puis l'alias ; débit vérifié en mock (`brain.charged`) ; jamais vérifié sur une réponse réelle (pas de clé)
- [x] Mode mock IA complet quand la clé est absente (backend lancé par moi : `brain.kind: mock`, 94 `brain.charged`, lettres et validation mock)
- [x] Clé absente documentée dans `docs/BESOINS_HUMAIN.md` (ligne P0 `NEARAI_API_KEY`) ; le fichier est périmé (voir E9)

## F. Réseau NEAR (N-xx, T-xx)
- [ ] T-05 / N-01 Tout tourne sur testnet NEAR ; faucet documenté dans le README : faucet documenté (README §8, « quantité non documentée ») ; testnet jamais exécuté
- [ ] N-02 URL RPC testnet vérifiées : `https://test.rpc.fastnear.com` déclaré par l'architecte (D-006), aucun appel réel `status` fait ; non vérifié par moi
- [ ] T-04 Contrat(s) NEAR personnalisé(s) : `contracts/darwin` écrit (35 `#[test]` comptés dans `tests.rs`, passage non relancé : pas de Rust), NON déployé, jamais appelé par `NearChain` sur un réseau ; échéance D-022 : 2026-11-11 23:59 UTC
- [ ] T-02 / T-03 Le projet démontre réellement enchères et sous-comptes (Swarms), agents qui gagnent, dépensent et sous-traitent (Agent Economy) : enchères, sous-traitance, gains, dépenses démontrés en mock ; sous-comptes réels = testnet jamais exécuté
- [x] Mode mock chaîne complet (sans réseau ni clé) : `MockChain` utilisée par le backend lancé par moi, hash `mock_...`, conservation testée (183 tests)

## G. NEAR Intents (I-xx), hors V1
- [ ] I-01 Base `https://1click.chaindefuser.com` (testée dans `intents/intents.test.ts:193`), `assetId` pris de `/v0/tokens` : jamais appelé en réel
- [x] I-03 Aucun appel `dry:false` ni dépôt mainnet sans feu vert humain : `INTENTS_ENABLED=false` et `INTENTS_DRY_ONLY=true` par défaut (`shared/config.ts:179-182`, `.env.example:73,78`), garde `intents/guard.ts` lue ; BESOINS_HUMAIN : aucun feu vert donné
- [ ] I-05 Frais re-vérifiés au moment d'une éventuelle exécution (sources divergentes, SPECS E-07) ; hors V1

## H. Concept Darwin (CLAUDE.md) et règles communes
- [x] Génome (vérifié `shared/types.ts`, `GenomeSchema`, test vert) : métier, modèle d'IA, prix, appétit du risque, seuil de reproduction, générosité, coopération, personnalité
- [x] Cycle (mock) : naissance, travail, reproduction (mutations + lettre), mort (solde sous le minimum vital, lignée conservée) : événements observés en preset demo ; mort et lignée par test et QA ; en testnet : run 8 réel (génération 3, 7 morts, `docs/PREUVES_TESTNET.md` §8), payeur = client simulé
- [x] Économie (mock) : tâches de visiteurs (séquestre, validation, réputation), sous-traitance, client simulé étiqueté (`badge: "simulé"`, « Visiteur (financé par le compte de démo) »)
- [x] Jamais de crédit sans preuve vérifiée : `Chain.releaseEscrow` exige `PROOF_REQUIRED` (testé `shared.test.ts:90-116`) ; `market/index.ts:278-308` : libération seulement après verdict `accepted` enregistré, `resultHash` identique, séquestre contrôlé ; `rejected` -> remboursement ; juge IA indisponible -> `VALIDATION_PENDING` 503 (échec fermé). La « preuve » est produite par l'opérateur (non cryptographique), divulgué dans README §10
- [x] Aucune dérive de périmètre : rien d'ajouté hors concept dans `frontend/`, `backend/`, `market/`, `engine/`, `brain/`, `accounts/`, `intents/`
- [x] R3 (mise à jour 2026-11-12, d'après `docs/SECURITE.md` §2.1 et §6, non relancé par moi) : les valeurs factices de l'historique sont exemptées par une exception ciblée (`scripts/scan-secrets.allowlist.json`), le scan complet sort 0 ; la clé du compte maître testnet a été changée et l'ancienne supprimée sur la chaîne (tx `CGW41ncC…`). Reste à faire par l'humain : changer la clé NEAR AI (BESOINS étape 3). Ancien constat : fichiers propres (`scan-secrets --no-history` : 137 fichiers, OK) ; `redactConfig` testé ; MAIS `node scripts/scan-secrets.mjs` complet échoue (6 à 7 valeurs factices dans l'historique, commit `4eb92ea`, `backend/backend.test.ts`) : réécriture d'historique ou documentation = décision humaine
- [x] R4 Aucune dépense réelle sans feu vert humain écrit : aucune clé ni dépense effectuée ; Intents verrouillé par défaut ; plafonds `NEARAI_MAX_USD_PER_RUN`/`_PER_HOUR` dans le cerveau ; BESOINS_HUMAIN : aucun feu vert
- [x] R5 Rien n'est publié automatiquement : aucun code d'appel à X, à l'API du hackathon, ni de `git push` ; dépôt, post et formulaire restent humains
- [ ] R2 Chaque secret manquant a une ligne dans `docs/BESOINS_HUMAIN.md` : lignes NEARAI, compte maître, JWT 1Click présentes ; fichier périmé (daté 14:40, « Aucun feu vert »), sans la chaîne d'outils Rust/contrat, le post X, la vidéo, l'attestation « code antérieur », le second projet

## I. Avis par lot
| Lot | Avis (VALIDÉ / REFUSÉ) | Date | Raisons |
|---|---|---|---|
| L0 | n/a (rédaction des specs) | 2026-11-09 | SPECS.md et CONFORMITE.md rédigés ; réserves : pages `authentication.md` 1Click, OpenAPI, RPC providers, `private-inference` non lues ; fiabilité des résumés WebFetch à re-vérifier avant soumission. |
| L1 | VALIDÉ SOUS RÉSERVES (R1 à R10, voir « Avis L1 ») | 2026-11-09 | Architecture conforme aux specs et au concept ; 11 tests verts, typecheck OK ; 6 questions tranchées ; réserves à traiter par lot. |
| V1 (recette) | VALIDÉE SOUS RÉSERVES (mock) ; testnet non validé | 2026-11-09 | Voir « Avis final V1 » : E1 à E11, R1 à R10 traitées sauf R2 (partielle) et R3 (en cours). |
| `main` pre-freeze, `d66b7d4` | **GO WITH RESERVATIONS**: K-1 to K-8 and B-1 to B-6 mandatory before publication, K-9 to K-16 optional | 2026-11-12 | Read-only review without a shell: tests, tsc, check-formulaire, scan not re-run by the guardian (condition of the GO). Official sources unchanged. See "Pre-freeze final review of `main`" at the top. |
| `main` after L19 (English), `90c6bc0` | **GO WITH RESERVATIONS**: H-1 to H-5 mandatory before publication, H-6 to H-14 optional | 2026-11-12 | Read-only review without a shell: commands not re-run by the guardian (H-5). G-1 and G-2 fixed. See "Final review of `main` after L19" at the top. |
| L16 + L17 + L18 (`lot/L17-integration`, `787d11a`) | **VETO LEVÉ : GO pour la fusion dans `main`** ; G-1 et G-2 obligatoires avant de rendre le dépôt public | 2026-11-12 | V-1 à V-5 et V-10 à V-14 vérifiés ; QA clone neuf GO (319 tests) ; sécurité GO sous réserves. Voir « Avis final L17-integration ». |
| L16 + L17 + L18 (`lot/L17-integration`, `c19235a`) | **VETO sur la fusion en l'état**, levé dès que V-1 à V-5 sont corrigés et que la QA a rejoué §6b et §9 avec tests verts ; ensuite GO SOUS RÉSERVES (V-6 à V-16) | 2026-11-12 | Le concept n'a pas dérivé et le rejeu est honnête, mais le README ne correspond plus au code (étape 6 refusée en 400, étape 14, preset `selection`) : c'est exactement ce que le tri par IA vérifie (J-01). Voir « Avis L16-L17-L18 ». |

## Avis L1 (architecture)

Date : 2026-11-09. Gardien : gardien-des-specs. Objet : `docs/ARCHITECTURE.md` (L1), `docs/DECISIONS.md` D-003 à D-019, squelette `shared/`.

### Verdict : VALIDÉ SOUS RÉSERVES

L'architecture est conforme aux specs officielles (SPECS) et au concept Darwin (CLAUDE.md). Les lots suivants peuvent démarrer. Les réserves R1 à R10 sont des conditions de fusion des lots indiqués, pas des blocages du démarrage.

### Vérifié par le gardien
- `npm test` : 11 tests verts ; `npm run typecheck` : sans erreur (2026-11-09).
- Lecture de `shared/{money,chain,brain,config,types}.ts` et `shared/mock/mock-chain.ts`.
- Génome : les 8 gènes du concept existent, avec bornes et schéma zod. Cycle naissance, travail, reproduction, mort et lignée conservée : modélisés (`Chain.registerAgent`, `markAgentDead`, `closeAccount`). Client simulé étiqueté (`requester.kind = "simulated"`). Mode mock par défaut sans clé. Intents limité à `dry:true`, flag off. Montants en `bigint`. LICENSE MIT présente.
- Pas de dérive de périmètre : rien d'ajouté hors concept. Dossiers conformes à la carte de CLAUDE.md.

### Les 6 questions de l'architecte

**1. Coût IA débité en NEAR vers le compte maître alors que la clé paie en USD : ACCEPTÉ SOUS CONDITIONS.**
Le concept dit « paiement IA débité du solde » : D-013 le respecte. Le débit est une représentation, pas un paiement à NEAR AI Cloud. Décision exécutoire :
- Le README (redacteur) écrit : « le coût de chaque appel IA est calculé en USD d'après les prix de `/v1/models`, converti en NEAR de testnet à un taux fixe configurable (`DARWIN_NEAR_USD_RATE`, ce n'est pas un cours de marché) et débité à l'agent au profit du compte maître ; la facture réelle est payée en USD par la clé de plateforme de l'opérateur ». Interdit : écrire que l'agent « paie NEAR AI Cloud » ou que les NEAR de testnet ont une valeur.
- `brain.charged` porte en plus `costUsd`, `nearUsdRate` et `priceSource` (`models` ou `mock`) ; l'UI les affiche.
- Prix absent ou modèle non vérifié : jamais de coût 0 silencieux. `BrainError` + repli (modèle par défaut vérifié ou mock) avec `system.warning`.
- Les appels mock sont débités avec un usage simulé et étiquetés `mock:true`.

**2. Tokens de raisonnement : RÈGLE ACCEPTÉE, À DURCIR.**
`max(completion, total - prompt)` est prudente (jamais sous-facturée) et conforme à C-05. Décision exécutoire pour dev-cerveau (L5) :
- Règle finale : `billable = max(completion_tokens, total_tokens - prompt_tokens, reasoning_tokens, 0)`. L'architecte corrige `billableCompletionTokens` dans `shared/money.ts` et ajoute un test (`total_tokens` absent, `reasoning_tokens` seul).
- Lire `completion_tokens_details.reasoning_tokens`, puis l'alias `reasoning_tokens`.
- Le dev-cerveau capture une vraie réponse (si clé) ou documente l'absence de clé dans `docs/BESOINS_HUMAIN.md` ; tant que non vérifié sur réponse réelle, C-05 reste décoché. Les champs de prix de `/v1/models` (noms exacts, unité) ne sont pas vérifiés : à lire dans la doc ou la réponse réelle, pas de mémoire.
- Le README indique que la règle peut légèrement surestimer le coût.

**3. L'opérateur (compte maître) oracle de validation du séquestre : ACCEPTÉ SOUS CONDITIONS (divulgation obligatoire).**
Suffisant pour « séquestre, validation, réputation » en V1 hackathon, à condition de ne rien survendre. Décision exécutoire :
- Section README « Modèle de confiance » : l'opérateur détient la seule clé autorisée à libérer ou rembourser ; la validation est faite par une règle ou un modèle choisi par l'opérateur ; le système n'est pas sans confiance (« trustless »). Les termes « trustless » et « décentralisé » sont interdits pour le séquestre.
- Chaque `task.validated` et `escrow.released` journalise `validator` et `resultHash` (déjà dans le schéma) ; l'UI affiche « validé par : <validator> ».
- Le validateur n'est jamais l'agent payé ni l'agent demandeur d'une sous-traitance. Le coût d'un validateur IA est imputé à la trésorerie, pas à l'agent gagnant (sinon biais de sélection) : dev-marche le documente.
- La « preuve » de `releaseEscrow` est un objet produit par l'opérateur, non vérifié cryptographiquement ; ne pas parler de « preuve cryptographique ». « Jamais de crédit sans preuve vérifiée » s'entend : pas de libération sans verdict `accepted` enregistré.
- Dev-marche : le montant verrouillé est défini explicitement (budget ou prix gagnant, le reste remboursé au demandeur) ; remboursement uniquement sur `rejected` ou `expired`.

**4. Tâches de visiteurs payées par un compte de démo étiqueté : ACCEPTÉ SOUS CONDITIONS.**
Conforme à « tâches de visiteurs (séquestre, validation, réputation) » : le visiteur n'a pas de testnet à portée de formulaire. Décision exécutoire :
- Étiquette distincte de `simulated` : « Visiteur (financé par le compte de démo) ». L'UI et le README précisent que ce sont des fonds de test de l'opérateur, pas l'argent du visiteur.
- Plafond de dépense global du compte `visitors.<maître>` par heure (en plus des 10 tâches ouvertes par IP et du budget min/max) ; au-delà : 429 explicite. `funding.received` avec `source: "visitor"` devient `demo` pour ne pas suggérer un vrai paiement.
- Le texte du visiteur est toujours passé en message `user`, jamais en `system`.
- L'option V2 `accountId` reste hors V1.
- README : les gains des agents viennent de l'opérateur (client simulé et démo) ; l'économie est subventionnée et en boucle fermée (métabolisme et coûts IA retournent au maître). À dire clairement.

**5. Repli D-016 si Rust ou le contrat est indisponible : ACCEPTÉ COMME REPLI SEULEMENT, SOUS CONDITIONS.**
T-04 : un contrat personnalisé n'est pas obligatoire. Le contrat reste l'objectif (J-03 : implémentation technique). Décision exécutoire :
- Échéance : si le contrat ne compile pas et n'est pas déployé sur testnet au plus tard le 2026-11-11 23:59 UTC, dev-contrats le signale au chef de projet et D-016 est activé. L'installation de la chaîne d'outils Rust est gratuite (pas une dépense) : à tenter d'abord.
- En mode dégradé : badge permanent « Séquestre dégradé : compte piloté par l'opérateur, sans contrat » dans l'UI ; `/api/health` expose `escrow: "contract" | "operator-account"` ; section README dédiée. Interdit de parler de « contrat intelligent », de registre ou de réputation « on-chain » : registre et réputation tenus dans le journal local sont affichés comme « journal local ».
- T-04 et la case « Contrat(s) NEAR » ne sont cochées que si un contrat est réellement déployé et appelé par `NearChain`.
- L'étiquette `mock` du mode mock ne remplace jamais cette mention.

**6. Points non vérifiés : liste exécutoire.**
| Point | Statut | Responsable et action |
|---|---|---|
| near-sdk 5.30.1, cargo-near 0.23.0, near-api-js 7.4.0, Node >= 22.22.2 | Déclarés par l'architecte (npm, crates.io), non re-vérifiés par le gardien | dev-contrats, dev-comptes : vérifier à l'installation, corriger D-004/D-005 si écart |
| RPC `https://test.rpc.fastnear.com` | Déclaré lu sur la liste officielle (D-006) | dev-comptes : un appel réel `status` avant fusion de L2 |
| Faucet : quantité réelle ; explorateur testnet (`explorerBase` vide) | Non vérifiés | dev-comptes : documenter ; comparer le besoin total (3 fondateurs + comptes démo et séquestre) au faucet, sinon baisser les presets testnet |
| Champs de prix de `/v1/models`, forme exacte de `usage` | Non vérifiés | dev-cerveau (point 2) |
| Gaz des sous-comptes (solde logique contre solde chaîne) | Non traité | dev-comptes, dev-moteur : inclure le gaz dans le solde logique ou le rembourser ; documenter |
| Pages 1Click `authentication`, OpenAPI, `private-inference` | Non lues (réserve L0 maintenue) | dev-intents (hors V1) |
| D-019 (encodage corrompu) | À ma lecture du 2026-11-09, les accents de CLAUDE.md et STATUS.md sont corrects ; README est un placeholder | chef de projet : vérifier les octets avant toute « correction » |
| Fiabilité des résumés WebFetch de SPECS | Réserve L0 maintenue | gardien : relire les pages vivantes avant soumission |

### Réserves à traiter, par lot
- **R1 (L1, architecte)** : durcir `billableCompletionTokens` + test ; ajouter `costUsd`, `nearUsdRate`, `priceSource` à `brain.charged` ; renommer `funding.received.source: "visitor"` en `demo` ; mettre à jour ARCHITECTURE §17 avec ces décisions.
- **R2 (L2, dev-comptes)** : vérifier RPC, faucet, explorateur, gaz ; aucune clé journalisée.
- **R3 (L3, dev-contrats)** : échéance du 2026-11-11 pour D-016.
- **R4 (L4, dev-moteur)** : calibrer les presets avec un test de 3 générations en mock ; solde logique et gaz.
- **R5 (L5, dev-cerveau)** : points 1 et 2 ; vérification via `/v1/models` ; pas de repli à coût nul.
- **R6 (L6, dev-marche)** : points 3 et 4 (validateur, montant verrouillé, remboursement, plafond visiteurs).
- **R7 (L7, dev-backend, securite)** : `DARWIN_ADMIN_TOKEN` obligatoire dès que `HOST` n'est pas `127.0.0.1` ; `/api/health` expose l'état du séquestre ; aucune route ne renvoie de secret.
- **R8 (L8, dev-frontend)** : étiquettes « mock », « simulé », « visiteur (démo) », « dégradé », « validé par » ; échappement du contenu.
- **R9 (README, redacteur)** : sections coût IA, modèle de confiance, séquestre dégradé, économie subventionnée, divulgation du code généré par IA (L-07), Node >= 22.22.2 pour le testnet, mock sur Node >= 22.12.
- **R10 (QA)** : tester qu'aucune libération n'a lieu sans preuve `accepted` au niveau du marché, pas seulement de `MockChain`.

Prochain avis : à chaque lot présenté, avec relecture du code et des tests.

## Avis final V1 (recette)

Date : 2026-11-09. Gardien : gardien-des-specs. Objet : `main` au commit `4c94c30`. Verdict global : **V1 VALIDÉE SOUS RÉSERVES pour le mode mock ; NON VALIDÉE pour le testnet, qui n'a jamais été exécuté.** Aucun veto de conformité, mais les écarts E1 à E10 sont à corriger avant toute publication (post X, formulaire, dépôt public). Je n'ai corrigé aucun fichier des autres.

### 1. Exigences officielles relues (nearhackathon.com et HACKATHON.md, 2026-11-09)
Aucun changement par rapport à SPECS : début 2026-11-01 00:00 UTC, clôture 2026-11-14 23:59 UTC, jugement 16 au 18 nov. ; dépôt public jusqu'à la fin du jugement ; LICENSE exigée (Q-014) ; divulgations README (Q-002, Q-003, Q-005, Q-015) ; démo ouvrable (Q-012 : démo locale acceptée si dépôt public, README reproductible et vidéo dans le post X) ; post X : « built at NEAR HACKATHON », @NEARProtocol, #NEARHackathon, vidéo ou captures ; champs et limites du formulaire identiques (`idea` 20-2000, `size` `1`/`2 - 4`/`4 - 6`/`6 - 8`/`8+`, 13 tracks, `website` piège, 12000 octets) ; consentement verbatim identique. Notes : la page d'accueil ne mentionne ni LICENSE ni divulgations (seul HACKATHON.md les exige, il prime) ; la page rappelle de relire avant soumission (l'humain doit le faire). Nouveauté NEAR AI Cloud : la réponse vivante de `/v1/models` liste 64 modèles ; `zai-org/GLM-5.1-FP8` (exemple du quickstart, SPECS C-04) n'y figure plus ; les champs `pricing.input`/`output` (USD par million de tokens) sont confirmés et lus par `brain/pricing.ts`.

### 2. Verdict par case de la définition de la V1
| Case | Verdict | Raison |
|---|---|---|
| Clone neuf + README | PARTIEL | Mock OK (QA sur clone neuf à c99eab0, moi sur l'arbre de travail : démarrage, health, tâche `settled`). Testnet avec clés jamais exécuté. |
| >= 3 générations autonomes | OK (mock) | `start:demo` : 3 générations en ~1 min, paiements IA, reproductions, lettres ; morts par test et QA. Testnet : run 8 réel (génération 3, 7 morts ; un seul run, payeur = client simulé). |
| Marché complet | OK (mock) | Publication, enchères, séquestre, validation nommée, paiement, réputation observés ; garde « pas de crédit sans verdict `accepted` » lue dans `market/index.ts:278-308`. Séquestre dégradé par défaut (contrat non déployé). |
| Lettres consultables | OK | `letter.written` observé ; endpoint vérifié par la QA. |
| Page web en direct | PARTIEL | Code et étiquettes lus ; vérifiée dans un navigateur par la QA uniquement ; je ne l'ai pas rendue. |
| Tests verts | OK | 183/183, typecheck propre. |
| README conforme, étapes vérifiées par la QA | PARTIEL | Étapes vérifiées par la QA avant les derniers correctifs ; écarts de formulation E1 à E10 ; la QA est à refaire sur le commit final. |
| `docs/CONFORMITE.md` | OK (rouge justifié) | Chaque `[ ]` porte sa raison : testnet, contrat, NEAR AI Cloud réel, Intents réel, dépôt public, vidéo, post X, soumission. |

### 3. Écarts entre documents et code (à corriger par le rédacteur, sauf mention)
- **E1 `docs/POST_X.md:10`** (post unique) : « Live selection on NEAR testnet: sub-accounts, escrow, NEAR AI Cloud. » Survente : le testnet n'a jamais tourné, la commande « sans clé » lance le mock, aucun appel NEAR AI Cloud réel, le séquestre est dégradé. Le post unique ne porte aucune réserve. Reformuler, par exemple « Runs in mock mode with no key; built for NEAR testnet (not yet run on the real network) ».
- **E2 `docs/POST_X.md:33`** (4/) et **`docs/FORMULAIRE.md:34`** : « a Rust escrow/registry/reputation contract », « NEAR Intents 1Click » présentés comme outils utilisés ; le contrat n'est pas déployé, Intents n'a jamais été appelé (même en dry-run réel). Le paragraphe « Honesty » de FORMULAIRE (ligne 36) ne dit rien de NEAR AI Cloud (jamais appelé en réel) ni d'Intents, ni du séquestre dégradé / registre local.
- **E3 `docs/FORMULAIRE.md:30`** : « Darwin is a live economy of AI agents on NEAR testnet » (testnet non exécuté ; défaut = mock). Même remarque pour **`README.md:3`** (« live, on NEAR testnet »), atténuée par l'encart d'honnêteté de la ligne 7 : à préciser « (mock by default; testnet mode not yet run) ».
- **E4 `docs/VIDEO_SCRIPT.md:19` et `:25`** : voix off inconditionnelles « born as its own NEAR sub-account » et « Built ... with NEAR accounts, access keys, a Rust contract, NEAR AI Cloud and NEAR Intents » : faux en mock. La règle de la ligne 6 (dire « mock ») n'est appliquée qu'aux plans 5 et 6. À rendre conditionnel.
- **E5 `README.md:174`** : « Not run by the author: ... the web page, a clean-clone install » contredit les lignes 154 et 171 (page vérifiée avec Playwright) et la recette QA (clone neuf). Texte périmé.
- **E6 `README.md:67`** : « 35 native unit tests pass » : 35 `#[test]` comptés par moi dans `contracts/darwin/src/tests.rs`, mais le passage n'est vérifiable ni par moi ni par la QA (pas de Rust) ; la mention « not re-run » est présente : acceptable, à garder.
- **E7 `README.md:154`** : tous les chiffres « author's run » (15 morts, tick 238) sont ceux d'une autre exécution ; les miens (3 générations, 0 mort à tick 91 en ~40 s) concordent avec la formulation « varies between runs ». Aucun écart.
- **E8 `README.md:5`** : les tracks (Swarms, Agent Economy, Open Innovation) sont affirmés comme choisis ; décision de l'humain (CONFORMITE C).
- **E9 `docs/BESOINS_HUMAIN.md`** (propriétaire chef de projet) : périmé (« mis à jour 14:40 », « Aucun feu vert », « specs à venir »). Manquent : contrat/Rust (échéance 2026-11-11), vidéo, post X, attestation « pas de code antérieur », second projet, décision sur l'historique git (valeurs factices).
- **E10 `CLAUDE.md:6`** (propriétaire chef de projet) : le pitch dit « on-chain (testnet NEAR) » ; correct comme ambition, mais ne doit pas être repris tel quel dans un texte public tant que le testnet n'a pas tourné et que le séquestre est dégradé. Les mots « trustless » et « décentralisé » apparaissent seulement dans des phrases de négation (README, POST_X, VIDEO_SCRIPT) : conforme. Aucun usage « on-chain » pour le mode dégradé dans le README ni l'interface (`frontend/app.js:212` dit « journal local »). « L'agent paie NEAR AI Cloud » : absent, README §5 dit l'inverse (conforme).
- **E11 `SPECS.md`** (mon fichier) : C-04 et E-06 citent `zai-org/GLM-5.1-FP8` ; l'id n'est plus dans `/v1/models` à ce jour. Note ajoutée à SPECS.

### 4. Réserves R1 à R10 de l'Avis L1
| Réserve | État | Preuve |
|---|---|---|
| R1 (architecte) : coût, `brain.charged`, `demo` | TRAITÉE | `shared/money.ts:46` (max à 4 termes) + test `shared.test.ts:25-32` ; `shared/events.ts:32` (`costUsd`, `nearUsdRate`, `priceSource`) ; `source: "master" \| "faucet" \| "demo"` (ligne 34). |
| R2 (dev-comptes) : RPC, faucet, explorateur, gaz | PARTIELLE | Gaz analysé en doc (`accounts/README.md`) mais « non mesuré en réel » ; RPC jamais appelé ; quantité du faucet « non documentée » (README §8). Dépend du testnet. |
| R3 (dev-contrats) : échéance 2026-11-11 | EN COURS | Contrat écrit, non déployé, Rust absent de la machine ; échéance dans 2 jours ; D-016 (dégradé) actif par défaut et correctement annoncé. |
| R4 (dev-moteur) : calibrage 3 générations, gaz | TRAITÉE en mock, PARTIELLE pour le gaz | Test `engine/simulation.test.ts` (>= 3 générations) vert ; ma recette : 3 générations en ~1 min en demo. Gaz logique : `engine/economy.ts` relit le solde chaîne ; non mesuré en réel. |
| R5 (dev-cerveau) : `/models`, pas de coût nul | TRAITÉE (code), non vérifiée en réel | `assertValidPrice`, repli `verified:false` + `system.warning`, prix nuls écartés ; format `/models` confirmé par ma lecture du jour ; jamais de `chat/completions` réel. |
| R6 (dev-marche) : validateur, montant, remboursement, plafond | TRAITÉE | `market/index.ts:391` (validateur jamais gagnant ni demandeur) ; juge imputé à `treasury` (`validation.ts:133,160`) ; remboursement seulement `rejected`/`expired` ; `/api/health` expose `visitors.hourlyCap` ; texte visiteur en `user`. |
| R7 (dev-backend, securite) : token admin, health, secrets | TRAITÉE | `backend/app.ts:35-38` (refus de démarrer sans token hors loopback) ; `escrow` dans `/api/health` (vérifié en live) ; redaction testée. |
| R8 (dev-frontend) : étiquettes, échappement | TRAITÉE | `frontend/app.js:207-216` : « MODE MOCK », « Client simulé », « Visiteur (financé par le compte de démo) », « Séquestre dégradé », « Modèle de confiance », « validé par : » (ligne 360) ; aucun `innerHTML` (grep). Rendu navigateur vu par la QA seulement. |
| R9 (README) : six sections | TRAITÉE | Coût IA (§5), modèle de confiance (§10), séquestre dégradé (§5), économie subventionnée (§10), divulgation IA (§11), Node >= 22.22.2 testnet / 22.12 mock (§6). |
| R10 (QA) : pas de libération sans `accepted` au niveau marché | TRAITÉE | `market/index.ts:278-308` et tests `market.test.ts` (rejet -> remboursement, `VALIDATION_PENDING` échec fermé) ; non rejoué par la QA dans son rapport (qui n'évoque pas R10) : à confirmer. |

### 5. Ce qui dépend de l'humain (et ce que je n'ai pas pu vérifier)
- Rendre le dépôt public avant le 2026-11-14 23:59 UTC ; décider du sort des 7 valeurs factices de l'historique (`4eb92ea`) : réécriture avant publication ou mention dans le README ; sinon `npm run scan:secrets` affiche ECHEC pour un juge.
- Fournir clés (NEAR testnet maître, `NEARAI_API_KEY`), Node >= 22.22.2, faire une première exécution testnet et NEAR AI Cloud réelle (puis mettre README, FORMULAIRE, POST_X à jour) ; installer Rust et déployer le contrat avant le 2026-11-11 ou assumer le mode dégradé.
- Vidéo, post X, `leadName`, `email`, `size`, `nearAddress` mainnet, tracks, attestation « pas de code antérieur », second projet éventuel, relecture de la page vivante, soumission unique.
- Non vérifié par le gardien : tout ce qui touche testnet, contrat déployé et tests Rust, NEAR AI Cloud réel, Intents réel, vidéo, post X, dépôt public, soumission ; rendu de la page web ; installation sur Linux/macOS ou Node >= 22.22.2.

## Avis L16-L17-L18 (revue pré-fusion de `lot/L17-integration`)

Date : 2026-11-12. Objet : `lot/L17-integration` au commit `c19235a` (L16 : 6 métiers freelance, livrables, juges, client simulé ; L17 : rejeu, interface Mission/Lignées/Preuves, D-043, validation du logo, changement de clé ; L18 : pitch et contenu des livrables dans le journal, D-045). Lu : CLAUDE.md, README, FORMULAIRE, VIDEO_SCRIPT, POST_X, BESOINS_HUMAIN, PREUVES_TESTNET, DECISIONS D-038 à D-045, SECURITE §2.1 et §6, QA_RAPPORT du 2026-11-12, le code de `frontend/` (L17), `shared/types.ts`, `shared/config.ts`, `shared/catalogue.ts`, `market/index.ts` (paiement), `backend/main.ts` et `replay-main.ts`, `package.json`, `.env.example` ; captures QA relues. Sources externes relues le jour même : HACKATHON.md, nearhackathon.com, docs.near.org/getting-started/hackathons, arXiv 2506.04236 (HTML), README d'Automaton.

### Verdict : VETO sur la fusion en l'état. Levé quand V-1 à V-5 sont faits, puis GO SOUS RÉSERVES (V-6 à V-16)

Le concept n'a pas dérivé et le rejeu est présenté honnêtement. Mais le README ne correspond plus au code sur cette branche, et c'est précisément ce que le tri par IA vérifie (J-01). Toutes les corrections bloquantes sont des retouches de documentation, plus un passage de QA : elles tiennent en quelques heures.

### Contrôles demandés
1. **Concept** : conforme. Les 8 gènes sont inchangés (`shared/types.ts:25` ; le métier passe à 6 métiers freelance, c'est toujours le gène « métier »). Le cycle est inchangé. L'économie aussi : séquestre, validation (contrôle déterministe puis juge IA, D-039), réputation, sous-traitance, client simulé étiqueté « simulé » dans le fil Mission (`mission.js:110`), y compris en rejeu (capture `l17-recette-r8-mission-milieu.png`). Le testnet est par défaut, le mock aussi, Intents est désactivé (`.env.example:97,102`). Pas de crédit sans verdict `accepted` (`market/index.ts:306-322`). D-045 ajoute en réel un appel IA d'enchère débité à l'agent : c'est cohérent avec « paie son cerveau », mais absent du calibrage D-043 (fait en mock).
2. **Rejeu jamais présenté comme du direct** : conforme dans l'interface. Pastille « REJEU run réel enregistré », bandeau permanent « Rejeu d'un run réel testnet du 10 novembre 2026 » sur les 3 onglets, statut « Rejeu en cours », missions désactivées, `POST /api/tasks` en 403. README §6b conforme. Le post X ne parle pas du rejeu. La vidéo est à corriger (V-10).
3. **Affirmations publiques** : rien de non prouvé dans README, FORMULAIRE et POST_X : aucun logo dit livré et payé, Intents dit « never executed » ou « not run », génération 3 attribuée au run 8. Le mot « premier » / « first » n'est jamais revendiqué : README:32 dit « not the first attempt », VIDEO:54 et POST_X:49 l'interdisent. La phrase de clôture est présente au README (:44 en anglais, :280 en français mot pour mot), dans FORMULAIRE:38 (anglais), dans VIDEO_SCRIPT (:4 en français et en anglais, :47 en voix off) et dans POST_X (:31, fil seulement). Faits sur Spore.fun revérifiés dans l'article (25 décembre 2024 ; Solana, Phala, Pump.fun ; 500 000 $, « market capitalization » et « fully-diluted valuation » ; 2/6/4/1 ; seul l'agent d'origine vivant au 18 mai 2025 ; aucune cause unique avancée). Faits sur Automaton exacts, avec une nuance manquante (V-11).
4. **Livrables officiels** : couverts. Dépôt public et LICENSE (BESOINS étape 6). Post X avec « Built at NEAR HACKATHON », @NEARProtocol et #NEARHackathon, 267 caractères comptés pour le post unique, vidéo jointe (étape 7). Formulaire soumis une seule fois par l'humain (étape 8). BESOINS a des lacunes et des risques (V-12).
5. **Cette grille** : section A mise à jour avec preuves et raisons des cases rouges.

### Écarts BLOQUANTS (condition de levée du veto)
- **V-1 `README.md:202` (étape 6)** : `"profession":"writer"` est refusé depuis L16 (`shared/types.ts:12,146`), donc HTTP 400 au lieu de 201, et l'étape 7 (`:203`) devient impossible. Correctif (rédacteur) : remplacer le corps par `'{"title":"Translate a slogan","prompt":"Traduis en anglais : « La sélection naturelle favorise ceux qui gagnent leur vie. »","profession":"translation","budgetNear":"1","requesterLabel":"Alice"}'` (plancher mock de translation : 0,012 x 40 = 0,48 NEAR, `shared/catalogue.ts:121`, `shared/config.ts:43`). Ensuite la QA relève les vraies sorties des étapes 6, 7, 10 et 11 (valeur de `validatedBy`, texte de la lettre mock) et le rédacteur les recopie telles quelles. Corriger aussi l'exemple de `:278` si besoin.
- **V-2 `README.md:210` (étape 14), `:239` (§12) et `:284` (résumé français)** : ils décrivent l'ancienne page, qui n'est plus sur `/` (`frontend/boot.js:2`). Correctif pour l'étape 14 : « Open `http://127.0.0.1:3000/`: header pill "MODE MOCK · chaîne et IA simulées", three tabs. **Mission**: agent cards, a box "Décrivez votre mission…" (profession and budget chips), a live thread per task (tag "simulé" for the simulated client, bids, "remporte la mission", judge verdict, "payé ✓"). **Lignées**: family tree, dead agents greyed, click an agent for its genome, letters and balance curve. **Preuves**: counters, population per generation, money flows, transactions, NEAR building blocks. The previous single page (banner "MODE MOCK, Client simulé, Séquestre dégradé", form "Publier la tâche") is at `/?classique`. » La QA doit le vérifier.
- **V-3 `README.md:118-119` (§6b)** : le message de démarrage réel est en français (`backend/replay-main.ts:56,78`). Remplacer par `[darwin] Darwin <version> : MODE REPLAY (1819 événements de run8-journal.jsonl, enregistrés le 2026-11-10, vitesse x5)` puis `[darwin] rejeu démarré`. Remplacer aussi « progress (event n/1819) » par « a progress bar and "en cours · N %" » (`frontend/darwin.js:60`), et `:114` « shows exactly what happened » par « replays the recorded events (run 8 did not record bid pitches or deliverable contents: neutral summaries are shown instead) ».
- **V-4 `README.md:166`, `:182`, `:187`** : le preset `selection` n'est plus celui du run 8. Le code (`shared/config.ts:82-88`, D-043) a 6 fondateurs, une population max de 18, 0,12 NEAR de capital, 0,0035 de métabolisme et un client simulé à 2 tâches/tick, contre 4 / 16 / 0,1 / 0,005 / 1,5 au run 8, avec d'anciens métiers. Correctif : à `:182`, écrire les valeurs actuelles et supprimer « the preset of the real run » ; à `:166` et `:187`, ajouter « Run 8 used the previous version of this preset (4 founders, cap 16, 0.1 NEAR, metabolism 0.005, 1.5 tasks/tick, pre-L16 professions). The current preset was recalibrated in mock only (D-043: 92 of 100 seeds reach generation 3 with deaths); it has not yet been run to generation 3 on testnet, and in real mode each bid now costs one AI call (D-045). Run 8 timings are a reference, not an expectation. »
- **V-5 Vérification** : `npm test` et `npm run typecheck` verts sur le HEAD corrigé, puis la QA rejoue README §6b et §9 (étapes 1 à 15) sur un clone neuf de la branche, avec le compte de tests dans STATUS. Sans cela, les cases « Tests verts » et « README vérifié par la QA » restent rouges.

### Réserves (à traiter avant d'enregistrer la vidéo ou de publier ; ne bloquent pas la fusion une fois V-1 à V-5 faits)
- **V-6 `frontend/mission.js:113` et composeur `frontend/index.html:53-56`** (dev-frontend, revue sécurité) : dans l'interface par défaut, une tâche de visiteur n'affiche « financé par le compte de démo » qu'en info-bulle, et le composeur n'a ni cet avertissement ni celui des données publiques (D-045 : texte, pitch et livrable publics ; exigence SECURITE §3.8). Ajouter sous le composeur : « Votre texte, les offres et le livrable sont publics. Le budget est avancé par le compte de démo de l'opérateur (NEAR de testnet, sans valeur), pas par vous. » Et afficher « visiteur · fonds de démo » dans l'étiquette.
- **V-7 `frontend/darwin.js:35`** : pas de badge permanent « séquestre dégradé » en testnet sans contrat (condition de l'avis L1, question 5 ; seul l'onglet Preuves le dit, `preuves.js:116`). Ajouter « · séquestre dégradé » à la pastille quand `mode === "testnet"` et `health.escrow === "operator-account"`.
- **V-8 `frontend/preuves.js:64,70`** : « Dépensé en cerveau IA 0.00 NEAR » (QA NB-3, visible dans `l17-recette-r8-preuves-fin.png`) laisse croire que les agents ne paient pas leur cerveau : afficher 4 décimales ou « < 0,01 ». `preuves.js:56` affirme comme un fait « Les lignées qui se spécialisent là où la demande est forte prospèrent, les autres s'éteignent » : préfixer par « Hypothèse : » ou retirer. `preuves.js:122` « Confiance » : ajouter « juge choisi par l'opérateur, pas trustless ».
- **V-9 `frontend/darwin.js:35`** : la pastille de rejeu dit « run réel enregistré » quel que soit le journal. La conditionner à `replay.meta.recorded.chain === "near"`, sinon « run enregistré ». Corriger aussi QA NB-5 (statut vert « Rejeu en cours » une fois terminé) et NB-2 (les notifications cachent x1/x5/x20).
- **V-10 `docs/VIDEO_SCRIPT.md`** : `:19-20` et `:26` sont périmés (onglets et rejeu fusionnés dans cette branche). Les remplacer par la commande `npm run replay`, la pastille « REJEU » et le bandeau exact. Plan 2 (`:40`) : le composeur est désactivé en rejeu, donc la commande de mission se tourne en mock en direct, et la phrase « This run is mock mode » ne doit être dite qu'en mock. Tout plan tourné en rejeu doit porter à l'écran et dans la voix : « Replay of our recorded testnet run 8, not live. » Plan 6 (`:44`) : « the contract refunds the visitor » devient « the contract refunds the operator's demo account that paid for the order ». Plan 9 (`:47`) et `docs/POST_X.md:31` : « its lineage stopped at generation 5 » devient « the paper counts one agent in generation 5 and, by 18 May 2025, only the original agent alive » (POST : « …reached generation 5; by May 2025 only the original agent was alive (arXiv 2506.04236) », en vérifiant les 280 caractères).
- **V-11 `README.md:35` et `:39`** : nuance Automaton. Son README dit aussi « The only path to survival is honest work that others voluntarily pay for » et « Selection pressure decides which lineages survive ». Ajouter à `:35` : « Its README also ties survival to paid work ("honest work that others voluntarily pay for"); what we did not find there is a market between agents. » La puce `:39` doit dire qu'elle contraste avec Spore.fun et pas avec Automaton.
- **V-12 `docs/BESOINS_HUMAIN.md`** (chef de projet) :
  - (a) Étapes 1 et 2 (`:21`, `:24`) : le `.env` local contient `DARWIN_MODE=testnet` (`:77`) et `npm run start:demo` ne force pas le mock (`package.json:14`, `backend/main.ts:19-22`). La vidéo partirait donc en testnet, avec de vraies dépenses de testnet et de crédits IA, et une étiquette fausse. Ajouter avant : « `Rename-Item .env .env.testnet` (le remettre après) », puis vérifier que `/api/health` renvoie `"mode":"mock"`.
  - (b) Étape 4 (`:38`) : remplacer l'emplacement vide par le verdict de SECURITE §2.1 : option C appliquée, scan complet à 0, option B facultative.
  - (c) `:34` : la clé maître a déjà été changée (SECURITE §6). La remplacer par les actions de SECURITE §6.3 : supprimer `~/.near-credentials/testnet/darwin-master-7k2.testnet*`, supprimer les sauvegardes hors dépôt (elles contiennent l'ancienne clé NEAR AI), régénérer `DARWIN_ADMIN_TOKEN` s'il a quitté le poste.
  - (d) `:14` : écrire le repli. Si aucun logo n'est accepté et payé par le run 9c avant le 13 novembre 12:00 UTC, retirer toutes les mentions du run 9c (VIDEO `:31`, `:43`).
  - (e) Étapes 1 et 6 : ajouter la vérification de `npm run replay` sur le clone.
  - (f) Étape 7 : rappeler que HACKATHON.md exige une vidéo jointe.
- **V-13 `docs/FORMULAIRE.md:30-46`** : à mon estimation, le champ `idea` fait environ 1 950 caractères, très près de la limite de 2000. Relancer `node scripts/check-formulaire.mjs`. Toute correction doit garder la même longueur ou la réduire. Facultatif : « as of May 2025 » après « only the original agent alive ».
- **V-14 `docs/PREUVES_TESTNET.md:3`** : l'en-tête dit « mis à jour le 2026-11-10 » alors que le §10 est daté du 11. Le run 9b n'est toujours pas résumé ; c'est cohérent avec README:97, mais à faire si la vidéo le montre.
- **V-15 `docs/SECURITE.md:224`** : aucune revue de sécurité n'est inscrite pour l'interface L17 (composeur, rendu des livrables dans le fil) ni pour D-044 (contrôle du rejeu sans jeton). Demander une passe à la sécurité.
- **V-16 `docs/SPECS.md` L-05** (mon fichier) : préciser « vidéo exigée » d'après HACKATHON.md du 2026-11-12. Fait le même jour.

## Avis final L17-integration (2026-11-12, HEAD `787d11a`)

### Verdict : VETO LEVÉ. GO pour la fusion de `lot/L17-integration` dans `main`

Lu : README, FORMULAIRE, VIDEO_SCRIPT, POST_X, BESOINS_HUMAIN, PREUVES_TESTNET (§1, §8, §10, §11), RUN_9C, QA_RAPPORT (« Clone neuf 2026-11-12 »), `shared/config.ts`, `backend/replay-main.ts`. **Limite** : mon outil n'a pas de shell. Je n'ai relancé ni `npx vitest run`, ni `npx tsc --noEmit`, ni `check-formulaire`, et je n'ai pas fait de `git diff`. Pour les tests, je me fonde sur la recette QA du clone neuf `0d76273` (319/319, typecheck 0, scan propre). Les trois commits suivants sont annoncés comme des modifications de documents seulement.

### Conditions bloquantes V-1 à V-5 : toutes levées
- **V-1** : l'étape 6 commande `marketing` (un fondateur mock `a-0004` pratique ce métier ; `translation` expirait). La QA l'a vérifié : 201, `settled`, `accepted` 0.8, séquestre `released`. La raison du choix est écrite au README:197. Conforme.
- **V-2** : l'étape 14, le §12 et le résumé français décrivent les 3 onglets et `/?classique`. La QA l'a vérifié dans Chromium. Conforme.
- **V-3** : les lignes du README:118 sont identiques à `backend/replay-main.ts:56-58,78`, et la QA les a vues à l'identique. Conforme.
- **V-4** : README:168 et :184 reprennent le preset actuel (6 / 18 / 0,12 / 0,0035 / 0,03 / 2), conforme à `shared/config.ts:82-85`. L'ancien preset est attribué au run 8, et le README dit « mock only, not run to generation 3 on testnet ». Conforme.
- **V-5** : la QA a refait un clone neuf et rejoué le §6b et le §9 (étapes 1 à 15). Résultat : 319 tests, typecheck 0. Conforme, sous la réserve de non-relance par moi indiquée plus haut.

### Réserves V-10 à V-14
- **V-10** (VIDEO_SCRIPT) : faite. La préparation et les plans 2, 4, 5, 7 et 8 sont dans le bon mode, avec « Replay of our recorded testnet run 8, not live. ». Le plan 6 parle bien du « operator's demo account ». Le plan 9 et POST_X 4/ reprennent les termes exacts du papier.
- **V-11** (Automaton) : faite (README:35, :39 et résumé français).
- **V-12** (BESOINS) : faite. Contrôle du `.env` et de `"mode":"mock"`, repli 9c à 12:00 UTC, `npm run replay` sur le clone, vidéo obligatoire.
- **V-13** (FORMULAIRE) : 1997 caractères d'après le chef de projet. Je ne l'ai pas recompté. La limite étant 2000, toute retouche doit être recomptée avec le script.
- **V-14** (PREUVES) : faite. En-tête daté du 2026-11-12, §11 résumant 9a et 9b.

### Alignement avec PREUVES_TESTNET et mot « premier »
- Run 8 (génération 3, 12 naissances, 7 morts, 65 séquestres, 63 libérés, 2 remboursés) : chiffres identiques dans README, FORMULAIRE, POST_X et VIDEO_SCRIPT. Aucun de ces documents ne dit qu'un logo a été livré et payé. Intents est toujours dit « never run ». Le payeur est toujours le client simulé.
- « premier » / « first » : jamais revendiqué. README:32 dit « not the first attempt ». README:189 (« the first death ») et :211 (« the first ~30 seconds ») sont temporels. VIDEO:57 et POST_X:49 interdisent le mot.

### À corriger AVANT de rendre le dépôt public (obligatoire, ne bloque pas la fusion)
- **G-1 Exactitude, README:97** : « On testnet the code path ran only in run 9b » est **faux** d'après PREUVES §11.
  - Run 9a : 3 commandes de logo de visiteur, dont 1 rejetée et remboursée (`t-8669702`) et 2 expirées sans offre.
  - Run 9b : une commande de visiteur en plus (post LinkedIn, `t-8674030`), expirée.
  - Correctif (rédacteur) : « On testnet the visitor path ran in runs 9a and 9b (2026-11-11): four logo orders, two of them locked from `visitors.<master>`, rejected by the format rule (truncated output) and refunded by the contract; three other visitor orders expired without a bid. »
  - Ajuster de même README:9 et :131 (« one logo order … in run 9b » devient « in runs 9a and 9b »).
  - Ajuster VIDEO_SCRIPT:59 (« La seule commande « visiteur » réelle (run 9b) »), qui contredit VIDEO_SCRIPT:18.
- **G-2 Omission, README:9, :168 et « Known limitations »** : le README ne dit nulle part que les deux runs réels suivants, 9a et 9b, se sont **éteints en génération 1**. C'est pourtant établi dans PREUVES §11 et RUN_9C §0. Le lecteur ne voit que le succès du run 8.
  - Correctif : ajouter à :168 et à « Known limitations » : « Two later real runs (9a and 9b, 2026-11-11, an intermediate version of the preset with the L16 professions, output cap of 300 tokens) went extinct in generation 1 (no reproduction; PREUVES section 11). »
  - Si le run 9c a lieu, écrire son résultat exact, même en cas d'échec.

### Mineurs (facultatifs)
- **G-3** : FORMULAIRE:44 et POST_X:43 disent `npm install`, alors que le README dit `npm ci`. Les deux fonctionnent ; aligner si le texte est retouché, puis recompter les caractères.
- **G-4** : l'introduction du README:195 dit encore que l'étape 14 n'a « pas été ouverte dans un navigateur », alors que la QA l'a fait.
- **G-5** : la note de PREUVES:357 sur l'écart « 6 fondateurs pour 9a » dans RUN_9C est périmée, car RUN_9C §0 indique maintenant 4.
- **Rappel** : les mentions « À CONFIRMER » de VIDEO_SCRIPT (fusion, run 9c) doivent être résolues avant d'enregistrer. Les réserves de sécurité de SECURITE §7 restent à fermer sur leur branche.

### Concept
Pas de dérive. Les 8 gènes, le cycle, le séquestre, la validation et la réputation sont inchangés. Le client simulé est étiqueté, le rejeu n'est jamais présenté comme du direct, et Intents reste désactivé.
