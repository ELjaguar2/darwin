// Mainnet demo helper (run by the HUMAN). This script signs nothing and moves no funds.
//   npx tsx intents/demo.ts tokens
//   npx tsx intents/demo.ts dry   <origin_symbol> <origin_chain> <dest_symbol> <dest_chain> <amountIn> <refundTo> <recipient>
//   npx tsx intents/demo.ts run   <same arguments>   (dry, then dry:false, human deposit, submit, tracking, proof; requires INTENTS_DRY_ONLY=false + written green light)
//   npx tsx intents/demo.ts status <depositAddress> [memo]
// Variables: INTENTS_ENABLED=true DARWIN_MODE=testnet (real client); INTENTS_JWT optional.
import { loadConfig } from "../shared/index.ts";
import { createIntents, findToken, verifyDeposit, DepositLedger, type DepositQuote, type QuoteParams } from "./index.ts";

const [cmd, ...a] = process.argv.slice(2);
const cfg = loadConfig({ ...process.env, DARWIN_MODE: process.env.DARWIN_MODE ?? "testnet" } as Record<string, string>);
const intents = createIntents(cfg);

async function paramsFrom(args: string[]): Promise<QuoteParams> {
  const [os, oc, ds, dc, amountIn, refundTo, recipient] = args;
  if (!os || !oc || !ds || !dc || !amountIn || !refundTo || !recipient) throw new Error("missing arguments (see file header)");
  const tokens = await intents.listTokens();
  const o = findToken(tokens, os, oc), d = findToken(tokens, ds, dc);
  if (!o || !d) throw new Error("asset not found in /v0/tokens");
  return { originAsset: o.assetId, destinationAsset: d.assetId, amountIn, refundTo, recipient };
}

async function main() {
  if (!intents.enabled) throw new Error("INTENTS_ENABLED=true requis.");
  if (cmd === "tokens") {
    for (const t of await intents.listTokens()) console.log(`${t.symbol}\t${t.blockchain}\tdecimals=${t.decimals}\t${t.assetId}`);
  } else if (cmd === "dry") {
    const q = await intents.dryQuote(await paramsFrom(a));
    console.log(JSON.stringify({ amountIn: q.response.quote.amountIn, amountInUsd: q.response.quote.amountInUsd, amountOut: q.response.quote.amountOut, minAmountOut: q.response.quote.minAmountOut, appFeeBps: q.appFeeBps }, null, 2));
  } else if (cmd === "run") {
    // dry -> dry:false -> wait for the human deposit -> submit -> tracking -> proof check. A single process ("dry before live" state in memory).
    const p = await paramsFrom(a);
    await intents.dryQuote(p);
    const q: DepositQuote = await intents.requestDepositQuote(p);
    console.log(`DEPOSIT ADDRESS: ${q.depositAddress}${q.depositMemo ? `  MEMO: ${q.depositMemo}` : ""}\nValid until: ${q.response.quote.deadline}\nSend EXACTLY ${p.amountIn} (smallest unit) from ${p.refundTo}, then paste the transaction hash.`);
    const readline = await import("node:readline/promises");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const txHash = (await rl.question("Deposit hash: ")).trim();
    rl.close();
    await intents.submitDeposit(q, txHash, process.env.NEAR_SENDER_ACCOUNT ? { nearSenderAccount: process.env.NEAR_SENDER_ACCOUNT } : undefined);
    const final = await intents.waitForTerminal(q, { intervalMs: 5000, timeoutMs: 20 * 60_000 });
    const r = verifyDeposit(q, final, { mock: false });
    console.log(`Statut final : ${final.status}`);
    if (!r.accepted) { console.log(`Proof REFUSED: ${r.reason}`); process.exitCode = 2; return; }
    new DepositLedger("data/intents-credits.json").credit(r.proof);
    console.log(`Proof accepted. amountOut=${r.proof.amountOut} hashes=${r.proof.txHashes.join(",")}`);
  } else if (cmd === "status") {
    if (!a[0]) throw new Error("depositAddress missing");
    const s = await intents.getStatus(a[0], a[1]);
    console.log(JSON.stringify({ status: s.status, swapDetails: s.swapDetails }, null, 2));
  } else {
    throw new Error("commande inconnue : tokens | dry | run | status");
  }
}
main().catch((e) => { console.error(`Error: ${(e as Error).message}`); process.exit(1); });
