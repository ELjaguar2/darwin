// Capture rapide des 3 pages (développement). Usage : NODE_PATH=... node shot17.cjs <url> <dossier> [prefixe] [attente_ms]
const { chromium } = require("playwright");
const [url, out, prefix = "l17", wait = "15000"] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: "dark", deviceScaleFactor: name === "mobile" ? 2 : 1 });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
    await p.goto(url + "/?debug");
    await p.waitForTimeout(Number(wait));
    await p.screenshot({ path: `${out}/${prefix}-mission-${name}.png` });
    await p.goto(url + "/?debug#/lignees"); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${prefix}-lignees-${name}.png` });
    await p.click(".lnode"); await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/${prefix}-lignees-panneau-${name}.png` });
    await p.goto(url + "/?debug#/preuves"); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${prefix}-preuves-${name}.png`, fullPage: true });
    await ctx.close();
  }
  console.log("erreurs:", errs.slice(0, 8));
  await b.close();
})();
