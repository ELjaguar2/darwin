// Recette QA 2026-11-12 : pilote l'interface L17 contre npm run replay (port 3000). Usage : NODE_PATH=<node_modules avec playwright> node tests/e2e/recette-replay-ui.cjs <dossier> <prefixe>
const { chromium } = require("playwright");
const out = process.argv[2], tag = process.argv[3];
const BASE = "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const errs = [], failed = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  p.on("requestfailed", (r) => failed.push(r.url()));
  const api = () => p.evaluate(() => fetch("/api/replay").then((r) => r.json()));
  const info = async (label) => {
    const o = await p.evaluate(() => ({
      pill: document.querySelector("#modePill")?.textContent.trim(), banner: document.querySelector("#replayText")?.textContent.trim(),
      bannerVisible: !!document.querySelector("#replayBanner") && getComputedStyle(document.querySelector("#replayBanner")).display !== "none" && document.querySelector("#replayBanner").offsetHeight > 0,
      cards: document.querySelectorAll("#strip .agent-card").length, threads: document.querySelectorAll("#feed .thread").length,
      toasts: document.querySelectorAll("#toasts .toast").length, lnodes: document.querySelectorAll(".lnode").length,
      deadNodes: document.querySelectorAll(".lnode.dead").length, inputDisabled: document.querySelector("#mInput")?.disabled }));
    const r = await api();
    console.log(label, JSON.stringify(o), "replay=", r.phase, r.speed, r.position + "/" + r.total);
  };
  await p.goto(BASE + "/");
  await p.waitForTimeout(2500);
  await info("debut");
  await p.screenshot({ path: `${out}/${tag}-mission-debut.png` });
  await p.click('[data-tab="lignees"]'); await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/${tag}-lignees-debut.png` });
  await p.click('[data-tab="preuves"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${tag}-preuves-debut.png` });
  await p.click('[data-tab="mission"]');
  // boutons de vitesse
  const btns = await p.$$eval("#replayBanner .rp-ctl button", (n) => n.map((x) => x.textContent.trim() + (x.disabled ? "(disabled)" : "")));
  console.log("boutons:", JSON.stringify(btns));
  const speedBtn = async (label) => {
    const loc = p.locator("#replayBanner .rp-ctl button", { hasText: new RegExp("^\\s*" + label + "\\s*$") });
    await loc.first().click(); await p.waitForTimeout(700);
    console.log("clic", label, "->", JSON.stringify(await api()));
  };
  await speedBtn("x1"); await speedBtn("x20");
  let shotMid = false;
  for (let i = 0; i < 120; i++) {
    await sleep(3000);
    const r = await api();
    if (!shotMid && r.position > r.total / 2) {
      shotMid = true;
      await info("milieu");
      await p.screenshot({ path: `${out}/${tag}-mission-milieu.png` });
      await p.click('[data-tab="lignees"]'); await p.waitForTimeout(1200);
      await p.screenshot({ path: `${out}/${tag}-lignees-milieu.png` });
      await p.click('[data-tab="preuves"]'); await p.waitForTimeout(800);
      await p.screenshot({ path: `${out}/${tag}-preuves-milieu.png`, fullPage: true });
      await p.click('[data-tab="mission"]');
    }
    if (r.phase === "ended") break;
  }
  await p.waitForTimeout(1500);
  await info("fin");
  await p.screenshot({ path: `${out}/${tag}-mission-fin.png` });
  await p.click('[data-tab="lignees"]'); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${tag}-lignees-fin.png` });
  // clic sur un noeud (mort si possible, sinon premier)
  const dead = await p.$$(".lnode.dead");
  const all = await p.$$(".lnode");
  const target = dead[0] ?? all[Math.min(1, all.length - 1)];
  if (target) { await target.click({ force: true }); await p.waitForTimeout(1000); }
  await p.screenshot({ path: `${out}/${tag}-lignees-panneau.png` });
  const panel = await p.evaluate(() => { const e = document.querySelector("#lpanel, .lpanel, aside"); return e ? e.textContent.slice(0, 300) : null; });
  console.log("panneau:", panel);
  await p.keyboard.press("Escape");
  await p.click('[data-tab="preuves"]'); await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/${tag}-preuves-fin.png`, fullPage: true });
  const links = await p.$$eval("a[href]", (n) => n.map((a) => ({ h: a.href, t: a.textContent.trim().slice(0, 30), tg: a.target, rel: a.rel })).filter((x) => /nearblocks|near/.test(x.h)));
  console.log("liens explorer:", links.length, JSON.stringify(links.slice(0, 4)));
  console.log("liens hors nearblocks:", JSON.stringify(links.filter((l) => !/^https:\/\/(testnet\.)?nearblocks\.io\//.test(l.h)).slice(0, 5)));
  const tee = await p.evaluate(() => (document.querySelector("#view-preuves, [data-view=preuves], main")?.textContent.match(/TEE[^.]{0,200}/) || [null])[0]);
  console.log("TEE:", tee);
  console.log("ERRS", JSON.stringify(errs), "FAILED", JSON.stringify(failed));
  // /classique
  const resp = await p.goto(BASE + "/classique");
  await p.waitForTimeout(2500);
  console.log("classique url:", p.url(), "banner:", await p.evaluate(() => document.querySelector("#replayBanner, .replay-banner")?.textContent?.trim().slice(0, 120)));
  await p.screenshot({ path: `${out}/${tag}-classique.png` });
  // mobile
  const m = await (await b.newContext({ viewport: { width: 375, height: 800 }, colorScheme: "dark", isMobile: true, hasTouch: true })).newPage();
  const merrs = [];
  m.on("console", (x) => { if (x.type() === "error") merrs.push(x.text()); });
  await m.goto(BASE + "/"); await m.waitForTimeout(2500);
  for (const t of ["mission", "lignees", "preuves"]) {
    await m.click(`[data-tab="${t}"]`); await m.waitForTimeout(1000);
    const sw = await m.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    console.log("mobile", t, "scrollWidth/innerWidth", sw.join("/"));
    await m.screenshot({ path: `${out}/${tag}-mobile-${t}.png` });
  }
  console.log("mobile errs", JSON.stringify(merrs));
  await b.close();
})();
