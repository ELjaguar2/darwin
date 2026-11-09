#!/usr/bin/env node
// Scan de secrets Darwin (sans dependance). Proprietaire : agent securite.
// Usage : node scripts/scan-secrets.mjs [--ref <branche>] [--no-history] [--no-files]
//   (sans --ref : fichiers suivis du dossier de travail + historique de toutes les refs)
//   --ref X     : fichiers de X (git show) + historique de X seulement
// Sortie 1 si detection. Les valeurs trouvees sont TOUJOURS masquees.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const refIdx = args.indexOf("--ref");
const ref = refIdx >= 0 ? args[refIdx + 1] : null;
const doFiles = !args.includes("--no-files");
const doHistory = !args.includes("--no-history");

const B58 = "[1-9A-HJ-NP-Za-km-z]";
const SECRET_ENV = "(?:NEAR_MASTER_PRIVATE_KEY|NEARAI_API_KEY|INTENTS_JWT|DARWIN_ADMIN_TOKEN|PRIVATE_KEY|SECRET_KEY|API_KEY)";
const RULES = [
  { type: "cle-privee-NEAR", re: new RegExp(String.raw`\b(?:ed25519|secp256k1):${B58}{43,100}\b`, "g") },
  { type: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { type: "cle-api-sk", re: /\bsk-(?:[A-Za-z0-9]+-)*[A-Za-z0-9_]{20,}/g },
  { type: "bearer-long", re: /\bBearer\s+([A-Za-z0-9._~+\/=-]{24,})/g, group: 1, reject: (v) => /^(?:\$|x{4,}|\.{3})/i.test(v) },
  { type: "cle-pem", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    type: "phrase-de-recuperation",
    re: /\b(?:seed|mnemonic|recovery|passphrase|phrase)[\w ]{0,20}["']?\s*[:=]\s*["'`]?((?:[a-z]{3,8}[ ]+){11,23}[a-z]{3,8})\b/gi,
    group: 1,
  },
  {
    // affectation non vide d'une variable secrete connue (.env oublie, code)
    type: "affectation-secret",
    re: new RegExp(String.raw`\b${SECRET_ENV}\b["']?\s*[:=]\s*["'\x60]?([^\s"'\x60#,;)]{16,})`, "g"),
    group: 1,
    reject: (v) => /^(?:\$|process\.|env\b|config\b|cfg\b|opts?\b|args?\b|deps\b|input\b|undefined|null|true|false|<|\[|\{|\(|test|fake|dummy|mock|example|changeme|placeholder|your|x{3,}|\*{3,}|\.{3})/i.test(v) || /[(){}]/.test(v),
  },
];

const mask = (v) => (v.length <= 8 ? "****" : `${v.slice(0, 4)}...[${v.length} car.]`);
const findings = [];
const seen = new Set();

function scanLine(line, where) {
  if (!line || line.length > 4000) line = (line || "").slice(0, 4000);
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(line))) {
      const v = rule.group ? m[rule.group] : m[0];
      if (!v || v.trim() === "") continue;
      if (rule.reject && rule.reject(v)) continue;
      const key = rule.type + "|" + where.file + "|" + createHash("sha256").update(v).digest("hex").slice(0, 16);
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ ...where, type: rule.type, masked: mask(v) });
    }
  }
}

const SKIP = /(^|\/)(\.env\.example|package-lock\.json|Cargo\.lock|pnpm-lock\.yaml|yarn\.lock|node_modules\/)/;
const isEnvFile = (f) => /(^|\/)\.env(\.[^/]+)?$/.test(f) && !/\.env\.example$/.test(f);
const git = (a, opts = {}) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...opts });

function scanText(text, file, extra = {}) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) scanLine(lines[i], { file, line: i + 1, ...extra });
}

// 1. Fichiers suivis
if (doFiles) {
  const label = ref ? `ref ${ref}` : "dossier de travail";
  const files = (ref ? git(["ls-tree", "-r", "--name-only", ref]) : git(["ls-files"])).split(/\r?\n/).filter(Boolean);
  for (const f of files) {
    if (isEnvFile(f)) findings.push({ file: f, line: 0, type: "fichier-.env-suivi-par-git", masked: "(contenu non affiche)" });
    if (SKIP.test(f)) continue;
    let text;
    try {
      text = ref ? git(["show", `${ref}:${f}`]) : existsSync(f) ? readFileSync(f, "utf8") : "";
    } catch { continue; }
    if (text.includes("\u0000")) continue;
    scanText(text, f, { source: label });
  }
  console.log(`[scan-secrets] fichiers scannes (${label}) : ${files.length}`);
}

// 2. Historique (lignes ajoutees uniquement)
async function scanHistory() {
  const a = ["log", "-p", "--no-color", "--no-ext-diff", "--diff-filter=AM", ref ? ref : "--all"];
  const child = spawn("git", a, { stdio: ["ignore", "pipe", "ignore"] });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let commit = "?", file = "?", n = 0, ln = 0, skip = false;
  for await (const l of rl) {
    if (l.startsWith("commit ") && /^commit [0-9a-f]{40}/.test(l)) { commit = l.slice(7, 14); n++; continue; }
    if (l.startsWith("diff --git ")) { file = l.split(" b/").pop(); skip = SKIP.test(file); continue; }
    if (l.startsWith("@@")) { const m = /\+(\d+)/.exec(l); ln = m ? +m[1] - 1 : 0; continue; }
    if (l.startsWith("+++") || l.startsWith("---")) continue;
    if (l.startsWith("+")) {
      ln++;
      if (!skip) scanLine(l.slice(1), { file, line: ln, source: `historique ${commit}` });
    } else if (!l.startsWith("-")) ln++;
  }
  console.log(`[scan-secrets] commits scannes (historique ${ref ?? "toutes refs"}) : ${n}`);
}
if (doHistory) await scanHistory();

if (findings.length === 0) {
  console.log("[scan-secrets] OK : aucun secret detecte.");
  process.exit(0);
}
console.error(`[scan-secrets] ECHEC : ${findings.length} detection(s) (valeurs masquees).`);
for (const f of findings) console.error(` - ${f.type} | ${f.file}:${f.line} | ${f.source ?? ""} | ${f.masked}`);
process.exit(1);
