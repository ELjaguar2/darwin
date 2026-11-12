// Entry point: L17 interface by default; classic interface (L16) on /classique (the backend redirects to /?classique) or /?classique.
if (/[?&]classique\b/.test(location.search)) {
  const { CLASSIC_BODY } = await import("./classique-markup.js");
  for (const l of [...document.querySelectorAll('link[rel="stylesheet"]')]) l.remove();
  for (const href of ["style.css", "freelance.css"]) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.append(l); }
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${CLASSIC_BODY}</body>`, "text/html"); // trusted static markup
  document.body.replaceChildren(...[...doc.body.childNodes].map((n) => document.importNode(n, true)));
  document.body.dataset.page = "classique";
  await import("./app.js");
} else {
  const { boot } = await import("./darwin.js");
  boot();
}
