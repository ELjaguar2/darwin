// Compact view of a deliverable in the chat feed (L17).
// `d` = response of GET /api/tasks/:id/deliverable (with file contents) or null; `meta` = deliverable.produced event
// (names, types, sizes: only what remains in a replayed log). Same security rules as deliverable.js:
// SVG only via <img src="data:image/svg+xml">, text and Markdown as DOM nodes, never innerHTML.
import { h, shortHash } from "./format.js";
import { renderMarkdown, svgDataUri, fileUrl, isSvg, isMermaid, isMarkdown, SAFE_NAME, MAX_INLINE_CHARS } from "./deliverable.js";

export function buildChatDeliverable(d, meta) {
  const root = h("div", { class: "chat-deliv", role: "group", "aria-label": "Deliverable submitted by the agent" });
  const files = Array.isArray(d?.files) ? d.files : [];
  const taskId = d?.taskId ?? meta?.taskId;
  if (!files.length) {
    const m = Array.isArray(meta?.files) ? meta.files : [];
    root.append(
      h("div", { class: "cd-head" }, h("strong", null, "Deliverable"), m.length ? ` · ${m.length} file${m.length > 1 ? "s" : ""}` : ""),
      h("ul", { class: "cd-files" }, m.map((f) => h("li", null, h("code", null, String(f.name ?? "").slice(0, 64)), h("span", { class: "muted" }, ` ${String(f.mime ?? "").slice(0, 40)} · ${f.bytes ?? "?"} B`)))),
      meta?.resultHash ? h("p", { class: "muted small" }, "hash ", h("code", null, shortHash(meta.resultHash))) : null,
      h("p", { class: "muted small" }, "Deliverable not stored in the log: only the metadata is displayed."));
    return root;
  }
  const logos = files.filter(isSvg), rest = files.filter((f) => !isSvg(f));
  if (logos.length) {
    root.append(h("div", { class: "cd-logos" }, logos.map((f) => {
      const name = String(f.name ?? "");
      if (!SAFE_NAME.test(name)) return h("p", { class: "muted small" }, "File ignored: non-conforming name.");
      if (f.truncated) return h("p", { class: "muted small" }, `${name}: SVG too large for the log (${f.bytes ?? "?"} B), preview unavailable.`);
      return h("figure", { class: "cd-logo" },
        h("img", { src: svgDataUri(f.content), alt: `Logo proposal ${name}`, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" }),
        h("figcaption", null, h("code", null, name)));
    })));
  }
  for (const f of rest) {
    const name = String(f.name ?? "");
    if (!SAFE_NAME.test(name)) { root.append(h("p", { class: "muted small" }, "File ignored: non-conforming name.")); continue; }
    const content = String(f.content ?? "");
    const body = isMermaid(f)
      ? h("pre", { class: "md-code" }, h("code", null, content.slice(0, MAX_INLINE_CHARS)))
      : isMarkdown(f) ? renderMarkdown(content) : h("div", { class: "md" }, h("pre", { class: "plain" }, content.slice(0, MAX_INLINE_CHARS)));
    const box = h("div", { class: "cd-text clamp" }, body, f.truncated ? h("p", { class: "muted small" }, `… content truncated in the log (${f.bytes ?? "?"} B in total).`) : null);
    const more = h("button", { type: "button", class: "cd-more", onclick: () => { const clamped = box.classList.toggle("clamp"); more.textContent = clamped ? "Read all" : "Collapse"; } }, "Read all");
    root.append(h("div", { class: "cd-file" },
      h("div", { class: "cd-head" }, h("code", null, name), isMermaid(f) ? h("span", { class: "muted small" }, " diagram source (rendering disabled)") : null,
        taskId ? h("a", { class: "btn-dl", href: fileUrl(taskId, name, true), download: name, "aria-label": `Download ${name}` }, "Download") : null),
      box, more));
  }
  return root;
}
