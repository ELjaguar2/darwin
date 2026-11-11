import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/index.ts";
import { createApp } from "./app.ts";
import { createRuntime } from "./runtime.ts";

async function mk(frontendDir: string) {
  const rt = createRuntime(loadConfig({ DARWIN_PRESET: "demo" }), { autoRun: false });
  await rt.startSim();
  return createApp(rt, { getIp: () => "1.2.3.4", frontendDir });
}

describe("statique : liste blanche et CSP sans style inline", () => {
  it("/classique redirige vers /?classique (backend live)", async () => {
    const app = await mk(join(process.cwd(), "frontend"));
    const r = await app.request("/classique");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/?classique");
  });

  it("page et scripts servis ; dev/, screens/, .md, fichiers cachés et traversées refusés", async () => {
    const app = await mk(join(process.cwd(), "frontend"));
    for (const ok of ["/", "/index.html", "/app.js", "/store.js", "/style.css", "/favicon.svg"]) expect((await app.request(ok)).status, ok).toBe(200);
    for (const bad of [
      "/dev/e2e.cjs", "/dev/fake-server.mjs", "/dev/real.cjs", "/screens/desktop-1280x800.png", "/README.md", "/.env", "/.git/config",
      "/%2e%2e/package.json", "/..%2fpackage.json", "/app.js/../package.json", "/%2Fdev/e2e.cjs", "/dev/../app.js/x", "/package.json", "/app.js.map", "//dev/e2e.cjs",
    ]) {
      expect((await app.request(bad)).status, bad).toBe(404);
    }
  });

  it("CSP sans unsafe-inline ; page de repli sans style inline, feuille servie en fichier", async () => {
    const app = await mk(join(process.cwd(), "pas-de-frontend"));
    const home = await app.request("/");
    expect(home.status).toBe(200);
    expect(home.headers.get("content-security-policy")).not.toContain("unsafe-inline");
    const html = await home.text();
    expect(html).not.toMatch(/<style|style=/);
    expect(html).toContain('href="/_fallback.css"');
    const css = await app.request("/_fallback.css");
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toContain("text/css");
  });
});
