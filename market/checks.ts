// DETERMINISTIC checks per profession (L16), applied before any AI judge: a failure here = rejection, with no model call.
// L19: failure reasons and notes are readable English text (free text; stable codes live elsewhere, e.g. `rule:<profession>`).
import { BRANDS_TO_AVOID, LEGAL_DISCLAIMER, type Deliverable, type Task } from "../shared/index.ts";

export interface CheckResult {
  ok: boolean;
  /** Failure reasons (empty if ok). */
  failures: string[];
  /** Informational findings (e.g. number of figures found again). */
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
  if (svgs.length !== 3) f.push(`3 logos expected, ${svgs.length} provided`);
  for (const s of svgs) {
    if (!/viewBox\s*=\s*["']\s*0\s+0\s+256\s+256\s*["']/i.test(s.content)) f.push(`${s.name}: viewBox 0 0 256 256 missing`);
    if (s.content.length > 20_000) f.push(`${s.name}: too large`);
    if (!/<(rect|circle|ellipse|path|polygon|polyline|line|text|g)\b/i.test(s.content)) f.push(`${s.name}: no shape drawn`);
    const brand = findBrand(s.content);
    if (brand) f.push(`${s.name}: contains the name of a known brand ("${brand}"), the logo must be original`);
  }
  if (new Set(svgs.map((s) => s.content.replace(/\s+/g, ""))).size < svgs.length) f.push("two (or more) logos are identical");
  n.push(`${svgs.length} SVG, ${svgs.reduce((a, s) => a + s.content.length, 0)} characters`);
}

// ---------- architecture ----------
export function mermaidSyntaxProblem(src: string): string | undefined {
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("%%"));
  if (lines.length < 3) return "Mermaid diagram too short (3 lines minimum)";
  if (!MERMAID_START.test(lines[0]!)) return `Mermaid diagram: invalid first line ("${lines[0]!.slice(0, 30)}")`;
  for (const [open, close] of [["[", "]"], ["(", ")"], ["{", "}"]] as const) {
    const o = src.split(open).length - 1;
    const c = src.split(close).length - 1;
    if (o !== c) return `Mermaid diagram: unbalanced ${open}${close}`;
  }
  if (/^(flowchart|graph)/i.test(lines[0]!) && !lines.slice(1).some((l) => /-->|---|==>|-\.->|-\.-/.test(l))) return "flowchart without any link";
  return undefined;
}

function checkArchitecture(d: Deliverable, f: string[], n: string[]): void {
  const md = d.files.find((x) => x.name === "architecture.md");
  const mmd = d.files.find((x) => x.name === "schema.mmd");
  if (!md || !mmd) return void f.push("architecture.md and schema.mmd required");
  const problem = mermaidSyntaxProblem(mmd.content);
  if (problem) f.push(problem);
  const prose = md.content.replace(/```[\s\S]*?```/g, "").trim();
  if (prose.length < 200) f.push(`document too short (${prose.length} characters outside the diagram, 200 minimum)`);
  n.push(`${mmd.content.split("\n").length}-line diagram, ${prose.length} characters of text`);
}

// ---------- legal ----------
function checkLegal(d: Deliverable, f: string[], n: string[]): void {
  const t = norm(d.rawText.replace(/[*_>#`]/g, ""));
  const disc = norm(LEGAL_DISCLAIMER);
  if (!t.startsWith(disc)) f.push(`the disclaimer "${LEGAL_DISCLAIMER}" must open the document`);
  if (!t.endsWith(disc)) f.push(`the disclaimer "${LEGAL_DISCLAIMER}" must close the document`);
  const items = (d.rawText.match(/^\s*[-*]\s*\[[ xX]?\]/gm) ?? []).length;
  if (items < 3) f.push(`checklist: at least 3 checkboxes (- [ ]) expected, ${items} found`);
  n.push(`${items} checkboxes`);
}

// ---------- marketing ----------
export const MARKETING_MIN_CHARS = 150;
function checkMarketing(d: Deliverable, f: string[], n: string[]): void {
  const len = d.rawText.trim().length;
  if (len < MARKETING_MIN_CHARS) f.push(`text too short (${len} < ${MARKETING_MIN_CHARS} characters)`);
  n.push(`${len} characters`);
}

// ---------- translation ----------
function sourceSegments(prompt: string): string[] {
  const quoted = [...prompt.matchAll(/«\s*([\s\S]+?)\s*»|"([^"]{20,})"|“([^”]{20,})”/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
  const segs = quoted.filter((s) => s.length >= 20);
  if (segs.length) return segs;
  const afterColon = /:\s*([\s\S]{20,})$/.exec(prompt.trim());
  return afterColon ? [afterColon[1]!] : [];
}
/** "Translation" part of a result: before the `---` or `Note:` line. */
export function translationBody(text: string): string {
  const m = /\r?\n\s*(?:---+|\*\*?note\s*:?\*?\*?|note\s*:)/i.exec(text);
  return (m ? text.slice(0, m.index) : text).trim();
}
const STOP: Record<"en" | "fr", string[]> = {
  en: ["the", "and", "of", "to", "is", "in", "your", "you", "for", "will", "with", "that", "be", "are", "our", "this", "it", "on"],
  fr: ["le", "la", "les", "de", "des", "du", "et", "est", "un", "une", "votre", "vous", "pour", "que", "dans", "sur", "en", "nos", "ce"],
};
/** Languages other than English/French that a task may name explicitly: no stop-word check is possible for them. */
const OTHER_LANGUAGES = /\b(?:spanish|german|italian|portuguese|dutch|arabic|chinese|japanese|russian|korean|turkish|polish|espagnol|allemand|italien|portugais|n[ée]erlandais|arabe|chinois|japonais|russe)\b/i;
/**
 * Target language of a translation. The default target is ALWAYS English (L19), including for a task written in French
 * ("Traduis ce texte" without a language gives English). French is the target only when the order says so explicitly
 * ("into French", "en français"). Any other explicitly named language: no check (`undefined`).
 */
export function targetLanguage(prompt: string): "en" | "fr" | undefined {
  const head = prompt.split(/«/)[0] ?? prompt;
  if (/\b(en|into|to)\s+(anglais|english)\b/i.test(head)) return "en";
  if (/\b(en|into|to)\s+(fran[cç]ais|french)\b/i.test(head)) return "fr";
  if (OTHER_LANGUAGES.test(head)) return undefined;
  return "en";
}
function stopwordShare(text: string, lang: "en" | "fr"): number {
  const words = text.toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
  if (!words.length) return 0;
  const set = new Set(STOP[lang]);
  return words.filter((w) => set.has(w)).length / words.length;
}
function checkTranslation(d: Deliverable, task: Pick<Task, "prompt">, f: string[], n: string[]): void {
  const body = translationBody(d.rawText);
  if (body.length < 5) return void f.push("empty translation");
  const segs = sourceSegments(task.prompt);
  const src = segs.join(" ");
  if (!src) return void n.push("source text not identifiable, length check skipped");
  const ratio = body.length / src.length;
  if (ratio < 0.4 || ratio > 2.5) f.push(`implausible length ratio (${ratio.toFixed(2)}, expected between 0.4 and 2.5)`);
  const nb = lower(body);
  for (const s of segs) if (nb.includes(lower(s))) f.push("the source text is copied as is instead of being translated");
  n.push(`length ratio ${ratio.toFixed(2)}`);
  const lang = targetLanguage(task.prompt);
  if (lang) {
    const other = lang === "en" ? "fr" : "en";
    if (stopwordShare(body, lang) < 0.1 || stopwordShare(body, other) > stopwordShare(body, lang)) f.push(`the text does not seem to be in ${lang === "en" ? "English" : "French"}`);
  }
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

/** Numeric columns of a Markdown table in the order (one list of series per column). */
export function tableColumns(prompt: string): number[][] {
  const rows = prompt.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|?$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const body = rows.slice(1); // 1st row = headers
  const width = Math.max(0, ...body.map((r) => r.length));
  const cols: number[][] = [];
  for (let c = 0; c < width; c++) {
    const vals = body.map((r) => r[c] ?? "");
    if (vals.every((v) => /^-?[\d\s .,]+\s*\S{0,4}$/.test(v) && /\d/.test(v))) cols.push(vals.map((v) => numbersIn(v)[0]!));
  }
  return cols;
}

/** Totals that can be recomputed from the data: sums of contiguous ranges of each column and of their differences, row by row. */
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
    n.push(`${found}/${provided.length} provided figures found again`);
    if (share < 0.6) f.push(`the provided figures are not restated (${found}/${provided.length} found, 60% minimum)`);
  } else n.push("no figure in the order: restatement check skipped");
  const totals = computableTotals(task.prompt);
  if (totals.length) {
    for (const line of d.rawText.split(/\r?\n/)) {
      const m = /\btotal\b[^\n=:]*?[=:]\s*\**\s*(-?[\d\s .,]*\d)/i.exec(line);
      if (!m) continue;
      const v = parseNumber(m[1]!);
      if (Number.isFinite(v) && !totals.some((t) => close(t, v))) f.push(`announced total cannot be recomputed from the data: "${line.trim().slice(0, 80)}"`);
    }
  }
  if (d.rawText.trim().length < 200) f.push("analysis too short (200 characters minimum)");
}

/** Runs the deterministic checks of the task's profession on an already extracted deliverable. */
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
