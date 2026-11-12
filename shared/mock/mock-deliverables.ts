// Fake BUT valid deliverables, in the right format for each profession, so that everything runs without a key (mock mode).
// Depends only on shared/: do not import market/. Texts are deterministic (a function of the order). L19: all texts are English.
import { LEGAL_DISCLAIMER } from "../catalogue.ts";
import type { Profession } from "../types.ts";

const clean = (s: string, max = 40) => s.replace(/[^\p{L}\p{N} '-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);

function companyOf(task: string): string {
  // "Company:" is the L19 template field; the French labels are kept as a fallback for old orders. The backslash stops the match
  // inside a JSON-encoded order (the order reaches the brain as JSON, so a line break appears as "\n").
  const m = /(?:Company|Entreprise|Nom de l'entreprise|Nom)\s*:\s*([^\n\\.,;]+)/i.exec(task);
  return clean(m?.[1] ?? "Atelier Mock", 24) || "Atelier Mock";
}

function logos(task: string): string {
  const name = companyOf(task);
  const ini = (name[0] ?? "A").toUpperCase();
  const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">';
  const a = `${head}<rect width="256" height="256" fill="#f4efe6"/><circle cx="128" cy="108" r="64" fill="#2a6f6b"/><text x="128" y="128" font-size="64" font-family="sans-serif" text-anchor="middle" fill="#ffffff">${ini}</text><text x="128" y="216" font-size="20" font-family="sans-serif" text-anchor="middle" fill="#2a6f6b">${name}</text></svg>`;
  const b = `${head}<rect width="256" height="256" fill="#ffffff"/><polygon points="128,28 220,184 36,184" fill="#c8553d"/><rect x="88" y="196" width="80" height="14" fill="#2b2b2b"/><text x="128" y="238" font-size="16" font-family="serif" text-anchor="middle" fill="#2b2b2b">${name}</text></svg>`;
  const c = `${head}<rect width="256" height="256" fill="#1d2b44"/><path d="M40 190 Q128 20 216 190 Z" fill="none" stroke="#f2b134" stroke-width="12"/><circle cx="128" cy="150" r="18" fill="#f2b134"/><text x="128" y="232" font-size="18" font-family="monospace" text-anchor="middle" fill="#ffffff">${name}</text></svg>`;
  return [
    "Proposal 1: a circle and the initial, sober.", "```svg", a, "```",
    "Proposal 2: a dynamic triangle.", "```svg", b, "```",
    "Proposal 3: a glowing arch.", "```svg", c, "```",
  ].join("\n");
}

function finance(task: string): string {
  const rows = task.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|?$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  if (rows.length < 2) return "# Analysis\n\nNo table of figures is provided in the order: no numerical analysis is possible without inventing data, which I refuse to do. Please provide the figures to analyse (revenue, costs, periods).\n\n## Limits\n\nAnalysis impossible without data.";
  const head = rows[0]!;
  const body = rows.slice(1);
  const nums = (c: number) => body.map((r) => Number((r[c] ?? "").replace(/[^\d.-]/g, "")));
  const numericCols = head.map((_, c) => c).filter((c) => body.every((r) => /^-?\d+(\.\d+)?/.test((r[c] ?? "").replace(/\s/g, ""))));
  const out = ["# Financial analysis", "", "## 1. Data restated", "", `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`), "", "## 2. Calculations", ""];
  const sums: Record<number, number> = {};
  for (const c of numericCols) {
    const v = nums(c);
    sums[c] = Math.round(v.reduce((a, x) => a + x, 0) * 100) / 100;
    out.push(`- ${head[c]}: ${v.join(" + ")} = ${sums[c]}`, `Total ${head[c]} = ${sums[c]}`);
  }
  if (numericCols.length >= 2) {
    const [x, y] = numericCols as [number, number];
    out.push(`- Difference (${head[x]} - ${head[y]}): ${sums[x]} - ${sums[y]} = ${Math.round(((sums[x] ?? 0) - (sums[y] ?? 0)) * 100) / 100}`);
  }
  out.push("", "## 3. Reading of the results", "", "The totals above are computed only from the provided figures. The difference between the first two columns gives the result of the period.", "", "## 4. Limits", "", "Analysis limited to the provided figures: no growth assumption, no external data, no known seasonality.");
  return out.join("\n");
}

const ARCH = [
  "# Proposed architecture", "", "## Context", "", "The described need calls for a simple, reliable and cheap-to-run service. I choose a three-layer architecture: a web client, an API and a database, with a task queue for long-running jobs.", "",
  "## Components and flows", "", "The client calls the API; the API writes to the database and drops long-running jobs into a queue; a worker consumes them and updates the database.", "",
  "```mermaid", "flowchart TD", "  Client[Web client] --> API[HTTP API]", "  API --> DB[(Database)]", "  API --> Queue[Task queue]", "  Queue --> Worker[Worker]", "  Worker --> DB", "```", "",
  "## Choices and trade-offs", "", "A modular monolith is preferred over microservices: lower operating cost, single deployment. Trade-off: scaling is vertical first.", "", "## Risks", "", "Single point of failure on the database: plan daily backups and a read replica.",
].join("\n");

const MARKETING = "## A little boost, every day\n\nYour daily life deserves simple, well-thought-out products built to last. We design them with care, test them with real customers and improve them with every piece of feedback.\n\n**Try it today** and tell us what you think: we read every message.";

const EN = [
  "Thank you for your patience, your order will be shipped within two business days.",
  "Please restart the application after installing the update so that the changes take effect.",
  "Our team is available from Monday to Friday to answer all of your questions.",
];
const FR = [
  "Merci de votre patience, votre commande sera expédiée sous deux jours ouvrés.",
  "Veuillez redémarrer l'application après l'installation de la mise à jour afin que les changements prennent effet.",
  "Notre équipe est disponible du lundi au vendredi pour répondre à toutes vos questions.",
];

function translation(task: string): string {
  const q = /«\s*([\s\S]+?)\s*»/.exec(task);
  const src = q?.[1] ?? "";
  // The default target is English (L19); French only when the order explicitly asks for it.
  const toFrench = /\b(?:into|to|en)\s+(?:french|fran[cç]ais)\b/i.test(task.split(/«/)[0] ?? task);
  const pool = toFrench ? FR : EN;
  let body = "";
  for (let i = 0; body.length < src.length * 0.8 || i === 0; i++) body += (body ? " " : "") + pool[i % pool.length]!;
  while (src && body.length > src.length * 1.6 && body.includes(" ")) body = body.slice(0, body.lastIndexOf(" "));
  return `${body}\n\n---\nNote: fake translation produced in mock mode; the general meaning is preserved.`;
}

const LEGAL = [
  LEGAL_DISCLAIMER, "", "## Registration and status", "- [ ] Check the legal status suited to the activity (sole proprietorship, company).", "- [ ] Make sure the business is registered with the one-stop shop.", "",
  "## Contracts and conditions", "- [ ] Write general terms of sale or service.", "- [ ] Plan a written contract for each important customer.", "",
  "## Personal data", "- [ ] List the data collected and how long it is kept.", "- [ ] Display a privacy policy and legal notices.", "",
  "For complex cases, consult a legal professional.", "", LEGAL_DISCLAIMER,
].join("\n");

export function mockDeliverable(profession: Profession, taskText: string): string {
  switch (profession) {
    case "logo": return logos(taskText);
    case "finance": return finance(taskText);
    case "architecture": return ARCH;
    case "marketing": return MARKETING;
    case "translation": return translation(taskText);
    case "legal": return LEGAL;
  }
}
