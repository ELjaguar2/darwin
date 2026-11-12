// Attend la première mort d'un agent contre le vrai backend et capture l'arbre + lignées + liste.
// REAL_URL=http://127.0.0.1:3210 NODE_PATH=... node frontend/dev/deaths.cjs <fichierSortie.png>
const { chromium } = require("playwright");
const URL_ = process.env.REAL_URL || "http://127.0.0.1:3000";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto(String(URL_).replace(/[/]+$/, "") + "/?classique");
  await p.waitForSelector(".node.dead", { timeout: 300000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({
    deadNodes: document.querySelectorAll(".node.dead").length,
    deadStyle: (() => { const e = document.querySelector(".node.dead .body"); const c = getComputedStyle(e); return { fill: c.fill, dash: c.strokeDasharray }; })(),
    crossVisible: getComputedStyle(document.querySelector(".node.dead .cross")).display,
    deadInList: document.querySelectorAll("#agents li.dead").length,
    lineageTxt: [...document.querySelectorAll(".lin-txt")].map((e) => e.textContent),
    morts: document.getElementById("stDead").textContent,
    tick: document.getElementById("tickInfo").textContent,
  }));
  console.log(JSON.stringify(info, null, 1));
  await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: process.argv[2] || "morts.png" });
  console.log("erreurs", errs);
  await b.close();
})();
