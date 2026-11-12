// Vérifie la page contre le VRAI backend (npm run start:mock). REAL_URL=http://127.0.0.1:3210 node frontend/dev/real.cjs <dossierCaptures>
const { chromium } = require("playwright");
const path = require("path");
const URL_ = process.env.REAL_URL || "http://127.0.0.1:3000";
const out = process.argv[2] || ".";
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 812 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(name + " " + m.text()); });
    p.on("pageerror", (e) => errs.push(name + " PAGEERROR " + e.message));
    await p.goto(String(URL_).replace(/[/]+$/, "") + "/?classique");
    await p.waitForFunction(() => document.querySelectorAll(".node").length >= 4, null, { timeout: 20000 });
    console.log(name, "conn:", await p.textContent("#connText"));
    await p.fill("#fTitle", "Résumer un article sur NEAR");
    await p.fill("#fPrompt", "Résume en trois phrases pourquoi les agents autonomes ont besoin de monnaie programmable.");
    await p.fill("#fBudget", "1");
    await p.click("#fSubmit");
    await p.waitForFunction(() => /publiée|refuse|Trop|indisponible|Erreur|inattendue/.test(document.getElementById("fStatus").textContent), null, { timeout: 10000 });
    console.log(name, "form:", (await p.textContent("#fStatus")).slice(0, 160));
    await p.waitForFunction(() => Number(document.getElementById("genNum").textContent) >= 3, null, { timeout: 200000 }).catch(() => console.log(name, "génération 3 non atteinte"));
    await p.waitForTimeout(3000);
    console.log(name, "gen", await p.textContent("#genNum"), "nodes", (await p.$$(".node")).length, "tx", (await p.$$("#feed li")).length, "chron", (await p.$$("#chron li")).length, "tasks", (await p.$$("#tasks li")).length);
    console.log(name, "banners:", (await p.textContent("#banners")).replace(/\s+/g, " ").slice(0, 400));
    console.log(name, "visitor task:", /Visiteur \(financé/.test(await p.textContent("#tasks")));
    console.log(name, "scroll", await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(out, `real-${name}.png`) });
    await p.screenshot({ path: path.join(out, `real-${name}-full.png`), fullPage: true });
    await ctx.close();
  }
  console.log("ERREURS", errs);
  await b.close();
})();
