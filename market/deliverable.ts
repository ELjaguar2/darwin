// Extraction of the deliverable from an agent's raw text (L16). Everything coming from an agent is untrusted data:
// SVGs are sanitised (rejection, never a silent "repair" of active content) and file names are fixed.
// L19: error messages (readable free text) are in English; file names and mime types are protocol identifiers and do not change.
import { sha256Hex, type Deliverable, type DeliverableFile, type Task } from "../shared/index.ts";

export class DeliverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliverableError";
  }
}

export const MAX_SVG_BYTES = 20_000;
export const MIN_SVG_BYTES = 60;
export const SVG_VIEWBOX = "0 0 256 256";
export const MIME = { svg: "image/svg+xml", md: "text/markdown", mmd: "text/vnd.mermaid" } as const;

const bytes = (s: string) => Buffer.byteLength(s, "utf8");

/** Code blocks of a given language (```lang ... ```). */
export function codeBlocks(text: string, lang: string): string[] {
  const re = new RegExp("```" + lang + "[ \\t]*\\r?\\n([\\s\\S]*?)```", "gi");
  return [...text.matchAll(re)].map((m) => m[1]!.trim());
}

/**
 * Sanitises an SVG: throws DeliverableError if the content is active or external, otherwise returns the SVG (xmlns added if missing).
 * Forbidden: script, foreignObject, on* attributes, non-local href/xlink:href, external url(), image, iframe, embed, object, style @import, DOCTYPE/ENTITY.
 */
export function sanitizeSvg(raw: string): string {
  const svg = raw.trim().replace(/<!--[\s\S]*?-->/g, ""); // comments removed BEFORE the checks
  if (bytes(svg) > MAX_SVG_BYTES) throw new DeliverableError(`SVG too large (${bytes(svg)} bytes, max ${MAX_SVG_BYTES})`);
  if (bytes(svg) < MIN_SVG_BYTES) throw new DeliverableError("SVG too short to be a logo");
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new DeliverableError("the block must start with <svg and end with </svg>");
  if (/<\?xml|<!doctype|<!entity|<!\[CDATA\[/i.test(svg)) throw new DeliverableError("DOCTYPE, ENTITY, CDATA and XML instructions are forbidden");
  const forbidden = /<\s*(script|foreignobject|image|iframe|embed|object|audio|video|link|meta|animate|set|handler)\b/i.exec(svg);
  if (forbidden) throw new DeliverableError(`forbidden tag: <${forbidden[1]!.toLowerCase()}>`);
  if (/\son[a-z]+\s*=/i.test(svg)) throw new DeliverableError("event attribute on*= is forbidden");
  if (/javascript:|vbscript:|data:text\/html/i.test(svg)) throw new DeliverableError("script URL is forbidden");
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) {
    if (!m[2]!.trim().startsWith("#")) throw new DeliverableError(`external href is forbidden: ${m[2]!.slice(0, 40)}`);
  }
  for (const m of svg.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    if (!m[2]!.trim().startsWith("#")) throw new DeliverableError(`external url() is forbidden: ${m[2]!.slice(0, 40)}`);
  }
  if (/@import/i.test(svg)) throw new DeliverableError("@import is forbidden");
  const open = /^<svg\b[^>]*>/i.exec(svg)![0];
  if (!new RegExp(`viewBox\\s*=\\s*["']\\s*${SVG_VIEWBOX.replace(/ /g, "\\s+")}\\s*["']`, "i").test(open)) throw new DeliverableError(`viewBox "${SVG_VIEWBOX}" required`);
  assertBalanced(svg);
  return /xmlns\s*=/i.test(open) ? svg : svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}

/** Minimal well-formedness check: tags opened/closed in order, attributes quoted. */
function assertBalanced(svg: string): void {
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const between = svg.slice(last, m.index);
    if (between.includes("<")) throw new DeliverableError("malformed SVG: unreadable tag");
    last = re.lastIndex;
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop()?.toLowerCase() !== name!.toLowerCase()) throw new DeliverableError(`malformed SVG: unexpected </${name}>`);
    } else stack.push(name!);
  }
  if (svg.slice(last).includes("<")) throw new DeliverableError("malformed SVG: unreadable tag");
  if (stack.length) throw new DeliverableError(`malformed SVG: <${stack.at(-1)}> not closed`);
}

export interface DeliverableCosts {
  productionCostUsd?: number;
  judgeCostUsd?: number;
  createdAt?: string;
}

const textFile = (name: string, content: string): DeliverableFile => ({ name, mime: MIME.md, content });

/** Extracts the deliverable from a raw result; throws DeliverableError if the format is not respected (the judge then rejects). */
export function extractDeliverable(
  task: Pick<Task, "id" | "profession">, agentId: string, rawText: string, costs: DeliverableCosts = {},
): Deliverable {
  const text = rawText.trim();
  if (!text) throw new DeliverableError("empty result");
  let files: DeliverableFile[];
  switch (task.profession) {
    case "logo": {
      const blocks = codeBlocks(text, "svg");
      if (blocks.length !== 3) throw new DeliverableError(`exactly 3 \`\`\`svg blocks expected, ${blocks.length} found`);
      files = blocks.map((b, i) => ({ name: `logo-${i + 1}.svg`, mime: MIME.svg, content: sanitizeSvg(b) }));
      break;
    }
    case "architecture": {
      const blocks = codeBlocks(text, "mermaid");
      if (blocks.length < 1) throw new DeliverableError("a ```mermaid block is required");
      files = [textFile("architecture.md", text), { name: "schema.mmd", mime: MIME.mmd, content: blocks[0]! }];
      break;
    }
    // File names below are stable protocol identifiers (frontend, journals): they stay as they are.
    case "finance": files = [textFile("analyse.md", text)]; break;
    case "marketing": files = [textFile("texte.md", text)]; break;
    case "translation": files = [textFile("traduction.md", text)]; break;
    case "legal": files = [textFile("checklist.md", text)]; break;
    default: throw new DeliverableError(`unknown profession: ${String(task.profession)}`);
  }
  return {
    taskId: task.id, profession: task.profession, agentId, files, rawText: text, resultHash: sha256Hex(rawText),
    productionCostUsd: costs.productionCostUsd ?? 0, judgeCostUsd: costs.judgeCostUsd ?? 0, createdAt: costs.createdAt ?? new Date().toISOString(),
  };
}

export const fileBytes = (d: Deliverable) => d.files.map((f) => ({ name: f.name, mime: f.mime, bytes: bytes(f.content) }));
