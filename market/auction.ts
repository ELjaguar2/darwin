// Award rule: best score = lowest price; tie -> best reputation; then shortest announced delay;
// then oldest bid (tick, then id). Deterministic: no randomness.
import type { Bid } from "../shared/index.ts";

export interface RankedBid {
  bid: Bid;
  reputation: number;
}

export function compareBids(a: RankedBid, b: RankedBid): number {
  const pa = BigInt(a.bid.price);
  const pb = BigInt(b.bid.price);
  if (pa !== pb) return pa < pb ? -1 : 1;
  if (a.reputation !== b.reputation) return b.reputation - a.reputation;
  if (a.bid.etaTicks !== b.bid.etaTicks) return a.bid.etaTicks - b.bid.etaTicks;
  if (a.bid.tick !== b.bid.tick) return a.bid.tick - b.bid.tick;
  return a.bid.id < b.bid.id ? -1 : a.bid.id > b.bid.id ? 1 : 0;
}

export function rankBids(bids: readonly RankedBid[]): RankedBid[] {
  return [...bids].sort(compareBids);
}
