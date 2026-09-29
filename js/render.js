// SVG rendering of the assembly in orthographic and axonometric views.
// Pure string builders so the same code draws the editor and the spec sheet.

import { FOAMS, BASES } from './catalog.js';
import {
  foamFaces, foamEdges, baseFaces, bracketBox, boxFaces, faceNormal, dot, norm, partBounds,
} from './geometry.js';
import { fmtLen, assemblyBounds } from './model.js';

const LIGHT = norm([-0.35, -0.55, 0.8]);
const BRACKET_FILL = '#8792a0';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex, k) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function baseColour(key) {
  if (key.startsWith('ply')) return '#c79a63';
  if (key === 'alu3') return '#b8c0c8';
  return '#9fa7a0';
}

// Every polygon in the scene, in world coordinates, with edge information so
// curved surfaces are drawn without their facet lines.
export function sceneFaces(project, { colourMode = 'foam' } = {}) {
  const out = [];
  const push = (faces, edges, info) => {
    const base = out.length;
    faces.forEach((verts, i) => {
      const e = edges?.[i];
      out.push({
        verts, ...info,
        hard: e ? e.hard : verts.map(() => true),
        nb: e ? e.nb.map((k) => (k === null ? null : base + k)) : verts.map(() => null),
      });
    });
  };
  for (const part of project.parts) {
    if (part.hidden) continue;
    const fill = colourMode === 'cover' && part.cover.material !== 'none'
      ? part.cover.colour
      : (FOAMS[part.foam] || FOAMS.hr40).colour;
    push(foamFaces(part), foamEdges(part), { fill, partId: part.id, kind: 'foam' });
    if (BASES[part.base]?.t) push(baseFaces(part), null, { fill: baseColour(part.base), partId: part.id, kind: 'base' });
    for (const br of part.brackets) {
      const { lo, hi } = bracketBox(part, br);
      push(boxFaces(lo, hi), null, { fill: BRACKET_FILL, partId: part.id, bracketId: br.id, kind: 'bracket' });
    }
  }
  for (const f of out) f.n = faceNormal(f.verts);
  return out;
}

export function projector(basis, cam) {
  const { right, up } = basis;
  return (p) => [
    cam.W / 2 + (dot(p, right) - cam.cx) * cam.s,
    cam.H / 2 - (dot(p, up) - cam.cy) * cam.s,
  ];
}

export function planeToScreen(cam, a, b) {
  return [cam.W / 2 + (a - cam.cx) * cam.s, cam.H / 2 - (b - cam.cy) * cam.s];
}

export function screenToPlane(cam, x, y) {
  return [cam.cx + (x - cam.W / 2) / cam.s, cam.cy - (y - cam.H / 2) / cam.s];
}

export function fitCamera(project, basis, W, H, pad = 60, top = 0) {
  const faces = sceneFaces(project);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const f of faces) {
    for (const v of f.verts) {
      const a = dot(v, basis.right), b = dot(v, basis.up);
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
  }
  if (!Number.isFinite(a0)) { a0 = 0; a1 = 500; b0 = 0; b1 = 500; }
  // `top` reserves room for a header overlay above the drawing.
  let s = Math.min((W - 2 * pad) / Math.max(a1 - a0, 1), (H - 2 * pad - top) / Math.max(b1 - b0, 1));
  s = Math.max(0.02, Math.min(s, 20));
  return { cx: (a0 + a1) / 2, cy: (b0 + b1) / 2 + top / 2 / s, s, W, H };
}

// ---------- dimensions ----------

const f1 = (v) => Math.round(v * 10) / 10;

