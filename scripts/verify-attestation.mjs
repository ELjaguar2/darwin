#!/usr/bin/env node
// Verification de l'attestation TEE d'une reponse NEAR AI Cloud (modele avec attestationSupported).
// Protocole : docs.near.ai/cloud/verification (verifie le 2026-11-10). Voir docs/ATTESTATION_TEE.md pour le detail et les limites.
//
// Usage :
//   node scripts/verify-attestation.mjs [--model z-ai/glm-5.3-flash] [--env-file .env] [--accept UpToDate,...]
//        [--save-evidence <dossier>] [--offline <dossier>] [--skip-gpu] [--max-tokens 64]
//   npm run ai:verify-attestation -- --model Qwen/Qwen3.8-27B
//
// Etapes (chacune est reportee PASS / FAIL / SKIP, sans jamais presenter un SKIP comme une reussite) :
//   1. rapport d'attestation (gateway + modele) avec un nonce genere ici ;
//   2. quote Intel TDX verifiee par @phala/dcap-qvl (collateral Phala PCCS, reseau) : statut TCB, mode debug ;
//   3. report_data de la quote = identite du signataire + nonce ; MRCONFIGID = SHA-256(app_compose) ; rejeu RTMR3 de l'event log ;
//   4. preuve GPU NVIDIA : nonce du payload, verdict NVIDIA NRAS (verdict TLS, jeton non revalide localement) ;
//   5. une vraie requete (octets exacts conservees) + GET /v1/signature/{id} : texte signe = modele:SHA256(requete):SHA256(reponse),
//      signature ECDSA (EIP-191) recuperee, adresse = signing_address d'UN rapport modele verifie.
// La cle API (NEARAI_API_KEY) n'est lue que depuis l'environnement / le fichier .env, n'est jamais affichee ni ecrite.
import { createHash, randomBytes, timingSafeEqual, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };

const envFile = opt("env-file", process.env.DARWIN_ENV_FILE ?? ".env");
try { process.loadEnvFile(envFile); } catch { /* absent : variables d'environnement seules */ }

const BASE = (process.env.NEARAI_BASE_URL ?? "https://cloud-api.near.ai/v1").replace(/\/+$/, "");
if (!BASE.startsWith("https://")) { console.error("NEARAI_BASE_URL doit etre en https"); process.exit(2); }
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
  console.log(`${status.padEnd(5)} ${name}${detail ? " : " + detail : ""}`);
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
    if (ev.digest && !hexBytes(ev.digest).equals(digest)) throw new Error(`digest incoherent pour l'evenement ${ev.event}`);
    rtmr3 = sha("sha384", rtmr3, digest);
  }
  return rtmr3;
}

/** Texte signe attendu pour une signature provider_tee. */
export const expectedText = (model, reqBytes, resBytes) => `${model}:${sha("sha256", reqBytes).toString("hex")}:${sha("sha256", resBytes).toString("hex")}`;

async function verifyReport(label, report, nonce, { quoteVerifier }) {
  const id = hexBytes(report.signing_address);
  if ({ ecdsa: 20, ed25519: 32 }[report.signing_algo] !== id.length) { check(`${label} : identite du signataire`, "FAIL", "algorithme/adresse non pris en charge"); return undefined; }
  let quote;
  if (!quoteVerifier) { check(`${label} : quote Intel TDX (DCAP)`, "SKIP", "mode hors ligne : quote non reverifiee (collateral requis)"); }
  else {
    try {
      const verified = await quoteVerifier(hexBytes(report.intel_quote));
      if (!ACCEPT.has(verified.status)) throw new Error(`statut TCB ${verified.status} non accepte (${(verified.advisory_ids ?? []).join(",")})`);
      if (verified.report.type !== "td10") throw new Error("quote TDX td10 attendue");
      quote = verified.report.data;
      check(`${label} : quote Intel TDX (DCAP, collateral Phala PCCS)`, "PASS", `statut TCB ${verified.status}${(verified.advisory_ids ?? []).length ? ", advisories " + verified.advisory_ids.join(",") : ""}`);
    } catch (e) { check(`${label} : quote Intel TDX (DCAP)`, "FAIL", e.message); return undefined; }
    if (quote.tdAttributes[0] & 1) check(`${label} : mode debug TDX`, "FAIL", "debug active");
    else check(`${label} : mode debug TDX desactive`, "PASS");
    const bound = report.tls_cert_fingerprint ? sha("sha256", id, hexBytes(report.tls_cert_fingerprint)) : Buffer.concat([id, Buffer.alloc(32 - id.length)]);
    const okRd = Buffer.from(quote.reportData).equals(Buffer.concat([bound, hexBytes(nonce)]));
    check(`${label} : report_data de la quote = signataire + nonce du client`, okRd ? "PASS" : "FAIL");
    check(`${label} : nonce renvoye = nonce envoye`, String(report.request_nonce).toLowerCase() === nonce ? "PASS" : "FAIL");
    try {
      const compose = parse(report.info.tcb_info).app_compose;
      const exp = Buffer.concat([Buffer.from([1]), sha("sha256", Buffer.from(compose, "utf8")), Buffer.alloc(15)]);
      check(`${label} : MRCONFIGID = SHA-256(app_compose)`, Buffer.from(quote.mrConfigId).equals(exp) ? "PASS" : "FAIL");
    } catch (e) { check(`${label} : MRCONFIGID`, "FAIL", e.message); }
    try { check(`${label} : rejeu de l'event log = RTMR3 de la quote`, replayRtmr3(report.event_log).equals(Buffer.from(quote.rtMr3)) ? "PASS" : "FAIL"); }
    catch (e) { check(`${label} : rejeu RTMR3`, "FAIL", e.message); }
  }
  return { signing_address: report.signing_address, signing_algo: report.signing_algo };
}

