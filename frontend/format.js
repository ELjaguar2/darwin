// Pure utilities (no DOM access except `h`). Never innerHTML: all text goes through textContent.
const YOCTO = 10n ** 24n;

/** Tolerant BigInt: a non-numeric value gives 0n instead of throwing. */
export function big(v) { try { return BigInt(v ?? 0); } catch { return 0n; } }

const EXPLORER_HOSTS = new Set(["testnet.nearblocks.io", "nearblocks.io"]);
function allowedExplorerUrl(u) {
  try { const x = new URL(u); return x.protocol === "https:" && EXPLORER_HOSTS.has(x.hostname) && !x.username && !x.password ? x.href : null; } catch { return null; }
}

/** yoctoNEAR (string or bigint) -> readable NEAR number. */
export function formatNear(y, digits = 2) {
  let v;
  try { v = BigInt(y ?? 0); } catch { return "?"; }
  const neg = v < 0n;
  if (neg) v = -v;
  const scale = 10n ** BigInt(digits);
  const q = (v * scale + YOCTO / 2n) / YOCTO;
  const int = q / scale;
  const frac = (q % scale).toString().padStart(digits, "0");
  return (neg ? "-" : "") + int.toString() + (digits ? "." + frac : "");
}

/** Amount in NEAR as a number (only for sizing graphic elements). */
export function nearNumber(y) {
  try { return Number(BigInt(y ?? 0) / (YOCTO / 1000000n)) / 1e6; } catch { return 0; }
}

/** Small amount (AI brain cost): never a misleading "0.00". 2 decimals from 0.01 NEAR, 4 below, "< 0.0001" under the threshold, "0" if zero. */
export function formatNearSmall(y) {
  let v;
  try { v = BigInt(y ?? 0); } catch { return "?"; }
  const a = v < 0n ? -v : v;
  if (a === 0n) return "0";
  if (a < YOCTO / 10000n) return (v < 0n ? "-" : "") + "< 0.0001";
  return formatNear(v, a < YOCTO / 100n ? 4 : 2);
}

export function signedNear(y, digits = 2) {
  const s = formatNear(y, digits);
  return s.startsWith("-") ? s : "+" + s;
}

export function shortHash(h) {
  if (!h) return "";
  return h.length > 16 ? h.slice(0, 8) + "…" + h.slice(-6) : h;
}

export const TESTNET_EXPLORER = "https://testnet.nearblocks.io";

/**
 * Explorer URL of a transaction. The backend-provided URL has priority; otherwise, on the `near` chain,
 * `${base}/txns/<hash>` (same format as accounts/near-chain.ts). No link for mock or local hashes.
 */
export function explorerUrl(hash, { explicit, chainKind, base } = {}) {
  const ok = explicit ? allowedExplorerUrl(explicit) : null; // Event URL outside the allowlist: ignored, rebuilt from the hash
  if (ok) return ok;
  if (!hash || chainKind !== "near") return null;
  if (/^(mock_|local_)/.test(hash)) return null;
  return `${(base || TESTNET_EXPLORER).replace(/\/$/, "")}/txns/${encodeURIComponent(hash)}`;
}

export const PROFESSIONS = {
  logo: { label: "Logo", glyph: "L", cls: "p-logo" },
  finance: { label: "Financial analysis", glyph: "F", cls: "p-finance" },
  architecture: { label: "Software architecture", glyph: "A", cls: "p-architecture" },
  marketing: { label: "Marketing copywriting", glyph: "M", cls: "p-marketing" },
  translation: { label: "Translation", glyph: "T", cls: "p-translation" },
  legal: { label: "Legal checklist", glyph: "J", cls: "p-legal" },
};
export const PROFESSION_IDS = Object.keys(PROFESSIONS);
/** Unknown profession (unexpected value): raw label, neutral color. */
export const profOf = (p) => PROFESSIONS[p] ?? { label: String(p ?? "?"), glyph: "?", cls: "p-unknown" };

/** Decimal NEAR amount ("0.045") -> yocto (BigInt); null if invalid. Exact computation, no floats. */
export function parseNearToYocto(str) {
  const m = /^(\d+)(?:\.(\d{1,24}))?$/.exec(String(str ?? "").trim());
  if (!m) return null;
  return BigInt(m[1]) * YOCTO + BigInt((m[2] ?? "").padEnd(24, "0"));
}
/** yocto -> decimal NEAR without useless zeros (6 decimals max), e.g. "0.045". */
export function nearInput(y) {
  const s = formatNear(y, 6);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
/** AI cost in USD (very small): "$0.0012". */
export function usd(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "?";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 0.01 ? 5 : 3 });
}
/** Demand multiplier: 3 -> "×3", 0.3 -> "×0.3". */
export const multLabel = (m) => "×" + Number(m).toLocaleString("en-US", { maximumFractionDigits: 2 });

const TX_KIND = {
  create_account: "Birth (account created)", transfer: "Transfer", lock_escrow: "Escrow locked",
  release_escrow: "Escrow released", refund_escrow: "Escrow refunded", delete_account: "Death (balance recovered)",
  register_agent: "Registry: agent", mark_dead: "Registry: death", add_reputation: "Reputation",
};
export const txKindLabel = (k) => TX_KIND[k] ?? String(k ?? "transaction");

/** Protocol badge values (English since L19; legacy French values kept for old flows) -> display labels; fallback to the raw value. */
export const BADGE_LABEL = { "simulated": "simulated", "subcontracting": "subcontract", "Visitor (funded by the demo account)": "Visitor (funded by the demo account)", "simulé": "simulated", "simule": "simulated", "sous-traitance": "subcontract", "visiteur": "visitor", "Visiteur": "visitor", "Visiteur (financé par le compte de démo)": "Visitor (funded by the demo account)" };
export const badgeText = (b) => BADGE_LABEL[b] ?? String(b ?? "?");

export function requesterBadge(r, serverBadge) {
  if (serverBadge && r?.kind) return { ...requesterBadge(r), text: badgeText(serverBadge) }; // normalized label provided by the backend
  if (!r) return { text: "?", cls: "b-neutral" };
  if (r.kind === "simulated") return { text: "simulated", title: "Artificial client: these tasks do not come from a human.", cls: "b-sim" };
  if (r.kind === "visitor") return { text: "Visitor (funded by the demo account)", title: "The visitor does not pay: the demo account funds the task.", cls: "b-visitor" };
  return { text: "subcontract", title: "Task handed from one agent to another.", cls: "b-agent" };
}

export const STATUS_LABEL = { posted: "bidding", awarded: "awarded", submitted: "delivered", settled: "paid", rejected: "refunded", expired: "expired" };

/** Small safe DOM builder. h("div", {class:"x", onclick}, "text", child...) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "css") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Readable message from an HTTP error body of unknown shape (zod issues, {message}, {error}, ...). */
export function errorMessages(body) {
  const out = [];
  const walk = (b) => {
    if (!b) return;
    if (typeof b === "string") { out.push(b); return; }
    if (Array.isArray(b)) { b.forEach(walk); return; }
    if (typeof b === "object") {
      if (b.message && typeof b.message === "string") {
        const p = Array.isArray(b.path) && b.path.length ? b.path.join(".") + ": " : "";
        out.push(p + b.message);
      }
      for (const k of ["issues", "errors", "details"]) if (b[k]) walk(b[k]);
      if (!out.length && typeof b.error === "string") out.push(b.error);
      if (b.error && typeof b.error === "object") walk(b.error);
    }
  };
  walk(body);
  return [...new Set(out)];
}
