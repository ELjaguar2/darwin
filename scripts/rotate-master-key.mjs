#!/usr/bin/env node
// Rotation de la cle du compte maitre TESTNET. Proprietaire : agent securite.
// Usage : node scripts/rotate-master-key.mjs [--env <chemin .env>] [--backup-dir <dossier hors depot>]
//                                            [--rpc <url[,url2]>] [--apply] [--keep-old]
//   Sans --apply : DRY-RUN (lecture seule : verifie l'ancienne cle on-chain, n'ecrit rien, ne signe rien).
//   Avec --apply : (a) sauvegarde du .env, (b) nouvelle paire ed25519 sauvegardee hors depot AVANT toute transaction,
//     (c) AddKey full access signee par l'ancienne cle, (d) verification RPC, (e) mise a jour du .env,
//     (f) transaction de controle signee par la NOUVELLE cle seule, (g) DeleteKey de l'ancienne (sauf --keep-old),
//     verification de sa disparition et nouvelle transaction de controle.
//   Au moindre echec : arret, rien n'est supprime. Les cles ne sont JAMAIS affichees (fragments de 4 caracteres de la cle PUBLIQUE).
//   Refuse tout reseau autre que testnet et tout compte qui ne se termine pas par .testnet.
// near-api-js (optionnel) est resolu depuis le dossier courant ou celui du script : lancer depuis un dossier ou il est installe.
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
const RESUME = opt("--resume", null); // fichier new-master-key-*.json : reprise apres un arret
const envPath = resolve(opt("--env", ".env"));
const backupDir = resolve(opt("--backup-dir", join(homedir(), ".darwin-secure")));
// Masquage des messages d'erreur (memes motifs que backend/redact.ts) : une erreur RPC ne doit jamais afficher une cle.
const redactText = (s) =>
  String(s)
    .replace(/\b(ed25519|secp256k1):[A-Za-z0-9+/=_-]{16,}/g, "$1:[masque]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [masque]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/g, "[cle masquee]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[jwt masque]")
    .replace(/(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{86,90}(?![1-9A-HJ-NP-Za-km-z])/g, (m) => (/[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m) ? "[cle masquee]" : m));
const safeMsg = (e, max) => redactText(e?.message || e).slice(0, max);

/** Vrai si le dossier (existant ou a creer) est dans l'arbre de travail d'un depot git : la cle en clair y serait committable. */
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
    return false; // git absent ou hors depot
  }
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const log = (...a) => console.log("[rotate-master-key]", ...a);
const fail = (m) => { console.error("[rotate-master-key] ECHEC :", m); process.exit(1); };
const frag = (pk) => `${String(pk).slice(0, 12)}...${String(pk).slice(-4)}`; // cle PUBLIQUE seulement
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (insideGitTree(backupDir)) fail(`--backup-dir (${backupDir}) est dans un depot git : la nouvelle cle en clair y serait committable. Choisissez un dossier hors de tout depot (defaut : ~/.darwin-secure).`);

function loadNear() {
  for (const base of [join(process.cwd(), "package.json"), fileURLToPath(import.meta.url)]) {
    try { return createRequire(base)("near-api-js"); } catch { /* suivant */ }
  }
  fail("near-api-js introuvable (npm install near-api-js@7.4.0, Node >= 22.22.2).");
}
const near = loadNear();

// --- .env (parse minimal, sans rien afficher) ---
if (!existsSync(envPath)) fail(`.env introuvable : ${envPath}`);
const envText = readFileSync(envPath, "utf8");
const envGet = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(envText);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};
const network = envGet("NEAR_NETWORK") || "testnet";
const accountId = envGet("NEAR_MASTER_ACCOUNT_ID");
const oldSecret = envGet("NEAR_MASTER_PRIVATE_KEY");
if (network !== "testnet") fail("NEAR_NETWORK doit valoir testnet.");
if (!accountId.endsWith(".testnet")) fail("NEAR_MASTER_ACCOUNT_ID doit se terminer par .testnet.");
if (!oldSecret) fail("NEAR_MASTER_PRIVATE_KEY vide dans le .env.");
const rpcUrls = (opt("--rpc", process.env.NEAR_RPC_URL || envGet("NEAR_RPC_URL") || "https://test.rpc.fastnear.com"))
  .split(",").map((s) => s.trim()).filter(Boolean);
if (!rpcUrls.every((u) => u.startsWith("https://"))) fail("Les URL RPC doivent etre en https.");
let oldPair;
try { oldPair = near.KeyPair.fromString(oldSecret); } catch { fail("NEAR_MASTER_PRIVATE_KEY illisible (ed25519: attendu)."); }
const oldPub = oldPair.getPublicKey().toString();