async function verifyGpu(label, report, nonce) {
  if (flag("skip-gpu")) return check(`${label} : preuve GPU NVIDIA`, "SKIP", "--skip-gpu");
  if (!report.nvidia_payload) return check(`${label} : preuve GPU NVIDIA`, "SKIP", "pas de nvidia_payload dans le rapport");
  try {
    const payload = parse(report.nvidia_payload);
    if (String(payload.nonce ?? "").toLowerCase() !== nonce) return check(`${label} : preuve GPU NVIDIA`, "FAIL", "nonce du payload different");
    if (OFFLINE) return check(`${label} : preuve GPU NVIDIA`, "SKIP", "mode hors ligne (verdict NRAS non redemande)");
    const r = await fetch("https://nras.attestation.nvidia.com/v3/attest/gpu", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!r.ok) return check(`${label} : preuve GPU NVIDIA (NRAS)`, "FAIL", `HTTP ${r.status}`);
    const arr = await r.json();
    const jwt = arr?.[0]?.[1];
    const claims = JSON.parse(Buffer.from(String(jwt).split(".")[1], "base64url").toString("utf8"));
    check(`${label} : preuve GPU NVIDIA (verdict NRAS, jeton non revalide localement)`, claims["x-nvidia-overall-att-result"] === true ? "PASS" : "FAIL", `x-nvidia-overall-att-result=${claims["x-nvidia-overall-att-result"]}`);
  } catch (e) { check(`${label} : preuve GPU NVIDIA`, "FAIL", e.message); }
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
  check("signature : texte signe = modele:SHA256(requete exacte):SHA256(reponse exacte)", sig.text === want ? "PASS" : "FAIL", sig.text === want ? "" : "texte different");
  if (sig.signature_kind && sig.signature_kind !== "provider_tee") check("signature : type", "FAIL", `signature_kind=${sig.signature_kind} (provider_tee attendu pour lier la reponse au TEE du modele)`);
  else check(`signature : type ${sig.signature_kind ?? "(absent)"}`, sig.signature_kind === "provider_tee" ? "PASS" : "SKIP", sig.signature_kind ? "" : "signature_kind absent : classification non verifiable");
  try {
    let ok;
    if (sig.signing_algo === "ecdsa") {
      const recovered = await recoverEcdsa(sig.text, sig.signature.startsWith("0x") ? sig.signature : "0x" + sig.signature);
      ok = same(hexBytes(recovered), hexBytes(sig.signing_address));
    } else if (sig.signing_algo === "ed25519") ok = verifyEd25519(sig.text, sig.signature, sig.signing_address);
    else throw new Error("algorithme non pris en charge");
    check(`signature : ${sig.signing_algo} valide pour signing_address`, ok ? "PASS" : "FAIL");
  } catch (e) { check("signature : verification cryptographique", "FAIL", e.message); }
  const matches = preflightSigners.filter((s) => s.signing_algo === sig.signing_algo && s.signing_address.toLowerCase() === sig.signing_address.toLowerCase());
  if (OFFLINE) check("signature : signataire = UN rapport modele verifie en amont", "SKIP", `hors ligne : rapports non reverifies (${matches.length} adresse(s) identique(s) dans le rapport enregistre)`);
  else check("signature : signataire = UN rapport modele verifie en amont", matches.length === 1 ? "PASS" : "FAIL", `${matches.length} correspondance(s)`);
}

