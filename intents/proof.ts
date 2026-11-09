// Preuve de dépôt : aucun crédit sans preuve vérifiée (CLAUDE.md, D-015).
// La preuve ne vient JAMAIS de l'utilisateur (hash annoncé) : elle vient de /v0/status, recoupée avec le devis qu'on a nous-mêmes obtenu.
import type { DepositQuote, ProofResult, StatusResponse, VerifiedDeposit } from "./types.ts";

const issued = new WeakSet<object>();

function big(v: string | undefined): bigint | undefined {
  if (v === undefined || !/^\d+$/.test(v)) return undefined;
  return BigInt(v);
}

/**
 * Vérifie qu'un statut prouve la livraison du devis `quote`. Refuse tout sauf SUCCESS cohérent :
 *  - statut SUCCESS (REFUNDED, FAILED, PROCESSING... = refus) ;
 *  - correlationId et adresse de dépôt identiques à notre devis ;
 *  - destinataire et actif de destination identiques à ceux demandés ;
 *  - montant reçu >= minAmountOut du devis (entier décimal strict) ;
 *  - au moins une transaction de destination (hash non vide) ;
 *  - aucun remboursement associé.
 */
export function verifyDeposit(quote: DepositQuote, status: StatusResponse, opts: { mock: boolean }): ProofResult {
  const no = (reason: string): ProofResult => ({ accepted: false, reason });
  if (status.status !== "SUCCESS") return no(`statut ${status.status} != SUCCESS`);
  if (status.correlationId !== quote.response.correlationId && status.quoteResponse.correlationId !== quote.response.correlationId) {
    return no("correlationId différent du devis");
  }
  if (status.quoteResponse.quote.depositAddress !== quote.depositAddress) return no("adresse de dépôt différente du devis");
  const req = status.quoteResponse.quoteRequest;
  if (req.recipient !== quote.params.recipient) return no("destinataire différent de la demande");
  if (req.destinationAsset !== quote.params.destinationAsset) return no("actif de destination différent de la demande");
  if (req.originAsset !== quote.params.originAsset) return no("actif d'origine différent de la demande");
  const out = big(status.swapDetails.amountOut);
  if (out === undefined) return no("amountOut absent ou non entier");
  const min = big(quote.response.quote.minAmountOut);
  if (min === undefined) return no("minAmountOut du devis illisible");
  if (out < min) return no("montant reçu < minAmountOut");
  const refunded = big(status.swapDetails.refundedAmount);
  if (refunded !== undefined && refunded > 0n) return no("remboursement partiel présent");
  const hashes = [
    ...status.swapDetails.destinationChainTxHashes.map((t) => t.hash),
    ...status.swapDetails.nearTxHashes,
  ].filter((h) => h.length > 0);
  if (hashes.length === 0) return no("aucun hash de transaction");
  const proof = Object.freeze({
    depositAddress: quote.depositAddress,
    correlationId: quote.response.correlationId,
    recipient: quote.params.recipient,
    destinationAsset: quote.params.destinationAsset,
    amountOut: out.toString(),
    txHashes: Object.freeze(hashes),
    mock: opts.mock,
  }) as unknown as VerifiedDeposit;
  issued.add(proof);
  return { accepted: true, proof };
}

export function isIssuedProof(p: unknown): p is VerifiedDeposit {
  return typeof p === "object" && p !== null && issued.has(p);
}

/** Registre de crédits : n'accepte que des preuves émises par `verifyDeposit`, une seule fois par dépôt. */
export class DepositLedger {
  private readonly credited = new Map<string, { amountOut: string; mock: boolean }>();

  credit(proof: VerifiedDeposit): { credited: boolean; amountOut: string; reason?: string } {
    if (!isIssuedProof(proof)) throw new Error("Crédit refusé : preuve non émise par verifyDeposit.");
    const key = `${proof.depositAddress}|${proof.correlationId}`;
    if (this.credited.has(key)) return { credited: false, amountOut: proof.amountOut, reason: "déjà crédité" };
    this.credited.set(key, { amountOut: proof.amountOut, mock: proof.mock });
    return { credited: true, amountOut: proof.amountOut };
  }

  get size(): number { return this.credited.size; }
  has(depositAddress: string, correlationId: string): boolean { return this.credited.has(`${depositAddress}|${correlationId}`); }
}
