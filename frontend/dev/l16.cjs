// L16 checks (professions, specialization, market, form, deliverable) against the fake server, or the real backend via REAL_URL.
// Usage: NODE_PATH=<node_modules with playwright> node frontend/dev/l16.cjs <captureFolder> [--no-catalogue]
// Targets the classic interface (/?classique).
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const out = process.argv[2] || ".";
const extra = process.argv.slice(3).filter((a) => a.startsWith("--"));
const noCat = extra.includes("--no-catalogue");
const PORT = 3251;
const REAL = process.env.REAL_URL;
const BASE = REAL ?? `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "OK   " : "FAIL ") + m); };
(async () => { try {
  const srv = REAL ? { kill() {} } : spawn("node", [path.join(__dirname, "fake-server.mjs"), `--port=${PORT}`, "--tick=" + (process.env.TICK ?? 250), ...extra], { stdio: "inherit" });
  await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", acceptDownloads: true });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto(BASE + "/?classique&debug");
  await p.waitForTimeout(Number(process.env.WAIT ?? 22000));

  // (5) tree: 6 profession colors
  const legend = await p.$$eval("#legend li .sw", (n) => n.length);
  ok(legend === 6, "tree legend: 6 professions");
  const nodeCls = await p.$$eval(".node", (n) => [...new Set(n.map((x) => [...x.classList].find((c) => c.startsWith("p-"))))]);
  ok(nodeCls.length >= 1 && nodeCls.every((c) => /^p-(logo|finance|architecture|marketing|translation|legal)$/.test(c)), "nodes colored by profession: " + nodeCls.join(","));
  // (4) specialization
  const rows = await p.$$eval("#spec .spec-row", (n) => n.length);
  const segs = await p.$$eval("#spec .seg", (n) => n.length);
  ok(rows >= 1 && segs >= 1, `specialization: ${rows} generations, ${segs} segments`);
  ok((await p.textContent("#specHint")).includes("alive"), "specialization: alive summary");
  // (3) market
  const hist = await p.$$eval("#mHist .mev, #mActive .mev", (n) => n.length);
  ok(hist >= 1, `market: ${hist} event(s) displayed`);
  const mult = await p.$$eval(".mev-mult", (n) => n.map((x) => x.textContent));
  ok(mult.some((t) => /×3|×0\.3/.test(t)), "market: multipliers ×3 / ×0.3: " + mult.join(" "));
  const prices = await p.$$eval("#prices li", (n) => n.length);
  ok(prices === 6, "floor price: 6 rows" + (noCat ? " (fallback without price)" : ""));
  // (1) form
  const opts = await p.$$eval("#fProf option", (n) => n.map((o) => o.textContent));
  ok(opts.length === 6, "form: 6 professions: " + opts.join(" | "));
  if (!noCat) {
    ok(opts[0].includes("0.045"), "form: floor price in the labels");
    ok((await p.inputValue("#fBudget")) === "0.045", "budget pre-filled to the logo minimum");
    await p.selectOption("#fProf", "translation");
    ok((await p.inputValue("#fBudget")) === "0.012", "budget = 0.012 for translation");
    await p.selectOption("#fProf", "legal");
    ok((await p.textContent("#fProfInfo")).includes("not legal advice"), "legal warning visible for legal");
    await p.selectOption("#fProf", "logo");
    ok((await p.textContent("#fProfInfo")).includes("original"), "original logo reminder");
    await p.fill("#fTitle", "Logo test"); await p.fill("#fPrompt", "A logo for my neighborhood bakery");
    await p.fill("#fBudget", "0.001"); await p.click("#fSubmit");
    const msg = await p.textContent("#fStatus");
    ok(/too low/i.test(msg) && msg.includes("0.045"), "budget too low: readable message: " + msg.slice(0, 120));
    await p.fill("#fBudget", "0.05"); await p.click("#fSubmit");
    await p.waitForTimeout(600);
    ok(/posted/.test(await p.textContent("#fStatus")), "task posted: " + (await p.textContent("#fStatus")).slice(0, 60));
  }
  // (2) task view: open a delivered task of each type
  // NB-1: the fake server draws professions at random: wait (up to 90 s) for a finished, rendered task of each tested profession
  if (!noCat) {
    await p.waitForFunction(() => {
      const done = (pr) => [...window.__darwin.store.tasks.values()].some((t) => t.profession === pr && ["settled", "rejected"].includes(t.status) && document.getElementById("task-" + t.id));
      return done("logo") && done("architecture");
    }, null, { timeout: 90000, polling: 500 }).catch(() => console.log("note: no finished logo/architecture task in time, conditional sections skipped"));
  }
  const taskInfo = await p.evaluate(() => [...window.__darwin.store.tasks.values()].filter((t) => ["settled", "rejected"].includes(t.status) && document.getElementById("task-" + t.id)).map((t) => [t.id, t.profession]));
  ok(taskInfo.length > 0, "finished tasks: " + taskInfo.length);
  const byProf = {};
  for (const [id, pr] of taskInfo) byProf[pr] ??= id;
  console.log("professions with deliverable:", Object.keys(byProf).join(","));
  const open = async (id) => { await p.evaluate((i) => { const d = document.querySelector(`#task-${i} details`); if (d) { d.open = true; } }, id); await p.waitForSelector(`#task-${id} .deliverable`, { timeout: 15000 }).catch(() => {}); };
  if (!noCat) {
    if (byProf.logo) {
      await open(byProf.logo);
      const imgs = await p.$$eval(`#task-${byProf.logo} .deliverable img`, (n) => n.map((i) => i.src.slice(0, 26)));
      ok(imgs.length === 3 && imgs.every((s) => s.startsWith("data:image/svg+xml")), "logo: 3 <img> data URIs");
      ok((await p.$$eval(`#task-${byProf.logo} .deliverable svg, #task-${byProf.logo} .deliverable script`, (n) => n.length)) === 0, "logo: no <svg>/<script> injected into the DOM");
      ok((await p.evaluate(() => window.__pwned)) === undefined, "no SVG script was executed");
      ok((await p.$$eval(`#task-${byProf.logo} .btn-dl`, (n) => n.length)) === 3, "logo: 3 Download buttons");
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), p.click(`#task-${byProf.logo} .btn-dl`)]);
      ok(!!dl && /^logo-1\.svg$/.test(dl.suggestedFilename()), "download logo-1.svg: " + dl?.suggestedFilename());
      ok(/Accepted|Rejected/.test(await p.textContent(`#task-${byProf.logo} .verdict`)) && /Score \d+%/.test(await p.textContent(`#task-${byProf.logo} .score`)), "verdict badge + score");
      ok(/\$/.test(await p.textContent(`#task-${byProf.logo} .dl-summary`)), "production and judge costs displayed");
      ok((await p.$$eval(`#task-${byProf.logo} .rubric-list li`, (n) => n.length)) === 3, "scoring rubric");
      ok((await p.$$eval(`#task-${byProf.logo} .life li`, (n) => n.length)) === 6, "lifecycle: 6 steps");
      await p.locator(`#task-${byProf.logo}`).scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(out, "l16-logo.png") });
    }
    if (byProf.architecture) {
      await open(byProf.architecture);
      const sel = `#task-${byProf.architecture} .deliverable`;
      ok((await p.$$eval(`${sel} h3, ${sel} h4, ${sel} table, ${sel} li`, (n) => n.length)) > 3, "architecture: Markdown rendered (headings, lists, table)");
      ok((await p.$$eval(`${sel} img, ${sel} script`, (n) => n.length)) === 0, "architecture: Markdown <img onerror>/<script> stay text");
      ok((await p.evaluate(() => window.__pwned)) === undefined, "no execution from the Markdown");
      ok((await p.textContent(sel)).includes("graph TD"), "mermaid: source displayed");
      await p.locator(`#task-${byProf.architecture}`).scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(out, "l16-architecture.png") });
    }
    const fresh = await p.evaluate(() => [...window.__darwin.store.tasks.values()].filter((t) => ["settled", "rejected"].includes(t.status) && !["logo", "architecture"].includes(t.profession) && document.getElementById("task-" + t.id)).map((t) => t.id));
    const other = fresh[0];
    if (other) { await open(other); ok((await p.$$eval(`#task-${other} .deliverable .md`, (n) => n.length)) >= 1, "other profession: formatted text"); }
  } else {
    const any = taskInfo[0]?.[0];
    if (any) { await open(any); ok(/not available/.test(await p.textContent(`#task-${any}`)), "404 fallback: \"deliverable not available\" message"); }
  }
  // large captures
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: path.join(out, "l16-desktop-top.png") });
  await p.locator(".c-spec").scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(out, "l16-spec-market.png") });
  await p.screenshot({ path: path.join(out, "l16-full.png"), fullPage: true });
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 375, height: 812 });
  m.on("pageerror", (e) => errs.push("MOBILE PAGEERROR " + e.message));
  await m.goto(BASE + "/?classique&debug"); await m.waitForTimeout(6000);
  const sw = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(sw[0] <= sw[1] + 1, `mobile 375: no horizontal scroll (${sw})`);
  await m.locator(".c-spec").scrollIntoViewIfNeeded();
  await m.screenshot({ path: path.join(out, "l16-mobile-spec.png") });
  await m.locator(".c-form").scrollIntoViewIfNeeded();
  await m.screenshot({ path: path.join(out, "l16-mobile-form.png") });
  await m.screenshot({ path: path.join(out, "l16-mobile-full.png"), fullPage: true });
  ok(errs.filter((e) => !/404/.test(e)).length === 0, "no console/page error: " + JSON.stringify(errs.slice(0, 4)));
  console.log(`\n${pass} OK, ${fail} FAIL`);
  await b.close(); srv.kill();
  process.exit(fail ? 1 : 0);
} catch (e) { console.log("FAIL exception: " + String(e?.message ?? e).split("\n")[0]); process.exit(1); } })();
