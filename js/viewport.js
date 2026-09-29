// Interactive SVG viewport: pan/zoom, selection, drag-to-move, the
// dimension tool, inline editing of dimensions and 3D orbit.

import { VIEW_BASES, orbitBasis } from './geometry.js';
import {
  renderView, fitCamera, planeToScreen, screenToPlane, dimSvg, dimValue,
} from './render.js';
import { fmtLen, toDisplay, fromDisplay, findPart } from './model.js';

const LABELS = { top: 'Top', front: 'Front', right: 'Right side', iso: '3D' };
const HINTS = {
  top: 'looking down · X across, Y back',
  front: 'looking back · X across, Z up',
  right: 'looking left · Y across, Z up',
  iso: 'drag to orbit · shift-drag to pan',
};

export class Viewport {
  constructor(root, id, app) {
    this.id = id;
    this.app = app;
    this.ortho = id !== 'iso';
    this.yaw = 0.62;
    this.pitch = 0.5;
    this.cam = null;
    this.snap = [];
    this.dimState = null;
    this.W = 400; this.H = 300;

    root.innerHTML = `
      <div class="vp-head">
        <span class="vp-name">${LABELS[id]}</span>
        <span class="vp-hint">${HINTS[id]}</span>
        <span class="vp-actions">
          <button type="button" class="icon-btn" data-act="fit" title="Zoom to fit (F)" aria-label="Zoom ${LABELS[id]} view to fit">⤢</button>
          <button type="button" class="icon-btn" data-act="max" title="Maximise this view (double-click header)" aria-label="Maximise ${LABELS[id]} view">▢</button>
        </span>
      </div>
      <svg class="cad" id="svg-${id}" role="img" aria-label="${LABELS[id]} view of the device"><g class="scene"></g><g class="overlay"></g></svg>
      <input class="dim-edit" id="dim-edit-${id}" type="number" step="any" hidden aria-label="New dimension value">`;
    this.root = root;
    this.svg = root.querySelector('svg');
    this.scene = root.querySelector('.scene');
    this.overlay = root.querySelector('.overlay');
    this.editInput = root.querySelector('.dim-edit');

    root.querySelector('[data-act=fit]').addEventListener('click', () => { this.fit(); this.render(); });
    root.querySelector('[data-act=max]').addEventListener('click', () => app.toggleMax(id));
    root.querySelector('.vp-head').addEventListener('dblclick', () => app.toggleMax(id));

    new ResizeObserver(() => this.resize()).observe(this.svg);
    this.bindPointer();
    this.bindEdit();
  }

  get basis() {
    return this.ortho ? VIEW_BASES[this.id] : orbitBasis(this.yaw, this.pitch);
  }

  resize() {
    const r = this.svg.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const first = !this.cam;
    this.W = r.width; this.H = r.height;
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    if (first) this.fit();
    else { this.cam.W = this.W; this.cam.H = this.H; }
    this.render();
  }

  fit() {
    this.cam = fitCamera(this.app.project, this.basis, this.W, this.H, this.ortho ? 64 : 36, 30);
  }

  render() {
    if (!this.cam) return;
    const { project, sel } = this.app;
    const { svg, snap } = renderView(project, {
      basis: this.basis, cam: this.cam, viewId: this.id, ortho: this.ortho,
      selection: sel, units: project.settings.units, grid: project.settings.grid,
      showGrid: this.app.showGrid, colourMode: this.app.colourMode, editable: true,
    });
    this.scene.innerHTML = svg;
    this.snap = snap;
    this.renderOverlay();
  }

  // ---------- coordinates ----------

  local(e) {
    const r = this.svg.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  snapPoint(sp) {
    let best = null, bd = 10;
    for (const p of this.snap) {
      const d = Math.hypot(p[0] - sp[0], p[1] - sp[1]);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) return { screen: best, plane: screenToPlane(this.cam, best[0], best[1]), vertex: true };
    let plane = screenToPlane(this.cam, sp[0], sp[1]);
    const { snap, grid } = this.app.project.settings;
    if (snap) plane = plane.map((v) => Math.round(v / grid) * grid);
    return { screen: planeToScreen(this.cam, plane[0], plane[1]), plane, vertex: false };
  }

  // ---------- pointer handling ----------

  bindPointer() {
    const svg = this.svg;
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const sp = this.local(e);
      const before = screenToPlane(this.cam, sp[0], sp[1]);
      const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      this.cam.s = Math.max(0.02, Math.min(40, this.cam.s * k));
      const after = screenToPlane(this.cam, sp[0], sp[1]);
      this.cam.cx += before[0] - after[0];
      this.cam.cy += before[1] - after[1];
      this.render();
    }, { passive: false });

