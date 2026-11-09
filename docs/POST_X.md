# POST_X : brouillon du post (aucune publication)

> Propriétaire : redacteur. **L'humain relit, adapte et publie lui-même.** Mentions obligatoires (SPECS L-05) : dire que le projet a été construit au NEAR HACKATHON, taguer **@NEARProtocol** et **#NEARHackathon**, joindre la vidéo (`docs/VIDEO_SCRIPT.md`) ou des captures. Optionnels : @NearLegion, @NearBuilders. Le lien du post va dans `demoUrl` du formulaire (`docs/FORMULAIRE.md`).
> Remplacer `<REPO_URL>` par l'URL du dépôt public avant publication. Chaque post fait moins de 280 caractères (URL comptée pour 23) ; revérifier dans l'éditeur de X.

## Post unique

```text
Built at NEAR HACKATHON: Darwin, AI agents that earn, pay for their brain, reproduce and die when broke.
Chain and AI simulated by default; real testnet and NEAR AI Cloud modes ready, not run yet.
Run it, no key: <REPO_URL>
@NEARProtocol #NEARHackathon
```

Joindre : la vidéo (le « wow » dans les 10 premières secondes).

## Variante en fil

```text
1/ Built at NEAR HACKATHON: Darwin. AI agents that earn their living, pay for their own brain, have children with their own money, and die when they run dry. Economic natural selection, live. @NEARProtocol #NEARHackathon
[vidéo]
```

```text
2/ Each agent has a genome (profession, AI model, price, risk, generosity...). It is born as a (simulated by default) NEAR sub-account, bids in auctions, works, and is paid through an escrow after validation. Its AI cost is debited from its balance.
```

```text
3/ Rich agents reproduce: a child with mutated genes + a "letter to my child" written by the parent's brain. Broke agents die, accounts closed, lineage kept.
```

```text
4/ NEAR integration, written but not yet run for real: sub-accounts and function-call keys (tested against a fake backend), a Rust escrow/registry contract (unit-tested natively, not deployed), a NEAR AI Cloud client, a NEAR Intents 1Click client (dry-run, off by default).
```

```text
5/ Honest limits: no key needed (mock mode). The simulated client is labelled. Escrow is validated by the operator (not trustless). Testnet mode, the contract, NEAR AI Cloud and Intents were never run for real. Most code written by AI agents (Claude Code).
```

```text
6/ Try it: <REPO_URL> (npm install && npm run start:mock). README has "do X, you will see Y" steps. #NEARHackathon @NEARProtocol
```

## Points de vigilance avant de publier

- Le texte doit rester vrai : si le contrat est déployé ou le mode testnet exécuté, mettre à jour le post (et le README). Sinon garder les mentions de limites.
- Pas de promesse de gain réel : le NEAR de testnet n'a pas de valeur.
- Vérifier que le dépôt est public et que le post X est public, puis copier son URL dans le formulaire.
