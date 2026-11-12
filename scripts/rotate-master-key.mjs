#!/usr/bin/env node
// Rotation of the TESTNET master account key. Owner: security agent.
// Usage: node scripts/rotate-master-key.mjs [--env <.env path>] [--backup-dir <folder outside the repo>]
//                                            [--rpc <url[,url2]>] [--apply] [--keep-old]
//   Without --apply: DRY-RUN (read-only: checks the old key on-chain, writes nothing, signs nothing).
//   With --apply: (a) .env backup, (b) new ed25519 pair saved outside the repository BEFORE any transaction,
//     (c) full-access AddKey signed by the old key, (d) RPC verification, (e) .env update,
//     (f) control transaction signed by the NEW key alone, (g) DeleteKey of the old one (unless --keep-old),
//     verification that it is gone and a new control transaction.
//   On the slightest failure: stop, nothing is deleted. Keys are NEVER displayed (4-character fragments of the PUBLIC key).
//   Refuses any network other than testnet and any account that does not end with .testnet.
// near-api-js (optional) is resolved from the current folder or the script's folder: run from a folder where it is installed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, copyFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const APPLY = argv.includes("--apply");
const KEEP_OLD = argv.includes("--keep-old");
const RESUME = opt("--resume", null); // new-master-key-*.json file: resume after a stop
const envPath = resolve(opt("--env", ".env"));
const backupDir = resolve(opt("--backup-dir", join(homedir(), ".darwin-secure")));
// Masking of error messages (same patterns as backend/redact.ts): an RPC error must never display a key.
const redactText = (s) =>
  String(s)
    .replace(/\b(ed25519|secp256k1):[A-Za-z0-9+/=_-]{16,}/g, "$1:[masque]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [masque]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/g, "[key masked]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[jwt masque]")
    .replace(/(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{86,90}(?![1-9A-HJ-NP-Za-km-z])/g, (m) => (/[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m) ? "[key masked]" : m));
const safeMsg = (e, max) => redactText(e?.message || e).slice(0, max);

/** True if the folder (existing or to be created) is inside a repository's working tree: the clear-text key would be committable there. */
function insideGitTree(dir) {
  let d = dir;
  while (!existsSync(d)) {
    const up = dirname(d);
    if (up === d) return false;
    d = up;
  }
  try {
    return execFileSync("git", ["-C", d, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() === "true";
  } catch {
    return false; // not installed or outside a repository
  }
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const log = (...a) => console.log("[rotate-master-key]", ...a);
const fail = (m) => { console.error("[rotate-master-key] FAILURE:", m); process.exit(1); };
const frag = (pk) => `${String(pk).slice(0, 12)}...${String(pk).slice(-4)}`; // PUBLIC key only
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (insideGitTree(backupDir)) fail(`--backup-dir (${backupDir}) is inside a repository: the new clear-text key would be committable there. Choose a folder outside any repository (default: ~/.darwin-secure).`);

function loadNear() {
  for (const base of [join(process.cwd(), "package.json"), fileURLToPath(import.meta.url)]) {
    try { return createRequire(base)("near-api-js"); } catch { /* suivant */ }
  }
  fail("near-api-js not found (npm install near-api-js@7.4.0, Node >= 22.22.2).");
}
const near = loadNear();

// --- .env (minimal parse, displays nothing) ---
if (!existsSync(envPath)) fail(`.env not found: ${envPath}`);
const envText = readFileSync(envPath, "utf8");
const envGet = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(envText);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};
const network = envGet("NEAR_NETWORK") || "testnet";
const accountId = envGet("NEAR_MASTER_ACCOUNT_ID");
const oldSecret = envGet("NEAR_MASTER_PRIVATE_KEY");
if (network !== "testnet") fail("NEAR_NETWORK doit valoir testnet.");
if (!accountId.endsWith(".testnet")) fail("NEAR_MASTER_ACCOUNT_ID must end with .testnet.");
if (!oldSecret) fail("NEAR_MASTER_PRIVATE_KEY is empty in the .env.");
const rpcUrls = (opt("--rpc", process.env.NEAR_RPC_URL || envGet("NEAR_RPC_URL") || "https://test.rpc.fastnear.com"))
  .split(",").map((s) => s.trim()).filter(Boolean);
if (!rpcUrls.every((u) => u.startsWith("https://"))) fail("RPC URLs must use https.");
let oldPair;
try { oldPair = near.KeyPair.fromString(oldSecret); } catch { fail("NEAR_MASTER_PRIVATE_KEY unreadable (ed25519: expected)."); }
const oldPub = oldPair.getPublicKey().toString();

// --- RPC with retries (429, network) and failover between providers ---
const providers = rpcUrls.map((url) => new near.JsonRpcProvider({ url }));
async function withRetry(label, fn, tries = 8) {
  let delay = 1500, last;
  for (let i = 0; i < tries; i++) {
    const idx = i % providers.length;
    try { return await fn(providers[idx], idx); } catch (e) {
      last = e;
      const msg = safeMsg(e, 160);
      if (e?.__fatal) throw e;
      log(`${label}: attempt ${i + 1}/${tries} failed (${msg}); retrying in ${delay} ms`);
      await sleep(delay); delay = Math.min(delay * 2, 20000);
    }
  }
  throw last;
}
const listKeys = () => withRetry("key list", (p) => p.viewAccessKeyList({ accountId, finalityQuery: { finality: "final" } }))
  .then((r) => r.keys.map((k) => ({ pub: k.public_key ?? k.publicKey, full: (k.access_key ?? k.accessKey).permission === "FullAccess" })));
const txHash = (r) => r?.transaction?.hash ?? r?.transaction_outcome?.id ?? "(hash unavailable)";
const okOutcome = (r) => {
  const s = r?.status;
  return s && typeof s === "object" && "SuccessValue" in s;
};
// control transaction: 1 yoctoNEAR from the account to itself, signed by `pair`
async function selfTransfer(pair, tag) {
  const signer = near.KeyPairSigner ? new near.KeyPairSigner(pair) : pair.toString();
  const r = await withRetry(`controle ${tag}`, (p) => new near.Account(accountId, p, signer).transfer({ receiverId: accountId, amount: 1n }), 4);
  if (!okOutcome(r)) fail(`control transaction ${tag} not confirmed.`);
  log(`control transaction (${tag}) OK: ${txHash(r)}`);
  return txHash(r);
}

log(`compte ${accountId} | reseau ${network} | RPC ${rpcUrls.join(", ")} | mode ${APPLY ? "APPLY" : "DRY-RUN"}`);
const before = await listKeys();
log(`access keys before: ${before.map((k) => `${frag(k.pub)}${k.full ? "(full)" : "(fc)"}`).join(", ")}`);
const oldEntry = before.find((k) => k.pub === oldPub);
if (!oldEntry) fail(`the .env public key (${frag(oldPub)}) is not among the account's keys.`);
if (!oldEntry.full) fail("the .env key is not full access.");
if (before.filter((k) => k.full).length > 1) log("WARNING: several full-access keys already exist; only the .env one will be deleted.");

if (!APPLY) {
  log("DRY-RUN: steps that would be executed:");
  log(` a) copy of the .env to ${backupDir} (0600)`);
  log(" b) new ed25519 pair, saved in the same folder before any transaction");
  log(` c) full-access AddKey signed by ${frag(oldPub)}`);
  log(" d) RPC verification of the new key  e) update of NEAR_MASTER_PRIVATE_KEY in the .env");
  log(" f) transfer of 1 yoctoNEAR (account to itself) signed by the new key alone");
  log(KEEP_OLD ? " g) --keep-old: the old key would NOT be deleted" : " g) DeleteKey of the old key, verification, new control transaction");
  log("Nothing was modified. Re-run with --apply to execute.");
  process.exit(0);
}

// (a) .env backup
mkdirSync(backupDir, { recursive: true });
const envBackup = join(backupDir, `env-backup-${ts}`);
copyFileSync(envPath, envBackup);
try { chmodSync(envBackup, 0o600); } catch { /* Windows */ }
log(`(a) .env sauvegarde : ${envBackup}`);

// (b) new pair, saved BEFORE any transaction
// (--resume: resuming an already saved pair, possibly already added on-chain)
let newPair;
if (RESUME) {
  const saved = JSON.parse(readFileSync(resolve(RESUME), "utf8"));
  if (saved.accountId !== accountId) fail("--resume: the file concerns another account.");
  newPair = near.KeyPair.fromString(saved.secretKey);
  log(`(b) resuming the saved key ${frag(newPair.getPublicKey().toString())}`);
} else {
  newPair = near.KeyPair.fromRandom("ed25519");
  const keyBackup = join(backupDir, `new-master-key-${ts}.json`);
  writeFileSync(keyBackup, JSON.stringify({ accountId, publicKey: newPair.getPublicKey().toString(), secretKey: newPair.toString(), createdAt: ts }), { mode: 0o600 });
  try { chmodSync(keyBackup, 0o600); } catch { /* Windows */ }
  log(`(b) new key generated (${frag(newPair.getPublicKey().toString())}), saved: ${keyBackup}`);
}
const newPub = newPair.getPublicKey().toString();
const newSecret = newPair.toString();

// (c) AddKey signed by the old key (skipped if the key is already on-chain)
const oldSigner = near.KeyPairSigner ? new near.KeyPairSigner(oldPair) : oldPair.toString();
let addHash = "(already present)";
if (!before.some((k) => k.pub === newPub)) {
  try {
    const r = await withRetry("AddKey", (p) => new near.Account(accountId, p, oldSigner).addFullAccessKey(newPub), 4);
    if (!okOutcome(r)) throw new Error("AddKey not confirmed");
    addHash = txHash(r);
  } catch (e) {
    log(`(c) error on AddKey (${safeMsg(e, 120)}): checking the on-chain state before concluding...`);
  }
}
// (d) verification (RPC finality lags by a few seconds: polling for up to 60 s)
let newEntry;
for (let i = 0; i < 12 && !newEntry; i++) {
  if (i) await sleep(5000);
  newEntry = (await listKeys()).find((k) => k.pub === newPub);
}
if (!newEntry || !newEntry.full) fail("(d) the new key is not listed as full access on the account: STOP, nothing deleted, .env intact.");
log(`(c) AddKey OK : ${addHash}`);
log(`(d) new key ${frag(newPub)} present with full access`);

// (e) .env: atomic replacement of the NEAR_MASTER_PRIVATE_KEY line only
const re = /^NEAR_MASTER_PRIVATE_KEY=.*$/m;
if (!re.test(envText)) fail("(e) NEAR_MASTER_PRIVATE_KEY line missing from the .env.");
const tmp = `${envPath}.tmp-${process.pid}`;
writeFileSync(tmp, envText.replace(re, () => `NEAR_MASTER_PRIVATE_KEY=${newSecret}`), { mode: 0o600 });
renameSync(tmp, envPath);
if (!readFileSync(envPath, "utf8").includes(`NEAR_MASTER_PRIVATE_KEY=${newSecret}`)) fail("(e) inconsistent .env re-read (restore the backup).");
log("(e) .env updated (value not displayed)");

// (f) control with the NEW key alone (re-read from the .env)
const reread = near.KeyPair.fromString(new RegExp("^NEAR_MASTER_PRIVATE_KEY=(.*)$", "m").exec(readFileSync(envPath, "utf8"))[1].trim());
if (reread.getPublicKey().toString() !== newPub) fail("(f) the .env key does not match the new public key.");
const ctl1 = await selfTransfer(reread, "new key alone");

if (KEEP_OLD) { log("--keep-old: deletion of the old key skipped."); process.exit(0); }

// (g) deletion of the old key, signed by the NEW one
const newSigner = near.KeyPairSigner ? new near.KeyPairSigner(reread) : reread.toString();
let delHash = "(not confirmed)";
try {
  const r = await withRetry("DeleteKey", (p) => new near.Account(accountId, p, newSigner).deleteKey(oldPub), 4);
  if (!okOutcome(r)) throw new Error("DeleteKey not confirmed");
  delHash = txHash(r);
} catch (e) {
  log(`(g) error on DeleteKey (${safeMsg(e, 120)}): checking the on-chain state...`);
}
let afterDel = await listKeys();
for (let i = 0; i < 12 && afterDel.some((k) => k.pub === oldPub); i++) { await sleep(5000); afterDel = await listKeys(); }
if (afterDel.some((k) => k.pub === oldPub)) fail("(g) the old key is still listed on the account (the account stays usable with the new one).");
if (!afterDel.some((k) => k.pub === newPub && k.full)) fail("(g) ALERT: the new key is no longer full access!");
log(`(g) DeleteKey OK : ${delHash}`);
log(`    access keys after: ${afterDel.map((k) => `${frag(k.pub)}${k.full ? "(full)" : "(fc)"}`).join(", ")}`);
const ctl2 = await selfTransfer(reread, "apres suppression");
log(`TERMINE. AddKey ${addHash} | controle ${ctl1} | DeleteKey ${delHash} | controle ${ctl2}`);
log(`Backups outside the repository in ${backupDir}: delete them once the rotation is validated.`);
