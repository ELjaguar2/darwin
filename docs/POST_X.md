# POST_X : brouillon du post (aucune publication)

> Propriétaire : redacteur. **L'humain relit, adapte et publie lui-même.** Mentions obligatoires (SPECS L-05) : dire que le projet a été construit au NEAR HACKATHON, taguer **@NEARProtocol** et **#NEARHackathon**, joindre la **vidéo** (`docs/VIDEO_SCRIPT.md`) : elle est OBLIGATOIRE, HACKATHON.md (relu le 2026-11-12) dit que des captures seules ne suffisent pas. Optionnels : @NearLegion, @NearBuilders. Le lien du post va dans `demoUrl` du formulaire (`docs/FORMULAIRE.md`).
> Remplacer `<REPO_URL>` par l'URL du dépôt public avant publication. Chaque post fait moins de 280 caractères (URL comptée pour 23) ; compteur vérifié par script (`node -e` ci-dessous) puis à revérifier dans l'éditeur de X.
> Mis à jour le 2026-11-11 d'après `docs/PREUVES_TESTNET.md` (run 8) : le testnet et le contrat ont réellement tourné. **Ne pas citer le run 9 (commande de logo) tant qu'un logo accepté et payé n'est pas prouvé** (À CONFIRMER : run 9c).

## Post unique

```text
Built at NEAR HACKATHON: Darwin, AI agents that earn from paid, validated work, pay for their own brain, reproduce and die when broke. Real NEAR testnet run: generation 3, 7 deaths. Client simulated. No key needed: <REPO_URL> @NEARProtocol #NEARHackathon
```

Joindre : la vidéo (le « wow » dans les 10 premières secondes).

## Variante en fil

```text
1/ Built at NEAR HACKATHON: Darwin. AI agents that earn their living, pay for their own brain, have children with their own money, and die when they run dry. Economic natural selection, live. @NEARProtocol #NEARHackathon
[vidéo]
```

```text
2/ Each agent has a genome (profession, AI model, price, risk, generosity...). It is born as a NEAR sub-account, bids in auctions, works, and is paid through an escrow after validation. Its AI cost is debited from its balance.
```

```text
3/ Rich agents reproduce: a child with mutated genes + a "letter to my child" written by the parent's brain. Broke agents die, accounts closed, lineage kept.
```

```text
4/ Spore.fun selected agents by token price: it reached generation 5; by May 2025 only the original agent was alive (arXiv 2506.04236). Darwin selects by paid, validated work. Selection by speculation died out. Selection by useful work can last. A hypothesis to test.
```

```text
5/ On NEAR testnet, run for real: sub-accounts, function-call keys, a Rust escrow/registry contract, NEAR AI Cloud as the brain. One run: generation 3, 12 births, 7 deaths, 65 escrows. NEAR Intents: not run.
```

```text
6/ Honest limits: mock mode by default. The payer is a labelled simulated client. Escrow is validated by the operator (not trustless). One real run, not a guarantee. Most code written by AI agents (Claude Code).
```

```text
7/ Try it: <REPO_URL> (npm ci && npm run start:mock). README has "do X, you will see Y" steps. #NEARHackathon @NEARProtocol
```

## Points de vigilance avant de publier

- Le texte doit rester vrai : relire `docs/PREUVES_TESTNET.md` ; si le run 9c prouve un logo accepté et payé, on pourra l'ajouter (À CONFIRMER), pas avant.
- Pas de promesse de gain réel : le NEAR de testnet n'a pas de valeur. Ne jamais écrire « le premier ».
- Vérifier que le dépôt est public et que le post X est public, puis copier son URL dans le formulaire.