// ------------------------------------------------------------------------------------------------------------------------------
async function main() {
  console.log(`# Verification d'attestation NEAR AI Cloud : modele ${MODEL}${OFFLINE ? " (hors ligne)" : ""}`);
  let quoteVerifier;
  if (!OFFLINE) {
    try { quoteVerifier = (await import("@phala/dcap-qvl")).getCollateralAndVerify; }
    catch { check("outil @phala/dcap-qvl", "FAIL", "non installe : npm install"); }
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
    if (!r.ok) { check("rapport d'attestation", "FAIL", `HTTP ${r.status}`); return finish(); }
    body = await r.json();
    check("rapport d'attestation recupere", "PASS", `nonce client ${nonce.slice(0, 8)}... ; ${body.model_attestations?.length ?? 0} candidat(s) modele`);
  }

  const signers = [];
  if (body.gateway_attestation) await verifyReport("gateway", body.gateway_attestation, nonce, { quoteVerifier });
  else check("gateway : rapport", "SKIP", "absent de la reponse");
  const cands = body.model_attestations ?? [];
  if (cands.length === 0) check("modele : model_attestations[] non vide", "FAIL", "aucun rapport modele (modele sans TEE ?)");
  let i = 0;
  for (const c of cands) {
    i++;
    const s = await verifyReport(`modele#${i}`, c, nonce, { quoteVerifier });
    if (s) signers.push(s);
    await verifyGpu(`modele#${i}`, c, nonce);
  }

  if (!OFFLINE) {
    const key = process.env.NEARAI_API_KEY;
    if (!key) { check("requete reelle + signature", "SKIP", "NEARAI_API_KEY absente"); return finish(); }
    reqBytes = Buffer.from(JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "Reponds par le mot OK." }], max_tokens: MAX_TOKENS, ...(MODEL === "z-ai/glm-5.3-flash" ? { reasoning_effort: "low" } : {}) }), "utf8");
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST", body: reqBytes,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "x-no-aliasing": "true", "Accept-Encoding": "identity" },
    });
    resBytes = Buffer.from(await r.arrayBuffer());
    if (!r.ok) { check("requete reelle", "FAIL", `HTTP ${r.status}`); return finish(); }
    const j = JSON.parse(resBytes.toString("utf8"));
    completionId = j.id;
    check("requete reelle executee", "PASS", `id ${completionId}, ${j.usage?.prompt_tokens} in / ${j.usage?.completion_tokens} out`);
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
      else { check("signature recuperee", "FAIL", `HTTP ${sr.status}`); return finish(); }
    }
    if (!sig) { check("signature recuperee", "FAIL", "indisponible apres 6 essais (non verifiee)"); return finish(); }
    check("signature recuperee", "PASS", `kind=${sig.signature_kind ?? "(absent)"} algo=${sig.signing_algo}`);
  }
  await verifySignature({ model: MODEL, reqBytes, resBytes, sig, preflightSigners: signers });

  if (SAVE && !OFFLINE) {
    mkdirSync(SAVE, { recursive: true });
    writeFileSync(join(SAVE, "meta.json"), JSON.stringify({ nonce, model: MODEL, completionId, at: new Date().toISOString() }, null, 2));
    writeFileSync(join(SAVE, "attestation-report.json"), JSON.stringify(body));
    writeFileSync(join(SAVE, "signature.json"), JSON.stringify(sig, null, 2));
    writeFileSync(join(SAVE, "request.bin"), reqBytes);
    writeFileSync(join(SAVE, "response.bin"), resBytes);
    console.log(`preuves enregistrees dans ${SAVE} (re-verification : --offline ${SAVE})`);
  }
  return finish();
}

/** Journal d'usage + cumul du budget (meme format que brain/budget.ts), cout = usage x prix du catalogue /model/list. */
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
    if (existsSync(bp)) { try { spent = JSON.parse(readFileSync(bp, "utf8")).spentUsd ?? 0; } catch { /* repart du journal */ } }
    writeFileSync(bp + ".tmp", JSON.stringify({ spentUsd: spent + costUsd, updatedAt: ts }));
    renameSync(bp + ".tmp", bp);
  } catch { /* ne bloque pas la verification */ }
}

function finish() {
  const n = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nBilan : ${n("PASS")} PASS, ${n("FAIL")} FAIL, ${n("SKIP")} SKIP`);
  process.exitCode = n("FAIL") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}`).href) await main();
