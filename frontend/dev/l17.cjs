// Vérifications L17 (interface à trois onglets) contre le faux serveur, ou un vrai backend (mock/replay) avec REAL_URL.
// Usage : NODE_PATH=<node_modules avec playwright> node frontend/dev/l17.cjs <dossierCaptures> [--replay]
//   --replay : REAL_URL pointe un backend `npm run replay` ; la barre doit être désactivée et le bandeau affiché.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const out = process.argv[2] || ".";
const REPLAY = process.argv.includes("--replay");
const PORT = 3261;
const REAL = process.env.REAL_URL;
const BASE = REAL ?? `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "OK   " : "FAIL ") + m); };
(async () => {
  const srv = REAL ? { kill() {} } : spawn("node", [path.join(__dirname, "fake-server.mjs"), `--port=${PORT}`, "--tick=" + (process.env.TICK ?? 300)], { stdio: "inherit" });
  await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" && !/status of 404/.test(m.text())) errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto(BASE + "/?debug");
  await p.waitForTimeout(Number(process.env.WAIT ?? 12000));

  // navigation et mode toujours affiché
  ok((await p.$$eval(".tabs .tab", (n) => n.length)) === 3, "3 onglets : Mission, Lignées, Preuves");
  const mode = (await p.textContent("#modePill")).toUpperCase();
  ok(REPLAY ? mode.includes("REJEU") : /MOCK|TESTNET/.test(mode), "mode affiché dans l'en-tête : " + mode.trim());
  if (REPLAY) {
    ok(await p.isVisible("#replayBanner"), "bandeau de rejeu visible");
    ok(/Rejeu d'un run/.test(await p.textContent("#replayText")), "bandeau : " + (await p.textContent("#replayText")));
    ok((await p.$$eval("#replayBanner .rp-ctl button", (n) => n.length)) >= 3, "boutons de vitesse x1/x5/x20");
    ok(await p.isDisabled("#mInput"), "barre de mission désactivée en rejeu");
    ok((await p.getAttribute("#mInput", "placeholder")).includes("désactivées pendant le rejeu"), "mention « missions désactivées pendant le rejeu »");
  } else ok(!(await p.isVisible("#replayBanner")), "pas de bandeau de rejeu hors rejeu");

  // page Mission : cartes d'agents
  const cards = await p.$$eval("#strip .agent-card", (n) => n.length);
  ok(cards >= 4, `${cards} cartes d'agents vivants`);
  ok((await p.$$eval("#strip .agent-card .gauge-fill", (n) => n.length)) === cards, "chaque carte porte une jauge de solde");
  ok((await p.$$eval("#strip .agent-card .avatar .av-badge svg", (n) => n.length)) === cards, "chaque carte porte l'icône du métier");
  ok((await p.$$eval("#feed .thread", (n) => n.length)) >= 1, "fil : au moins une mission en direct");
  ok((await p.$$eval("#feed .rtag.tag-sim", (n) => n.length)) >= 1 || REPLAY, "étiquette « simulé » visible sur le client artificiel");

  if (!REPLAY) {
    // barre : métier et budget déduits, modifiables
    await p.fill("#mInput", "Dessine un logo pour ma boulangerie de quartier");
    ok((await p.textContent("#jobBtn")).includes("Logo"), "métier déduit du texte : Logo");
    const bud = Number(await p.inputValue("#budgetInput"));
    ok(Math.abs(bud - 0.045) < 1e-9, "budget pré-rempli au minimum du catalogue : " + bud);
    await p.click("#jobBtn");
    ok((await p.$$eval("#jobMenu button", (n) => n.length)) === 6, "menu métier : 6 choix");
    await p.click('#jobMenu button:has-text("Traduction")');
    ok((await p.textContent("#jobBtn")).includes("Traduction"), "métier modifiable d'un clic");
    await p.click("#jobBtn"); await p.click('#jobMenu button:has-text("Logo")');
    await p.fill("#budgetInput", "0.001"); await p.press("#mInput", "Enter");
    ok((await p.textContent("#mStatus")).toLowerCase().includes("budget trop bas"), "budget trop bas refusé localement");
    await p.fill("#budgetInput", "0.05");
    await p.press("#mInput", "Enter");
    await p.waitForSelector("#feed .thread.mine", { timeout: 5000 }).catch(() => {});
    ok(!!(await p.$("#feed .thread.mine")), "après envoi : la mission apparaît dans le fil (étiquette « vous »)");
    ok((await p.inputValue("#mInput")) === "", "la barre est vidée après l'envoi");
    await p.waitForSelector("#feed .thread.mine .pill-sys.paid", { timeout: 20000 }).catch(() => {});
    ok(!!(await p.$("#feed .thread.mine .pill-sys.paid")), "fil : « payé ✓ » affiché");
    ok(!!(await p.$("#feed .thread.mine .msg.bid")), "fil : enchère d'un agent (prix + pitch)");
    ok(!!(await p.$("#feed .thread.mine .msg.judge")), "fil : verdict du juge");
    const imgs = await p.$$eval("#feed .thread.mine .cd-logo img", (n) => n.map((x) => x.src.slice(0, 26)));
    ok(imgs.length === 3 && imgs.every((s) => s.startsWith("data:image/svg+xml")), "livrable : 3 logos SVG en <img data:> (inertes)");
    await p.waitForTimeout(1500);
    await p.locator("#feed .thread.mine").screenshot({ path: path.join(out, "l17-mission-flux.png") });
  }
  ok((await p.evaluate(() => window.__pwned)) === undefined, "aucun script de livrable n'a été exécuté");
  ok((await p.$$eval("#feed script, #feed svg script, #feed [onerror], #feed [onload]", (n) => n.length)) === 0, "aucun script ni gestionnaire d'événement dans le fil");

  // Lignées
  await p.click('[data-tab="lignees"]');
  await p.waitForTimeout(1200);
  const nodes = await p.$$eval(".lnode", (n) => n.length);
  ok(nodes >= 4, `arbre : ${nodes} nœuds`);
  const cls = await p.$$eval(".lnode", (n) => [...new Set(n.map((x) => [...x.classList].find((c) => c.startsWith("j-"))))]);
  ok(cls.length >= 1 && cls.every((c) => /^j-/.test(c)), "nœuds colorés par métier : " + cls.join(","));
  const t0 = await p.getAttribute(".ltree-svg .vp", "transform");
  await p.click("#zoomIn"); await p.waitForTimeout(300);
  ok((await p.getAttribute(".ltree-svg .vp", "transform")) !== t0, "zoom (+) modifie la vue");
  const box = await p.locator(".ltree-svg").boundingBox();
  await p.mouse.move(box.x + 200, box.y + 300); await p.mouse.down(); await p.mouse.move(box.x + 260, box.y + 340, { steps: 4 }); await p.mouse.up();
  ok((await p.getAttribute(".ltree-svg .vp", "transform")) !== t0, "déplacement à la souris");
  await p.click("#zoomFit"); await p.waitForTimeout(900);
  await p.click(".lnode");
  await p.waitForSelector("#panel:not([hidden])");
  ok(await p.isVisible("#panel"), "clic sur un nœud : panneau latéral ouvert");
  const ptxt = await p.textContent("#panel");
  ok(/Génome/.test(ptxt) && /Personnalité|Lettres/.test(ptxt) && /Historique financier/.test(ptxt), "panneau : génome, personnalité, lettres, historique financier");
  await p.press("body", "Escape");
  ok(await p.isHidden("#panel"), "Échap ferme le panneau");
  // un agent né d'un parent : lettre lisible
  const child = await p.$$eval(".lnode", (n) => n.length);
  if (child > 4 || REPLAY) {
    const idx = await p.evaluate(() => { const a = [...window.__darwin.store.agents.values()].find((x) => x.parentId); return a ? a.id : null; });
    if (idx) {
      await p.evaluate((id) => { location.hash = "#/lignees"; }, idx);
      await p.evaluate((id) => document.querySelectorAll(".lnode")[[...window.__darwin.store.agents.keys()].indexOf(id)]?.dispatchEvent(new MouseEvent("click", { bubbles: true })), idx);
      await p.waitForTimeout(800);
      ok(/Lettre reçue/.test((await p.textContent("#panel")) || ""), "panneau d'un enfant : lettre du parent affichée");
    }
  }
  await p.screenshot({ path: path.join(out, "l17-lignees.png") });
  await p.click('[data-tab="lignees"]');

  // Preuves
  await p.click('[data-tab="preuves"]');
  await p.waitForTimeout(800);
  ok((await p.$$eval("#kpis .kpi", (n) => n.length)) === 5, "preuves : 5 indicateurs");
  ok((await p.$$eval("#population .pop-row", (n) => n.length)) >= 1, "preuves : population par génération");
  ok((await p.$$eval("#flows .flow", (n) => n.length)) === 3, "preuves : flux gagné / cerveau / transmis");
  ok((await p.$$eval("#txs li", (n) => n.length)) >= 5, "preuves : transactions listées");
  if (REPLAY || REAL) ok((await p.$$eval("#txs a.hash[href^='https://testnet.nearblocks.io/txns/']", (n) => n.length)) >= 1, "preuves : liens nearblocks");
  ok(/TEE/.test(await p.textContent("#tee")), "preuves : badge d'attestation TEE");
  ok((await p.$$eval("#tools li", (n) => n.length)) === 5, "preuves : 5 briques NEAR");
  await p.screenshot({ path: path.join(out, "l17-preuves.png"), fullPage: true });

  // classique
  const pc = await ctx.newPage();
  pc.on("pageerror", (e) => errs.push("CLASSIC PAGEERROR " + e.message));
  await pc.goto(BASE + "/?classique");
  await pc.waitForTimeout(2500);
  ok(!!(await pc.$("#tree svg")) && !!(await pc.$("#taskForm")), "interface classique disponible sur /?classique");
  if (!REAL) { const r = await pc.goto(BASE + "/classique"); ok(/classique/.test(r.url()), "/classique redirige vers l'ancienne interface (faux serveur)"); }

  // mobile
  const mctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const m = await mctx.newPage();
  await m.goto(BASE + "/");
  await m.waitForTimeout(6000);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile : pas de défilement horizontal (Mission)");
  const tabY = await m.evaluate(() => document.querySelector(".tabs").getBoundingClientRect().bottom);
  ok(Math.abs(tabY - 812) < 4, "mobile : onglets en barre basse");
  await m.screenshot({ path: path.join(out, "l17-mission-mobile.png") });
  for (const t of ["lignees", "preuves"]) {
    await m.click(`[data-tab="${t}"]`); await m.waitForTimeout(900);
    ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `mobile : pas de défilement horizontal (${t})`);
    await m.screenshot({ path: path.join(out, `l17-${t}-mobile.png`) });
  }

  ok(errs.length === 0, "aucune erreur console / CSP" + (errs.length ? " : " + errs.slice(0, 3).join(" | ") : ""));
  console.log(`\n${pass} OK, ${fail} FAIL`);
  await b.close(); srv.kill();
  process.exit(fail ? 1 : 0);
})();
