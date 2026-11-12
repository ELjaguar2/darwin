// "Lineage" page (L17): full-screen family tree (zoom, pan), side panel per agent.
// SVG built from DOM nodes (never innerHTML). Positions interpolated every frame: nodes glide, are born from the parent, turn gray at death.
import { store, core, ledger, api, on, aliveAgents, labelOfJob } from "./core.js";
import { h, formatNear, formatNearSmall, signedNear, nearNumber, big } from "./format.js";
import { jobOf, icon, avatar, firstName } from "./jobs.js";
import { TEE_MODELS } from "./preuves.js";
import { subs, FALLBACK_REASON } from "./subcontract.js";
import { letterReceipts } from "./letters.js";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
const $ = (id) => document.getElementById(id);
const SLOT = 118, ROW = 150;
const radiusFor = (a) => (a.status === "dead" ? 20 : Math.max(24, Math.min(40, 22 + Math.sqrt(Math.max(0, nearNumber(a.balance))) * 6)));
const labelOf = (p) => labelOfJob(p, jobOf(p).label);

class LineageTree {
  constructor(host, { onSelect }) {
    this.host = host; this.onSelect = onSelect;
    this.nodes = new Map(); this.edges = new Map();
    this.view = { x: 0, y: 0, k: 1 }; this.tview = { x: 0, y: 0, k: 1 };
    this.userMoved = false; this.selected = null; this.raf = 0; this.dirty = true;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.svg = svgEl("svg", { class: "ltree-svg", role: "group", "aria-label": "Family tree of the agents. Drag to pan, use the wheel or buttons to zoom." });
    this.vp = svgEl("g", { class: "vp" });
    this.gEdges = svgEl("g"); this.gNodes = svgEl("g"); this.gFx = svgEl("g", { "aria-hidden": "true" });
    this.vp.append(this.gEdges, this.gNodes, this.gFx);
    this.svg.append(this.vp);
    this.empty = h("p", { class: "tree-empty" }, "Waiting for the first agents…");
    host.append(this.svg, this.empty);
    new ResizeObserver(() => { this.schedule(); }).observe(host);
    this.bindPointer();
  }
  schedule() { this.dirty = true; if (!this.raf) this.raf = requestAnimationFrame(() => this.frame()); }
  clear() { for (const n of this.nodes.values()) n.g.remove(); for (const e of this.edges.values()) e.path.remove(); this.nodes.clear(); this.edges.clear(); this.gFx.replaceChildren(); this.userMoved = false; this.schedule(); }

