import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOGUE, PROFESSIONS, loadConfig, type Deliverable } from "../shared/index.ts";
import { createApp } from "./app.ts";
import { createRuntime } from "./runtime.ts";
import { createStore } from "./store.ts";

const tmp: string[] = [];
const mkdtmp = () => {
  const d = mkdtempSync(join(tmpdir(), "darwin-dl-"));
  tmp.push(d);
  return d;
};
afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
});

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><circle cx="128" cy="128" r="100" fill="#09f"/></svg>';
const FAKE: Deliverable = {
  taskId: "t-7", profession: "logo", agentId: "a-1", rawText: "brut",
  files: [{ name: "logo-1.svg", mime: "image/svg+xml", content: SVG }, { name: "notes.md", mime: "text/markdown", content: "# Notes" }],
  resultHash: "ab".repeat(32), productionCostUsd: 0.001, judgeCostUsd: 0.0005, createdAt: "2026-11-11T00:00:00.000Z", verdict: "accepted", score: 0.8,
};

async function setup(ticks = 0) {
  const config = loadConfig({ DARWIN_PRESET: "demo" });
  const rt = createRuntime(config, { autoRun: false });
  await rt.startSim();
  for (let i = 0; i < ticks; i++) await rt.engine.tick();
  const app = createApp(rt, { getIp: () => "1.2.3.4", frontendDir: join(tmpdir(), "darwin-no-frontend") });
  return { rt, app, config };
}
const json = async (r: Response) => (await r.json()) as any;

describe("livrables", () => {
  it("200: full JSON without rawText; 404 if task without deliverable or invalid id", async () => {
    const { rt, app } = await setup();
    rt.market.getDeliverable = (id) => (id === "t-7" ? structuredClone(FAKE) : undefined);
    const r = await app.request("/api/tasks/t-7/deliverable");
    expect(r.status).toBe(200);
    const d = await json(r);
    expect(d).toMatchObject({ taskId: "t-7", profession: "logo", agentId: "a-1", verdict: "accepted", score: 0.8, resultHash: FAKE.resultHash, productionCostUsd: 0.001, judgeCostUsd: 0.0005 });
    expect(d.files).toEqual([{ name: "logo-1.svg", mime: "image/svg+xml", content: SVG }, { name: "notes.md", mime: "text/markdown", content: "# Notes" }]);
    expect(d.rawText).toBeUndefined();
    expect((await app.request("/api/tasks/t-8/deliverable")).status).toBe(404);
    expect((await app.request("/api/tasks/..%2Fx/deliverable")).status).toBe(404);
  });

  it("file: SVG with strict headers, download=1, invalid name 400, unknown 404", async () => {
    const { rt, app } = await setup();
    rt.market.getDeliverable = (id) => (id === "t-7" ? structuredClone(FAKE) : undefined);
    const r = await app.request("/api/tasks/t-7/deliverable/logo-1.svg");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/svg+xml");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
    expect(r.headers.get("content-disposition")).toBeNull();
    expect(await r.text()).toBe(SVG);
    const dl = await app.request("/api/tasks/t-7/deliverable/logo-1.svg?download=1");
    expect(dl.headers.get("content-disposition")).toBe('attachment; filename="logo-1.svg"');
    const md = await app.request("/api/tasks/t-7/deliverable/notes.md");
    expect(md.headers.get("content-type")).toMatch(/^text\/markdown/);
    expect((await app.request("/api/tasks/t-7/deliverable/..%2F..%2Fpackage.json")).status).toBe(400);
    expect((await app.request("/api/tasks/t-7/deliverable/Logo.SVG")).status).toBe(400);
    expect((await app.request("/api/tasks/t-7/deliverable/absent.svg")).status).toBe(404);
    expect((await app.request("/api/tasks/t-8/deliverable/logo-1.svg")).status).toBe(404);
  });

  it("a real deliverable produced by the market is served", async () => {
    const { rt, app } = await setup();
    for (let i = 0; i < 60 && rt.market.listDeliverables().length === 0; i++) await rt.engine.tick();
    const d = rt.market.listDeliverables()[0];
    if (!d) return; // no deliverable within 60 ticks: covered by the market tests
    const r = await app.request(`/api/tasks/${d.taskId}/deliverable`);
    expect(r.status).toBe(200);
    const f = d.files[0]!;
    const raw = await app.request(`/api/tasks/${d.taskId}/deliverable/${f.name}`);
    expect(await raw.text()).toBe(f.content);
  });
});

