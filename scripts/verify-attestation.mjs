#!/usr/bin/env node
// Verification of the TEE attestation of a NEAR AI Cloud response (model with attestationSupported).
// Protocol: docs.near.ai/cloud/verification (checked on 2026-11-10). See docs/ATTESTATION_TEE.md for details and limits.
//
// Usage:
//   node scripts/verify-attestation.mjs [--model z-ai/glm-5.3-flash] [--env-file .env] [--accept UpToDate,...]
//        [--save-evidence <folder>] [--offline <folder>] [--skip-gpu] [--max-tokens 64]
//   npm run ai:verify-attestation -- --model Qwen/Qwen3.8-27B
//
// Steps (each one is reported PASS / FAIL / SKIP, never presenting a SKIP as a success):
//   1. attestation report (gateway + model) with a nonce generated here;
//   2. Intel TDX quote verified by @phala/dcap-qvl (Phala PCCS collateral, network): TCB status, debug mode;
//   3. quote report_data = signer identity + nonce; MRCONFIGID = SHA-256(app_compose); RTMR3 replay of the event log;
//   4. NVIDIA GPU evidence: payload nonce, NVIDIA NRAS verdict (TLS verdict, token not re-validated locally);
//   5. a real request (exact bytes kept) + GET /v1/signature/{id}: signed text = model:SHA256(request):SHA256(response),
//      ECDSA signature (EIP-191) recovered, address = signing_address of ONE verified model report.
// The API key (NEARAI_API_KEY) is read only from the environment / the .env file, and is never displayed or written.
import { createHash, randomBytes, timingSafeEqual, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };

const envFile = opt("env-file", process.env.DARWIN_ENV_FILE ?? ".env");
try { process.loadEnvFile(envFile); } catch { /* absent: environment variables only */ }

const BASE = (process.env.NEARAI_BASE_URL ?? "https://cloud-api.near.ai/v1").replace(/\/+$/, "");
if (!BASE.startsWith("https://")) { console.error("NEARAI_BASE_URL must use https"); process.exit(2); }
const MODEL = opt("model", "z-ai/glm-5.3-flash");
const ACCEPT = new Set(opt("accept", "UpToDate").split(",").map((s) => s.trim()).filter(Boolean));
const MAX_TOKENS = Math.min(Number(opt("max-tokens", "64")) || 64, 200);
const OFFLINE = opt("offline", undefined);
const SAVE = opt("save-evidence", undefined);
const DATA_DIR = process.env.DARWIN_DATA_DIR ?? "data";
const EUR_USD = Number(process.env.DARWIN_EUR_USD_RATE) > 0 ? Number(process.env.DARWIN_EUR_USD_RATE) : 1.1;

const results = [];
const check = (name, status, detail = "") => {
  results.push({ name, status, detail });
  console.log(`${status.padEnd(5)} ${name}${detail ? ": " + detail : ""}`);
};
const sha = (alg, ...parts) => { const h = createHash(alg); for (const p of parts) h.update(p); return h.digest(); };
const hexBytes = (v) => Buffer.from(String(v).replace(/^0x/i, ""), "hex");
const parse = (v) => (typeof v === "string" ? JSON.parse(v) : v);
const same = (a, b) => a.length === b.length && timingSafeEqual(a, b);

export function replayRtmr3(eventLog) {
  let rtmr3 = Buffer.alloc(48);
  for (const ev of parse(eventLog)) {
    if (ev.imr !== 3) continue;
    const t = Buffer.alloc(4);
    t.writeUInt32LE(ev.event_type);
    const digest = sha("sha384", t, ":", Buffer.from(ev.event, "utf8"), ":", hexBytes(ev.event_payload ?? ""));
    if (ev.digest && !hexBytes(ev.digest).equals(digest)) throw new Error(`inconsistent digest for event ${ev.event}`);
    rtmr3 = sha("sha384", rtmr3, digest);
  }
  return rtmr3;
}

/** Expected signed text for a provider_tee signature. */
export const expectedText = (model, reqBytes, resBytes) => `${model}:${sha("sha256", reqBytes).toString("hex")}:${sha("sha256", resBytes).toString("hex")}`;