// A linear dimension between screen points p1 and p2. `mode` is h, v or a
// (aligned); the dimension line passes through screen point `place`.
export function dimSvg(p1, p2, mode, place, label, { cls = '', attrs = '' } = {}) {
  let m;
  if (mode === 'h') m = [1, 0];
  else if (mode === 'v') m = [0, 1];
  else {
    const l = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    m = [(p2[0] - p1[0]) / l, (p2[1] - p1[1]) / l];
  }
  const n = [-m[1], m[0]];
  const s = place[0] * n[0] + place[1] * n[1];
  const proj = (p) => [p[0] + n[0] * (s - (p[0] * n[0] + p[1] * n[1])), p[1] + n[1] * (s - (p[0] * n[0] + p[1] * n[1]))];
  const d1 = proj(p1), d2 = proj(p2);
  const parts = [];
  for (const [p, d] of [[p1, d1], [p2, d2]]) {
    const off = s - (p[0] * n[0] + p[1] * n[1]);
    if (Math.abs(off) < 1) continue;
    const sg = Math.sign(off);
    parts.push(`<line class="ext" x1="${f1(p[0] + n[0] * sg * 3)}" y1="${f1(p[1] + n[1] * sg * 3)}" x2="${f1(d[0] + n[0] * sg * 5)}" y2="${f1(d[1] + n[1] * sg * 5)}"/>`);
  }
  const len = Math.hypot(d2[0] - d1[0], d2[1] - d1[1]);
  const dir = len > 0 ? [(d2[0] - d1[0]) / len, (d2[1] - d1[1]) / len] : m;
  const inside = len > 26;
  const arrow = (tip, towards) => {
    const bx = tip[0] - towards[0] * 8, by = tip[1] - towards[1] * 8;
    return `<path class="arrow" d="M${f1(tip[0])},${f1(tip[1])} L${f1(bx + dir[1] * 2.6)},${f1(by - dir[0] * 2.6)} L${f1(bx - dir[1] * 2.6)},${f1(by + dir[0] * 2.6)}Z"/>`;
  };
  if (inside) {
    parts.push(`<line class="dim-line" x1="${f1(d1[0])}" y1="${f1(d1[1])}" x2="${f1(d2[0])}" y2="${f1(d2[1])}"/>`);
    parts.push(arrow(d1, [-dir[0], -dir[1]]), arrow(d2, dir));
  } else {
    parts.push(`<line class="dim-line" x1="${f1(d1[0] - dir[0] * 16)}" y1="${f1(d1[1] - dir[1] * 16)}" x2="${f1(d2[0] + dir[0] * 16)}" y2="${f1(d2[1] + dir[1] * 16)}"/>`);
    parts.push(arrow(d1, dir), arrow(d2, [-dir[0], -dir[1]]));
  }
  let ang = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
  if (ang >= 90) ang -= 180;
  if (ang < -90) ang += 180;
  const mx = (d1[0] + d2[0]) / 2, my = (d1[1] + d2[1]) / 2;
  // Text sits just off the line, on the side away from the measured feature.
  const side = (s - ((p1[0] + p2[0]) / 2 * n[0] + (p1[1] + p2[1]) / 2 * n[1])) >= 0 ? 1 : -1;
  let tx = mx, ty = my;
  if (!inside) { tx = d2[0] + dir[0] * 22; ty = d2[1] + dir[1] * 22; }
  const tn = [n[0] * side, n[1] * side];
  // Keep the label off the line: horizontal labels above, others beside.
  if (mode === 'h') ty -= 6;
  else { tx += tn[0] * 9; ty += tn[1] * 9; }
  parts.push(`<text class="dim-text" x="${f1(tx)}" y="${f1(ty)}" transform="rotate(${f1(ang)} ${f1(tx)} ${f1(ty)})" text-anchor="middle" dominant-baseline="${mode === 'h' ? 'auto' : 'middle'}" ${attrs}>${esc(label)}</text>`);
  return `<g class="dim ${cls}">${parts.join('')}</g>`;
}

// ---------- grid ----------

function gridSvg(cam, grid) {
  let step = Math.max(1, grid);
  const mults = [2, 2.5, 2];
  let i = 0;
  while (step * cam.s < 8) { step *= mults[i % 3]; i += 1; }
  const major = step >= 100 ? step * 5 : 100;
  const [a0, b1] = [cam.cx - cam.W / 2 / cam.s, cam.cy + cam.H / 2 / cam.s];
  const [a1, b0] = [cam.cx + cam.W / 2 / cam.s, cam.cy - cam.H / 2 / cam.s];
  const minor = [], maj = [], axis = [];
  for (let a = Math.ceil(a0 / step) * step; a <= a1; a += step) {
    const [x] = planeToScreen(cam, a, 0);
    const line = `M${f1(x)},0V${cam.H}`;
    if (Math.abs(a) < 1e-6) axis.push(line); else if (Math.abs(a / major - Math.round(a / major)) < 1e-6) maj.push(line); else minor.push(line);
  }
  for (let b = Math.ceil(b0 / step) * step; b <= b1; b += step) {
    const [, y] = planeToScreen(cam, 0, b);
    const line = `M0,${f1(y)}H${cam.W}`;
    if (Math.abs(b) < 1e-6) axis.push(line); else if (Math.abs(b / major - Math.round(b / major)) < 1e-6) maj.push(line); else minor.push(line);
  }
  return `<g class="grid"><path class="grid-minor" d="${minor.join('')}"/><path class="grid-major" d="${maj.join('')}"/><path class="grid-axis" d="${axis.join('')}"/></g>`;
}