  // ----- pan and zoom
  bindPointer() {
    const pts = new Map();
    let last = null, pinch = 0, moved = 0;
    this.svg.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
      if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    this.svg.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch); pinch = d; moved = 99; return;
      }
      if (last) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y; moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) { if (!this.svg.hasPointerCapture(e.pointerId)) this.svg.setPointerCapture(e.pointerId); this.pan(dx, dy); last = { x: e.clientX, y: e.clientY }; this.svg.classList.add("grab"); }
      }
    });
    const up = (e) => { pts.delete(e.pointerId); last = pts.size === 1 ? { ...[...pts.values()][0] } : null; pinch = 0; this.svg.classList.remove("grab"); if (this.svg.hasPointerCapture?.(e.pointerId)) this.svg.releasePointerCapture(e.pointerId); };
    this.svg.addEventListener("pointerup", up); this.svg.addEventListener("pointercancel", up);
    this.svg.addEventListener("wheel", (e) => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    this.svg.addEventListener("click", (e) => { if (moved > 6) { e.stopPropagation(); moved = 0; } }, true);
    this.svg.addEventListener("keydown", (e) => {
      const step = 60;
      if (e.target !== this.svg) return;
      if (e.key === "ArrowLeft") this.pan(step, 0); else if (e.key === "ArrowRight") this.pan(-step, 0); else if (e.key === "ArrowUp") this.pan(0, step); else if (e.key === "ArrowDown") this.pan(0, -step);
      else if (e.key === "+" || e.key === "=") this.zoomBy(1.25); else if (e.key === "-") this.zoomBy(0.8); else return;
      e.preventDefault();
    });
    this.svg.tabIndex = 0;
  }
  pan(dx, dy) { this.userMoved = true; this.tview.x += dx; this.tview.y += dy; this.view.x = this.tview.x; this.view.y = this.tview.y; this.applyView(); }
  zoomAt(cx, cy, f) {
    this.userMoved = true;
    const r = this.svg.getBoundingClientRect(); const px = cx - r.left, py = cy - r.top;
    const k = Math.max(0.2, Math.min(3, this.tview.k * f)); const real = k / this.tview.k;
    this.tview.x = px - (px - this.tview.x) * real; this.tview.y = py - (py - this.tview.y) * real; this.tview.k = k;
    Object.assign(this.view, this.tview); this.applyView();
  }
  zoomBy(f) { const r = this.svg.getBoundingClientRect(); this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); }
  fit() { this.userMoved = false; this.schedule(); }
  applyView() { this.vp.setAttribute("transform", `translate(${this.view.x.toFixed(1)} ${this.view.y.toFixed(1)}) scale(${this.view.k.toFixed(3)})`); }

  // ----- layout
  layout() {
    const agents = [...store.agents.values()];
    const kids = new Map(), roots = [];
    for (const a of agents) { if (a.parentId && store.agents.has(a.parentId)) { (kids.get(a.parentId) ?? kids.set(a.parentId, []).get(a.parentId)).push(a); } else roots.push(a); }
    const order = (x, y) => (x.birthTick ?? 0) - (y.birthTick ?? 0) || x.id.localeCompare(y.id);
    roots.sort(order);
    let slot = 0, maxGen = 1; const pos = new Map();
    const place = (a, depth) => {
      if (depth > 80) return slot++;
      const cs = (kids.get(a.id) ?? []).sort(order);
      maxGen = Math.max(maxGen, a.generation);
      let x;
      if (!cs.length) x = slot++; else { const xs = cs.map((c) => place(c, depth + 1)); x = (xs[0] + xs[xs.length - 1]) / 2; }
      pos.set(a.id, x);
      return x;
    };
    roots.forEach((r, i) => { if (i > 0) slot += 0.35; place(r, 0); });
    return { pos, slots: Math.max(slot, 1), maxGen };
  }

  sync() {
    const { pos, slots, maxGen } = this.layout();
    this.empty.hidden = store.agents.size > 0;
    this.bounds = { w: Math.max(1, (slots - 1) * SLOT + 160), h: (maxGen - 1) * ROW + 170 };
    for (const a of store.agents.values()) {
      const x = pos.get(a.id); if (x == null) continue;
      const tx = 80 + x * SLOT, ty = 70 + (a.generation - 1) * ROW;
      let n = this.nodes.get(a.id);
      if (!n) n = this.createNode(a, tx, ty);
      n.tx = tx; n.ty = ty; n.tr = radiusFor(a); n.a = a;
      this.paint(n, a);
    }
    for (const a of store.agents.values()) {
      if (!a.parentId || !store.agents.has(a.parentId)) continue;
      let e = this.edges.get(a.id);
      if (!e) {
        const path = svgEl("path", { class: "ledge new", pathLength: "1" });
        this.gEdges.append(path); e = { path, parentId: a.parentId }; this.edges.set(a.id, e);
        setTimeout(() => path.classList.remove("new"), this.reduced ? 0 : 1300);
      }
      e.path.classList.toggle("dead", a.status === "dead");
      e.path.classList.toggle("hl", this.hl?.has(a.id) ?? false);
    }
    if (!this.userMoved) this.computeFit();
  }
  computeFit() {
    const cw = this.host.clientWidth || 600, ch = this.host.clientHeight || 400;
    const { w, h: hh } = this.bounds;
    const k = Math.max(0.25, Math.min(1.25, Math.min((cw - 30) / w, (ch - 30) / hh)));
    this.tview = { k, x: (cw - w * k) / 2 + 20 * k, y: Math.max(14, (ch - hh * k) / 2) + 10 * k };
  }

  createNode(a, tx, ty) {
    const parent = a.parentId ? this.nodes.get(a.parentId) : null;
    const g = svgEl("g", { class: "lnode", tabindex: "0", role: "button" });
    const halo = svgEl("circle", { class: "lhalo" });
    const body = svgEl("circle", { class: "lbody" });
    const ic = icon(jobOf(a.genome?.profession).icon, 24); ic.setAttribute("class", "ico lico");
    const cross = svgEl("path", { class: "lcross", d: "M-9 -9 L9 9 M9 -9 L-9 9" });
    const name = svgEl("text", { class: "lname", "text-anchor": "middle" });
    const bal = svgEl("text", { class: "lbal", "text-anchor": "middle" });
    const tip = svgEl("title");
    g.append(tip, halo, body, ic, cross, name, bal);
    g.addEventListener("click", () => this.onSelect(a.id));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this.onSelect(a.id); } });
    this.gNodes.append(g);
    const sx = parent ? parent.cx : tx, sy = parent ? parent.cy : ty - 40;
    const n = { g, halo, body, ic, cross, name, bal, tip, cx: sx, cy: sy, tx, ty, r: 6, tr: 24, id: a.id, a, wasDead: false, scale: this.reduced ? 1 : 0 };
    if (this.reduced) { n.cx = tx; n.cy = ty; n.r = 24; }
    this.nodes.set(a.id, n);
    if (core.live) this.ring(n, "birth");
    return n;
  }
  paint(n, a) {
    const dead = a.status === "dead";
    const job = jobOf(a.genome?.profession);
    n.g.setAttribute("class", `lnode ${job.cls}${dead ? " dead" : ""}${this.selected === a.id ? " selected" : ""}${this.hl?.has(a.id) ? " hl" : ""}`);
    n.name.textContent = firstName(a);
    n.bal.textContent = dead ? "" : `${formatNear(a.balance, 2)}`;
    n.cross.style.display = dead ? "" : "none"; n.ic.style.display = dead ? "none" : "";
    const txt = `${a.name}, generation ${a.generation}, ${labelOf(a.genome?.profession)}, ${dead ? `dead${a.causeOfDeath === "starvation" ? " (ran out of money)" : ""}` : formatNear(a.balance, 2) + " NEAR"}`;
    n.g.setAttribute("aria-label", txt + ". Open profile."); n.tip.textContent = txt;
    if (dead && !n.wasDead) { n.wasDead = true; if (core.live) this.ring(n, "death"); }
  }
  ring(n, kind) {
    if (this.reduced) return;
    const c = svgEl("circle", { class: `lring ${kind}`, cx: n.cx.toFixed(1), cy: n.cy.toFixed(1), r: String(n.r + 4) });
    this.gFx.append(c); setTimeout(() => c.remove(), 1800);
  }
  float(id, text, kind) {
    const n = this.nodes.get(id); if (!n || this.reduced) return;
    const t = svgEl("text", { class: `lfloat ${kind}`, x: (n.cx + n.r * 0.6).toFixed(1), y: (n.cy - n.r - 4).toFixed(1) }, text);
    this.gFx.append(t); setTimeout(() => t.remove(), 1800);
  }
  setSelected(id) {
    this.selected = id;
    this.hl = new Set();
    for (let c = id ? store.agents.get(id) : null, i = 0; c && i < 80; i++) { this.hl.add(c.id); c = c.parentId ? store.agents.get(c.parentId) : null; }
    this.dirty = true; this.schedule();
  }

  frame() {
    this.raf = 0;
    if (this.dirty) { this.dirty = false; this.sync(); }
    const k = this.reduced ? 1 : 0.17;
    let moving = false;
    const dv = { x: this.tview.x - this.view.x, y: this.tview.y - this.view.y, k: this.tview.k - this.view.k };
    if (Math.abs(dv.x) > 0.3 || Math.abs(dv.y) > 0.3 || Math.abs(dv.k) > 0.002) { this.view.x += dv.x * k; this.view.y += dv.y * k; this.view.k += dv.k * k; moving = true; } else Object.assign(this.view, this.tview);
    this.applyView();
    for (const n of this.nodes.values()) {
      const nx = n.cx + (n.tx - n.cx) * k, ny = n.cy + (n.ty - n.cy) * k, nr = n.r + (n.tr - n.r) * k, ns = n.scale + (1 - n.scale) * k;
      if (Math.abs(n.tx - nx) > 0.3 || Math.abs(n.ty - ny) > 0.3 || Math.abs(n.tr - nr) > 0.1 || Math.abs(1 - ns) > 0.01) moving = true;
      n.cx = Math.abs(n.tx - nx) > 0.3 ? nx : n.tx; n.cy = Math.abs(n.ty - ny) > 0.3 ? ny : n.ty; n.r = Math.abs(n.tr - nr) > 0.1 ? nr : n.tr; n.scale = Math.abs(1 - ns) > 0.01 ? ns : 1;
      n.g.setAttribute("transform", `translate(${n.cx.toFixed(1)} ${n.cy.toFixed(1)}) scale(${n.scale.toFixed(3)})`);
      n.body.setAttribute("r", n.r.toFixed(1)); n.halo.setAttribute("r", (n.r + 7).toFixed(1));
      const s = (n.r * 1.0) / 24 * 1.0; // icon proportional to the radius
      n.ic.setAttribute("width", (n.r * 1.0).toFixed(1)); n.ic.setAttribute("height", (n.r * 1.0).toFixed(1)); n.ic.setAttribute("x", (-n.r * 0.5).toFixed(1)); n.ic.setAttribute("y", (-n.r * 0.5).toFixed(1));
      n.name.setAttribute("y", (n.r + 22).toFixed(0)); n.bal.setAttribute("y", (n.r + 42).toFixed(0));
      void s;
    }
    for (const [cid, e] of this.edges) {
      const c = this.nodes.get(cid), p = this.nodes.get(e.parentId); if (!c || !p) continue;
      const y0 = p.cy + p.r * p.scale, y1 = c.cy - c.r * c.scale, my = (y0 + y1) / 2;
      e.path.setAttribute("d", `M${p.cx.toFixed(1)} ${y0.toFixed(1)} C${p.cx.toFixed(1)} ${my.toFixed(1)} ${c.cx.toFixed(1)} ${my.toFixed(1)} ${c.cx.toFixed(1)} ${y1.toFixed(1)}`);
    }
    if (moving) this.raf = requestAnimationFrame(() => this.frame());
  }
}

