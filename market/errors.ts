// Erreurs typées du marché. `httpStatus` est une suggestion pour le backend (ex. 429 pour le plafond visiteurs).
export type MarketErrorCode =
  | "INVALID_INPUT" | "BUDGET_OUT_OF_RANGE" | "VISITOR_CAP_EXCEEDED" | "UNKNOWN_TASK" | "UNKNOWN_AGENT"
  | "NOT_OPEN" | "NOT_WINNER" | "NOT_AWARDED" | "DEADLINE_PASSED" | "DUPLICATE_BID" | "SELF_DEALING"
  | "INVALID_SUBCONTRACT" | "INVALID_VALIDATOR" | "ESCROW_MISMATCH" | "VALIDATION_FAILED" | "VALIDATION_PENDING";

const STATUS: Partial<Record<MarketErrorCode, number>> = {
  INVALID_INPUT: 400, BUDGET_OUT_OF_RANGE: 400, VISITOR_CAP_EXCEEDED: 429, UNKNOWN_TASK: 404, UNKNOWN_AGENT: 404,
  VALIDATION_PENDING: 503, NOT_OPEN: 409, NOT_WINNER: 403, NOT_AWARDED: 409, DEADLINE_PASSED: 409, DUPLICATE_BID: 409, SELF_DEALING: 403,
};

export class MarketError extends Error {
  readonly httpStatus: number;
  constructor(public code: MarketErrorCode, message: string) {
    super(message);
    this.name = "MarketError";
    this.httpStatus = STATUS[code] ?? 500;
  }
}
