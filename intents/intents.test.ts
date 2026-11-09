import { describe, expect, it, vi } from "vitest";
import { createJournal, loadConfig } from "../shared/index.ts";
import {
  DepositLedger, IntentsDisabledError, IntentsGuardError, IntentsHttpError, MockIntents, OneClickIntents,
  createIntents, findToken, verifyDeposit, type DepositQuote, type QuoteParams,
} from "./index.ts";

const cfgOf = (env: Record<string, string> = {}) => loadConfig(env);
const LIVE = { INTENTS_ENABLED: "true", INTENTS_DRY_ONLY: "false" };
const noSleep = async () => {};

function params(c: MockIntents, amountIn = "1000000000000000000000000"): Promise<QuoteParams> {
  return c.listTokens().then((t) => ({
    originAsset: findToken(t, "wNEAR", "near")!.assetId,
    destinationAsset: findToken(t, "USDC", "base")!.assetId,
    amountIn, refundTo: "darwin-demo.near", recipient: "0xRecipient",
  }));
}

describe("feature flag", () => {
  it("désactivé par défaut : aucun appel, toute méthode lève", async () => {
    const c = cfgOf();
    expect(c.intents.enabled).toBe(false);
    expect(c.intents.dryOnly).toBe(true);
    const f = vi.fn();
    const i = createIntents(c, { fetch: f as unknown as typeof fetch });
    expect(i.enabled).toBe(false);
    await expect(i.listTokens()).rejects.toBeInstanceOf(IntentsDisabledError);
    await expect(i.quoteDry({ originAsset: "a", destinationAsset: "b", amountIn: "1" })).rejects.toBeInstanceOf(IntentsDisabledError);
    await expect(i.getStatus("x")).rejects.toBeInstanceOf(IntentsDisabledError);
    expect(f).not.toHaveBeenCalled();
  });
  it("activé en mode mock : MockIntents ; en testnet : client réel", () => {
    expect(createIntents(cfgOf({ INTENTS_ENABLED: "true" })).mock).toBe(true);
    expect(createIntents(cfgOf({ INTENTS_ENABLED: "true", DARWIN_MODE: "testnet" })).mock).toBe(false);
  });
});

describe("verrous de dépense", () => {
  it("dry:false et deposit/submit refusés tant que INTENTS_DRY_ONLY est actif (défaut)", async () => {
    const c = new MockIntents(cfgOf({ INTENTS_ENABLED: "true" }).intents);
    const p = await params(c);
    await c.dryQuote(p);
    await expect(c.requestDepositQuote(p)).rejects.toThrow(/DRY_ONLY/);
    await expect(c.submitDeposit({} as DepositQuote, "tx")).rejects.toThrow(/DRY_ONLY/);
  });
  it("dry:true d'abord, mêmes paramètres", async () => {
    const c = new MockIntents(cfgOf(LIVE).intents);
    const p = await params(c);
    await expect(c.requestDepositQuote(p)).rejects.toThrow(/dry:true/);
    await c.dryQuote(p);
    await expect(c.requestDepositQuote({ ...p, recipient: "0xAutre" })).rejects.toThrow(/dry:true/);
    const q = await c.requestDepositQuote(p);
    expect(q.depositAddress).toMatch(/^mock-deposit/);
    expect(q.mock).toBe(true);
  });
  it("plafond USD", async () => {
    const c = new MockIntents(cfgOf(LIVE).intents, { maxUsd: 5 });
    const p = await params(c, "2000000000000000000000000"); // 2 NEAR = 7 USD
    await c.dryQuote(p);
    await expect(c.requestDepositQuote(p)).rejects.toThrow(/plafond/);
  });
  it("submit refusé pour une adresse non émise par cette instance", async () => {
    const c = new MockIntents(cfgOf(LIVE).intents);
    const p = await params(c);
    await c.dryQuote(p);
    const q = await c.requestDepositQuote(p);
    await expect(c.submitDeposit({ ...q, depositAddress: "forged" }, "tx")).rejects.toBeInstanceOf(IntentsGuardError);
  });
  it("montant invalide refusé", async () => {
    const c = new MockIntents(cfgOf({ INTENTS_ENABLED: "true" }).intents);
    const p = await params(c);
    await expect(c.dryQuote({ ...p, amountIn: "1.5" })).rejects.toBeInstanceOf(IntentsGuardError);
    await expect(c.dryQuote({ ...p, amountIn: "0" })).rejects.toBeInstanceOf(IntentsGuardError);
  });
});