// ------------------------------------------------------------------ side panel
let tree = null, selected = null, panelTimer = 0;
const REASON = { birth: "Birth capital", task: "Mission paid", brain: "AI brain paid", chain_fee: "Network fee", death: "Death: balance recovered", metabolism: "Cost of living", reproduction: "Capital given to a child" };
/** L21: "delegated ..." / "subcontract earned ..." lines of an agent (agent-to-agent subcontracting). */
export function subRowsOf(a, near = (v) => formatNear(v, 4)) {
  const out = [];
  for (const r of subs.records()) {
    const prof = r.profession ? labelOf(r.profession) : "";
    if (r.byAgentId === a.id) {
      const st = r.status === "integrated" ? "integrated" : r.status === "fallback" ? "fell back in-house" : r.status === "paid" ? "paid" : r.status === "expired" ? "expired, no bidder" : r.status === "refunded" ? "refunded" : r.status === "awarded" ? "awarded" : "open";
      const amt = r.price ?? (r.commissionKind === "none" ? null : r.budget);
      const com = r.commissionKind === "none" ? " · no money moved, delegator keeps the whole price" : r.commission != null ? ` · ${r.commissionKind === "max" ? "up to " : ""}${near(r.commission)} commission` : "";
      out.push({ tick: r.tick, delta: r.price != null && r.status !== "integrated" ? -r.price : 0n, text: `delegated ${prof ? prof + " " : ""}sub-task${amt != null ? ` · ${near(amt)}` : ""}${com}`, sub: st, amount: r.price != null && r.status !== "integrated" ? `-${near(r.price)}` : "–" });
    }
    if (r.byAgentId === a.id && r.status === "integrated") {
      const ch = store.agents.get(r.winnerId);
      out.push({ tick: r.tick, delta: -(r.price ?? 0n), text: `paid child${ch ? ` ${firstName(ch)}` : ""}`, sub: prof ? `${prof} sub-task` : "sub-task", amount: `-${near(r.price ?? 0n)}` });
      if (r.commissionKind === "void") out.push({ tick: r.tick, delta: 0n, text: "no commission: parent mission rejected", sub: "child was paid, parent refunded", amount: "–" });
      else out.push({ tick: r.tick, delta: r.commission ?? 0n, text: r.commissionKind === "actual" ? "subcontract commission" : "subcontract commission (pending parent payment)", sub: "parent price - child price", amount: `+${near(r.commission ?? 0n)}` });
    }
    if (r.byAgentId === a.id && r.status === "fallback") out.push({ tick: r.tick, delta: 0n, text: "fallback: done in-house", sub: FALLBACK_REASON[r.fallbackReason] ?? r.fallbackReason ?? "failed", amount: "–" });
    if ((r.status === "paid" || r.status === "integrated") && r.payee && r.payee === a.accountId) {
      const by = store.agents.get(r.byAgentId);
      out.push({ tick: r.tick, delta: r.paidAmount ?? 0n, text: `subcontract earned${by ? ` from ${firstName(by)}` : ""}`, sub: prof ? `${prof} sub-task` : "sub-task", amount: `+${near(r.paidAmount ?? 0n)}` });
    }
  }
  return out;
}
const GENES = [["Asking price", "askRatio", 0.3, 1], ["Risk appetite", "risk", 0, 1], ["Reproduction threshold", "reproThreshold", 1.2, 4], ["Generosity", "generosity", 0, 0.6], ["Cooperation", "cooperation", 0, 1]];

