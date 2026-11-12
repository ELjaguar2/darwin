// near-api-js adapter (the ONLY file that touches it, via dynamic import: the package is optional, Node >= 22.22.2).
// API checked in the near-api-js 7.4.0 types (2026-11-09): `new Account(id, provider|url, signer|KeyPairString)`,
// getState(), createSubAccount({accountOrPrefix, publicKey, nearToTransfer}), transfer({receiverId, amount}),
// deleteAccount(beneficiaryId), addFunctionCallAccessKey({publicKey, contractId, methodNames, allowance}).
// NearChain depends only on the `NearBackend` interface, so it can be tested without a network using a fake backend.
import { createHash } from "node:crypto";
import { ChainError } from "../shared/chain.ts";
import type { Secret } from "./keys.ts";

export interface NearSigner {
  accountId: string;
  secretKey: Secret;
}

/** Limited-rights function call key, added in the SAME transaction as the account creation. */
export interface FunctionCallKeySpec {
  publicKey: string;
  contractId: string;
  methodNames: string[];
  allowance: bigint;
}

export interface NearBackend {
  /** Checks that the RPC answers and returns the network (expected: "testnet"). */
  status(): Promise<{ chainId: string }>;
  /** null if the account does not exist. `available` = total minus locked storage. */
  getState(accountId: string): Promise<{ total: bigint; available: bigint } | null>;
  /** Creates `<label>.<signer.accountId>` funded with `fund`; returns the transaction hash. */
  createSubAccount(signer: NearSigner, label: string, publicKey: string, fund: bigint, fc?: FunctionCallKeySpec): Promise<string>;
  transfer(signer: NearSigner, to: string, amount: bigint): Promise<string>;
  deleteAccount(signer: NearSigner, beneficiary: string): Promise<string>;
  addFunctionCallKey(
    signer: NearSigner,
    publicKey: string,
    opts: { contractId: string; methodNames: string[]; allowance: bigint },
  ): Promise<string>;
  /** Signed (write) method call. Throws ChainError if the transaction or a receipt fails. Returns the hash. */
  call(
    signer: NearSigner,
    contractId: string,
    methodName: string,
    args: Record<string, unknown>,
    opts?: { deposit?: bigint; gas?: bigint },
  ): Promise<string>;
  /** View call (read-only, unsigned). */
  view(contractId: string, methodName: string, args: Record<string, unknown>): Promise<unknown>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRec = Record<string, any>;

function hashOf(res: AnyRec): string {
  const h = res?.transaction?.hash ?? res?.transaction_outcome?.id;
  if (typeof h !== "string") throw new ChainError("RPC_ERROR", "RPC response without a transaction hash");
  return h;
}

/** Cleaned RPC error message: never a key (in case a library included one). */
export function safeMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{40,}/g, "ed25519:[REDACTED]").slice(0, 400);
}

/** Collects the failure messages of a transaction response (transaction and receipts). */
function failureOf(res: AnyRec): string | null {
  const bad: unknown[] = [];
  if (res?.status && typeof res.status === "object" && "Failure" in res.status) bad.push(res.status.Failure);
  for (const r of (res?.receipts_outcome as AnyRec[] | undefined) ?? []) {
    const st = r?.outcome?.status;
    if (st && typeof st === "object" && "Failure" in st) bad.push(st.Failure);
  }
  return bad.length ? JSON.stringify(bad) : null;
}

