// End-to-end test of the frontend against the fake server (Playwright). Run:
//   NODE_PATH=<node_modules with playwright> node frontend/dev/e2e.cjs [captureFolder]
// Targets the classic interface (/?classique).
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
    await p.goto(String(url).replace(/[/]+$/, "") + "/?classique");
    return p;
  };

  // 1. normal run: tree, generations, form OK + 400
  let s = await start("--tick=100");
  let p = await newPage(s.url);
  await p.waitForFunction(() => document.querySelectorAll(".node").length >= 6, null, { timeout: 45000 });
  ok("tree: nodes displayed", true);
  await p.waitForFunction(() => Number(document.getElementById("genNum").textContent) >= 3, null, { timeout: 60000 });
  ok("generation counter >= 3", true, await p.textContent("#genNum"));
  await p.waitForSelector("#feed li .hash");
  ok("transaction stream filled", (await p.$$("#feed li")).length > 3);
  ok("chronicle not empty", (await p.$$("#chron li")).length > 3);
  ok("mock: no explorer link", (await p.$$("#feed li a.hash")).length === 0);
  ok("mock banner", /MOCK MODE/.test(await p.textContent("#banners")));
  ok("simulated client label", /Simulated client/.test(await p.textContent("#banners")));
  ok("visitor funded-by-demo label", /Visitor \(funded by the demo account\)/.test(await p.textContent("#banners")));
  ok("task labelled simulated", /simulated/.test(await p.textContent("#tasks")));
  await p.click("#agents li:first-child button");
  await p.waitForSelector("#fiche h3");
  ok("agent profile", true, await p.textContent("#fiche h3"));
  ok("readable letter", (await p.textContent("#letter")).length > 40);
  await p.fill("#fTitle", "Test frontend"); await p.fill("#fPrompt", "Write a haiku about natural selection."); await p.fill("#fBudget", "9");
  await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.err");
  ok("form 400: server message", /out of bounds|maximum/.test(await p.textContent("#fStatus")), (await p.textContent("#fStatus")).slice(0, 80));
  await p.fill("#fBudget", "1.2"); await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.ok");
  ok("form 201", /posted/.test(await p.textContent("#fStatus")));
  await p.waitForFunction(() => /Visitor \(funded/.test(document.getElementById("tasks").textContent), null, { timeout: 5000 });
  ok("visitor task visible with label", true);
  await p.fill("#fTitle", "x"); await p.click("#fSubmit");
  ok("local validation", /Incomplete/.test(await p.textContent("#fStatus")));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(out, "desktop.png") });
  await p.click("#themeBtn");
  const theme = await p.evaluate(() => document.documentElement.dataset.theme);
  ok("theme toggle", theme === "dark" || theme === "light", theme);
  await p.screenshot({ path: path.join(out, "desktop-alt-theme.png") });

  // 2. SSE resume: cut then new server on the same port (log at zero -> reset event)
  s.srv.kill();
  await p.waitForFunction(() => /Reconnecting|Offline/.test(document.getElementById("connText").textContent), null, { timeout: 15000 });
  ok("connection state: cut detected", true, await p.textContent("#connText"));
  const srv2 = spawn("node", [path.join(__dirname, "fake-server.mjs"), `--port=${s.p}`, "--tick=100", "--seed=11"], { stdio: "ignore" });
  await p.waitForFunction(() => document.getElementById("connText").textContent === "Live", null, { timeout: 30000 });
  ok("SSE resume after server restart", true);
  await p.waitForTimeout(3000);
  ok("after reset: the tree rebuilds", (await p.$$(".node")).length >= 4, String((await p.$$(".node")).length));
  srv2.kill();
  await p.context().close();

  // 3. degraded escrow + 429
  s = await start("--tick=100", "--degraded", "--task-status=429");
  p = await newPage(s.url);
  await p.waitForSelector("#banners .pill.danger");
  const bt = await p.textContent("#banners");
  ok("Degraded escrow badge", /Degraded escrow/.test(bt));
  ok("mock AND degraded simultaneously", /MOCK MODE/.test(bt) && /Degraded escrow/.test(bt));
  await p.fill("#fTitle", "Test 429"); await p.fill("#fPrompt", "An instruction that is long enough."); await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.warn");
  ok("form 429 + Retry-After", /429/.test(await p.textContent("#fStatus")) && /Retry in/.test(await p.textContent("#fSubmit")), await p.textContent("#fSubmit"));
  ok("button locked while waiting", await p.isDisabled("#fSubmit"));
  await p.context().close(); s.srv.kill();

  // 4. 503 (validation in progress)
  s = await start("--tick=100", "--task-status=503");
  p = await newPage(s.url);
  await p.fill("#fTitle", "Test 503"); await p.fill("#fPrompt", "An instruction that is long enough."); await p.click("#fSubmit");
  await p.waitForSelector("#fStatus.warn");
  ok("form 503 (waiting state)", /503/.test(await p.textContent("#fStatus")) && /not an outage/.test(await p.textContent("#fStatus")));
  await p.context().close(); s.srv.kill();

  // 5. testnet: explorer links
  s = await start("--tick=100", "--testnet");
  p = await newPage(s.url);
  await p.waitForSelector("#feed li a.hash", { timeout: 15000 });
  const href = await p.getAttribute("#feed li a.hash", "href");
  ok("testnet: nearblocks explorer link", /^https:\/\/testnet\.nearblocks\.io\/txns\/[0-9a-f]{44}$/.test(href), href);
  ok("testnet: no mock banner", !/MOCK MODE/.test(await p.textContent("#banners")));
  ok("testnet: rel=noopener link", (await p.getAttribute("#feed li a.hash", "rel")).includes("noopener"));
  await p.context().close(); s.srv.kill();

  // 6. mobile 320 px (reduced motion) and 375 px, no horizontal scroll
  s = await start("--tick=100");
  p = await newPage(s.url, { width: 320, height: 640 }, { reducedMotion: "reduce" });
  await p.waitForFunction(() => document.querySelectorAll(".node").length >= 6, null, { timeout: 45000 });
  await p.waitForTimeout(8000);
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok("320 px: no horizontal scroll", sw[0] <= sw[1], JSON.stringify(sw));
  await p.screenshot({ path: path.join(out, "mobile-320.png"), fullPage: true });
  await p.context().close();
  p = await newPage(s.url, { width: 375, height: 812 });
  await p.waitForTimeout(6000);
  const sw2 = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok("375 px: no horizontal scroll", sw2[0] <= sw2[1], JSON.stringify(sw2));
  await p.screenshot({ path: path.join(out, "mobile.png") });
  await p.screenshot({ path: path.join(out, "mobile-full.png"), fullPage: true });
  await p.context().close(); s.srv.kill();

  // 7. malformed SSE messages (null, non-object, broken JSON, unknown type, non-numeric deltas, seq gap)
  s = await start("--tick=100", "--garbage");
  p = await newPage(s.url + "?debug");
  await p.waitForFunction(() => document.querySelectorAll(".node").length >= 4, null, { timeout: 20000 });
  const t0 = await p.evaluate(() => window.__darwin.store.tick);
  await p.waitForTimeout(12000);
  const st = await p.evaluate(() => ({ tick: window.__darwin.store.tick, agents: window.__darwin.store.agents.size, ...window.__darwin.stats() }));
  ok("malformed SSE: the stream keeps advancing", st.tick > t0 + 10, JSON.stringify(st));
  ok("malformed SSE: invalid messages ignored and counted", st.invalidMsgs > 20, String(st.invalidMsgs));
  ok("malformed SSE: the tree stays displayed", (await p.$$(".node")).length >= 4);
  await p.context().close();
  p = await newPage(s.url);
  ok("window.__darwin absent outside ?debug", await p.evaluate(() => window.__darwin === undefined));
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
  ok("explorer allowlist", exp[0] === "https://testnet.nearblocks.io/txns/abc123" && exp[1] === "https://testnet.nearblocks.io/txns/abc123" && exp[2] === null && exp[3] === "https://testnet.nearblocks.io/txns/abc123", JSON.stringify(exp.slice(0, 4)));
  ok("tolerant big()", exp[4] === "0" && exp[5] === "0" && exp[6] === "12", JSON.stringify(exp.slice(4)));
  await p.context().close(); s.srv.kill();

  console.log("CONSOLE ERRORS:", errs.length ? errs : "none");
  await b.close();
  const ko = results.filter((r) => r[0] === "KO ").length;
  console.log(ko ? `${ko} FAILURE(S)` : "ALL OK");
  process.exit(ko || errs.length ? 1 : 0);
})().catch((e) => { console.error("EXCEPTION", e); process.exit(2); });