function floorGridSvg(project, basis, cam) {
  const b = assemblyBounds(project) || { x0: 0, y0: 0, x1: 400, y1: 400 };
  const pad = 100;
  const x0 = Math.floor((b.x0 - pad) / 100) * 100, x1 = Math.ceil((b.x1 + pad) / 100) * 100;
  const y0 = Math.floor((b.y0 - pad) / 100) * 100, y1 = Math.ceil((b.y1 + pad) / 100) * 100;
  const pr = projector(basis, cam);
  const d = [];
  for (let x = x0; x <= x1; x += 100) { const p = pr([x, y0, 0]), q = pr([x, y1, 0]); d.push(`M${f1(p[0])},${f1(p[1])}L${f1(q[0])},${f1(q[1])}`); }
  for (let y = y0; y <= y1; y += 100) { const p = pr([x0, y, 0]), q = pr([x1, y, 0]); d.push(`M${f1(p[0])},${f1(p[1])}L${f1(q[0])},${f1(q[1])}`); }
  return `<g class="grid"><path class="grid-minor" d="${d.join('')}"/></g>`;
}

function triadSvg(basis, H) {
  const o = [34, H - 30];
  const axes = [['X', [1, 0, 0]], ['Y', [0, 1, 0]], ['Z', [0, 0, 1]]];
  const out = [];
  for (const [name, v] of axes) {
    const dx = dot(v, basis.right), dy = -dot(v, basis.up);
    const l = Math.hypot(dx, dy);
    if (l < 0.15) {
      out.push(`<text class="triad-text" x="${o[0] + 1}" y="${o[1] + 4}" text-anchor="middle">${dot(v, basis.eye) > 0 ? '⊙' : '⊗'}</text>`);
      continue;
    }
    const e = [o[0] + dx * 22, o[1] + dy * 22];
    out.push(`<line class="triad triad-${name.toLowerCase()}" x1="${o[0]}" y1="${o[1]}" x2="${f1(e[0])}" y2="${f1(e[1])}"/>`);
    out.push(`<text class="triad-text" x="${f1(o[0] + dx * 32)}" y="${f1(o[1] + dy * 32 + 4)}" text-anchor="middle">${name}</text>`);
  }
  return `<g class="triad-g">${out.join('')}</g>`;
}

// ---------- main view renderer ----------

const AXIS_OF = (v) => v.findIndex((c) => Math.abs(c) > 0.5);
const LO = ['x0', 'y0', 'z0'], HI = ['x1', 'y1', 'z1'];
const AXIS_NAME = ['x', 'y', 'z'];