describe("flux complet en mock + preuve", () => {
  async function setup() {
    const journal = createJournal();
    const c = new MockIntents(cfgOf(LIVE).intents, { journal });
    const p = await params(c);
    const dry = await c.dryQuote(p);
    const q = await c.requestDepositQuote(p);
    return { c, p, q, dry, journal };
  }

  it("devis dry journalisé (intents.quote dry:true), frais 25 bps visibles", async () => {
    const { dry, journal } = await setup();
    expect(dry.appFeeBps).toBe(25);
    expect(dry.response.quote.depositAddress).toBeUndefined();
    const ev = journal.since(0).filter((e) => e.type === "intents.quote");
    expect(ev).toHaveLength(1);
    expect(ev[0]!.data).toMatchObject({ dry: true });
  });

  it("SUCCESS : preuve acceptée puis crédit unique", async () => {
    const { c, q } = await setup();
    expect((await c.getStatus(q.depositAddress)).status).toBe("PENDING_DEPOSIT");
    c.simulateDeposit(q.depositAddress);
    const sub = await c.submitDeposit(q, "mock-tx-1");
    expect(sub.status).toBe("KNOWN_DEPOSIT_TX");
    const final = await c.waitForTerminal(q, { sleep: noSleep });
    expect(final.status).toBe("SUCCESS");
    const r = verifyDeposit(q, final, { mock: true });
    expect(r.accepted).toBe(true);
    if (!r.accepted) return;
    const ledger = new DepositLedger();
    expect(ledger.credit(r.proof)).toMatchObject({ credited: true });
    expect(ledger.credit(r.proof)).toMatchObject({ credited: false, reason: "déjà crédité" });
    expect(ledger.size).toBe(1);
  });

  it.each(["REFUNDED", "FAILED", "INCOMPLETE_DEPOSIT"] as const)("%s : aucune preuve", async (outcome) => {
    const { c, q } = await setup();
    c.simulateDeposit(q.depositAddress, { outcome });
    const final = await c.waitForTerminal(q, { sleep: noSleep });
    expect(final.status).toBe(outcome);
    expect(verifyDeposit(q, final, { mock: true }).accepted).toBe(false);
  });

  it("statut non terminal (PROCESSING) : aucune preuve", async () => {
    const { c, q } = await setup();
    c.simulateDeposit(q.depositAddress);
    await c.getStatus(q.depositAddress); // -> PROCESSING
    const s = await c.getStatus(q.depositAddress);
    expect(s.status).toBe("SUCCESS" === s.status ? "SUCCESS" : "PROCESSING");
    const early = await (async () => { const x = await setup(); x.c.simulateDeposit(x.q.depositAddress); return { q: x.q, s: await x.c.getStatus(x.q.depositAddress) }; })();
    expect(early.s.status).toBe("PROCESSING");
    expect(verifyDeposit(early.q, early.s, { mock: true })).toMatchObject({ accepted: false });
  });

  it("montant falsifié < minAmountOut ou destinataire falsifié : rejeté", async () => {
    for (const t of [{ amountOut: "1" }, { recipient: "0xAttaquant" }]) {
      const { c, q } = await setup();
      c.simulateDeposit(q.depositAddress);
      c.tamper(q.depositAddress, t);
      const final = await c.waitForTerminal(q, { sleep: noSleep });
      expect(verifyDeposit(q, final, { mock: true }).accepted).toBe(false);
    }
  });

  it("statut d'un AUTRE devis (rejeu) : rejeté", async () => {
    const a = await setup();
    const b = await setup();
    a.c.simulateDeposit(a.q.depositAddress);
    const finalA = await a.c.waitForTerminal(a.q, { sleep: noSleep });
    expect(verifyDeposit(b.q, finalA, { mock: true }).accepted).toBe(false);
  });

  it("le registre refuse une preuve forgée à la main", () => {
    const ledger = new DepositLedger();
    const fake = { depositAddress: "x", correlationId: "y", recipient: "r", destinationAsset: "d", amountOut: "999", txHashes: ["h"], mock: false };
    expect(() => ledger.credit(fake as never)).toThrow(/non émise/);
    expect(ledger.size).toBe(0);
  });

  it("waitForTerminal : délai dépassé sans dépôt", async () => {
    const { c, q } = await setup();
    let t = 0;
    const c2 = c as unknown as { now: () => Date };
    c2.now = () => new Date((t += 60_000));
    await expect(c.waitForTerminal(q, { sleep: noSleep, timeoutMs: 120_000 })).rejects.toThrow(/Délai/);
  });
});