async function verifyReport(label, report, nonce, { quoteVerifier }) {
  const id = hexBytes(report.signing_address);
  if ({ ecdsa: 20, ed25519: 32 }[report.signing_algo] !== id.length) { check(`${label}: signer identity`, "FAIL", "unsupported algorithm/address"); return undefined; }
  let quote;
  if (!quoteVerifier) { check(`${label}: Intel TDX quote (DCAP)`, "SKIP", "offline mode: quote not re-verified (collateral required)"); }
  else {
    try {
      const verified = await quoteVerifier(hexBytes(report.intel_quote));
      if (!ACCEPT.has(verified.status)) throw new Error(`TCB status ${verified.status} not accepted (${(verified.advisory_ids ?? []).join(",")})`);
      if (verified.report.type !== "td10") throw new Error("td10 TDX quote expected");
      quote = verified.report.data;
      check(`${label}: Intel TDX quote (DCAP, Phala PCCS collateral)`, "PASS", `TCB status ${verified.status}${(verified.advisory_ids ?? []).length ? ", advisories " + verified.advisory_ids.join(",") : ""}`);
    } catch (e) { check(`${label}: Intel TDX quote (DCAP)`, "FAIL", e.message); return undefined; }
    if (quote.tdAttributes[0] & 1) check(`${label}: TDX debug mode`, "FAIL", "debug enabled");
    else check(`${label}: TDX debug mode disabled`, "PASS");
    const bound = report.tls_cert_fingerprint ? sha("sha256", id, hexBytes(report.tls_cert_fingerprint)) : Buffer.concat([id, Buffer.alloc(32 - id.length)]);
    const okRd = Buffer.from(quote.reportData).equals(Buffer.concat([bound, hexBytes(nonce)]));
    check(`${label}: quote report_data = signer + client nonce`, okRd ? "PASS" : "FAIL");
    check(`${label}: returned nonce = sent nonce`, String(report.request_nonce).toLowerCase() === nonce ? "PASS" : "FAIL");
    try {
      const compose = parse(report.info.tcb_info).app_compose;
      const exp = Buffer.concat([Buffer.from([1]), sha("sha256", Buffer.from(compose, "utf8")), Buffer.alloc(15)]);
      check(`${label}: MRCONFIGID = SHA-256(app_compose)`, Buffer.from(quote.mrConfigId).equals(exp) ? "PASS" : "FAIL");
    } catch (e) { check(`${label}: MRCONFIGID`, "FAIL", e.message); }
    try { check(`${label}: event log replay = quote RTMR3`, replayRtmr3(report.event_log).equals(Buffer.from(quote.rtMr3)) ? "PASS" : "FAIL"); }
    catch (e) { check(`${label}: RTMR3 replay`, "FAIL", e.message); }
  }
  return { signing_address: report.signing_address, signing_algo: report.signing_algo };
}

async function verifyGpu(label, report, nonce) {
  if (flag("skip-gpu")) return check(`${label}: NVIDIA GPU evidence`, "SKIP", "--skip-gpu");
  if (!report.nvidia_payload) return check(`${label}: NVIDIA GPU evidence`, "SKIP", "no nvidia_payload in the report");
  try {
    const payload = parse(report.nvidia_payload);
    if (String(payload.nonce ?? "").toLowerCase() !== nonce) return check(`${label}: NVIDIA GPU evidence`, "FAIL", "payload nonce differs");
    if (OFFLINE) return check(`${label}: NVIDIA GPU evidence`, "SKIP", "offline mode (NRAS verdict not requested again)");
    const r = await fetch("https://nras.attestation.nvidia.com/v3/attest/gpu", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!r.ok) return check(`${label}: NVIDIA GPU evidence (NRAS)`, "FAIL", `HTTP ${r.status}`);
    const arr = await r.json();
    const jwt = arr?.[0]?.[1];
    const claims = JSON.parse(Buffer.from(String(jwt).split(".")[1], "base64url").toString("utf8"));
    check(`${label}: NVIDIA GPU evidence (NRAS verdict, token not re-validated locally)`, claims["x-nvidia-overall-att-result"] === true ? "PASS" : "FAIL", `x-nvidia-overall-att-result=${claims["x-nvidia-overall-att-result"]}`);
  } catch (e) { check(`${label}: NVIDIA GPU evidence`, "FAIL", e.message); }
}

async function recoverEcdsa(text, signature) {
  const { ethers } = await import("ethers");
  return ethers.verifyMessage(Buffer.from(text, "utf8"), signature);
}

function verifyEd25519(text, signatureHex, pubHex) {
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), hexBytes(pubHex)]);
  return cryptoVerify(null, Buffer.from(text, "utf8"), createPublicKey({ key: spki, format: "der", type: "spki" }), hexBytes(signatureHex));
}