function gene(label, v, lo, hi) {
  const n = Number(v);
  const pct = Number.isFinite(n) ? Math.round(((n - lo) / (hi - lo)) * 100) : 0;
  return h("li", null, h("span", { class: "g-l" }, label), h("span", { class: "g-bar", role: "img", "aria-label": `${label}: ${Number.isFinite(n) ? n.toFixed(2) : "?"}` }, h("span", { class: "g-fill", css: { width: `${Math.max(4, Math.min(100, pct))}%` } })), h("b", null, Number.isFinite(n) ? n.toFixed(2) : "?"));
}

function sparkline(points) {
  if (points.length < 2) return null;
  const W = 280, H = 56, max = Math.max(...points, 1e-9), min = Math.min(...points, 0);
  const xy = points.map((v, i) => `${((i / (points.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - min) / (max - min || 1)) * (H - 8)).toFixed(1)}`).join(" ");
  const svg = svgEl("svg", { class: "spark", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Agent balance curve" });
  svg.append(svgEl("polyline", { points: xy, fill: "none", "stroke-width": "2.5", "stroke-linejoin": "round", "stroke-linecap": "round" }));
  return svg;
}

async function letterBlock(l, title, open) {
  const text = l.text ?? "";
  return h("details", { class: "letter", open: open || null }, h("summary", null, title, l.mock ? h("span", { class: "tag-mini" }, "mock") : null), h("div", { class: "letter-text" }, text));
}

async function renderPanel() {
  const a = selected ? store.agents.get(selected) : null;
  const panel = $("panel");
  if (!a) { panel.hidden = true; return; }
  panel.hidden = false;
  const g = a.genome ?? {};
  const job = jobOf(g.profession);
  const dead = a.status === "dead";
  const parent = a.parentId ? store.agents.get(a.parentId) : null;
  const kids = (a.childrenIds ?? []).map((id) => store.agents.get(id)).filter(Boolean);
  const passed = kids.reduce((s, c) => s + big(c.birthCapital), 0n);
  const tee = TEE_MODELS.has(String(g.model ?? ""));
  const hist = ledger.hist.get(a.id) ?? [];
  const pts = hist.map((x) => nearNumber(x.balance));
  const subRows = subRowsOf(a);
  const rows = hist.filter((x) => x.reason !== "metabolism").slice(-24).reverse();
  const meta = hist.filter((x) => x.reason === "metabolism");
  const metaSum = meta.reduce((s, x) => s + x.delta, 0n);
  // letters: received from the parent, written to the children
  const letters = [];
  const fetchLetter = async (id) => {
    if (store.letters.has(id)) return store.letters.get(id);
    try { const r = await api(`/api/letters/${encodeURIComponent(id)}`); const l = r.body?.letter ?? r.body; if (r.ok && l?.id) { store.letters.set(l.id, l); return l; } } catch { /* ignored */ }
    return null;
  };
  const recv = a.letterId ? await fetchLetter(a.letterId) : [...store.letters.values()].find((l) => l.toAgentId === a.id) ?? null;
  const rc = letterReceipts.get(a.id); // L25: letter.received (absent from older journals: then the letter.written letter is shown as before)
  const from = firstName(parent) || "its parent";
  if (rc?.status === "empty") letters.push(h("p", { class: "muted letter-empty" }, "No letter received (empty)"));
  else if (rc) {
    const text = recv?.text ?? `${rc.excerpt}${rc.length > rc.excerpt.length ? "…" : ""}`;
    if (rc.fallback) letters.push(h("p", { class: "letter-fallback" }, "Fallback letter received"));
    letters.push(await letterBlock({ ...(recv ?? {}), text }, `Letter received from ${from}`, true));
  } else if (recv) letters.push(await letterBlock(recv, `Letter received from ${from}`, true));
  const sent = [...store.letters.values()].filter((l) => l.fromAgentId === a.id).sort((x, y) => (x.id < y.id ? -1 : 1));
  for (const l of sent) letters.push(await letterBlock(l, `Letter written to ${firstName(store.agents.get(l.toAgentId))}`, !recv && letters.length === 0));
  if (selected !== a.id) return; // the selection changed during loading

  panel.replaceChildren(
    h("header", { class: "p-head" },
      avatar(a, 64),
      h("div", { class: "p-id" }, h("h2", { id: "panelTitle" }, firstName(a)), h("p", { class: "muted" }, `Generation ${a.generation} · `, h("span", { class: `jchip ${job.cls}` }, icon(job.icon, 14), labelOf(g.profession))),
        h("p", null, dead ? h("span", { class: "badge dead" }, `dead · tick ${a.deathTick ?? "?"}${a.causeOfDeath === "starvation" ? " · ran out of money" : ""}`) : h("span", { class: "badge alive" }, "alive"))),
      h("button", { type: "button", class: "p-close", "aria-label": "Close the profile", onclick: () => select(null) }, "×")),
    h("section", null, h("div", { class: "p-balance" }, h("b", null, dead ? "0" : formatNear(a.balance, 3)), h("span", null, " NEAR")), sparkline(pts)),
    h("section", null, h("h3", null, "Genome"),
      h("p", { class: "p-model" }, "AI model ", h("code", null, g.model ?? "?"), tee ? h("span", { class: "tee-tag", title: "Model attestable in a trusted execution environment (see the Proof tab)" }, "TEE") : null),
      h("ul", { class: "genes" }, GENES.map(([l, k, lo, hi]) => gene(l, g[k], lo, hi)))),
    g.personality ? h("section", null, h("h3", null, "Personality"), h("blockquote", { class: "persona" }, g.personality)) : null,
    h("section", null, h("h3", null, "Parent → child letters"), letters.length ? letters : h("p", { class: "muted" }, a.generation === 1 ? "Founder: no letter received." : "No letter yet.")),
    h("section", null, h("h3", null, "Financial history"),
      h("dl", { class: "kv" },
        h("div", null, h("dt", null, "Earned"), h("dd", null, formatNear(a.earned ?? 0, 3))),
        h("div", null, h("dt", null, "Paid to the AI"), h("dd", null, formatNearSmall(a.spentBrain ?? 0))),
        h("div", null, h("dt", null, "Passed to children"), h("dd", null, formatNear(passed, 3))),
        h("div", null, h("dt", null, "Missions"), h("dd", null, a.tasksDone ?? 0)),
        h("div", null, h("dt", null, "Reputation"), h("dd", null, a.reputation ?? 0)),
        h("div", null, h("dt", null, "Children"), h("dd", null, kids.length))),
      subRows.length ? h("ol", { class: "fin sub-fin", "aria-label": "Subcontracting" }, subRows.map((x) => h("li", { class: `sub-row ${x.delta >= 0n ? "up" : "down"}` }, h("span", { class: "f-t" }, `t${x.tick}`), h("span", { class: "f-r" }, x.text, h("small", null, x.sub)), h("b", { class: "f-d" }, x.amount)))) : null,
      rows.length ? h("ol", { class: "fin" }, rows.map((x) => h("li", { class: x.delta >= 0n ? "up" : "down" }, h("span", { class: "f-t" }, `t${x.tick}`), h("span", { class: "f-r" }, REASON[x.reason] ?? x.reason), h("b", { class: "f-d" }, signedNear(x.delta, 3))))) : h("p", { class: "muted" }, "No movement recorded yet."),
      meta.length ? h("p", { class: "muted small" }, `Cumulative cost of living: ${formatNear(-metaSum, 3)} NEAR over ${meta.length} tick${meta.length > 1 ? "s" : ""}.`) : null),
    parent ? h("p", { class: "p-parent" }, "Parent: ", h("button", { type: "button", class: "link", onclick: () => select(parent.id) }, firstName(parent))) : null);
}

export function select(id) {
  selected = id;
  tree?.setSelected(id);
  const root = $("lignees");
  root.classList.toggle("with-panel", !!id);
  renderPanel();
  if (id) $("panel").scrollTop = 0;
  if (id) setTimeout(() => $("panel").querySelector(".p-close")?.focus({ preventScroll: true }), 50);
}
const refreshPanel = () => { if (!selected || panelTimer) return; panelTimer = setTimeout(() => { panelTimer = 0; renderPanel(); }, 400); };

function renderLegend() {
  const ids = [...new Set([...store.agents.values()].map((a) => a.genome?.profession).filter(Boolean))];
  const list = ids.length ? ids : ["logo", "finance", "architecture", "marketing", "translation", "legal"];
  $("legend").replaceChildren(...list.map((id) => { const j = jobOf(id); return h("li", { class: j.cls }, h("span", { class: "dot" }), labelOf(id)); }));
}
function renderCounters() {
  const all = [...store.agents.values()], alive = all.filter((a) => a.status === "alive").length;
  const gen = Math.max(store.generations, ...all.map((a) => a.generation), 0);
  $("treeCount").replaceChildren(h("b", null, `Generation ${gen}`), ` · ${alive} alive · ${all.length - alive} dead`);
}

export function initLignees() {
  tree = new LineageTree($("treeHost"), { onSelect: select });
  $("zoomIn").addEventListener("click", () => tree.zoomBy(1.3));
  $("zoomOut").addEventListener("click", () => tree.zoomBy(0.77));
  $("zoomFit").addEventListener("click", () => tree.fit());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && selected && !$("lignees").hidden) select(null); });
  on("reset", () => { tree.clear(); select(null); renderLegend(); renderCounters(); });
  on("loaded", () => { tree.schedule(); renderLegend(); renderCounters(); });
  on("event", (ev) => {
    const d = ev.data ?? {};
    switch (ev.type) {
      case "letter.received": refreshPanel(); break;
      case "agent.born": case "agent.died": case "agent.reproduced": tree.schedule(); renderLegend(); renderCounters(); refreshPanel(); break;
      case "balance.changed":
        tree.schedule(); refreshPanel();
        if (core.live && (d.reason === "task" || d.reason === "brain")) tree.float(d.agentId, d.reason === "brain" ? `${big(d.delta) >= 0n ? "+" : ""}${formatNearSmall(d.delta)}` : signedNear(d.delta, 2), big(d.delta) >= 0n ? "up" : "down");
        break;
      case "letter.written": refreshPanel(); break;
      default: break;
    }
  });
  renderLegend(); renderCounters();
}
export const showLignees = () => { tree?.schedule(); };
void aliveAgents;
