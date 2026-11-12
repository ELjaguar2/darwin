// Métiers, icônes et avatars (interface L17). Données d'affichage uniquement, aucune logique métier.
// Les 6 métiers du catalogue (L16) + les 5 métiers « historiques » des runs réels antérieurs (writer, analyst, coder, summarizer, translator),
// pour que le rejeu d'un ancien journal reste lisible. Un métier inconnu retombe sur un style neutre.
import { h } from "./format.js";

const NS = "http://www.w3.org/2000/svg";

// Tracés d'icônes (viewBox 24, trait). Chaque valeur est un tableau de chemins.
const ICON = {
  logo: ["M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6z"],
  finance: ["M4 20V11", "M10 20V4", "M16 20v-6", "M2 20h20"],
  architecture: ["M3 3h7v7H3z", "M14 14h7v7h-7z", "M14 3h7v4h-7z", "M10 6.5h4", "M6.5 10v8h7.5"],
  marketing: ["M3 10v4l11 5V5z", "M17 8.5c2 1 3 2.2 3 3.5s-1 2.5-3 3.5", "M6 14.5l1.5 5"],
  translation: ["M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z", "M3 12h18", "M12 3c3 3 3 15 0 18", "M12 3c-3 3-3 15 0 18"],
  legal: ["M12 3v17", "M5 7h14", "M5 7l-3 7a3 3 0 0 0 6 0z", "M19 7l-3 7a3 3 0 0 0 6 0z", "M8 21h8"],
  coder: ["M8 7l-5 5 5 5", "M16 7l5 5-5 5", "M14 4l-4 16"],
  summarizer: ["M4 6h16", "M4 12h11", "M4 18h7"],
  writer: ["M4 20l1-4L16 5l3 3L8 19z", "M14 7l3 3"],
  analyst: ["M4 20V11", "M10 20V4", "M16 20v-6", "M2 20h20"],
  translator: ["M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z", "M3 12h18", "M12 3c3 3 3 15 0 18", "M12 3c-3 3-3 15 0 18"],
  unknown: ["M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7", "M12 17h.01"],
};

// Couleur (variable CSS --p-<clé>) et libellé court par métier. Les métiers historiques empruntent la teinte d'un métier proche.
const JOB = {
  logo: { label: "Logo", tone: "logo" },
  finance: { label: "Analyse financière", tone: "finance" },
  architecture: { label: "Architecture", tone: "architecture" },
  marketing: { label: "Rédaction marketing", tone: "marketing" },
  translation: { label: "Traduction", tone: "translation" },
  legal: { label: "Checklist juridique", tone: "legal" },
  writer: { label: "Rédaction", tone: "marketing" },
  analyst: { label: "Analyse", tone: "finance" },
  coder: { label: "Code", tone: "architecture" },
  summarizer: { label: "Résumé", tone: "legal" },
  translator: { label: "Traduction", tone: "translation" },
};

/** Style d'un métier : {id, label, cls (classe de teinte j-xxx), icon (clé)}. */
export function jobOf(p) {
  const j = JOB[p];
  return j ? { id: p, label: j.label, cls: `j-${j.tone}`, icon: p } : { id: String(p ?? "?"), label: String(p ?? "métier inconnu"), cls: "j-unknown", icon: "unknown" };
}

/** Icône SVG (nœud DOM, jamais de chaîne HTML). */
export function icon(key, size = 16) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "ico");
  for (const d of ICON[key] ?? ICON.unknown) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

/** Prénom affiché : « Iris-214953 » devient « Iris ». */
export const firstName = (a) => String(a?.name ?? a?.id ?? "?").replace(/[-\s]\d+$/, "");

/** Teinte déterminée par le génome : deux agents au génome proche se ressemblent, une mutation décale la couleur. */
export function genomeHue(g) {
  const x = (v, lo, hi) => (Number.isFinite(Number(v)) ? (Number(v) - lo) / (hi - lo) : 0.5);
  const raw = x(g?.risk, 0, 1) * 200 + x(g?.cooperation, 0, 1) * 110 + x(g?.generosity, 0, 0.6) * 80 + x(g?.askRatio, 0.3, 1) * 60 + 20;
  return Math.round(raw) % 360;
}

/** Avatar rond : dégradé selon le génome, initiale, badge du métier. `size` en px. */
export function avatar(a, size = 44) {
  const hue = genomeHue(a?.genome);
  const job = jobOf(a?.genome?.profession);
  const el = h("span", { class: `avatar ${a?.status === "dead" ? "dead" : ""}`, "aria-hidden": "true" },
    h("span", { class: "av-letter" }, firstName(a).slice(0, 1).toUpperCase()),
    h("span", { class: `av-badge ${job.cls}` }, icon(job.icon, Math.round(size * 0.3))));
  el.style.width = el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size * 0.46)}px`;
  el.style.background = `linear-gradient(145deg, hsl(${hue} 78% 62%), hsl(${(hue + 48) % 360} 70% 40%))`;
  return el;
}