// --- RPC avec reessais (429, reseau) et bascule entre fournisseurs ---
const providers = rpcUrls.map((url) => new near.JsonRpcProvider({ url }));
async function withRetry(label, fn, tries = 8) {
  let delay = 1500, last;
  for (let i = 0; i < tries; i++) {
    const idx = i % providers.length;
    try { return await fn(providers[idx], idx); } catch (e) {
      last = e;
      const msg = safeMsg(e, 160);
      if (e?.__fatal) throw e;
      log(`${label}: tentative ${i + 1}/${tries} echouee (${msg}); nouvel essai dans ${delay} ms`);
      await sleep(delay); delay = Math.min(delay * 2, 20000);
    }
  }
  throw last;
}
const listKeys = () => withRetry("liste des cles", (p) => p.viewAccessKeyList({ accountId, finalityQuery: { finality: "final" } }))
  .then((r) => r.keys.map((k) => ({ pub: k.public_key ?? k.publicKey, full: (k.access_key ?? k.accessKey).permission === "FullAccess" })));
const txHash = (r) => r?.transaction?.hash ?? r?.transaction_outcome?.id ?? "(hash indisponible)";
const okOutcome = (r) => {
  const s = r?.status;
  return s && typeof s === "object" && "SuccessValue" in s;
};
// transaction de controle : 1 yoctoNEAR du compte vers lui-meme, signee par `pair`
async function selfTransfer(pair, tag) {
  const signer = near.KeyPairSigner ? new near.KeyPairSigner(pair) : pair.toString();
  const r = await withRetry(`controle ${tag}`, (p) => new near.Account(accountId, p, signer).transfer({ receiverId: accountId, amount: 1n }), 4);
  if (!okOutcome(r)) fail(`transaction de controle ${tag} non confirmee.`);
  log(`transaction de controle (${tag}) OK : ${txHash(r)}`);
  return txHash(r);
}

log(`compte ${accountId} | reseau ${network} | RPC ${rpcUrls.join(", ")} | mode ${APPLY ? "APPLY" : "DRY-RUN"}`);
const before = await listKeys();
log(`cles d'acces avant : ${before.map((k) => `${frag(k.pub)}${k.full ? "(full)" : "(fc)"}`).join(", ")}`);
const oldEntry = before.find((k) => k.pub === oldPub);
if (!oldEntry) fail(`la cle publique du .env (${frag(oldPub)}) ne figure pas parmi les cles du compte.`);
if (!oldEntry.full) fail("la cle du .env n'est pas full access.");
if (before.filter((k) => k.full).length > 1) log("AVERTISSEMENT : plusieurs cles full access existent deja ; seule celle du .env sera supprimee.");

if (!APPLY) {
  log("DRY-RUN : etapes qui seraient executees :");
  log(` a) copie du .env vers ${backupDir} (0600)`);
  log(" b) nouvelle paire ed25519, sauvegardee dans le meme dossier avant toute transaction");
  log(` c) AddKey full access signee par ${frag(oldPub)}`);
  log(" d) verification RPC de la nouvelle cle  e) mise a jour de NEAR_MASTER_PRIVATE_KEY dans le .env");
  log(" f) transfert de 1 yoctoNEAR (compte vers lui-meme) signe par la nouvelle cle seule");
  log(KEEP_OLD ? " g) --keep-old : l'ancienne cle ne serait PAS supprimee" : " g) DeleteKey de l'ancienne cle, verification, nouvelle transaction de controle");
  log("Rien n'a ete modifie. Relancer avec --apply pour executer.");
  process.exit(0);
}

// (a) sauvegarde du .env
mkdirSync(backupDir, { recursive: true });
const envBackup = join(backupDir, `env-backup-${ts}`);
copyFileSync(envPath, envBackup);
try { chmodSync(envBackup, 0o600); } catch { /* Windows */ }
log(`(a) .env sauvegarde : ${envBackup}`);

// (b) nouvelle paire, sauvegardee AVANT toute transaction
// (--resume : reprise d'une paire deja sauvegardee, eventuellement deja ajoutee on-chain)
let newPair;
if (RESUME) {
  const saved = JSON.parse(readFileSync(resolve(RESUME), "utf8"));
  if (saved.accountId !== accountId) fail("--resume : le fichier concerne un autre compte.");
  newPair = near.KeyPair.fromString(saved.secretKey);
  log(`(b) reprise de la cle sauvegardee ${frag(newPair.getPublicKey().toString())}`);
} else {
  newPair = near.KeyPair.fromRandom("ed25519");
  const keyBackup = join(backupDir, `new-master-key-${ts}.json`);
  writeFileSync(keyBackup, JSON.stringify({ accountId, publicKey: newPair.getPublicKey().toString(), secretKey: newPair.toString(), createdAt: ts }), { mode: 0o600 });
  try { chmodSync(keyBackup, 0o600); } catch { /* Windows */ }
  log(`(b) nouvelle cle generee (${frag(newPair.getPublicKey().toString())}), sauvegardee : ${keyBackup}`);
}
const newPub = newPair.getPublicKey().toString();
const newSecret = newPair.toString();