export function renderView(project, opts) {
  const {
    basis, cam, viewId, selection = {}, units = 'mm', grid = 10, showGrid = true,
    colourMode = 'foam', showDims = true, editable = false, ortho = true,
  } = opts;
  const pr = projector(basis, cam);
  const all = sceneFaces(project, { colourMode });
  const visible = all.map((f) => dot(f.n, basis.eye) > 1e-6);
  const faces = all
    .map((f, i) => ({ f, i }))
    .filter(({ i }) => visible[i])
    .map(({ f, i }) => {
      let depth = 0;
      for (const v of f.verts) depth += dot(v, basis.eye);
      return { ...f, idx: i, depth: depth / f.verts.length, pts: f.verts.map(pr) };
    })
    .sort((a, b) => a.depth - b.depth);

  const out = [];
  if (showGrid) out.push(ortho ? gridSvg(cam, grid) : floorGridSvg(project, basis, cam));

  const snap = [];
  const polys = faces.map((f) => {
    const light = 0.62 + 0.38 * Math.max(0, dot(f.n, LIGHT));
    const selPart = selection.partId === f.partId;
    const selBr = f.bracketId && selection.bracketId === f.bracketId;
    const cls = ['face', `face-${f.kind}`];
    if (selPart && (!selection.bracketId || f.kind !== 'bracket')) cls.push('sel');
    if (selBr) cls.push('sel-br');
    const colour = shade(f.fill, light);
    const pts = f.pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' ');
    // Edges: sharp ones always, smooth ones only where the neighbour faces away (silhouette).
    const d = [];
    for (let i = 0; i < f.pts.length; i++) {
      const nb = f.nb[i];
      if (!f.hard[i] && nb !== null && visible[nb]) continue;
      const p = f.pts[i], q = f.pts[(i + 1) % f.pts.length];
      d.push(`M${f1(p[0])},${f1(p[1])}L${f1(q[0])},${f1(q[1])}`);
      snap.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
    }
    const attrs = `data-part="${f.partId}"${f.bracketId ? ` data-bracket="${f.bracketId}"` : ''}`;
    return `<polygon class="${cls.join(' ')}" points="${pts}" fill="${colour}" stroke="${colour}" ${attrs}/>${d.length ? `<path class="edge ${cls.slice(2).join(' ')}" d="${d.join('')}"/>` : ''}`;
  });
  out.push(`<g class="faces">${polys.join('')}</g>`);

  if (ortho && showDims) {
    const hAxis = AXIS_OF(basis.right), vAxis = AXIS_OF(basis.up);
    const dims = [];
    const sel = project.parts.find((p) => p.id === selection.partId && !p.hidden);
    const env = assemblyBounds(project);
    const boxScreen = (b) => {
      const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
      const a = pr(lo), c = pr(hi);
      return { l: Math.min(a[0], c[0]), r: Math.max(a[0], c[0]), t: Math.min(a[1], c[1]), b: Math.max(a[1], c[1]) };
    };
    if (env && (!sel || project.parts.filter((p) => !p.hidden).length > 1)) {
      const s = boxScreen(env);
      const hv = env[HI[hAxis]] - env[LO[hAxis]], vv = env[HI[vAxis]] - env[LO[vAxis]];
      dims.push(dimSvg([s.l, s.t], [s.r, s.t], 'h', [0, s.t - 42], fmtLen(hv, units), { cls: 'dim-env' }));
      dims.push(dimSvg([s.l, s.b], [s.l, s.t], 'v', [s.l - 42, 0], fmtLen(vv, units), { cls: 'dim-env' }));
    }
    if (sel) {
      const b = partBounds(sel, false);
      const s = boxScreen(b);
      const hv = b[HI[hAxis]] - b[LO[hAxis]], vv = b[HI[vAxis]] - b[LO[vAxis]];
      const ed = (axis) => (editable ? `data-edit="${sel.id}:${AXIS_NAME[axis]}"` : '');
      dims.push(dimSvg([s.l, s.b], [s.r, s.b], 'h', [0, s.b + 26], fmtLen(hv, units), { cls: 'dim-sel', attrs: ed(hAxis) }));
      dims.push(dimSvg([s.r, s.b], [s.r, s.t], 'v', [s.r + 26, 0], fmtLen(vv, units), { cls: 'dim-sel', attrs: ed(vAxis) }));
    }
    out.push(`<g class="auto-dims">${dims.join('')}</g>`);

    const user = (project.dimensions || []).filter((d) => d.view === viewId).map((d) => {
      const [p1, p2, pc] = [d.a, d.b, d.c].map(([a, b]) => planeToScreen(cam, a, b));
      const val = dimValue(d);
      return dimSvg(p1, p2, d.mode, pc, fmtLen(val, units), {
        cls: `dim-user${selection.dimId === d.id ? ' dim-picked' : ''}`,
        attrs: `data-dim="${d.id}"`,
      }).replace('<g class="dim', `<g data-dim="${d.id}" class="dim`);
    });
    out.push(`<g class="user-dims">${user.join('')}</g>`);
  }
  out.push(triadSvg(basis, cam.H));
  return { svg: out.join(''), snap };
}

export function dimValue(d) {
  const dx = Math.abs(d.b[0] - d.a[0]), dy = Math.abs(d.b[1] - d.a[1]);
  if (d.mode === 'h') return dx;
  if (d.mode === 'v') return dy;
  return Math.hypot(dx, dy);
}

// A static, self-contained SVG drawing (used for the spec sheet and export).
export function staticViewSvg(project, basis, W, H, { viewId, units, colourMode = 'foam', ortho = true, title = '' } = {}) {
  const cam = fitCamera(project, basis, W, H, ortho ? 64 : 30, 20);
  const { svg } = renderView(project, {
    basis, cam, viewId, units, colourMode, ortho, showGrid: false, showDims: true, selection: {},
  });
  return `<svg class="cad" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}${title ? `<text class="view-title" x="10" y="18">${esc(title)}</text>` : ''}</svg>`;
}
