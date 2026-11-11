// Contrôles DÉTERMINISTES par métier (L16), appliqués avant tout juge IA : un échec ici = rejet, sans appel de modèle.
import { BRANDS_TO_AVOID, LEGAL_DISCLAIMER, type Deliverable, type Task } from "../shared/index.ts";

export interface CheckResult {
  ok: boolean;
  /** Raisons d'échec (vide si ok). */
  failures: string[];
  /** Constats informatifs (ex. nombre de chiffres retrouvés). */
  notes: string[];
}

const MERMAID_START = /^(flowchart|graph|c4context|c4container|c4component|c4dynamic|c4deployment|sequencediagram|classdiagram|statediagram(?:-v2)?|erdiagram|journey|gantt|mindmap|timeline)\b/i;
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const lower = (s: string) => norm(s).toLowerCase();

// ---------- logo ----------
export function findBrand(text: string): string | undefined {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9à-ÿ-]+/g, " ")} `;
  return BRANDS_TO_AVOID.find((b) => t.includes(` ${b.replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim()} `));
}

function checkLogo(d: Deliverable, f: string[], n: string[]): void {
  const svgs = d.files.filter((x) => x.name.startsWith("logo-"));
  if (svgs.length !== 3) f.push(`3 logos attendus, ${svgs.length} fournis`);
  for (const s of svgs) {
    if (!/viewBox\s*=\s*["']\s*0\s+0\s+256\s+256\s*["']/i.test(s.content)) f.push(`${s.name} : viewBox 0 0 256 256 absent`);
    if (s.content.length > 20_000) f.push(`${s.name} : trop gros`);
    if (!/<(rect|circle|ellipse|path|polygon|polyline|line|text|g)\b/i.test(s.content)) f.push(`${s.name} : aucune forme dessinée`);
    const brand = findBrand(s.content);
    if (brand) f.push(`${s.name} : contient le nom d'une marque connue (« ${brand} »), le logo doit être original`);
  }
  if (new Set(svgs.map((s) => s.content.replace(/\s+/g, ""))).size < svgs.length) f.push("deux logos (ou plus) sont identiques");
  n.push(`${svgs.length} SVG, ${svgs.reduce((a, s) => a + s.content.length, 0)} caractères`);
}

// ---------- architecture ----------
export function mermaidSyntaxProblem(src: string): string | undefined {
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("%%"));
  if (lines.length < 3) return "schéma Mermaid trop court (3 lignes minimum)";
  if (!MERMAID_START.test(lines[0]!)) return `schéma Mermaid : première ligne invalide (« ${lines[0]!.slice(0, 30)} »)`;
  for (const [open, close] of [["[", "]"], ["(", ")"], ["{", "}"]] as const) {
    const o = src.split(open).length - 1;
    const c = src.split(close).length - 1;
    if (o !== c) return `schéma Mermaid : ${open}${close} non appariés`;
  }
  if (/^(flowchart|graph)/i.test(lines[0]!) && !lines.slice(1).some((l) => /-->|---|==>|-\.->|-\.-/.test(l))) return "flowchart sans aucune liaison";
  return undefined;
}

function checkArchitecture(d: Deliverable, f: string[], n: string[]): void {
  const md = d.files.find((x) => x.name === "architecture.md");
  const mmd = d.files.find((x) => x.name === "schema.mmd");
  if (!md || !mmd) return void f.push("architecture.md et schema.mmd requis");
  const problem = mermaidSyntaxProblem(mmd.content);
  if (problem) f.push(problem);
  const prose = md.content.replace(/```[\s\S]*?```/g, "").trim();
  if (prose.length < 200) f.push(`document trop court (${prose.length} caractères hors schéma, 200 minimum)`);
  n.push(`schéma de ${mmd.content.split("\n").length} lignes, ${prose.length} caractères de texte`);
}