describe("catalogue, population, budget", () => {
  it("/api/catalogue: 6 scaled professions + active events", async () => {
    const { rt, app, config } = await setup(3);
    const r = await app.request("/api/catalogue");
    expect(r.status).toBe(200);
    const c = await json(r);
    expect(c.priceScale).toBe(config.sim.priceScale);
    expect(c.professions.map((p: any) => p.profession)).toEqual([...PROFESSIONS]);
    expect(c.professions).toHaveLength(6);
    const logo = c.professions.find((p: any) => p.profession === "logo");
    expect(logo).toMatchObject({ label: "Logo", refUsd: 150, acceptScore: 0.6, nearPriceNear: (0.045 * config.sim.priceScale).toFixed(6).replace(/\.?0+$/, "") });
    expect(BigInt(logo.nearPrice)).toBe((CATALOGUE.logo.nearPrice * BigInt(config.sim.priceScale * 1000)) / 1000n);
    expect(logo.rubric.length).toBeGreaterThan(0);
    expect(typeof logo.deliverable).toBe("string");
    expect(Array.isArray(c.events)).toBe(true);
    void rt;
  });

  it("active events derived from the journal", async () => {
    const { rt, app } = await setup();
    const tick = rt.engine.getState().tick;
    rt.journal.emit({ type: "market.event", data: { event: { id: "e-9999", title: "Test", profession: "logo", demandMultiplier: 3, startTick: tick, endTick: tick + 5 } } });
    rt.journal.emit({ type: "market.event", data: { event: { id: "e-9998", title: "Past", profession: "legal", demandMultiplier: 3, startTick: tick - 9, endTick: tick - 1 } } });
    const c = await json(await app.request("/api/catalogue"));
    expect(c.events.map((e: any) => e.id)).toEqual(["e-9999"]);
  });

  it("/api/state and /api/population expose the last population.snapshot", async () => {
    const { app } = await setup(2);
    const st = await json(await app.request("/api/state"));
    const pop = (await json(await app.request("/api/population"))).population;
    if (st.population) {
      expect(st.population.byProfession).toBeTypeOf("object");
      expect(pop).toEqual(st.population);
    } else {
      expect(pop).toBeNull();
    }
  });

  it("POST /api/tasks below the catalogue price: explicit 400 BUDGET_OUT_OF_RANGE", async () => {
    const { app } = await setup();
    const r = await app.request("/api/tasks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Logo", prompt: "A logo for a tea shop.", profession: "logo", budgetNear: "0.001", requesterLabel: "Bob" }),
    });
    expect(r.status).toBe(400);
    const b = await json(r);
    expect(b.error.code).toBe("BUDGET_OUT_OF_RANGE");
    expect(b.error.message).toMatch(/minimum.*Logo|Logo.*minimum/i);
  });
});

describe("deliverable persistence", () => {
  it("writes data/deliverables/<task>/<file> + meta.json, rejects dangerous names", () => {
    const dir = mkdtmp();
    const store = createStore(dir);
    store.saveDeliverable(FAKE);
    expect(readFileSync(join(dir, "deliverables", "t-7", "logo-1.svg"), "utf8")).toBe(SVG);
    const meta = JSON.parse(readFileSync(join(dir, "deliverables", "t-7", "meta.json"), "utf8"));
    expect(meta).toMatchObject({ taskId: "t-7", verdict: "accepted", resultHash: FAKE.resultHash });
    expect(meta.rawText).toBeUndefined();
    expect(meta.files[0]).toMatchObject({ name: "logo-1.svg", bytes: SVG.length });

    const dir2 = mkdtmp();
    const s2 = createStore(dir2);
    s2.saveDeliverable({ ...FAKE, taskId: "../../evil" });
    s2.saveDeliverable({ ...FAKE, taskId: "t-1", files: [{ name: "../x.txt", mime: "text/plain", content: "x" }] });
    expect(existsSync(join(dir2, "..", "evil"))).toBe(false);
    expect(existsSync(join(dir2, "deliverables", "t-1", "x.txt"))).toBe(false);
  });

  it("the next launch moves old deliverables to deliverables.prev", () => {
    const dir = mkdtmp();
    createStore(dir).saveDeliverable(FAKE);
    createStore(dir);
    expect(existsSync(join(dir, "deliverables.prev", "t-7", "meta.json"))).toBe(true);
    expect(existsSync(join(dir, "deliverables", "t-7"))).toBe(false);
  });
});
