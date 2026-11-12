// Deliverable display (lot L16). Security: any AI-produced content is untrusted text.
//  - text: Text nodes only (never innerHTML);
//  - SVG: displayed only via <img src="data:image/svg+xml,..."> (the browser runs no script inside an image);
//  - Mermaid: source displayed as code (no rendering: the backend CSP forbids any external script).
import { h, usd, shortHash } from "./format.js";

const SAFE_NAME = /^[a-z0-9._-]{1,64}$/;
const MAX_INLINE_CHARS = 60000; // beyond this, not everything is displayed (the file stays downloadable)

/** Minimal, safe Markdown: headings, lists, simple tables, quotes, code blocks, bold, italic, inline code. Output = DOM nodes. */
export function renderMarkdown(src) {
  const root = h("div", { class: "md" });
  const lines = String(src ?? "").slice(0, MAX_INLINE_CHARS).replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(line);
    if (fence) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) buf.push(lines[i++]);
      i++;
      root.append(h("pre", { class: "md-code", "data-lang": fence[2] || null }, h("code", null, buf.join("\n"))));
      continue;
    }
    const hd = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hd) { root.append(h(`h${Math.min(6, hd[1].length + 2)}`, { class: "md-h" }, inline(hd[2]))); i++; continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { root.append(h("hr")); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line); i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(cells(lines[i++]));
      root.append(h("div", { class: "md-tablewrap", tabindex: "0", role: "region", "aria-label": "Table (scrollable)" },
        h("table", { class: "md-table" }, h("thead", null, h("tr", null, head.map((c) => h("th", null, inline(c))))),
          h("tbody", null, body.map((r) => h("tr", null, r.map((c) => h("td", null, inline(c)))))))));
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      root.append(h("blockquote", null, inline(buf.join(" "))));
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (m) { items.push({ depth: Math.min(3, Math.floor(m[1].length / 2)), text: m[3] }); i++; }
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += " " + lines[i++].trim(); }
        else break;
      }
      root.append(h(ordered ? "ol" : "ul", { class: "md-list" }, items.map((it) => h("li", { class: `d${it.depth}` }, inline(it.text)))));
      continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(\s*(```|~~~)|#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) buf.push(lines[i++].trim());
    if (!buf.length) { buf.push(lines[i++]); }
    root.append(h("p", null, inline(buf.join(" "))));
  }
  if (src && String(src).length > MAX_INLINE_CHARS) root.append(h("p", { class: "muted small" }, "Text truncated on screen: download the file to read it in full."));
  return root;
}

/** `code`, **bold**, *italic*: returns nodes (inert text). No clickable link: an AI-provided URL is never activated. */
function inline(text) {
  const out = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g;
  let last = 0, m;
  const s = String(text);
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("`")) out.push(h("code", null, t.slice(1, -1)));
    else if (t.startsWith("**") || t.startsWith("__")) out.push(h("strong", null, t.slice(2, -2)));
    else out.push(h("em", null, t.slice(1, -1)));
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** SVG content -> data URL for <img>. Never injected into the DOM. */
export function svgDataUri(content) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(String(content));
}

export const fileUrl = (taskId, name, download) =>
  `/api/tasks/${encodeURIComponent(taskId)}/deliverable/${encodeURIComponent(name)}${download ? "?download=1" : ""}`;

function dlLink(taskId, f) {
  return h("a", { class: "btn-dl", href: fileUrl(taskId, f.name, true), download: f.name, "aria-label": `Download ${f.name}` }, "Download");
}

export const isSvg = (f) => f.mime === "image/svg+xml" || /\.svg$/.test(f.name);
export const isMermaid = (f) => f.mime === "text/vnd.mermaid" || /\.mmd$/.test(f.name);
export const isMarkdown = (f) => f.mime === "text/markdown" || /\.md$/.test(f.name);
export { SAFE_NAME, MAX_INLINE_CHARS };

function fileBlock(taskId, f) {
  const name = String(f.name ?? "");
  if (!SAFE_NAME.test(name)) return h("p", { class: "muted small" }, "File ignored: non-conforming name.");
  const content = String(f.content ?? "");
  if (isSvg(f)) {
    return h("figure", { class: "dl-svg" },
      h("div", { class: "svg-frame" }, h("img", { src: svgDataUri(content), alt: `Logo proposal ${name}`, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" })),
      h("figcaption", null, h("code", null, name), dlLink(taskId, f)));
  }
  if (isMermaid(f)) {
    return h("div", { class: "dl-file" },
      h("div", { class: "dl-head" }, h("strong", null, "Mermaid diagram (source)"), h("code", null, name), dlLink(taskId, f)),
      h("pre", { class: "md-code", tabindex: "0", "aria-label": "Mermaid diagram source" }, h("code", null, content.slice(0, MAX_INLINE_CHARS))),
      h("p", { class: "muted small" }, "Source displayed as-is (graphical rendering disabled: the page loads no external resource)."));
  }
  return h("div", { class: "dl-file" },
    h("div", { class: "dl-head" }, h("code", null, name), dlLink(taskId, f)),
    isMarkdown(f) ? renderMarkdown(content) : h("div", { class: "md" }, h("pre", { class: "plain" }, content.slice(0, MAX_INLINE_CHARS))));
}

/** Builds the full deliverable view. `spec` = catalogue entry (rubric, threshold) or null. */
export function buildDeliverable(d, spec, profLabelText) {
  const accepted = d.verdict === "accepted";
  const has = d.verdict === "accepted" || d.verdict === "rejected";
  const score = Number.isFinite(Number(d.score)) ? Number(d.score) : null;
  const files = Array.isArray(d.files) ? d.files : [];
  const root = h("section", { class: "deliverable", "aria-label": `Deliverable ${profLabelText ?? ""}` });
  root.append(h("div", { class: "dl-summary" },
    has ? h("span", { class: `verdict ${accepted ? "v-ok" : "v-ko"}` }, accepted ? "Accepted" : "Rejected") : h("span", { class: "verdict v-wait" }, "Awaiting validation"),
    score != null ? h("span", { class: "score", title: spec ? `Acceptance threshold: ${Math.round(spec.acceptScore * 100)}%` : "" }, `Score ${Math.round(score * 100)}%`, spec ? h("small", null, ` (threshold ${Math.round(spec.acceptScore * 100)}%)`) : null) : null,
    h("span", { class: "cost", title: "AI production cost, paid by the agent" }, "Production ", h("b", null, usd(d.productionCostUsd))),
    h("span", { class: "cost", title: "AI cost of the judge who scores the deliverable" }, "Judge ", h("b", null, usd(d.judgeCostUsd))),
    d.resultHash ? h("span", { class: "muted small" }, "hash ", h("code", null, shortHash(d.resultHash))) : null));
  if (spec?.rubric?.length) {
    const sc = score ?? 0;
    root.append(h("details", { class: "rubric" },
      h("summary", null, "Scoring rubric"),
      h("ul", { class: "rubric-list" }, spec.rubric.map((c) => h("li", null,
        h("span", { class: "rb-d" }, c.description),
        h("span", { class: "rb-bar", role: "img", "aria-label": `Weight ${Math.round(c.weight * 100)}%` }, h("span", { css: { width: `${Math.round(c.weight * 100)}%` } })),
        h("b", null, `${Math.round(c.weight * 100)}%`)))),
      h("p", { class: "muted small" }, `Final score = weighted sum of the criteria${score != null ? `: ${sc.toFixed(2)}` : ""}. Accepted if the score reaches the threshold AND the automatic checks pass.`)));
  }
  if (!files.length) root.append(h("p", { class: "muted" }, "No file in this deliverable."));
  const logos = files.filter(isSvg), rest = files.filter((f) => !isSvg(f));
  if (logos.length) root.append(h("div", { class: "logos" }, logos.map((f) => fileBlock(d.taskId, f))));
  for (const f of rest) root.append(fileBlock(d.taskId, f));
  return root;
}