// ---------- legal ----------
function checkLegal(d: Deliverable, f: string[], n: string[]): void {
  const t = norm(d.rawText.replace(/[*_>#`]/g, ""));
  const disc = norm(LEGAL_DISCLAIMER);
  if (!t.startsWith(disc)) f.push(`l'avertissement « ${LEGAL_DISCLAIMER} » doit ouvrir le document`);
  if (!t.endsWith(disc)) f.push(`l'avertissement « ${LEGAL_DISCLAIMER} » doit clore le document`);
  const items = (d.rawText.match(/^\s*[-*]\s*\[[ xX]?\]/gm) ?? []).length;
  if (items < 3) f.push(`checklist : au moins 3 cases à cocher (- [ ]) attendues, ${items} trouvée(s)`);
  n.push(`${items} cases à cocher`);
}

// ---------- marketing ----------
export const MARKETING_MIN_CHARS = 150;
function checkMarketing(d: Deliverable, f: string[], n: string[]): void {
  const len = d.rawText.trim().length;
  if (len < MARKETING_MIN_CHARS) f.push(`texte trop court (${len} < ${MARKETING_MIN_CHARS} caractères)`);
  n.push(`${len} caractères`);
}

// ---------- translation ----------
function sourceSegments(prompt: string): string[] {
  const quoted = [...prompt.matchAll(/«\s*([\s\S]+?)\s*»|"([^"]{20,})"|“([^”]{20,})”/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
  const segs = quoted.filter((s) => s.length >= 20);
  if (segs.length) return segs;
  const afterColon = /:\s*([\s\S]{20,})$/.exec(prompt.trim());
  return afterColon ? [afterColon[1]!] : [];
}
/** Partie « traduction » d'un résultat : avant la ligne `---` ou `Note :`. */
export function translationBody(text: string): string {
  const m = /\r?\n\s*(?:---+|\*\*?note\s*:?\*?\*?|note\s*:)/i.exec(text);
  return (m ? text.slice(0, m.index) : text).trim();
}
function checkTranslation(d: Deliverable, task: Pick<Task, "prompt">, f: string[], n: string[]): void {
  const body = translationBody(d.rawText);
  if (body.length < 5) return void f.push("traduction vide");
  const segs = sourceSegments(task.prompt);
  const src = segs.join(" ");
  if (!src) return void n.push("texte source non identifiable, contrôle de longueur ignoré");
  const ratio = body.length / src.length;
  if (ratio < 0.4 || ratio > 2.5) f.push(`rapport de longueur implausible (${ratio.toFixed(2)}, attendu entre 0,4 et 2,5)`);
  const nb = lower(body);
  for (const s of segs) if (nb.includes(lower(s))) f.push("le texte source est recopié tel quel au lieu d'être traduit");
  n.push(`rapport de longueur ${ratio.toFixed(2)}`);
}

// ---------- finance ----------
const NUM = /-?\d{1,3}(?:[   .,]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g;
export function parseNumber(raw: string): number {
  let s = raw.replace(/[   ]/g, "");
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  if (dots && commas) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (commas > 1 || (commas === 1 && /,\d{3}$/.test(s) && !/^-?0,/.test(s))) s = s.replace(/,/g, "");
  else if (commas === 1) s = s.replace(",", ".");
  else if (dots > 1) s = s.replace(/\./g, "");
  return Number(s);
}
export function numbersIn(text: string): number[] {
  return (text.match(NUM) ?? []).map(parseNumber).filter(Number.isFinite);
}

/** Colonnes numériques d'un tableau Markdown de la commande (une liste de séries par colonne). */
export function tableColumns(prompt: string): number[][] {
  const rows = prompt.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|?$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const body = rows.slice(1); // 1re ligne = en-têtes
  const width = Math.max(0, ...body.map((r) => r.length));
  const cols: number[][] = [];
  for (let c = 0; c < width; c++) {
    const vals = body.map((r) => r[c] ?? "");
    if (vals.every((v) => /^-?[\d\s .,]+\s*\S{0,4}$/.test(v) && /\d/.test(v))) cols.push(vals.map((v) => numbersIn(v)[0]!));
  }
  return cols;
}

/** Totaux que l'on peut recalculer à partir des données : sommes de plages contiguës de chaque colonne et de leurs différences, ligne à ligne. */
export function computableTotals(prompt: string): number[] {
  const cols = tableColumns(prompt);
  const series: number[][] = [...cols];
  for (let i = 0; i < cols.length; i++) for (let j = 0; j < cols.length; j++) if (i !== j) series.push(cols[i]!.map((v, k) => v - cols[j]![k]!));
  const out = new Set<number>();
  for (const s of series) for (let a = 0; a < s.length; a++) { let acc = 0; for (let b = a; b < s.length; b++) { acc += s[b]!; out.add(Math.round(acc * 100) / 100); } }
  if (cols.length > 1) for (let k = 0; k < cols[0]!.length; k++) out.add(Math.round(cols.reduce((a, c) => a + c[k]!, 0) * 100) / 100);
  const all = numbersIn(prompt);
  out.add(Math.round(all.reduce((a, v) => a + v, 0) * 100) / 100);
  return [...out];
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);

function checkFinance(d: Deliverable, task: Pick<Task, "prompt">, f: string[], n: string[]): void {
  const cols = tableColumns(task.prompt);
  const provided = cols.length ? cols.flat() : numbersIn(task.prompt).filter((v) => Math.abs(v) >= 10);
  const have = new Set(numbersIn(d.rawText).map((v) => Math.round(v * 100) / 100));
  if (provided.length) {
    const found = provided.filter((v) => have.has(Math.round(v * 100) / 100)).length;
    const share = found / provided.length;
    n.push(`${found}/${provided.length} chiffres fournis retrouvés`);
    if (share < 0.6) f.push(`les chiffres fournis ne sont pas repris (${found}/${provided.length} retrouvés, 60 % minimum)`);
  } else n.push("aucun chiffre dans la commande : contrôle de reprise ignoré");
  const totals = computableTotals(task.prompt);
  if (totals.length) {
    for (const line of d.rawText.split(/\r?\n/)) {
      const m = /\btotal\b[^\n=:]*?[=:]\s*\**\s*(-?[\d\s .,]*\d)/i.exec(line);
      if (!m) continue;
      const v = parseNumber(m[1]!);
      if (Number.isFinite(v) && !totals.some((t) => close(t, v))) f.push(`total annoncé non recalculable à partir des données : « ${line.trim().slice(0, 80)} »`);
    }
  }
  if (d.rawText.trim().length < 200) f.push("analyse trop courte (200 caractères minimum)");
}

/** Exécute les contrôles déterministes du métier de la tâche sur un livrable déjà extrait. */
export function runChecks(task: Pick<Task, "profession" | "prompt">, d: Deliverable): CheckResult {
  const failures: string[] = [];
  const notes: string[] = [];
  switch (task.profession) {
    case "logo": checkLogo(d, failures, notes); break;
    case "architecture": checkArchitecture(d, failures, notes); break;
    case "legal": checkLegal(d, failures, notes); break;
    case "marketing": checkMarketing(d, failures, notes); break;
    case "translation": checkTranslation(d, task, failures, notes); break;
    case "finance": checkFinance(d, task, failures, notes); break;
  }
  return { ok: failures.length === 0, failures, notes };
}