/** Translates an RPC message or a contract panic into a typed ChainError. */
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
  const specifier = "near-api-js"; // variable: TypeScript does not resolve the optional package
  let lib: AnyRec;
  try {
    lib = (await import(specifier)) as AnyRec;
  } catch {
    throw new ChainError(
      "RPC_ERROR",
      "near-api-js not found (optional package). Install it with Node >= 22.22.2: `npm install near-api-js@7.4.0`.",
    );
  }
  // `rpcUrl` may list several providers separated by commas (NEAR_RPC_URL): automatic failover
  // (FailoverRpcProvider) when one of them fails or rate-limits. nearcore does not accept batched JSON-RPC
  // ("batch"): so we reduce the number of calls with a short cache of account states (see getState).
  const urls = rpcUrl.split(",").map((u) => u.trim()).filter(Boolean);
  const provider: AnyRec =
    urls.length > 1
      ? new lib.FailoverRpcProvider(urls.map((url) => new lib.JsonRpcProvider({ url })))
      : new lib.JsonRpcProvider({ url: urls[0] ?? rpcUrl });
  const STATE_TTL_MS = Number(process.env.DARWIN_RPC_STATE_TTL_MS ?? 3000);
  const stateCache = new Map<string, { at: number; v: { total: bigint; available: bigint } | null }>();
  const accounts = new Map<string, AnyRec>(); // one instance per account (nonce management)
  const acct = (s: NearSigner): AnyRec => {
    const k = `${s.accountId}|${createHash("sha256").update(s.secretKey.reveal()).digest("hex").slice(0, 16)}`; // fingerprint, never a key fragment
    const known = accounts.get(k);
    if (known) return known;
    const created: AnyRec = new lib.Account(s.accountId, provider, s.secretKey.reveal());
    accounts.set(k, created);
    return created;
  };
  // Free public RPCs rate-limit (HTTP/JSON-RPC 429): we retry with progressive back-off
  // (the request is refused before processing, so replaying is safe) before failing.
  const RATE_LIMIT_RE = /\b429\b|rate limit/i;
  const RATE_LIMIT_RETRIES = 6;
  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ChainError) throw e;
        const msg = safeMessage(e);
        if (attempt < RATE_LIMIT_RETRIES && RATE_LIMIT_RE.test(msg)) {
          await new Promise((r) => setTimeout(r, Math.min(30_000, 2000 * 2 ** attempt) * (0.75 + Math.random() * 0.5)));
          continue;
        }
        throw mapChainError(msg);
      }
    }
  };

  const written = <T>(p: Promise<T>): Promise<T> => p.finally(() => stateCache.clear());

  return {
    call: (signer, contractId, methodName, args, o) =>
      written(wrap(async () => {
        const res = await acct(signer).callFunctionRaw({ contractId, methodName, args, deposit: o?.deposit ?? 0n, gas: o?.gas ?? 30_000_000_000_000n });
        const f = failureOf(res);
        if (f) throw mapChainError(f.replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{40,}/g, "ed25519:[REDACTED]").slice(0, 400));
        return hashOf(res);
      })),
    view: (contractId, methodName, args) => wrap(async () => provider.callFunction({ contractId, method: methodName, args })),
    status: () => wrap(async () => ({ chainId: String((await provider.viewNodeStatus()).chain_id) })),
    getState: async (accountId) => {
      const hit = stateCache.get(accountId);
      if (hit && Date.now() - hit.at < STATE_TTL_MS) return hit.v;
      const v = await wrap(async () => {
        try {
          const st = await new lib.Account(accountId, provider).getState();
          return { total: BigInt(st.balance.total), available: BigInt(st.balance.available) };
        } catch (e) {
          if (/does not exist|UNKNOWN_ACCOUNT|AccountDoesNotExist/i.test(safeMessage(e))) return null;
          throw e;
        }
      });
      stateCache.set(accountId, { at: Date.now(), v });
      return v;
    },
    createSubAccount: (signer, label, publicKey, fund, fc) =>
      written(wrap(async () => {
        if (!fc) return hashOf(await acct(signer).createSubAccount({ accountOrPrefix: label, publicKey, nearToTransfer: fund }));
        // A single transaction: create, fund, full key, function call key. Adding the limited key afterwards
        // (signed by the new account) failed: the RPC did not yet see the account's key ("access key does not exist").
        const { actions, PublicKey } = lib;
        const a = acct(signer);
        return hashOf(
          await a.signAndSendTransaction({
            receiverId: `${label}.${signer.accountId}`,
            actions: [
              actions.createAccount(),
              actions.transfer(fund),
              actions.addFullAccessKey(PublicKey.from(publicKey)),
              actions.addFunctionCallAccessKey(PublicKey.from(fc.publicKey), fc.contractId, fc.methodNames, fc.allowance),
            ],
          }),
        );
      })),
    transfer: (signer, to, amount) => written(wrap(async () => hashOf(await acct(signer).transfer({ receiverId: to, amount })))),
    deleteAccount: (signer, beneficiary) => written(wrap(async () => hashOf(await acct(signer).deleteAccount(beneficiary)))),
    addFunctionCallKey: (signer, publicKey, o) =>
      written(wrap(async () =>
        hashOf(await acct(signer).addFunctionCallAccessKey({ publicKey, contractId: o.contractId, methodNames: o.methodNames, allowance: o.allowance })),
      )),
  };
}
