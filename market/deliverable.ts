// Extraction du livrable à partir du texte brut d'un agent (L16). Tout ce qui vient d'un agent est une donnée non fiable :
// les SVG sont assainis (rejet, jamais de « réparation » silencieuse d'un contenu actif) et les noms de fichiers sont fixes.
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

/** Blocs de code d'un langage donné (```lang ... ```). */
export function codeBlocks(text: string, lang: string): string[] {
  const re = new RegExp("```" + lang + "[ \\t]*\\r?\\n([\\s\\S]*?)```", "gi");
  return [...text.matchAll(re)].map((m) => m[1]!.trim());
}

/**
 * Assainit un SVG : lève DeliverableError si le contenu est actif ou externe, sinon renvoie le SVG (xmlns ajouté si absent).
 * Interdits : script, foreignObject, attributs on*, href/xlink:href non locaux, url() externes, image, iframe, embed, object, style @import, DOCTYPE/ENTITY.
 */
export function sanitizeSvg(raw: string): string {
  const svg = raw.trim().replace(/<!--[\s\S]*?-->/g, ""); // commentaires retirés AVANT les contrôles
  if (bytes(svg) > MAX_SVG_BYTES) throw new DeliverableError(`SVG trop gros (${bytes(svg)} octets, max ${MAX_SVG_BYTES})`);
  if (bytes(svg) < MIN_SVG_BYTES) throw new DeliverableError("SVG trop court pour être un logo");
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new DeliverableError("le bloc doit commencer par <svg et finir par </svg>");
  if (/<\?xml|<!doctype|<!entity|<!\[CDATA\[/i.test(svg)) throw new DeliverableError("DOCTYPE, ENTITY, CDATA et instruction XML interdits");
  const forbidden = /<\s*(script|foreignobject|image|iframe|embed|object|audio|video|link|meta|animate|set|handler)\b/i.exec(svg);
  if (forbidden) throw new DeliverableError(`balise interdite : <${forbidden[1]!.toLowerCase()}>`);
  if (/\son[a-z]+\s*=/i.test(svg)) throw new DeliverableError("attribut d'événement on*= interdit");
  if (/javascript:|vbscript:|data:text\/html/i.test(svg)) throw new DeliverableError("URL de script interdite");
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi)) {
    if (!m[2]!.trim().startsWith("#")) throw new DeliverableError(`href externe interdit : ${m[2]!.slice(0, 40)}`);
  }
  for (const m of svg.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    if (!m[2]!.trim().startsWith("#")) throw new DeliverableError(`url() externe interdit : ${m[2]!.slice(0, 40)}`);
  }
  if (/@import/i.test(svg)) throw new DeliverableError("@import interdit");
  const open = /^<svg\b[^>]*>/i.exec(svg)![0];
  if (!new RegExp(`viewBox\\s*=\\s*["']\\s*${SVG_VIEWBOX.replace(/ /g, "\\s+")}\\s*["']`, "i").test(open)) throw new DeliverableError(`viewBox "${SVG_VIEWBOX}" requis`);
  assertBalanced(svg);
  return /xmlns\s*=/i.test(open) ? svg : svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}

/** Contrôle de bonne formation minimal : balises ouvertes/fermées dans l'ordre, attributs entre guillemets. */
function assertBalanced(svg: string): void {
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const between = svg.slice(last, m.index);
    if (between.includes("<")) throw new DeliverableError("SVG mal formé : balise illisible");
    last = re.lastIndex;
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop()?.toLowerCase() !== name!.toLowerCase()) throw new DeliverableError(`SVG mal formé : </${name}> inattendu`);
    } else stack.push(name!);
  }
  if (svg.slice(last).includes("<")) throw new DeliverableError("SVG mal formé : balise illisible");
  if (stack.length) throw new DeliverableError(`SVG mal formé : <${stack.at(-1)}> non fermée`);
}

export interface DeliverableCosts {
  productionCostUsd?: number;
  judgeCostUsd?: number;
  createdAt?: string;
}

const textFile = (name: string, content: string): DeliverableFile => ({ name, mime: MIME.md, content });

/** Extrait le livrable d'un résultat brut ; lève DeliverableError si le format n'est pas respecté (le juge rejette alors). */
export function extractDeliverable(
  task: Pick<Task, "id" | "profession">, agentId: string, rawText: string, costs: DeliverableCosts = {},
): Deliverable {
  const text = rawText.trim();
  if (!text) throw new DeliverableError("résultat vide");
  let files: DeliverableFile[];
  switch (task.profession) {
    case "logo": {
      const blocks = codeBlocks(text, "svg");
      if (blocks.length !== 3) throw new DeliverableError(`exactement 3 blocs \`\`\`svg attendus, ${blocks.length} trouvé(s)`);
      files = blocks.map((b, i) => ({ name: `logo-${i + 1}.svg`, mime: MIME.svg, content: sanitizeSvg(b) }));
      break;
    }
    case "architecture": {
      const blocks = codeBlocks(text, "mermaid");
      if (blocks.length < 1) throw new DeliverableError("un bloc ```mermaid est requis");
      files = [textFile("architecture.md", text), { name: "schema.mmd", mime: MIME.mmd, content: blocks[0]! }];
      break;
    }
    case "finance": files = [textFile("analyse.md", text)]; break;
    case "marketing": files = [textFile("texte.md", text)]; break;
    case "translation": files = [textFile("traduction.md", text)]; break;
    case "legal": files = [textFile("checklist.md", text)]; break;
    default: throw new DeliverableError(`métier inconnu : ${String(task.profession)}`);
  }
  return {
    taskId: task.id, profession: task.profession, agentId, files, rawText: text, resultHash: sha256Hex(rawText),
    productionCostUsd: costs.productionCostUsd ?? 0, judgeCostUsd: costs.judgeCostUsd ?? 0, createdAt: costs.createdAt ?? new Date().toISOString(),
  };
}

export const fileBytes = (d: Deliverable) => d.files.map((f) => ({ name: f.name, mime: f.mime, bytes: bytes(f.content) }));
