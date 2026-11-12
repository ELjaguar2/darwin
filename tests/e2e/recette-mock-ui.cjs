// QA recipe 2026-11-12: drives the default page in MOCK mode. Usage: BASE=http://127.0.0.1:PORT NODE_PATH=<node_modules with playwright> node tests/e2e/recette-mock-ui.cjs <dir>
const { chromium } = require("playwright");
const out = process.argv[2];
const BASE = process.env.BASE || "http://127.0.0.1:3000";
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto(BASE + "/");
  await p.waitForTimeout(3000);
  console.log("pill:", await p.textContent("#modePill"));
  console.log("tabs:", JSON.stringify(await p.$$eval(".tab", (n) => n.map((x) => x.textContent.trim()))));
  console.log("placeholder:", await p.getAttribute("#mInput", "placeholder"));
  await p.screenshot({ path: `${out}/mock-mission.png` });
  await p.fill("#mInput", "Write a short marketing slogan for a neighbourhood bookshop.");
  await p.click("#jobBtn");
  console.log("menu:", JSON.stringify(await p.$$eval("#jobMenu button", (n) => n.map((x) => x.textContent.trim()))));
  await p.click('#jobMenu button:has-text("Marketing")');
  console.log("budget hint:", await p.textContent("#budgetMin"), "| default budget:", await p.inputValue("#budgetInput"));
  await p.fill("#budgetInput", "1");
  console.log("composer buttons:", JSON.stringify(await p.$$eval("#composer button", (n) => n.map((x) => x.id + ":" + x.textContent.trim()))));
  await p.click("#composer button[type=submit], #sendBtn, #composer button:has-text('Send')");
  let paid = false;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    const t = await p.evaluate(() => document.querySelector("#feed .thread.mine")?.textContent || "");
    if (/paid/i.test(t) && /✓/.test(t)) { paid = true; console.log("paid after", i + 1, "s"); break; }
  }
  console.log("PAID:", paid);
  const mine = p.locator("#feed .thread.mine");
  if (await mine.count()) { console.log("thread:", (await mine.first().textContent()).replace(/\s+/g, " ").slice(0, 500)); await mine.first().screenshot({ path: `${out}/mock-mission-thread.png` }); }
  await p.screenshot({ path: `${out}/mock-mission-after.png` });
  await p.waitForTimeout(40000);
  await p.click('[data-tab="lignees"]'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/mock-lignees.png` });
  const nodes = await p.$$(".lnode");
  console.log("nodes:", nodes.length);
  await nodes[Math.min(nodes.length - 1, 4)].click({ force: true }); await p.waitForTimeout(1200);
  console.log("panel:", (await p.textContent("#panel")).replace(/\s+/g, " ").slice(0, 400));
  await p.screenshot({ path: `${out}/mock-lignees-panneau.png` });
  await p.click('[data-tab="preuves"]'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/mock-preuves.png`, fullPage: true });
  console.log("proof:", (await p.textContent("main")).replace(/\s+/g, " ").slice(0, 400));
  await p.goto(BASE + "/classique"); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/mock-classique.png` });
  const m = await (await b.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true })).newPage();
  await m.goto(BASE + "/"); await m.waitForTimeout(2500);
  for (const t of ["mission", "lignees", "preuves"]) {
    await m.click(`[data-tab="${t}"]`); await m.waitForTimeout(900);
    console.log("mobile", t, (await m.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])).join("/"));
    await m.screenshot({ path: `${out}/mock-mobile-${t}.png` });
  }
  console.log("ERRS", JSON.stringify(errs));
  await b.close();
})();
