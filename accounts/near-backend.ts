// Adaptateur near-api-js (SEUL fichier qui la touche, en import dynamique : le paquet est optionnel, Node >= 22.22.2).
// API vérifiée dans les types de near-api-js 7.4.0 (2026-11-09) : `new Account(id, provider|url, signer|KeyPairString)`,
// getState(), createSubAccount({accountOrPrefix, publicKey, nearToTransfer}), transfer({receiverId, amount}),
// deleteAccount(beneficiaryId), addFunctionCallAccessKey({publicKey, contractId, methodNames, allowance}).
// NearChain ne dépend que de l'interface `NearBackend`, donc se teste sans réseau avec un faux backend.
import { ChainError } from "../shared/chain.ts";
import type { Secret } from "./keys.ts";

export interface NearSigner {
  accountId: string;
  secretKey: Secret;
}

export interface NearBackend {
  /** Vérifie que le RPC répond et renvoie le réseau (attendu : "testnet"). */
  status(): Promise<{ chainId: string }>;
  /** null si le compte n'existe pas. `available` = total moins le stockage immobilisé. */
  getState(accountId: string): Promise<{ total: bigint; available: bigint } | null>;
  /** Crée `<label>.<signer.accountId>` financé de `fund` ; renvoie le hash de transaction. */
  createSubAccount(signer: NearSigner, label: string, publicKey: string, fund: bigint): Promise<string>;
  transfer(signer: NearSigner, to: string, amount: bigint): Promise<string>;
  deleteAccount(signer: NearSigner, beneficiary: string): Promise<string>;
  addFunctionCallKey(
    signer: NearSigner,
    publicKey: string,
    opts: { contractId: string; methodNames: string[]; allowance: bigint },
  ): Promise<string>;
  /** Appel de méthode (écriture) signé. Lève ChainError si la transaction ou un reçu échoue. Renvoie le hash. */
  call(
    signer: NearSigner,
    contractId: string,
    methodName: string,
    args: Record<string, unknown>,
    opts?: { deposit?: bigint; gas?: bigint },
  ): Promise<string>;
  /** Appel de vue (lecture seule, sans signature). */
  view(contractId: string, methodName: string, args: Record<string, unknown>): Promise<unknown>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRec = Record<string, any>;

function hashOf(res: AnyRec): string {
  const h = res?.transaction?.hash ?? res?.transaction_outcome?.id;
  if (typeof h !== "string") throw new ChainError("RPC_ERROR", "Réponse RPC sans hash de transaction");
  return h;
}

/** Message d'erreur RPC nettoyé : jamais de clé (au cas où une bibliothèque en inclurait une). */
export function safeMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{40,}/g, "ed25519:[REDACTED]").slice(0, 400);
}

/** Collecte les messages d'échec d'une réponse de transaction (transaction et reçus). */
function failureOf(res: AnyRec): string | null {
  const bad: unknown[] = [];
  if (res?.status && typeof res.status === "object" && "Failure" in res.status) bad.push(res.status.Failure);
  for (const r of (res?.receipts_outcome as AnyRec[] | undefined) ?? []) {
    const st = r?.outcome?.status;
    if (st && typeof st === "object" && "Failure" in st) bad.push(st.Failure);
  }
  return bad.length ? JSON.stringify(bad) : null;
}

/** Traduit un message RPC ou une panique de contrat en ChainError typée. */
export function mapChainError(msg: string): ChainError {
  const m = msg;
  if (/ESCROW_EXISTS|TASK_ALREADY_RESERVED/.test(m)) return new ChainError("ESCROW_EXISTS", m);
  if (/ESCROW_UNKNOWN/.test(m)) return new ChainError("ESCROW_UNKNOWN", m);
  if (/ESCROW_SETTLED/.test(m)) return new ChainError("ESCROW_SETTLED", m);
  if (/PROOF_REQUIRED/.test(m)) return new ChainError("PROOF_REQUIRED", m);
  if (/ALREADY_REGISTERED/.test(m)) return new ChainError("ALREADY_REGISTERED", m);
  if (/UNKNOWN_AGENT/.test(m)) return new ChainError("UNKNOWN_AGENT", m);
  if (/NotEnoughBalance|LackBalanceForState|NotEnoughAllowance|Can't complete the action because account/i.test(m)) {
    return new ChainError("INSUFFICIENT_FUNDS", m);
  }
  if (/AccountDoesNotExist|does not exist/i.test(m)) return new ChainError("UNKNOWN_ACCOUNT", m);
  return new ChainError("RPC_ERROR", m);
}

export async function loadNearApiBackend(rpcUrl: string): Promise<NearBackend> {
  const specifier = "near-api-js"; // variable : TypeScript ne résout pas le paquet optionnel
  let lib: AnyRec;
  try {
    lib = (await import(specifier)) as AnyRec;
  } catch {
    throw new ChainError(
      "RPC_ERROR",
      "near-api-js est introuvable (paquet optionnel). Installez-le avec Node >= 22.22.2 : `npm install near-api-js@7.4.0`.",
    );
  }
  const provider = new lib.JsonRpcProvider({ url: rpcUrl });
  const accounts = new Map<string, AnyRec>(); // une instance par compte (gestion des nonces)
  const acct = (s: NearSigner): AnyRec => {
    const k = `${s.accountId}|${s.secretKey.reveal().slice(-8)}`;
    const known = accounts.get(k);
    if (known) return known;
    const created: AnyRec = new lib.Account(s.accountId, provider, s.secretKey.reveal());
    accounts.set(k, created);
    return created;
  };
  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ChainError) throw e;
      throw mapChainError(safeMessage(e));
    }
  };

  return {
    call: (signer, contractId, methodName, args, o) =>
      wrap(async () => {
        const res = await acct(signer).callFunctionRaw({ contractId, methodName, args, deposit: o?.deposit ?? 0n, gas: o?.gas ?? 30_000_000_000_000n });
        const f = failureOf(res);
        if (f) throw mapChainError(f.replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{40,}/g, "ed25519:[REDACTED]").slice(0, 400));
        return hashOf(res);
      }),
    view: (contractId, methodName, args) => wrap(async () => provider.callFunction({ contractId, method: methodName, args })),
    status: () => wrap(async () => ({ chainId: String((await provider.viewNodeStatus()).chain_id) })),
    getState: (accountId) =>
      wrap(async () => {
        try {
          const st = await new lib.Account(accountId, provider).getState();
          return { total: BigInt(st.balance.total), available: BigInt(st.balance.available) };
        } catch (e) {
          if (/does not exist|UNKNOWN_ACCOUNT|AccountDoesNotExist/i.test(safeMessage(e))) return null;
          throw e;
        }
      }),
    createSubAccount: (signer, label, publicKey, fund) =>
      wrap(async () => hashOf(await acct(signer).createSubAccount({ accountOrPrefix: label, publicKey, nearToTransfer: fund }))),
    transfer: (signer, to, amount) => wrap(async () => hashOf(await acct(signer).transfer({ receiverId: to, amount }))),
    deleteAccount: (signer, beneficiary) => wrap(async () => hashOf(await acct(signer).deleteAccount(beneficiary))),
    addFunctionCallKey: (signer, publicKey, o) =>
      wrap(async () =>
        hashOf(await acct(signer).addFunctionCallAccessKey({ publicKey, contractId: o.contractId, methodNames: o.methodNames, allowance: o.allowance })),
      ),
  };
}
