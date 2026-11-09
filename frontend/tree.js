// Arbre généalogique vivant (SVG, sans dépendance). Mise en page déterministe + interpolation des positions
// par requestAnimationFrame : les nœuds glissent quand l'arbre se réorganise, naissent depuis leur parent, s'éteignent à la mort.
import { formatNear, nearNumber, profOf } from "./format.js";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};

const SLOT = 62; // largeur d'une feuille
const ROW = 82; // hauteur d'une génération
const PAD_X = 34;
const PAD_Y = 34;
const radiusFor = (bal) => Math.max(11, Math.min(25, 10 + Math.sqrt(Math.max(0, nearNumber(bal))) * 3.4));

export class Tree {
  constructor(host, store, { onSelect } = {}) {
    this.host = host;
    this.store = store;
    this.onSelect = onSelect ?? (() => {});
    this.nodes = new Map(); // id -> {g, body, halo, glyph, label, cx, cy, tx, ty, r, tr, scale, dead, el...}
    this.edges = new Map(); // childId -> {path}
    this.lineageIdx = new Map();
    this.selected = null;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => { this.reduced = e.matches; });
    this.svg = svgEl("svg", { class: "tree-svg", role: "group", "aria-label": "Arbre généalogique des agents" });
    this.gEdges = svgEl("g", { class: "edges" });
    this.gNodes = svgEl("g", { class: "nodes" });
    this.gFx = svgEl("g", { class: "fx", "aria-hidden": "true" });
    this.svg.append(this.gEdges, this.gNodes, this.gFx);
    this.empty = document.createElement("p");
    this.empty.className = "tree-empty";
    this.empty.textContent = "En attente des premiers agents…";
    host.append(this.svg, this.empty);
    this.scale = 1;
    this.raf = 0;
    this.dirty = true;
    new ResizeObserver(() => this.schedule()).observe(host);
  }

  schedule() { this.dirty = true; if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t)); }

  setSelected(id) {
    this.selected = id;
    for (const [nid, n] of this.nodes) n.g.classList.toggle("selected", nid === id);
  }

  // ---------- mise en page ----------
  layout() {
    const agents = [...this.store.agents.values()];
    const kids = new Map();
    const roots = [];
    for (const a of agents) {
      if (a.parentId && this.store.agents.has(a.parentId)) {
        if (!kids.has(a.parentId)) kids.set(a.parentId, []);
        kids.get(a.parentId).push(a);
      } else roots.push(a);
    }
    const order = (x, y) => x.birthTick - y.birthTick || x.id.localeCompare(y.id);
    roots.sort(order);
    let slot = 0, maxGen = 1;
    const pos = new Map();
    const place = (a) => {
      const cs = (kids.get(a.id) ?? []).sort(order);
      maxGen = Math.max(maxGen, a.generation);
      let x;
      if (!cs.length) { x = slot++; }
      else { const xs = cs.map(place); x = (xs[0] + xs[xs.length - 1]) / 2; }
      pos.set(a.id, { x, gen: a.generation });
      return x;
    };
    roots.forEach((r, i) => { if (i > 0) slot += 0.4; place(r); });
    this.lineageIdx.clear();
    roots.forEach((r, i) => this.lineageIdx.set(r.id, i % 8));
    const rootOf = (a) => { let c = a, n = 0; while (c.parentId && this.store.agents.get(c.parentId) && n++ < 64) c = this.store.agents.get(c.parentId); return c; };
    return { pos, slots: Math.max(slot, 1), maxGen, rootOf };
  }

  // ---------- synchronisation ----------
  sync() {
    const { pos, slots, maxGen, rootOf } = this.layout();
    this.empty.hidden = this.store.agents.size > 0;
    const W = PAD_X * 2 + (slots - 1) * SLOT + 40;
    const H = PAD_Y * 2 + (maxGen - 1) * ROW + 30;
    const cw = this.host.clientWidth || 600, ch = this.host.clientHeight || 400;
    const fit = Math.min(cw / W, ch / H);
    this.scale = Math.max(0.55, Math.min(1.5, fit));
    this.W = W; this.H = H;
    this.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    this.svg.setAttribute("width", Math.round(W * this.scale));
    this.svg.setAttribute("height", Math.round(H * this.scale));

    for (const a of this.store.agents.values()) {
      const p = pos.get(a.id);
      if (!p) continue;
      const tx = PAD_X + 20 + p.x * SLOT - (slots > 1 ? 0 : 0);
      const ty = PAD_Y + (a.generation - 1) * ROW;
      let n = this.nodes.get(a.id);
      if (!n) n = this.createNode(a, tx, ty);
      n.tx = tx; n.ty = ty;
      n.tr = a.status === "dead" ? Math.min(radiusFor(a.birthCapital), 14) : radiusFor(a.balance);
      n.agent = a;
      this.updateNodeStatic(n, a, rootOf(a));
    }
    // arêtes
    for (const a of this.store.agents.values()) {
      if (!a.parentId || !this.store.agents.has(a.parentId)) continue;
      let e = this.edges.get(a.id);
      if (!e) {
        const path = svgEl("path", { class: "edge new", pathLength: "1" });
        this.gEdges.append(path);
        e = { path, parentId: a.parentId };
        this.edges.set(a.id, e);
        if (!this.reduced) setTimeout(() => path.classList.remove("new"), 1200); else path.classList.remove("new");
      }
      e.path.classList.toggle("dead", a.status === "dead");
      e.path.dataset.l = String(this.lineageIdx.get(rootOf(a).id) ?? 0);
    }
  }

  createNode(a, tx, ty) {
    const parent = a.parentId ? this.nodes.get(a.parentId) : null;
    const g = svgEl("g", { class: "node", tabindex: "0", role: "button" });
    const halo = svgEl("circle", { class: "halo", r: 10 });
    const body = svgEl("circle", { class: "body", r: 10 });
    const glyph = svgEl("text", { class: "glyph", "text-anchor": "middle", dy: "0.35em" });
    const cross = svgEl("path", { class: "cross", d: "M-6 -6 L6 6 M6 -6 L-6 6" });
    const label = svgEl("text", { class: "label", "text-anchor": "middle" });
    const tip = svgEl("title");
    g.append(tip, halo, body, glyph, cross, label);
    g.addEventListener("click", () => this.onSelect(a.id));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this.onSelect(a.id); } });
    this.gNodes.append(g);
    const sx = parent ? parent.cx : tx, sy = parent ? parent.cy : ty - 30;
    const n = { g, halo, body, glyph, cross, label, tip, cx: sx, cy: sy, tx, ty, r: 4, tr: 10, scale: 0, tscale: 1, id: a.id, agent: a, wasDead: false };
    if (this.reduced) { n.cx = tx; n.cy = ty; n.scale = 1; n.r = n.tr; }
    this.nodes.set(a.id, n);
    if (this.live) this.burst(a.id, "birth");
    return n;
  }

  updateNodeStatic(n, a, root) {
    const prof = profOf(a.genome?.profession);
    const dead = a.status === "dead";
    n.g.setAttribute("class", `node ${prof.cls} l${this.lineageIdx.get(root.id) ?? 0}${dead ? " dead" : ""}${this.selected === a.id ? " selected" : ""}`);
    n.glyph.textContent = dead ? "" : prof.glyph;
    n.label.textContent = a.name;
    n.label.setAttribute("y", String(Math.round(n.tr + 13)));
    const bal = dead ? "mort" : `${formatNear(a.balance, 2)} NEAR`;
    const cause = dead ? ` (${a.causeOfDeath === "starvation" ? "à court d'argent" : a.causeOfDeath ?? ""})` : "";
    const txt = `${a.name}, génération ${a.generation}, ${prof.label}, ${bal}${cause}`;
    n.g.setAttribute("aria-label", txt);
    n.tip.textContent = txt;
    // danger : solde faible
    const low = !dead && nearNumber(a.balance) < nearNumber(a.birthCapital) * 0.3;
    n.g.classList.toggle("low", low);
    if (dead && !n.wasDead) { n.wasDead = true; if (this.live) this.burst(n.id, "death"); }
  }

  // ---------- effets ----------
  fxAt(n, cls, text) {
    const g = svgEl("g", { transform: `translate(${n.cx} ${n.cy})`, class: "fxg" });
    if (text != null) g.append(svgEl("text", { class: `float ${cls}`, "text-anchor": "middle", y: -n.r - 6 }, text));
    else g.append(svgEl("circle", { class: `ring ${cls}`, r: n.r + 2 }));
    this.gFx.append(g);
    setTimeout(() => g.remove(), 1700);
  }
  burst(id, kind) { const n = this.nodes.get(id); if (!n || this.reduced) return; this.fxAt(n, kind); if (kind === "birth") setTimeout(() => this.fxAt(n, "birth2"), 180); }
  float(id, text, kind) { const n = this.nodes.get(id); if (!n || this.reduced) return; this.fxAt(n, kind, text); }
  pulse(id) {
    const n = this.nodes.get(id); if (!n || this.reduced) return;
    n.g.classList.remove("pulse"); void n.g.getBoundingClientRect(); n.g.classList.add("pulse");
  }

  // ---------- animation ----------
  frame(t) {
    this.raf = 0;
    if (this.dirty) { this.dirty = false; this.sync(); }
    let moving = false;
    const k = this.reduced ? 1 : 0.16;
    for (const n of this.nodes.values()) {
      const nx = n.cx + (n.tx - n.cx) * k, ny = n.cy + (n.ty - n.cy) * k;
      const nr = n.r + (n.tr - n.r) * k, ns = n.scale + (n.tscale - n.scale) * k;
      if (Math.abs(n.tx - nx) > 0.2 || Math.abs(n.ty - ny) > 0.2 || Math.abs(n.tr - nr) > 0.1 || Math.abs(n.tscale - ns) > 0.01) moving = true;
      n.cx = Math.abs(n.tx - nx) > 0.2 ? nx : n.tx; n.cy = Math.abs(n.ty - ny) > 0.2 ? ny : n.ty;
      n.r = Math.abs(n.tr - nr) > 0.1 ? nr : n.tr; n.scale = Math.abs(n.tscale - ns) > 0.01 ? ns : n.tscale;
      n.g.setAttribute("transform", `translate(${n.cx.toFixed(1)} ${n.cy.toFixed(1)}) scale(${n.scale.toFixed(3)})`);
      n.body.setAttribute("r", n.r.toFixed(1));
      n.halo.setAttribute("r", (n.r + 5).toFixed(1));
      n.label.setAttribute("y", String(Math.round(n.r + 13)));
    }
    for (const [cid, e] of this.edges) {
      const c = this.nodes.get(cid), p = this.nodes.get(e.parentId);
      if (!c || !p) continue;
      const y0 = p.cy + p.r * p.scale, y1 = c.cy - c.r * c.scale, my = (y0 + y1) / 2;
      e.path.setAttribute("d", `M${p.cx.toFixed(1)} ${y0.toFixed(1)} C${p.cx.toFixed(1)} ${my.toFixed(1)} ${c.cx.toFixed(1)} ${my.toFixed(1)} ${c.cx.toFixed(1)} ${y1.toFixed(1)}`);
    }
    if (moving) this.raf = requestAnimationFrame((tt) => this.frame(tt));
  }
}
