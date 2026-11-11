// Vue compacte d'un livrable dans le fil de chat (L17).
// `d` = réponse de GET /api/tasks/:id/deliverable (avec le contenu des fichiers) ou null ; `meta` = événement deliverable.produced
// (noms, types, tailles : seul ce qui reste dans un journal rejoué). Mêmes règles de sécurité que deliverable.js :
// SVG uniquement via <img src="data:image/svg+xml">, texte et Markdown en nœuds DOM, jamais d'innerHTML.
import { h, shortHash } from "./format.js";
import { renderMarkdown, svgDataUri, fileUrl, isSvg, isMermaid, isMarkdown, SAFE_NAME, MAX_INLINE_CHARS } from "./deliverable.js";

export function buildChatDeliverable(d, meta) {
  const root = h("div", { class: "chat-deliv", role: "group", "aria-label": "Livrable remis par l'agent" });
  const files = Array.isArray(d?.files) ? d.files : [];
  const taskId = d?.taskId ?? meta?.taskId;
  if (!files.length) {
    const m = Array.isArray(meta?.files) ? meta.files : [];
    root.append(
      h("div", { class: "cd-head" }, h("strong", null, "Livrable"), m.length ? ` · ${m.length} fichier${m.length > 1 ? "s" : ""}` : ""),
      h("ul", { class: "cd-files" }, m.map((f) => h("li", null, h("code", null, String(f.name ?? "").slice(0, 64)), h("span", { class: "muted" }, ` ${String(f.mime ?? "").slice(0, 40)} · ${f.bytes ?? "?"} o`)))),
      meta?.resultHash ? h("p", { class: "muted small" }, "empreinte ", h("code", null, shortHash(meta.resultHash))) : null,
      h("p", { class: "muted small" }, "Livrable non enregistré dans le journal : seules les métadonnées sont affichées."));
    return root;
  }
  const logos = files.filter(isSvg), rest = files.filter((f) => !isSvg(f));
  if (logos.length) {
    root.append(h("div", { class: "cd-logos" }, logos.map((f) => {
      const name = String(f.name ?? "");
      if (!SAFE_NAME.test(name)) return h("p", { class: "muted small" }, "Fichier ignoré : nom non conforme.");
      return h("figure", { class: "cd-logo" },
        h("img", { src: svgDataUri(f.content), alt: `Proposition de logo ${name}`, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" }),
        h("figcaption", null, h("code", null, name)));
    })));
  }
  for (const f of rest) {
    const name = String(f.name ?? "");
    if (!SAFE_NAME.test(name)) { root.append(h("p", { class: "muted small" }, "Fichier ignoré : nom non conforme.")); continue; }
    const content = String(f.content ?? "");
    const body = isMermaid(f)
      ? h("pre", { class: "md-code" }, h("code", null, content.slice(0, MAX_INLINE_CHARS)))
      : isMarkdown(f) ? renderMarkdown(content) : h("div", { class: "md" }, h("pre", { class: "plain" }, content.slice(0, MAX_INLINE_CHARS)));
    const box = h("div", { class: "cd-text clamp" }, body);
    const more = h("button", { type: "button", class: "cd-more", onclick: () => { const clamped = box.classList.toggle("clamp"); more.textContent = clamped ? "Tout lire" : "Réduire"; } }, "Tout lire");
    root.append(h("div", { class: "cd-file" },
      h("div", { class: "cd-head" }, h("code", null, name), isMermaid(f) ? h("span", { class: "muted small" }, " source du schéma (rendu désactivé)") : null,
        taskId ? h("a", { class: "btn-dl", href: fileUrl(taskId, name, true), download: name, "aria-label": `Télécharger ${name}` }, "Télécharger") : null),
      box, more));
  }
  return root;
}
