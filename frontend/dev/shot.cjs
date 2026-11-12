// Vérification visuelle : lance le faux serveur, ouvre la page en desktop et mobile, enregistre des captures.
// Usage : NODE_PATH=<dossier node_modules contenant playwright> node frontend/dev/shot.cjs <dossierSortie> [attenteMs] ["args du faux serveur"]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const ROOT = path.resolve(__dirname);
const out = process.argv[2] || ".";
const wait = Number(process.argv[3] || 30000);
const extra = (process.argv[4] || "").split(" ").filter(Boolean);
const port = 3201;
(async () => {
  const REAL = process.env.REAL_URL; // ex. http://127.0.0.1:3210 : teste contre le vrai backend au lieu du faux serveur
  const srv = REAL ? { kill() {} } : spawn("node", [path.join(ROOT, "fake-server.mjs"), `--port=${port}`, "--tick=150", ...extra], { stdio: "inherit" });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  const errs = [];
  for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 812 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(name + " " + m.type() + ": " + m.text()); });
    p.on("pageerror", (e) => errs.push(name + " PAGEERROR " + e.message));
    await p.goto((REAL ?? `http://127.0.0.1:${port}`) + "/?classique");
    await p.waitForTimeout(wait);
    await p.screenshot({ path: path.join(out, `${name}-top.png`) });
    await p.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true });
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    console.log(name, "scrollWidth/innerWidth", sw);
    await ctx.close();
  }
  console.log("ERRORS", errs);
  await b.close(); srv.kill();
})();