    svg.addEventListener('contextmenu', (e) => {
      if (this.dimState) { e.preventDefault(); this.dimState = null; this.renderOverlay(); }
    });

    svg.addEventListener('pointerdown', (e) => this.onDown(e));
    svg.addEventListener('pointermove', (e) => this.onMove(e));
    svg.addEventListener('pointerup', (e) => this.onUp(e));
    svg.addEventListener('pointercancel', () => { this.drag = null; });
    svg.addEventListener('pointerleave', () => { if (this.dimState) { this.dimState.cursor = null; this.renderOverlay(); } });
  }

  onDown(e) {
    if (e.button === 2) return;
    const sp = this.local(e);
    const tool = this.app.tool;
    const target = e.target;

    if (target.closest?.('[data-edit]') && tool === 'select' && e.button === 0) {
      this.openEdit(target.closest('[data-edit]'));
      e.preventDefault();
      return;
    }

    const pan = e.button === 1 || e.shiftKey;
    if (this.ortho && tool === 'dim' && e.button === 0 && !e.shiftKey) {
      this.dimClick(sp);
      return;
    }

    svg_capture(this.svg, e);
    const partEl = target.closest?.('[data-part]');
    const dimEl = target.closest?.('[data-dim]');
    this.drag = {
      start: sp, last: sp, moved: false,
      mode: pan ? 'pan' : (!this.ortho ? 'orbit' : (partEl ? 'move' : (dimEl ? 'none' : 'pan'))),
      partId: partEl?.dataset.part, bracketId: partEl?.dataset.bracket, dimId: dimEl?.dataset.dim,
    };
    if (this.drag.mode === 'move') {
      const part = findPart(this.app.project, this.drag.partId);
      this.drag.startPos = { ...part.pos };
      if (this.drag.bracketId) {
        const br = part.brackets.find((b) => b.id === this.drag.bracketId);
        this.drag.mode = 'bracket';
        this.drag.startUV = { u: br.u, v: br.v };
      }
      this.app.select(this.drag.partId, this.drag.bracketId || null, { quiet: true });
    }
  }

  onMove(e) {
    const sp = this.local(e);
    if (this.dimState) {
      this.dimState.cursor = sp;
      this.renderOverlay();
    }
    const d = this.drag;
    if (!d) return;
    const dx = sp[0] - d.last[0], dy = sp[1] - d.last[1];
    if (!d.moved && Math.hypot(sp[0] - d.start[0], sp[1] - d.start[1]) < 3) return;
    if (!d.moved && (d.mode === 'move' || d.mode === 'bracket')) this.app.checkpoint();
    d.moved = true;
    d.last = sp;
    if (d.mode === 'pan') {
      this.cam.cx -= dx / this.cam.s;
      this.cam.cy += dy / this.cam.s;
      this.render();
    } else if (d.mode === 'orbit') {
      this.yaw -= dx * 0.01;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dy * 0.01));
      this.render();
    } else if (d.mode === 'move' || d.mode === 'bracket') {
      const da = (sp[0] - d.start[0]) / this.cam.s, db = -(sp[1] - d.start[1]) / this.cam.s;
      const { right, up } = this.basis;
      const delta = [0, 1, 2].map((i) => right[i] * da + up[i] * db);
      const { snap, grid } = this.app.project.settings;
      const g = (v) => (snap ? Math.round(v / grid) * grid : Math.round(v * 10) / 10);
      const part = findPart(this.app.project, d.partId);
      if (d.mode === 'move') {
        const keys = ['x', 'y', 'z'];
        keys.forEach((k, i) => {
          if (Math.abs(right[i]) + Math.abs(up[i]) > 0.5) part.pos[k] = g(d.startPos[k] + delta[i]);
        });
      } else {
        const br = part.brackets.find((b) => b.id === d.bracketId);
        const ax = { bottom: [0, 1], top: [0, 1], front: [0, 2], back: [0, 2], left: [1, 2], right: [1, 2] }[br.face];
        br.u = g(d.startUV.u + delta[ax[0]]);
        br.v = g(d.startUV.v + delta[ax[1]]);
      }
      this.app.refresh({ panels: false });
    }
  }

  onUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.moved) {
      if (d.dimId) this.app.selectDim(d.dimId);
      else if (d.partId) this.app.select(d.partId, d.bracketId || null);
      else if (d.mode === 'pan' || d.mode === 'orbit') this.app.select(null);
    } else if (d.mode === 'move' || d.mode === 'bracket') {
      this.app.refresh();
    }
  }

  // ---------- dimension tool ----------

  dimClick(sp) {
    const pt = this.snapPoint(sp);
    const st = this.dimState;
    if (!st) {
      this.dimState = { a: pt.plane, cursor: sp };
    } else if (!st.b) {
      if (Math.hypot(pt.plane[0] - st.a[0], pt.plane[1] - st.a[1]) < 1e-6) return;
      st.b = pt.plane;
    } else {
      const c = screenToPlane(this.cam, sp[0], sp[1]);
      this.app.addDimension({ view: this.id, mode: this.resolveMode(st.a, st.b, c), a: st.a, b: st.b, c });
      this.dimState = null;
    }
    this.renderOverlay();
  }

  resolveMode(a, b, c) {
    const m = this.app.dimMode;
    if (m !== 'auto') return m;
    const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
    if (dx < 1e-6) return 'v';
    if (dy < 1e-6) return 'h';
    // Like most CAD packages: drag the dimension above/below for horizontal,
    // to either side for vertical.
    const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]);
    const minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
    if (c && (c[1] > maxY || c[1] < minY) && c[0] >= minX && c[0] <= maxX) return 'h';
    if (c && (c[0] > maxX || c[0] < minX) && c[1] >= minY && c[1] <= maxY) return 'v';
    return dx >= dy ? 'h' : 'v';
  }

  cancelTool() {
    this.dimState = null;
    this.renderOverlay();
  }

  renderOverlay() {
    const st = this.dimState;
    if (!st || this.app.tool !== 'dim' || !this.cam) { this.overlay.innerHTML = ''; return; }
    const out = [];
    const cur = st.cursor ? this.snapPoint(st.cursor) : null;
    if (cur && !st.b) out.push(`<rect class="snap-mark${cur.vertex ? ' on-vertex' : ''}" x="${cur.screen[0] - 4}" y="${cur.screen[1] - 4}" width="8" height="8"/>`);
    const A = planeToScreen(this.cam, st.a[0], st.a[1]);
    out.push(`<circle class="snap-pt" cx="${A[0]}" cy="${A[1]}" r="3"/>`);
    const units = this.app.project.settings.units;
    if (!st.b && cur) {
      const d = { a: st.a, b: cur.plane, mode: 'a' };
      out.push(`<line class="rubber" x1="${A[0]}" y1="${A[1]}" x2="${cur.screen[0]}" y2="${cur.screen[1]}"/>`);
      out.push(`<text class="rubber-text" x="${cur.screen[0] + 10}" y="${cur.screen[1] - 10}">${fmtLen(dimValue(d), units)}</text>`);
    } else if (st.b) {
      const B = planeToScreen(this.cam, st.b[0], st.b[1]);
      const place = st.cursor || [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 30];
      const c = screenToPlane(this.cam, place[0], place[1]);
      const mode = this.resolveMode(st.a, st.b, c);
      out.push(dimSvg(A, B, mode, place, fmtLen(dimValue({ a: st.a, b: st.b, mode }), units), { cls: 'dim-preview' }));
    }
    this.overlay.innerHTML = out.join('');
  }

  // ---------- inline editing of a part dimension ----------

  bindEdit() {
    const inp = this.editInput;
    const close = (commit) => {
      if (inp.hidden) return;
      const target = inp.dataset.target;
      const v = parseFloat(inp.value);
      inp.hidden = true;
      if (commit && Number.isFinite(v) && v > 0) {
        const [partId, axis] = target.split(':');
        this.app.editExtent(partId, axis, fromDisplay(v, this.app.project.settings.units));
      }
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
      else if (e.key === 'Escape') { e.preventDefault(); close(false); }
      e.stopPropagation();
    });
    inp.addEventListener('blur', () => close(true));
  }

  openEdit(el) {
    const [partId, axis] = el.dataset.edit.split(':');
    const part = findPart(this.app.project, partId);
    if (!part) return;
    const r = el.getBoundingClientRect(), host = this.root.getBoundingClientRect();
    const inp = this.editInput;
    const { units } = this.app.project.settings;
    const b = this.app.boundsFor(part);
    const cur = { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 }[axis];
    inp.value = toDisplay(cur, units);
    inp.dataset.target = el.dataset.edit;
    inp.style.left = `${r.left - host.left + r.width / 2 - 40}px`;
    inp.style.top = `${r.top - host.top + r.height / 2 - 14}px`;
    inp.hidden = false;
    inp.focus();
    inp.select();
  }
}

function svg_capture(svg, e) {
  try { svg.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
}