async function verifySignature({ model, reqBytes, resBytes, sig, preflightSigners }) {
  const want = expectedText(model, reqBytes, resBytes);
  check("signature: signed text = model:SHA256(exact request):SHA256(exact response)", sig.text === want ? "PASS" : "FAIL", sig.text === want ? "" : "text differs");
  if (sig.signature_kind && sig.signature_kind !== "provider_tee") check("signature: type", "FAIL", `signature_kind=${sig.signature_kind} (provider_tee expected to bind the response to the model's TEE)`);
  else check(`signature: type ${sig.signature_kind ?? "(absent)"}`, sig.signature_kind === "provider_tee" ? "PASS" : "SKIP", sig.signature_kind ? "" : "signature_kind absent: classification not verifiable");
  try {
    let ok;
    if (sig.signing_algo === "ecdsa") {
      const recovered = await recoverEcdsa(sig.text, sig.signature.startsWith("0x") ? sig.signature : "0x" + sig.signature);
      ok = same(hexBytes(recovered), hexBytes(sig.signing_address));
    } else if (sig.signing_algo === "ed25519") ok = verifyEd25519(sig.text, sig.signature, sig.signing_address);
    else throw new Error("unsupported algorithm");
    check(`signature: ${sig.signing_algo} valid for signing_address`, ok ? "PASS" : "FAIL");
  } catch (e) { check("signature: cryptographic verification", "FAIL", e.message); }
  const matches = preflightSigners.filter((s) => s.signing_algo === sig.signing_algo && s.signing_address.toLowerCase() === sig.signing_address.toLowerCase());
  if (OFFLINE) check("signature: signer = ONE model report verified upstream", "SKIP", `offline: reports not re-verified (${matches.length} identical address(es) in the saved report)`);
  else check("signature: signer = ONE model report verified upstream", matches.length === 1 ? "PASS" : "FAIL", `${matches.length} match(es)`);
}

// ------------------------------------------------------------------------------------------------------------------------------
async function main() {
  console.log(`# NEAR AI Cloud attestation verification: model ${MODEL}${OFFLINE ? " (offline)" : ""}`);
  let quoteVerifier;
  if (!OFFLINE) {
    try { quoteVerifier = (await import("@phala/dcap-qvl")).getCollateralAndVerify; }
    catch { check("tool @phala/dcap-qvl", "FAIL", "not installed: npm install"); }
  }
  let nonce, body, reqBytes, resBytes, sig, completionId;
  if (OFFLINE) {
    const rd = (f) => JSON.parse(readFileSync(join(OFFLINE, f), "utf8"));
    ({ nonce } = rd("meta.json")); body = rd("attestation-report.json"); sig = rd("signature.json");
    reqBytes = readFileSync(join(OFFLINE, "request.bin")); resBytes = readFileSync(join(OFFLINE, "response.bin"));
  } else {
    nonce = randomBytes(32).toString("hex");
    const u = `${BASE}/attestation/report?` + new URLSearchParams({ model: MODEL, provider: "near", signing_algo: "ecdsa", nonce });
    const r = await fetch(u, { headers: { Accept: "application/json", "x-no-aliasing": "true" } });
    if (!r.ok) { check("attestation report", "FAIL", `HTTP ${r.status}`); return finish(); }
    body = await r.json();
    check("attestation report retrieved", "PASS", `client nonce ${nonce.slice(0, 8)}... ; ${body.model_attestations?.length ?? 0} model candidate(s)`);
  }

  const signers = [];
  if (body.gateway_attestation) await verifyReport("gateway", body.gateway_attestation, nonce, { quoteVerifier });
  else check("gateway: report", "SKIP", "absent from the response");
  const cands = body.model_attestations ?? [];
  if (cands.length === 0) check("model: model_attestations[] not empty", "FAIL", "no model report (model without TEE?)");
  let i = 0;
  for (const c of cands) {
    i++;
    const s = await verifyReport(`model#${i}`, c, nonce, { quoteVerifier });
    if (s) signers.push(s);
    await verifyGpu(`model#${i}`, c, nonce);
  }

  if (!OFFLINE) {
    const key = process.env.NEARAI_API_KEY;
    if (!key) { check("real request + signature", "SKIP", "NEARAI_API_KEY missing"); return finish(); }
    reqBytes = Buffer.from(JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "Reply with the word OK." }], max_tokens: MAX_TOKENS, ...(MODEL === "z-ai/glm-5.3-flash" ? { reasoning_effort: "low" } : {}) }), "utf8");
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST", body: reqBytes,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "x-no-aliasing": "true", "Accept-Encoding": "identity" },
    });
    resBytes = Buffer.from(await r.arrayBuffer());
    if (!r.ok) { check("real request", "FAIL", `HTTP ${r.status}`); return finish(); }
    const j = JSON.parse(resBytes.toString("utf8"));
    completionId = j.id;
    check("real request executed", "PASS", `id ${completionId}, ${j.usage?.prompt_tokens} in / ${j.usage?.completion_tokens} out`);
    await recordUsage(j);
    for (let attempt = 0; attempt < 6 && !sig; attempt++) {
      if (attempt) await new Promise((res) => setTimeout(res, 1500 * attempt));
      const sr = await fetch(`${BASE}/signature/${encodeURIComponent(completionId)}?` + new URLSearchParams({ model: MODEL, signing_algo: "ecdsa" }), {
        headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
      });
      if (sr.status === 404) continue;
      const sj = await sr.json().catch(() => undefined);
      if (sr.ok && sj && sj.signature && sj.text) sig = sj;
      else if (sr.ok) continue;
      else { check("signature retrieved", "FAIL", `HTTP ${sr.status}`); return finish(); }
    }
    if (!sig) { check("signature retrieved", "FAIL", "unavailable after 6 attempts (not verified)"); return finish(); }
    check("signature retrieved", "PASS", `kind=${sig.signature_kind ?? "(absent)"} algo=${sig.signing_algo}`);
  }
  await verifySignature({ model: MODEL, reqBytes, resBytes, sig, preflightSigners: signers });

  if (SAVE && !OFFLINE) {
    mkdirSync(SAVE, { recursive: true });
    writeFileSync(join(SAVE, "meta.json"), JSON.stringify({ nonce, model: MODEL, completionId, at: new Date().toISOString() }, null, 2));
    writeFileSync(join(SAVE, "attestation-report.json"), JSON.stringify(body));
    writeFileSync(join(SAVE, "signature.json"), JSON.stringify(sig, null, 2));
    writeFileSync(join(SAVE, "request.bin"), reqBytes);
    writeFileSync(join(SAVE, "response.bin"), resBytes);
    console.log(`records saved in ${SAVE} (re-verification: --offline ${SAVE})`);
  }
  return finish();
}