// (c) AddKey signee par l'ancienne cle (sautee si la cle est deja on-chain)
const oldSigner = near.KeyPairSigner ? new near.KeyPairSigner(oldPair) : oldPair.toString();
let addHash = "(deja presente)";
if (!before.some((k) => k.pub === newPub)) {
  try {
    const r = await withRetry("AddKey", (p) => new near.Account(accountId, p, oldSigner).addFullAccessKey(newPub), 4);
    if (!okOutcome(r)) throw new Error("AddKey non confirmee");
    addHash = txHash(r);
  } catch (e) {
    log(`(c) erreur sur AddKey (${safeMsg(e, 120)}) : verification de l'etat on-chain avant de conclure...`);
  }
}
// (d) verification (la finalite du RPC a quelques secondes de retard : interrogation jusqu'a 60 s)
let newEntry;
for (let i = 0; i < 12 && !newEntry; i++) {
  if (i) await sleep(5000);
  newEntry = (await listKeys()).find((k) => k.pub === newPub);
}
if (!newEntry || !newEntry.full) fail("(d) la nouvelle cle ne figure pas en full access sur le compte : STOP, rien supprime, .env intact.");
log(`(c) AddKey OK : ${addHash}`);
log(`(d) nouvelle cle ${frag(newPub)} presente en full access`);

// (e) .env : remplacement atomique de la seule ligne NEAR_MASTER_PRIVATE_KEY
const re = /^NEAR_MASTER_PRIVATE_KEY=.*$/m;
if (!re.test(envText)) fail("(e) ligne NEAR_MASTER_PRIVATE_KEY absente du .env.");
const tmp = `${envPath}.tmp-${process.pid}`;
writeFileSync(tmp, envText.replace(re, () => `NEAR_MASTER_PRIVATE_KEY=${newSecret}`), { mode: 0o600 });
renameSync(tmp, envPath);
if (!readFileSync(envPath, "utf8").includes(`NEAR_MASTER_PRIVATE_KEY=${newSecret}`)) fail("(e) relecture du .env incoherente (restaurer la sauvegarde).");
log("(e) .env mis a jour (valeur non affichee)");

// (f) controle avec la NOUVELLE cle seule (relue depuis le .env)
const reread = near.KeyPair.fromString(new RegExp("^NEAR_MASTER_PRIVATE_KEY=(.*)$", "m").exec(readFileSync(envPath, "utf8"))[1].trim());
if (reread.getPublicKey().toString() !== newPub) fail("(f) la cle du .env ne correspond pas a la nouvelle cle publique.");
const ctl1 = await selfTransfer(reread, "nouvelle cle seule");

if (KEEP_OLD) { log("--keep-old : suppression de l'ancienne cle sautee."); process.exit(0); }

// (g) suppression de l'ancienne cle, signee par la NOUVELLE
const newSigner = near.KeyPairSigner ? new near.KeyPairSigner(reread) : reread.toString();
let delHash = "(non confirme)";
try {
  const r = await withRetry("DeleteKey", (p) => new near.Account(accountId, p, newSigner).deleteKey(oldPub), 4);
  if (!okOutcome(r)) throw new Error("DeleteKey non confirmee");
  delHash = txHash(r);
} catch (e) {
  log(`(g) erreur sur DeleteKey (${safeMsg(e, 120)}) : verification de l'etat on-chain...`);
}
let afterDel = await listKeys();
for (let i = 0; i < 12 && afterDel.some((k) => k.pub === oldPub); i++) { await sleep(5000); afterDel = await listKeys(); }
if (afterDel.some((k) => k.pub === oldPub)) fail("(g) l'ancienne cle figure encore sur le compte (le compte reste utilisable avec la nouvelle).");
if (!afterDel.some((k) => k.pub === newPub && k.full)) fail("(g) ALERTE : la nouvelle cle n'est plus en full access !");
log(`(g) DeleteKey OK : ${delHash}`);
log(`    cles d'acces apres : ${afterDel.map((k) => `${frag(k.pub)}${k.full ? "(full)" : "(fc)"}`).join(", ")}`);
const ctl2 = await selfTransfer(reread, "apres suppression");
log(`TERMINE. AddKey ${addHash} | controle ${ctl1} | DeleteKey ${delHash} | controle ${ctl2}`);
log(`Sauvegardes hors depot dans ${backupDir} : les supprimer une fois la rotation validee.`);
