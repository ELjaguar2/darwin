// Livrables factices MAIS valides, au bon format de chaque métier, pour que tout tourne sans clé (mode mock).
// Dépend uniquement de shared/ : ne pas importer market/. Les textes sont déterministes (fonction de la commande).
import { LEGAL_DISCLAIMER } from "../catalogue.ts";
import type { Profession } from "../types.ts";

const clean = (s: string, max = 40) => s.replace(/[^\p{L}\p{N} '-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);

function companyOf(task: string): string {
  const m = /(?:Entreprise|Nom de l'entreprise|Nom)\s*:\s*([^\n.,;]+)/i.exec(task);
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
    "Proposition 1 : un cercle et l'initiale, sobre.", "```svg", a, "```",
    "Proposition 2 : un triangle dynamique.", "```svg", b, "```",
    "Proposition 3 : une arche lumineuse.", "```svg", c, "```",
  ].join("\n");
}

function finance(task: string): string {
  const rows = task.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|?$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  if (rows.length < 2) return "# Analyse\n\nAucun tableau de chiffres n'est fourni dans la commande : aucune analyse chiffrée n'est possible sans inventer des données, ce que je refuse de faire. Merci de fournir les chiffres à analyser (revenus, charges, périodes).\n\n## Limites\n\nAnalyse impossible sans données.";
  const head = rows[0]!;
  const body = rows.slice(1);
  const nums = (c: number) => body.map((r) => Number((r[c] ?? "").replace(/[^\d.-]/g, "")));
  const numericCols = head.map((_, c) => c).filter((c) => body.every((r) => /^-?\d+(\.\d+)?/.test((r[c] ?? "").replace(/\s/g, ""))));
  const out = ["# Analyse financière", "", "## 1. Données reprises", "", `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`), "", "## 2. Calculs", ""];
  const sums: Record<number, number> = {};
  for (const c of numericCols) {
    const v = nums(c);
    sums[c] = Math.round(v.reduce((a, x) => a + x, 0) * 100) / 100;
    out.push(`- ${head[c]} : ${v.join(" + ")} = ${sums[c]}`, `Total ${head[c]} = ${sums[c]}`);
  }
  if (numericCols.length >= 2) {
    const [x, y] = numericCols as [number, number];
    out.push(`- Écart (${head[x]} - ${head[y]}) : ${sums[x]} - ${sums[y]} = ${Math.round(((sums[x] ?? 0) - (sums[y] ?? 0)) * 100) / 100}`);
  }
  out.push("", "## 3. Lecture des résultats", "", "Les totaux ci-dessus sont calculés uniquement à partir des chiffres fournis. L'écart entre les deux premières colonnes donne le résultat de la période.", "", "## 4. Limites", "", "Analyse limitée aux chiffres fournis : aucune hypothèse de croissance, aucune donnée externe, pas de saisonnalité connue.");
  return out.join("\n");
}

const ARCH = [
  "# Architecture proposée", "", "## Contexte", "", "Le besoin décrit demande un service simple, fiable et peu coûteux à exploiter. Je retiens une architecture en trois couches : un client web, une API et une base de données, avec une file de tâches pour les traitements longs.", "",
  "## Composants et flux", "", "Le client appelle l'API ; l'API écrit dans la base et dépose les traitements longs dans une file ; un worker les consomme et met à jour la base.", "",
  "```mermaid", "flowchart TD", "  Client[Client web] --> API[API HTTP]", "  API --> DB[(Base de donnees)]", "  API --> Queue[File de taches]", "  Queue --> Worker[Worker]", "  Worker --> DB", "```", "",
  "## Choix et compromis", "", "Un monolithe modulaire est préféré aux microservices : moins de coûts d'exploitation, déploiement unique. Compromis : la montée en charge se fait d'abord verticalement.", "", "## Risques", "", "Point unique de défaillance sur la base : prévoir des sauvegardes quotidiennes et une réplique de lecture.",
].join("\n");

const MARKETING = "## Un coup de pouce, chaque jour\n\nVotre quotidien mérite des produits simples, bien pensés et faits pour durer. Nous les concevons avec soin, les testons avec des clients réels et les améliorons à chaque retour.\n\n**Essayez-le dès aujourd'hui** et dites-nous ce que vous en pensez : nous lisons chaque message.";

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
  const toEnglish = /anglais|english/i.test(task.split(/«/)[0] ?? task);
  const pool = toEnglish ? EN : FR;
  let body = "";
  for (let i = 0; body.length < src.length * 0.8 || i === 0; i++) body += (body ? " " : "") + pool[i % pool.length]!;
  while (src && body.length > src.length * 1.6 && body.includes(" ")) body = body.slice(0, body.lastIndexOf(" "));
  return `${body}\n\n---\nNote : traduction fictive produite en mode mock ; le sens général est conservé.`;
}

const LEGAL = [
  LEGAL_DISCLAIMER, "", "## Immatriculation et statut", "- [ ] Vérifier le statut juridique adapté à l'activité (micro-entreprise, société).", "- [ ] S'assurer de l'immatriculation auprès du guichet unique.", "",
  "## Contrats et conditions", "- [ ] Rédiger des conditions générales de vente ou de service.", "- [ ] Prévoir un contrat écrit pour chaque client important.", "",
  "## Données personnelles", "- [ ] Lister les données collectées et leur durée de conservation.", "- [ ] Afficher une politique de confidentialité et des mentions légales.", "",
  "Pour les cas complexes, consulter un professionnel du droit.", "", LEGAL_DISCLAIMER,
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
