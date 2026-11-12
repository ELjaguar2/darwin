#!/usr/bin/env node
// Darwin secret scan (no dependency). Owner: security agent.
// Usage: node scripts/scan-secrets.mjs [--ref <branch>] [--no-history] [--no-files]
//   (without --ref: tracked files of the working tree + history of all refs)
//   --ref X     : files of X (git show) + history of X only
//   --no-allowlist : ignores scripts/scan-secrets.allowlist.json (review the reviewed exceptions)
// Exit 1 on detection. Values found are ALWAYS masked.
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
    // non-empty assignment of a known secret variable (forgotten .env, code)
    type: "affectation-secret",
    re: new RegExp(String.raw`\b${SECRET_ENV}\b["']?\s*[:=]\s*["'\x60]?([^\s"'\x60#,;)]{16,})`, "g"),
    group: 1,
    reject: (v) => /^(?:\$|process\.|env\b|config\b|cfg\b|opts?\b|args?\b|deps\b|input\b|undefined|null|true|false|<|\[|\{|\(|test|fake|dummy|mock|example|changeme|placeholder|your|x{3,}|\*{3,}|\.{3})/i.test(v) || /[(){}]/.test(v),
  },
];

// Reviewed exceptions: scripts/scan-secrets.allowlist.json (commit + file + type + value fingerprint; no value stored).
// They only concern HISTORY (a secret in the current tree is never exempt). --no-allowlist ignores them.
const ALLOW_PATH = new URL("./scan-secrets.allowlist.json", import.meta.url);
const allowEntries = args.includes("--no-allowlist") || !existsSync(ALLOW_PATH) ? [] : JSON.parse(readFileSync(ALLOW_PATH, "utf8")).entries ?? [];
const allowed = [];
function isAllowed(f, fp) {
  if (!f.commit) return false;
  // full commit identifier (40 hex) compared in full; a prefix is not enough
  return allowEntries.some((e) => e.commit === f.commit && e.file === f.file && e.type === f.type && e.fingerprints.includes(fp));
}
const mask = (v) => (v.length <= 8 ? "****" : `${v.slice(0, 4)}...[${v.length} car.]`);
const findings = [];
const seen = new Set();

// 4000-character windows with a 600 overlap (longer than a known secret): no line is truncated.
const WINDOW = 4000;
const OVERLAP = 600;
function scanLine(line, where) {
  if (!line) return;
  if (line.length <= WINDOW) return scanWindow(line, where);
  for (let i = 0; ; i += WINDOW - OVERLAP) {
    scanWindow(line.slice(i, i + WINDOW), where);
    if (i + WINDOW >= line.length) break;
  }
}

function scanWindow(line, where) {
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(line))) {
      const v = rule.group ? m[rule.group] : m[0];
      if (!v || v.trim() === "") continue;
      if (rule.reject && rule.reject(v)) continue;
      const fp = createHash("sha256").update(v).digest("hex").slice(0, 16);
      const key = rule.type + "|" + where.file + "|" + fp;
      if (seen.has(key)) continue;
      seen.add(key);
      const f = { ...where, type: rule.type, masked: mask(v) };
      if (isAllowed(f, fp)) { allowed.push(f); continue; }
      findings.push(f);
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
  const label = ref ? `ref ${ref}` : "working tree";
  const files = (ref ? git(["ls-tree", "-r", "--name-only", ref]) : git(["ls-files"])).split(/\r?\n/).filter(Boolean);
  for (const f of files) {
    if (isEnvFile(f)) findings.push({ file: f, line: 0, type: "fichier-.env-suivi-par-git", masked: "(content not displayed)" });
    if (SKIP.test(f)) continue;
    let text;
    try {
      text = ref ? git(["show", `${ref}:${f}`]) : existsSync(f) ? readFileSync(f, "utf8") : "";
    } catch { continue; }
    // binary file (NUL byte): we scan at least the printable ASCII strings (like `strings`)
    if (text.includes("\u0000")) text = (text.match(/[\x20-\x7e]{16,}/g) ?? []).join("\n");
    scanText(text, f, { source: label });
  }
  console.log(`[scan-secrets] files scanned (${label}): ${files.length}`);
}

// 2. Historique (lignes ajoutees uniquement)
async function scanHistory() {
  const a = ["log", "-p", "--no-color", "--no-ext-diff", "--diff-filter=AM", ref ? ref : "--all"];
  const child = spawn("git", a, { stdio: ["ignore", "pipe", "ignore"] });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let commit = "?", file = "?", n = 0, ln = 0, skip = false;
  for await (const l of rl) {
    if (l.startsWith("commit ") && /^commit [0-9a-f]{40}/.test(l)) { commit = l.slice(7, 47); n++; continue; }
    if (l.startsWith("diff --git ")) { file = l.split(" b/").pop(); skip = SKIP.test(file); continue; }
    if (l.startsWith("@@")) { const m = /\+(\d+)/.exec(l); ln = m ? +m[1] - 1 : 0; continue; }
    if (l.startsWith("+++") || l.startsWith("---")) continue;
    if (l.startsWith("+")) {
      ln++;
      if (!skip) scanLine(l.slice(1), { file, line: ln, source: `historique ${commit.slice(0, 7)}`, commit });
    } else if (!l.startsWith("-")) ln++;
  }
  console.log(`[scan-secrets] commits scanned (history ${ref ?? "all refs"}): ${n}`);
}
if (doHistory) await scanHistory();

if (allowed.length) console.log(`[scan-secrets] ${allowed.length} history detection(s) exempted by scripts/scan-secrets.allowlist.json (reviewed dummy values, see docs/SECURITE.md 2.1).`);
if (findings.length === 0) {
  console.log("[scan-secrets] OK: no secret detected.");
  process.exit(0);
}
console.error(`[scan-secrets] FAILURE: ${findings.length} detection(s) (values masked).`);
for (const f of findings) console.error(` - ${f.type} | ${f.file}:${f.line} | ${f.source ?? ""} | ${f.masked}`);
process.exit(1);