describe("client HTTP 1Click (fetch simulé, aucun réseau)", () => {
  // Réponse réelle d'un devis dry:true obtenu le 2026-11-09 (wNEAR -> USDC, NEAR), sans clé.
  const realDry = {
    quote: {
      amountIn: "1000000000000000000000000", amountInFormatted: "1.0", amountInUsd: "3.540000000000", minAmountIn: "1000000000000000000000000",
      amountOut: "3519706", amountOutFormatted: "3.519706", amountOutUsd: "3.517861674056", minAmountOut: "3484508", timeEstimate: 22,
      refundFee: "0", withdrawFee: "0",
    },
    quoteRequest: {
      dry: true, depositMode: "SIMPLE", swapType: "EXACT_INPUT", slippageTolerance: 100, originAsset: "nep141:wrap.near", depositType: "ORIGIN_CHAIN",
      destinationAsset: "nep141:usdc", amount: "1000000000000000000000000", refundTo: "near", refundType: "ORIGIN_CHAIN", recipient: "near",
      recipientType: "DESTINATION_CHAIN", deadline: "2026-11-09T15:02:50.858Z", appFees: [{ recipient: "5880ad", fee: 20 }],
    },
    signature: "ed25519:xxx", timestamp: "2026-11-09T14:02:51.200Z", correlationId: "da3d32e7",
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("quote dry:true : corps conforme à l'OpenAPI, accepte 201, appFees lus", async () => {
    const f = vi.fn(async () => json(201, realDry));
    const i = new OneClickIntents(cfgOf({ INTENTS_ENABLED: "true", DARWIN_MODE: "testnet" }).intents, { fetch: f as unknown as typeof fetch });
    const r = await i.quoteDry({ originAsset: "nep141:wrap.near", destinationAsset: "nep141:usdc", amountIn: "1000000000000000000000000" });
    expect(r.amountOut).toBe("3519706");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://1click.chaindefuser.com/v0/quote");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ dry: true, swapType: "EXACT_INPUT", depositType: "ORIGIN_CHAIN", refundType: "ORIGIN_CHAIN", recipientType: "DESTINATION_CHAIN", slippageTolerance: 100 });
    expect(typeof body.deadline).toBe("string");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBeUndefined();
  });

  it("jwt envoyé en X-API-Key, jamais dans l'erreur ; HTTP 400 -> IntentsHttpError", async () => {
    const secret = "jwt-secret-value";
    const f = vi.fn(async () => json(400, { message: "recipient is not valid" }));
    const i = new OneClickIntents(cfgOf({ INTENTS_ENABLED: "true", DARWIN_MODE: "testnet", INTENTS_JWT: secret }).intents, { fetch: f as unknown as typeof fetch });
    const err = await i.quoteDry({ originAsset: "a", destinationAsset: "b", amountIn: "1" }).catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(IntentsHttpError);
    expect((err as Error).message).toContain("recipient is not valid");
    expect((err as Error).message).not.toContain(secret);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(secret);
  });

  it("verrou live aussi sur le client réel : aucun appel réseau avant autorisation", async () => {
    const f = vi.fn(async () => json(201, realDry));
    const i = new OneClickIntents(cfgOf({ INTENTS_ENABLED: "true", DARWIN_MODE: "testnet" }).intents, { fetch: f as unknown as typeof fetch });
    await expect(i.requestDepositQuote({ originAsset: "a", destinationAsset: "b", amountIn: "1", refundTo: "r", recipient: "c" })).rejects.toThrow(/DRY_ONLY/);
    await expect(i.submitDeposit({} as DepositQuote, "tx")).rejects.toThrow(/DRY_ONLY/);
    expect(f).not.toHaveBeenCalled();
  });

  it("status : query depositAddress (+ memo) et validation de schéma", async () => {
    const f = vi.fn(async () => json(200, { correlationId: "c", quoteResponse: realDry, status: "PENDING_DEPOSIT", updatedAt: "2026-11-09T14:03:00Z", swapDetails: { intentHashes: [], nearTxHashes: [], originChainTxHashes: [], destinationChainTxHashes: [] } }));
    const i = new OneClickIntents(cfgOf({ INTENTS_ENABLED: "true", DARWIN_MODE: "testnet" }).intents, { fetch: f as unknown as typeof fetch });
    const s = await i.getStatus("addr 1", "memo");
    expect(s.status).toBe("PENDING_DEPOSIT");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://1click.chaindefuser.com/v0/status?depositAddress=addr+1&depositMemo=memo");
    f.mockImplementationOnce(async () => json(200, { correlationId: "c", status: "WEIRD" }));
    await expect(i.getStatus("a")).rejects.toThrow();
  });
});
