// L17 checks (three-tab interface) against the fake server, or a real backend (mock/replay) via REAL_URL.
// Usage: NODE_PATH=<node_modules with playwright> node frontend/dev/l17.cjs <captureFolder> [--replay]
//   --replay: REAL_URL points to an `npm run replay` backend; the bar must be disabled and the banner shown.
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
  p.on("console", (m) => { if (m.type() === "error" && !/status of 40[04]/.test(m.text())) errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto(BASE + "/?debug");
  await p.waitForTimeout(Number(process.env.WAIT ?? 12000));

  // navigation and always-visible mode
  ok((await p.$$eval(".tabs .tab", (n) => n.length)) === 3, "3 tabs: Mission, Lineage, Proof");
  const mode = (await p.textContent("#modePill")).toUpperCase();
  ok(REPLAY ? mode.includes("REPLAY") : /MOCK|TESTNET/.test(mode), "mode shown in the header: " + mode.trim());
  if (REPLAY) {
    ok(await p.isVisible("#replayBanner"), "replay banner visible");
    ok(/Replay of a (real testnet |recorded )?run/.test(await p.textContent("#replayText")), "banner: " + (await p.textContent("#replayText")));
    ok((await p.$$eval("#replayBanner .rp-ctl button", (n) => n.length)) >= 3, "speed buttons x1/x5/x20");
    ok(await p.isDisabled("#mInput"), "mission bar disabled during replay");
    ok((await p.getAttribute("#mInput", "placeholder")).includes("disabled during replay"), "\"Missions disabled during replay\" notice");
    // NB-6: a single message, no duplicate
    const dup = await p.$$eval("#composer *", (n) => n.filter((e) => !e.hidden && e.offsetParent && /Missions disabled/.test(e.textContent) && e.children.length === 0).length);
    ok(dup === 0, "NB-6: the \"disabled\" message is not repeated under the bar (" + dup + ")");
    // NB-2: notifications sit below the banner, the x1/x5/x20 buttons stay clickable
    await p.evaluate(() => { const b = document.getElementById("toasts"); for (let i = 0; i < 3; i++) { const t = document.createElement("div"); t.className = "toast birth"; t.textContent = "Test notification " + i; b.append(t); } window.dispatchEvent(new Event("resize")); });
    await p.waitForTimeout(200);
    const geo = await p.evaluate(() => { const ban = document.getElementById("replayBanner").getBoundingClientRect(); const t = document.querySelector("#toasts .toast").getBoundingClientRect(); const bt = [...document.querySelectorAll("#replayBanner .rp-ctl button")].map((x) => { const r = x.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === x; }); return { banBottom: ban.bottom, toastTop: t.top, bt }; });
    ok(geo.toastTop >= geo.banBottom - 1, `NB-2: notifications below the banner (${Math.round(geo.toastTop)} >= ${Math.round(geo.banBottom)})`);
    ok(geo.bt.length >= 3 && geo.bt.every(Boolean), "NB-2: x1/x5/x20 buttons not covered");
    await p.evaluate(() => document.querySelectorAll("#toasts .toast").forEach((t) => t.remove()));
    // NB-5: replay end
    const rp = await p.evaluate(() => fetch("/api/replay").then((r) => r.json()).catch(() => ({})));
    if (rp.phase === "ended") {
      ok(/Replay finished/.test(await p.textContent("#connText")), "NB-5b: status dot \"Replay finished\": " + (await p.textContent("#connText")));
      const alive = await p.$$eval("#strip .agent-card", (n) => n.length);
      const se = await p.textContent("#stripEmpty");
      ok(alive > 0 || (!/Waiting for the first/.test(se) && /No living agent left|Replay finished/.test(se)), "NB-5a: correct end message: " + (alive ? alive + " cards" : se));
    } else console.log("note: replay not finished, NB-5 not evaluated here (" + rp.phase + ")");
  } else ok(!(await p.isVisible("#replayBanner")), "no replay banner outside replay");

  // V-6 / V-7 / V-9: visible warnings
  ok(!REPLAY ? (await p.isVisible("#publicNote")) && /public/i.test(await p.textContent("#publicNote")) && /funded by the demo account/.test(await p.textContent("#publicNote")) : true, "V-6: \"public data\" and \"funded by the demo account\" visible near the composer");
  { const st = await p.evaluate(() => ({ mode: window.__darwin.core.mode, esc: window.__darwin.core.health?.escrow })); const want = !(st.mode === "testnet" && st.esc && st.esc !== "contract"); ok((await p.isHidden("#escBadge")) === want, `V-7: \"degraded escrow\" badge ${want ? "absent" : "present"} (mode ${st.mode}, escrow ${st.esc})`); }
  if (REPLAY) ok(/recorded (real )?run/.test(await p.textContent("#modePill")), "V-9: pill: " + (await p.textContent("#modePill")).trim());
  ok(/Public data/.test(await p.textContent("#composer")) || REPLAY, "V-6: warning in the composer");
  // Mission page: agent cards
  const cards = await p.$$eval("#strip .agent-card", (n) => n.length);
  const extinct = REPLAY && cards === 0 && /No living agent left/.test(await p.textContent("#stripEmpty"));
  ok(cards >= 4 || extinct, `${cards} living agent cards${extinct ? " (population extinct, end message)" : ""}`);
  ok(extinct || (await p.$$eval("#strip .agent-card .gauge-fill", (n) => n.length)) === cards, "each card carries a balance gauge");
  ok(extinct || (await p.$$eval("#strip .agent-card .avatar .av-badge svg", (n) => n.length)) === cards, "each card carries the profession icon");
  ok((await p.$$eval("#feed .thread", (n) => n.length)) >= 1, "feed: at least one live mission");
  ok((await p.$$eval("#feed .rtag.tag-sim", (n) => n.length)) >= 1 || REPLAY, "\"simulated\" label visible on the artificial client");

  if (!REPLAY) {
    // bar: profession and budget inferred, editable
    await p.fill("#mInput", "Draw a logo for my neighborhood bakery");
    ok((await p.textContent("#jobBtn")).includes("Logo"), "profession inferred from the text: Logo");
    const bud = Number(await p.inputValue("#budgetInput"));
    const hint = await p.textContent("#budgetMin");
    const hm = /^Minimum for Logo: ([\d.]+) NEAR$/.exec(hint.trim());
    ok(!!hm && Math.abs(bud - Number(hm[1])) < 1e-9 && bud > 0, `budget pre-filled to the catalogue minimum (${bud}) and hint shown: "${hint.trim()}"`);
    // L19: untouched budget accepted for each profession (marketing, logo, translation), through to "paid"
    const cases = [["Write a short marketing slogan for a bookshop", "Marketing"], ["Draw a logo for my neighborhood bakery", "Logo"], ["Translate this paragraph into French: the shop opens at nine", "Translation"]];
    for (const [txt, lab] of cases) {
      const before = await p.$$eval("#feed .thread.mine", (n) => n.length);
      const paid0 = await p.$$eval("#feed .thread.mine .pill-sys.paid", (n) => n.length);
      await p.fill("#mInput", txt);
      ok((await p.textContent("#jobBtn")).includes(lab), `L19 ${lab}: profession inferred`);
      const h1 = (await p.textContent("#budgetMin")).trim(), v = Number(await p.inputValue("#budgetInput"));
      ok(new RegExp(`^Minimum for ${lab}[^:]*: [0-9.]+ NEAR$`).test(h1) && v > 0 && Math.abs(v - Number(h1.match(/([0-9.]+) NEAR/)[1])) < 1e-9, `L19 ${lab}: budget ${v} = minimum, hint "${h1}"`);
      const resp = p.waitForResponse((r) => r.url().endsWith("/api/tasks") && r.request().method() === "POST", { timeout: 8000 }).catch(() => null);
      await p.press("#mInput", "Enter");
      const rs = await resp;
      ok(rs && rs.status() === 201, `L19 ${lab}: POST /api/tasks -> ${rs ? rs.status() : "none"} without touching the budget`);
      await p.waitForFunction((n) => document.querySelectorAll("#feed .thread.mine").length > n, before, { timeout: 8000 }).catch(() => {});
      const jobId = lab.toLowerCase();
      const hasWorker = await p.evaluate(async (j) => { const r = await fetch("/api/agents?status=alive").then((x) => x.json()).catch(() => null); return !r || r.agents.some((a) => (a.genome?.profession ?? a.profession) === j); }, jobId);
      if (!hasWorker) { console.log(`note: no living ${lab} agent in this run, "paid" not expected (the task expires server-side)`); continue; }
      await p.waitForFunction((n) => document.querySelectorAll("#feed .thread.mine .pill-sys.paid").length > n, paid0, { timeout: 90000 }).catch(() => {});
      const paidNow = (await p.$$eval("#feed .thread.mine .pill-sys.paid", (n) => n.length)) > paid0;
      if (!paidNow) console.log("DBG threads:", JSON.stringify(await p.$$eval("#feed .thread.mine", (n) => n.map((x) => x.className + " | " + x.textContent.replace(/\s+/g, " ").slice(0, 300)))));
      ok(paidNow, `L19 ${lab}: thread reaches "paid"`);
      await p.waitForTimeout(500);
    }
    // L19: forced 400 -> message + one-click "Use the minimum"
    await p.route("**/api/tasks", (r) => r.request().method() === "POST" ? r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: { code: "BAD_REQUEST", message: "minimum budget for marketing is 0.96 NEAR" } }) }) : r.continue(), { times: 1 });
    await p.fill("#mInput", "Write a short marketing slogan for a bookshop");
    await p.evaluate(() => document.getElementById("composer").requestSubmit());
    await p.waitForSelector("#useMin", { timeout: 4000 }).catch(() => {});
    ok(/rejected/i.test(await p.textContent("#mStatus")) || !!(await p.$("#useMin")), "L19: 400 shows the server message");
    if (await p.$("#useMin")) { await p.click("#useMin"); ok(Number(await p.inputValue("#budgetInput")) > 0, "L19: Use the minimum sets " + (await p.inputValue("#budgetInput"))); ok(await p.isHidden("#mStatus"), "L19: message cleared"); }
    else ok(false, "L19: \"Use the minimum\" button present after a 400");
    await p.fill("#mInput", "Draw a logo for my neighborhood bakery");
    await p.click("#jobBtn");
    ok((await p.$$eval("#jobMenu button", (n) => n.length)) === 6, "profession menu: 6 choices");
    await p.click('#jobMenu button:has-text("Translation")');
    ok((await p.textContent("#jobBtn")).includes("Translation"), "profession editable with one click");
    await p.click("#jobBtn"); await p.click('#jobMenu button:has-text("Logo")');
    await p.fill("#budgetInput", "0.001"); await p.press("#mInput", "Enter");
    ok((await p.textContent("#mStatus")).toLowerCase().includes("budget too low"), "budget too low refused locally");
    await p.fill("#budgetInput", hm ? hm[1] : "0.05");
    await p.press("#mInput", "Enter");
    await p.waitForSelector("#feed .thread.mine", { timeout: 5000 }).catch(() => {});
    if (process.env.DBG) console.log("DBG", await p.textContent("#mStatus"), await p.inputValue("#budgetInput"), await p.textContent("#jobBtn"));
    ok(!!(await p.$("#feed .thread.mine")), "after sending: the mission appears in the feed (\"you\" label)");
    await p.waitForFunction(() => document.getElementById("mInput").value === "", null, { timeout: 4000 }).catch(() => {});
    ok((await p.inputValue("#mInput")) === "", "the bar is emptied after sending");
    await p.waitForSelector("#feed .thread.mine .pill-sys.paid", { timeout: 20000 }).catch(() => {});
    ok(!!(await p.$("#feed .thread.mine .pill-sys.paid")), "feed: \"paid ✓\" displayed");
    ok(!!(await p.$("#feed .thread.mine .msg.bid")), "feed: an agent bid (price + pitch)");
    ok(!!(await p.$("#feed .thread.mine .msg.judge")), "feed: judge verdict");
    const imgs = await p.$$eval("#feed .thread.mine .cd-logo img", (n) => n.map((x) => x.src.slice(0, 26)));
    ok(imgs.length === 3 && imgs.every((s) => s.startsWith("data:image/svg+xml")), "deliverable: 3 SVG logos as <img data:> (inert)");
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const t = [...document.querySelectorAll("#feed .thread.mine")].pop(); if (t) window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 110); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, "l17-mission-flux.png") });
  }
  ok((await p.evaluate(() => window.__pwned)) === undefined, "no deliverable script was executed");
  ok((await p.$$eval("#feed script, #feed svg script, #feed [onerror], #feed [onload]", (n) => n.length)) === 0, "no script or event handler in the feed");

  // L21: agent-to-agent subcontracting in the chat feed (the replay of run8 or the fake server both contain some)
  {
    const nsub = await p.$$eval("#feed .sub-deleg", (n) => n.length);
    const txt = await p.$$eval("#feed .sub-deleg .pill-sys", (n) => n.map((x) => x.textContent));
    console.log("   L21: delegation messages in the feed:", nsub, txt[0] ? "| " + txt[0] : "");
    ok(nsub >= 1 || REPLAY, "L21: at least one delegation message in the feed");
    ok(txt.every((t) => /delegates a .*sub-task to the market/.test(t)), "L21: sentence \"X delegates a ... sub-task to the market ...\"");
    ok(txt.every((t) => /for [\d.]+ NEAR/.test(t) && (/(keeps|expects) (up to )?[\d.]+ NEAR commission/.test(t) || /no money moved|no commission/.test(t))), "L21: budget and commission displayed (computed when the journal lacks them)");
    ok((await p.$$eval("#feed .thread.sub .rtag.tag-agent", (n) => n.length)) >= (nsub ? 1 : 0), "L21: child task as a linked thread with the \"subcontract\" tag");
    // pure tracker with and without optional fields, on fabricated events
    const r = await p.evaluate(async () => {
      const { SubTracker } = await import("/subcontract.js");
      const Y = 10n ** 21n; const mk = (seq, type, data) => ({ seq, tick: seq, type, data });
      const t = new SubTracker();
      const evs = [
        mk(1, "task.posted", { task: { id: "P1", requester: { kind: "simulated" }, profession: "marketing", budget: String(100n * Y) } }),
        mk(2, "task.awarded", { taskId: "P1", winnerId: "a1", price: String(90n * Y) }),
        mk(3, "task.posted", { task: { id: "C1", requester: { kind: "agent", agentId: "a1" }, profession: "translation", budget: String(40n * Y) } }),
        mk(4, "subcontract.created", { parentTaskId: "P1", childTaskId: "C1", byAgentId: "a1" }),
        mk(5, "task.awarded", { taskId: "C1", winnerId: "a2", price: String(35n * Y) }),
        mk(6, "escrow.locked", { taskId: "C1", payer: "a1.x", amount: String(35n * Y), tx: "LOCK1" }),
        mk(7, "escrow.released", { taskId: "C1", payee: "a2.x", amount: String(35n * Y), tx: "REL1" }),
        mk(8, "task.posted", { task: { id: "C2", requester: { kind: "agent", agentId: "a1" }, profession: "logo", budget: String(30n * Y) } }),
        mk(9, "subcontract.created", { parentTaskId: "P1", childTaskId: "C2", byAgentId: "a1", profession: "logo", budget: String(30n * Y), parentPrice: String(90n * Y), commission: String(60n * Y) }),
        mk(10, "task.expired", { taskId: "C2", reason: "no_bids" }),
      ];
      for (const e of evs) t.ingest(e);
      const s = t.summary();
      return { count: s.count, awarded: s.awarded, paid: s.paid, expired: s.expired, delegated: String(s.delegated / Y), paidTotal: String(s.paidTotal / Y), commission: String(s.commission / Y), c1: String(t.record("C1").commission / Y), c2: String(t.record("C2").commission / Y), st: [t.record("C1").status, t.record("C2").status] };
    });
    ok(JSON.stringify(r) === JSON.stringify({ count: 2, awarded: 1, paid: 1, expired: 1, delegated: "35", paidTotal: "35", commission: "55", c1: "55", c2: "0", st: ["paid", "expired"] }), "L21: tracker with / without optional fields " + JSON.stringify(r));
    const dt = await p.evaluate(async () => { const m = await import("/mission.js"); const Y = 10n ** 21n; return [m.delegationText("Ada", "Translation", { budget: 40n * Y, price: 35n * Y, commission: 55n * Y, commissionKind: "actual" }), m.delegationText("Ada", null, {}), m.delegationText("Ada", "Logo", { budget: 40n * Y, commission: 50n * Y, commissionKind: "max" }), m.delegationText("Ada", "Logo", { budget: 40n * Y, commissionKind: "none", commission: 0n })]; });
    ok(/^Ada delegates a Translation sub-task to the market for [\d.]+ NEAR and keeps [\d.]+ NEAR commission$/.test(dt[0]) && dt[1] === "Ada delegates a sub-task to the market" && /keeps up to [\d.]+ NEAR commission$/.test(dt[2]) && /no money moved, delegator keeps the whole price$/.test(dt[3]), "L21: delegation sentence with / without optional parts: " + dt.join(" || "));
  }

  // Lineage
  await p.click('[data-tab="lignees"]');
  await p.waitForTimeout(1200);
  const nodes = await p.$$eval(".lnode", (n) => n.length);
  ok(nodes >= 4, `tree: ${nodes} nodes`);
  const cls = await p.$$eval(".lnode", (n) => [...new Set(n.map((x) => [...x.classList].find((c) => c.startsWith("j-"))))]);
  ok(cls.length >= 1 && cls.every((c) => /^j-/.test(c)), "nodes colored by profession: " + cls.join(","));
  const t0 = await p.getAttribute(".ltree-svg .vp", "transform");
  await p.click("#zoomIn"); await p.waitForTimeout(300);
  ok((await p.getAttribute(".ltree-svg .vp", "transform")) !== t0, "zoom (+) changes the view");
  const box = await p.locator(".ltree-svg").boundingBox();
  await p.mouse.move(box.x + 200, box.y + 300); await p.mouse.down(); await p.mouse.move(box.x + 260, box.y + 340, { steps: 4 }); await p.mouse.up();
  ok((await p.getAttribute(".ltree-svg .vp", "transform")) !== t0, "mouse panning");
  await p.click("#zoomFit"); await p.waitForTimeout(900);
  await p.click(".lnode");
  await p.waitForSelector("#panel:not([hidden])");
  ok(await p.isVisible("#panel"), "click on a node: side panel opened");
  const ptxt = await p.textContent("#panel");
  ok(/Genome/.test(ptxt) && /Personality|letters/i.test(ptxt) && /Financial history/.test(ptxt), "panel: genome, personality, letters, financial history");
  await p.press("body", "Escape");
  ok(await p.isHidden("#panel"), "Escape closes the panel");
  // an agent born from a parent: readable letter
  const child = await p.$$eval(".lnode", (n) => n.length);
  if (child > 4 || REPLAY) {
    const idx = await p.evaluate(() => { const a = [...window.__darwin.store.agents.values()].find((x) => x.parentId); return a ? a.id : null; });
    if (idx) {
      await p.evaluate((id) => { location.hash = "#/lignees"; }, idx);
      await p.evaluate((id) => document.querySelectorAll(".lnode")[[...window.__darwin.store.agents.keys()].indexOf(id)]?.dispatchEvent(new MouseEvent("click", { bubbles: true })), idx);
      await p.waitForTimeout(800);
      ok(/Letter received/.test((await p.textContent("#panel")) || ""), "child panel: parent letter displayed");
    }
  }
  await p.screenshot({ path: path.join(out, "l17-lignees.png") });
  await p.click('[data-tab="lignees"]');

  // Proof
  await p.click('[data-tab="preuves"]');
  await p.waitForTimeout(800);
  ok((await p.$$eval("#kpis .kpi", (n) => n.length)) === 5, "proof: 5 indicators");
  ok((await p.$$eval("#population .pop-row", (n) => n.length)) >= 1, "proof: population by generation");
  ok((await p.$$eval("#flows .flow", (n) => n.length)) === 3, "proof: earned / brain / passed flows");
  ok((await p.$$eval("#txs li", (n) => n.length)) >= 5, "proof: transactions listed");
  // NB-3: the brain cost is never rounded to a misleading "0.00"
  const fmt = await p.evaluate(async () => { const f = await import("/format.js"); const Y = 10n ** 24n; return [f.formatNearSmall(0), f.formatNearSmall(Y / 333n), f.formatNearSmall(Y / 100000n), f.formatNearSmall(Y / 10000n), f.formatNearSmall(Y * 17n / 10n)]; });
  ok(fmt.join("|") === "0|0.0030|< 0.0001|0.0001|1.70", "NB-3: formatNearSmall " + fmt.join(" | "));
  const brainTxt = (await p.textContent("#flows .flow.brain b")).trim();
  const brainGen = await p.$$eval("#flowGen td.brain", (n) => n.map((x) => x.textContent.trim()));
  console.log("   brain:", brainTxt, "|", brainGen.join(","));
  ok(!/^0\.00 NEAR/.test(brainTxt) && !brainGen.includes("0.00"), "NB-3: \"Spent on AI brain\" without a misleading \"0.00\": " + brainTxt);
  if (REPLAY || /TESTNET/.test(mode)) ok((await p.$$eval("#txs a.hash[href^='https://testnet.nearblocks.io/txns/']", (n) => n.length)) >= 1, "proof: nearblocks links");
  { // L21: Proof tab, "Agent-to-agent subcontracting" block
    const vis = await p.isVisible("#subBlock");
    const sm = await p.evaluate(async () => { const { subs } = await import("/subcontract.js"); const s = subs.summary(); return { count: s.count, paid: s.paid, expired: s.expired, awarded: s.awarded, integrated: s.integrated, fallback: s.fallback }; });
    ok(vis === (sm.count > 0), `L21: subcontracting block ${vis ? "visible" : "hidden"} (${sm.count} subcontracts)`);
    if (vis) {
      const k = await p.$$eval("#subBlock .sub-kpis li", (n) => n.map((x) => x.textContent));
      ok(k.length === 7 && k[0].startsWith(String(sm.count)) && k[1].startsWith(String(sm.integrated)) && k[2].startsWith(String(sm.fallback)) && k[3].startsWith(String(sm.expired)), "L21: counts shown = tracker: " + k.join(" | "));
      ok((await p.$$eval("#subBlock .sub-table tbody tr", (n) => n.length)) === Math.min(40, sm.count), "L21: one table row per subcontract");
      if (sm.paid && REPLAY) ok((await p.$$eval("#subBlock .sub-table a[href^='https://testnet.nearblocks.io/txns/']", (n) => n.length)) >= 2 * sm.paid, "L21: nearblocks links for escrow and release");
    }
    await p.screenshot({ path: path.join(out, "l21-subcontract-proof.png"), fullPage: true });
  }
  ok(/TEE/.test(await p.textContent("#tee")), "proof: TEE attestation badge");
  ok((await p.$$eval("#tools li", (n) => n.length)) === 5, "proof: 5 NEAR building blocks");
  await p.screenshot({ path: path.join(out, "l17-preuves.png"), fullPage: true });

  // classic
  const pc = await ctx.newPage();
  pc.on("pageerror", (e) => errs.push("CLASSIC PAGEERROR " + e.message));
  await pc.goto(BASE + "/?classique");
  await pc.waitForTimeout(2500);
  ok(!!(await pc.$("#tree svg")) && !!(await pc.$("#taskForm")), "classic interface available on /?classique");
  if (!REAL) { const r = await pc.goto(BASE + "/classique"); ok(/classique/.test(r.url()), "/classique redirects to the old interface (fake server)"); }

  // mobile
  const mctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const m = await mctx.newPage();
  await m.goto(BASE + "/");
  await m.waitForTimeout(6000);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll (Mission)");
  const tabY = await m.evaluate(() => document.querySelector(".tabs").getBoundingClientRect().bottom);
  ok(Math.abs(tabY - 812) < 4, "mobile: tabs in a bottom bar");
  await m.screenshot({ path: path.join(out, "l17-mission-mobile.png") });
  if (REPLAY) {
    const ph = await m.evaluate(() => { const t = document.getElementById("mInput"); const cs = getComputedStyle(t); const c = document.createElement("canvas").getContext("2d"); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const w = c.measureText(t.placeholder).width; return { w, avail: t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), text: t.placeholder }; });
    ok(ph.w <= ph.avail, `NB-6 mobile: whole placeholder readable (${Math.round(ph.w)} <= ${Math.round(ph.avail)} px)`);
    await m.locator("#composer").screenshot({ path: path.join(out, "l17-replay-composer-mobile.png") });
  }
  for (const t of ["lignees", "preuves"]) {
    await m.click(`[data-tab="${t}"]`); await m.waitForTimeout(900);
    ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `mobile: no horizontal scroll (${t})`);
    await m.screenshot({ path: path.join(out, `l17-${t}-mobile.png`) });
  }

  ok(errs.length === 0, "no console / CSP error" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""));
  console.log(`\n${pass} OK, ${fail} FAIL`);
  await b.close(); srv.kill();
  process.exit(fail ? 1 : 0);
})();
