// Point d'entrée : interface L17 par défaut ; ancienne interface (L16) sur /classique (le backend renvoie vers /?classique) ou /?classique.
if (/[?&]classique\b/.test(location.search)) {
  const { CLASSIC_BODY } = await import("./classique-markup.js");
  for (const l of [...document.querySelectorAll('link[rel="stylesheet"]')]) l.remove();
  for (const href of ["style.css", "freelance.css"]) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.append(l); }
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${CLASSIC_BODY}</body>`, "text/html"); // balisage statique de confiance
  document.body.replaceChildren(...[...doc.body.childNodes].map((n) => document.importNode(n, true)));
  document.body.dataset.page = "classique";
  await import("./app.js");
} else {
  const { boot } = await import("./darwin.js");
  boot();
}
