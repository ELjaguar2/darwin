// Utilitaires purs (aucun accès au DOM sauf `h`). Jamais d'innerHTML : tout texte passe par textContent.
const YOCTO = 10n ** 24n;

/** yoctoNEAR (chaîne ou bigint) -> nombre de NEAR lisible. */
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

/** Montant en NEAR sous forme de nombre (pour dimensionner des éléments graphiques uniquement). */
export function nearNumber(y) {
  try { return Number(BigInt(y ?? 0) / (YOCTO / 1000000n)) / 1e6; } catch { return 0; }
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
 * URL d'explorateur d'une transaction. Priorité à l'URL fournie par le backend ; sinon, en chaîne `near`,
 * `${base}/txns/<hash>` (même format que accounts/near-chain.ts). Aucun lien pour les hashes mock ou locaux.
 */
export function explorerUrl(hash, { explicit, chainKind, base } = {}) {
  if (explicit && /^https:\/\//.test(explicit)) return explicit;
  if (!hash || chainKind !== "near") return null;
  if (/^(mock_|local_)/.test(hash)) return null;
  return `${(base || TESTNET_EXPLORER).replace(/\/$/, "")}/txns/${encodeURIComponent(hash)}`;
}

export const PROFESSIONS = {
  writer: { label: "Rédacteur", glyph: "R", cls: "p-writer" },
  translator: { label: "Traducteur", glyph: "T", cls: "p-translator" },
  summarizer: { label: "Synthèse", glyph: "S", cls: "p-summarizer" },
  analyst: { label: "Analyste", glyph: "A", cls: "p-analyst" },
  coder: { label: "Codeur", glyph: "C", cls: "p-coder" },
};
export const profOf = (p) => PROFESSIONS[p] ?? { label: String(p ?? "?"), glyph: "?", cls: "p-writer" };

const TX_KIND = {
  create_account: "Naissance (compte créé)", transfer: "Transfert", lock_escrow: "Séquestre verrouillé",
  release_escrow: "Séquestre libéré", refund_escrow: "Séquestre remboursé", delete_account: "Mort (solde récupéré)",
  register_agent: "Registre : agent", mark_dead: "Registre : mort", add_reputation: "Réputation",
};
export const txKindLabel = (k) => TX_KIND[k] ?? String(k ?? "transaction");

export function requesterBadge(r, serverBadge) {
  if (serverBadge && r?.kind) return { ...requesterBadge(r), text: serverBadge }; // libellé normalisé fourni par le backend
  if (!r) return { text: "?", cls: "b-neutral" };
  if (r.kind === "simulated") return { text: "simulé", title: "Client artificiel : ces tâches ne viennent pas d'un humain.", cls: "b-sim" };
  if (r.kind === "visitor") return { text: "Visiteur (financé par le compte de démo)", title: "Le visiteur ne paie pas : le compte de démonstration finance la tâche.", cls: "b-visitor" };
  return { text: "sous-traitance", title: "Tâche confiée par un agent à un autre.", cls: "b-agent" };
}

export const STATUS_LABEL = { posted: "enchères", awarded: "attribuée", submitted: "remise", settled: "payée", rejected: "rejetée", expired: "expirée" };

/** Petit constructeur DOM sûr. h("div", {class:"x", onclick}, "texte", enfant...) */
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

/** Message lisible depuis un corps d'erreur HTTP de forme inconnue (zod issues, {message}, {error}, …). */
export function errorMessages(body) {
  const out = [];
  const walk = (b) => {
    if (!b) return;
    if (typeof b === "string") { out.push(b); return; }
    if (Array.isArray(b)) { b.forEach(walk); return; }
    if (typeof b === "object") {
      if (b.message && typeof b.message === "string") {
        const p = Array.isArray(b.path) && b.path.length ? b.path.join(".") + " : " : "";
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
