// Test de bout en bout du frontend contre le faux serveur (Playwright). Lancer :
//   NODE_PATH=<node_modules avec playwright> node frontend/dev/e2e.cjs [dossierCaptures]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const out = process.argv[2] || ".";
let port = 3300;
const start = async (...args) => {
  const p = ++port;
  const srv = spawn("node", [path.join(__dirname, "fake-server.mjs"), `--port=${p}`, ...args], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  return { p, srv, url: `http://127.0.0.1:${p}/` };
};
const results = [];
const ok = (name, cond, info = "") => { results.push([cond ? "OK " : "KO ", name, info]); console.log(cond ? "OK " : "KO ", name, info); };

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const newPage = async (url, vp = { width: 1280, height: 800 }, opts = {}) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, ...opts });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource/.test(m.text())) errs.push(m.type() + ": " + m.text()); });
    p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
    await p.goto(url);
    return p;
  };

  // 1. run normal : arbre, générations, formulaire OK + 400
  let s = await start("--tick=100");
  let p = await newPage(s.url);
  await p.waitForFunction(() => document.querySelectorAll(".node").length >= 6, null, { timeout: 15000 });
  ok("arbre : nœuds affichés", true);
  await p.waitForFunction(() => Number(document.getElementById("genNum").textContent) >= 3, null, { timeout: 60000 });
  ok("compteur de générations >= 3", true, await p.textContent("#genNum"));
  await p.waitForSelector("#feed li .hash");
  ok("flux de transactions rempli", (await p.$$("#feed li")).length > 3);
  ok("chronique non vide", (await p.$$("#chron li")).length > 3);
  ok("mock : pas de lien explorateur", (await p.$$("#feed li a.hash")).length === 0);
  ok("bandeau mock", /MODE MOCK/.test(await p.textContent("#banners")));
  ok("étiquette client simulé", /Client simulé/.test(await p.textContent("#banners")));
  ok("étiquette visiteur financé démo", /Visiteur \(financé par le compte de démo\)/.test(await p.textContent("#banners")));
  ok("tâche étiquetée simulé", /simulé/.test(await p.textContent("#tasks")));
  await p.click("#agents li:first-child button");
  await p.waitForSelector("#fiche h3");
  ok("fiche agent", true, await p.textContent("#fiche h3"));
  ok("lettre lisible", (await p.textContent("#letter")).length > 40);
  await p.fill("#fTitle", "Test frontend"); await p.fill("#fPrompt", "Écris un haïku sur la sélection naturelle."); await p.fill("#fBudget", "9");
  await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.err");
  ok("formulaire 400 : message serveur", /hors bornes/.test(await p.textContent("#fStatus")), (await p.textContent("#fStatus")).slice(0, 80));
  await p.fill("#fBudget", "1.2"); await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.ok");
  ok("formulaire 201", /publiée/.test(await p.textContent("#fStatus")));
  await p.waitForFunction(() => /Visiteur \(financé/.test(document.getElementById("tasks").textContent), null, { timeout: 5000 });
  ok("tâche visiteur visible avec étiquette", true);
  await p.fill("#fTitle", "x"); await p.click("#fSubmit");
  ok("validation locale", /incomplet/.test(await p.textContent("#fStatus")));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(out, "desktop.png") });
  await p.click("#themeBtn");
  const theme = await p.evaluate(() => document.documentElement.dataset.theme);
  ok("bascule de thème", theme === "dark" || theme === "light", theme);
  await p.screenshot({ path: path.join(out, "desktop-alt-theme.png") });

  // 2. reprise SSE : coupure puis nouveau serveur sur le même port (journal à zéro -> événement reset)
  s.srv.kill();
  await p.waitForFunction(() => /Reconnexion|Hors ligne/.test(document.getElementById("connText").textContent), null, { timeout: 15000 });
  ok("état de connexion : coupure détectée", true, await p.textContent("#connText"));
  const srv2 = spawn("node", [path.join(__dirname, "fake-server.mjs"), `--port=${s.p}`, "--tick=100", "--seed=11"], { stdio: "ignore" });
  await p.waitForFunction(() => document.getElementById("connText").textContent === "En direct", null, { timeout: 30000 });
  ok("reprise SSE après redémarrage serveur", true);
  await p.waitForTimeout(3000);
  ok("après reset : l'arbre se reconstruit", (await p.$$(".node")).length >= 4, String((await p.$$(".node")).length));
  srv2.kill();
  await p.context().close();

  // 3. séquestre dégradé + 429
  s = await start("--tick=100", "--degraded", "--task-status=429");
  p = await newPage(s.url);
  await p.waitForSelector("#banners .pill.danger");
  const bt = await p.textContent("#banners");
  ok("badge Séquestre dégradé", /Séquestre dégradé/.test(bt));
  ok("mock ET dégradé simultanés", /MODE MOCK/.test(bt) && /Séquestre dégradé/.test(bt));
  await p.fill("#fTitle", "Test 429"); await p.fill("#fPrompt", "Une consigne suffisamment longue."); await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.warn");
  ok("formulaire 429 + Retry-After", /429/.test(await p.textContent("#fStatus")) && /Réessayer dans/.test(await p.textContent("#fSubmit")), await p.textContent("#fSubmit"));
  ok("bouton verrouillé pendant l'attente", await p.isDisabled("#fSubmit"));
  await p.context().close(); s.srv.kill();

  // 4. 503 (validation en cours)
  s = await start("--tick=100", "--task-status=503");
  p = await newPage(s.url);
  await p.fill("#fTitle", "Test 503"); await p.fill("#fPrompt", "Une consigne suffisamment longue."); await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.warn");
  ok("formulaire 503 (état d'attente)", /503/.test(await p.textContent("#fStatus")) && /pas une panne/.test(await p.textContent("#fStatus")));
  await p.context().close(); s.srv.kill();

  // 5. testnet : liens explorateur
  s = await start("--tick=100", "--testnet");
  p = await newPage(s.url);
  await p.waitForSelector("#feed li a.hash", { timeout: 15000 });
  const href = await p.getAttribute("#feed li a.hash", "href");
  ok("testnet : lien explorateur nearblocks", /^https:\/\/testnet\.nearblocks\.io\/txns\/[0-9a-f]{44}$/.test(href), href);
  ok("testnet : pas de bandeau mock", !/MODE MOCK/.test(await p.textContent("#banners")));
  ok("testnet : lien rel=noopener", (await p.getAttribute("#feed li a.hash", "rel")).includes("noopener"));
  await p.context().close(); s.srv.kill();

  // 6. mobile 320 px (reduced motion) et 375 px, sans scroll horizontal
  s = await start("--tick=100");
  p = await newPage(s.url, { width: 320, height: 640 }, { reducedMotion: "reduce" });
  await p.waitForFunction(() => document.querySelectorAll(".node").length >= 6, null, { timeout: 45000 });
  await p.waitForTimeout(8000);
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok("320 px : pas de scroll horizontal", sw[0] <= sw[1], JSON.stringify(sw));
  await p.screenshot({ path: path.join(out, "mobile-320.png"), fullPage: true });
  await p.context().close();
  p = await newPage(s.url, { width: 375, height: 812 });
  await p.waitForTimeout(6000);
  const sw2 = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok("375 px : pas de scroll horizontal", sw2[0] <= sw2[1], JSON.stringify(sw2));
  await p.screenshot({ path: path.join(out, "mobile.png") });
  await p.screenshot({ path: path.join(out, "mobile-full.png"), fullPage: true });
  await p.context().close(); s.srv.kill();

  // 7. messages SSE malformés (null, non objet, JSON cassé, type inconnu, deltas non numériques, trou de seq)
  s = await start("--tick=100", "--garbage");
  p = await newPage(s.url + "?debug");
  await p.waitForFunction(() => document.querySelectorAll(".node").length >= 4, null, { timeout: 20000 });
  const t0 = await p.evaluate(() => window.__darwin.store.tick);
  await p.waitForTimeout(12000);
  const st = await p.evaluate(() => ({ tick: window.__darwin.store.tick, agents: window.__darwin.store.agents.size, ...window.__darwin.stats() }));
  ok("SSE malformé : le flux continue d'avancer", st.tick > t0 + 10, JSON.stringify(st));
  ok("SSE malformé : messages invalides ignorés et comptés", st.invalidMsgs > 20, String(st.invalidMsgs));
  ok("SSE malformé : l'arbre reste affiché", (await p.$$(".node")).length >= 4);
  await p.context().close();
  p = await newPage(s.url);
  ok("window.__darwin absent hors ?debug", await p.evaluate(() => window.__darwin === undefined));
  const exp = await p.evaluate(async () => {
    const m = await import("/format.js");
    return [
      m.explorerUrl("abc123", { explicit: "https://evil.example/txns/abc123", chainKind: "near" }),
      m.explorerUrl("abc123", { explicit: "https://testnet.nearblocks.io/txns/abc123", chainKind: "near" }),
      m.explorerUrl("abc123", { explicit: "javascript:alert(1)", chainKind: "mock" }),
      m.explorerUrl("abc123", { explicit: "https://testnet.nearblocks.io.evil.com/x", chainKind: "near" }),
      String(m.big("1.5x")), String(m.big(null)), String(m.big("12")),
    ];
  });
  ok("liste blanche d'explorateur", exp[0] === "https://testnet.nearblocks.io/txns/abc123" && exp[1] === "https://testnet.nearblocks.io/txns/abc123" && exp[2] === null && exp[3] === "https://testnet.nearblocks.io/txns/abc123", JSON.stringify(exp.slice(0, 4)));
  ok("big() tolérant", exp[4] === "0" && exp[5] === "0" && exp[6] === "12", JSON.stringify(exp.slice(4)));
  await p.context().close(); s.srv.kill();

  console.log("ERREURS CONSOLE:", errs.length ? errs : "aucune");
  await b.close();
  const ko = results.filter((r) => r[0] === "KO ").length;
  console.log(ko ? `${ko} ECHEC(S)` : "TOUT OK");
  process.exit(ko || errs.length ? 1 : 0);
})().catch((e) => { console.error("EXCEPTION", e); process.exit(2); });