/** Usage journal + budget total (same format as brain/budget.ts), cost = usage x catalogue price from /model/list. */
async function recordUsage(j) {
  try {
    const cat = await (await fetch(`${BASE}/model/list`)).json();
    const m = cat.models.find((x) => x.modelId === MODEL);
    const per = (c) => (c.amount / 10 ** c.scale);
    const u = j.usage ?? {};
    const completion = Math.max(u.completion_tokens ?? 0, (u.total_tokens ?? 0) - (u.prompt_tokens ?? 0), u.completion_tokens_details?.reasoning_tokens ?? 0);
    const costUsd = (u.prompt_tokens ?? 0) * per(m.inputCostPerToken) + completion * per(m.outputCostPerToken);
    mkdirSync(DATA_DIR, { recursive: true });
    const ts = new Date().toISOString();
    appendFileSync(join(DATA_DIR, "ai-usage.jsonl"), JSON.stringify({
      ts, provider: "nearai", model: MODEL, servedModel: j.model, promptTokens: u.prompt_tokens ?? 0, completionTokens: u.completion_tokens ?? 0,
      reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0, costUsd, costEur: costUsd / EUR_USD, eurUsdRate: EUR_USD,
      responseId: j.id ?? null, agentId: "attestation", purpose: "other",
    }) + "\n");
    const bp = join(DATA_DIR, "ai-budget.json");
    let spent = 0;
    if (existsSync(bp)) { try { spent = JSON.parse(readFileSync(bp, "utf8")).spentUsd ?? 0; } catch { /* restart from the journal */ } }
    writeFileSync(bp + ".tmp", JSON.stringify({ spentUsd: spent + costUsd, updatedAt: ts }));
    renameSync(bp + ".tmp", bp);
  } catch { /* does not block the verification */ }
}

function finish() {
  const n = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nSummary: ${n("PASS")} PASS, ${n("FAIL")} FAIL, ${n("SKIP")} SKIP`);
  process.exitCode = n("FAIL") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}`).href) await main();
