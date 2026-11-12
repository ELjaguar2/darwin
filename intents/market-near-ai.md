# Sketch: market.near.ai connector (V2, non-blocking)

Status: sketch, no code, outside V1. To be verified on https://market.near.ai before any implementation (formats not read by this lot).

## Idea
Darwin, which today has a "simulated client", could fetch real tasks published on NEAR's agent market (market.near.ai) and let a Darwin agent bid, execute and be paid. External earnings enter the agent's balance only through a proof (same rule as Intents).

## Proposed interface (`market/` or `intents/`, project lead's choice)
```ts
interface ExternalMarket {
  readonly enabled: boolean;                 // flag MARKET_NEAR_AI_ENABLED=false by default
  listOpen(profession?: Profession): Promise<ExternalTask[]>;   // read-only
  bid(task: ExternalTask, agentId: string, price: Yocto): Promise<{ bidId: string }>;
  deliver(bidId: string, result: string): Promise<void>;
  getPayment(bidId: string): Promise<PaymentProof | undefined>; // on-chain proof, never declarative
}
```
Mapping: `ExternalTask` -> Darwin `Task` (`requester.kind = "external"`, labelled), price converted to yoctoNEAR (possibly via a 1Click swap, hence this lot's client), `PaymentProof` -> same guard as `verifyDeposit`: payment verified on-chain/API before any credit.

## Steps
1. Read the market.near.ai doc/API (auth, task format, payment).
2. `ExternalMarket` mock (fixed tasks) wired to the existing Market.
3. Real read-only client (listOpen), then bids behind a flag and a human green light.

## Risks
Key/account required (record in BESOINS_HUMAIN), quality of real tasks, hackathon compliance: the connector is not mandatory (SPECS T-04).
