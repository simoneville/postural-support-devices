// Geometry for foam parts. Every shape is a prism: a 2D profile extruded
// along one axis. That keeps volume, surface area and rendering simple.
//
// Assembly frame (mm): X = width (left → right), Y = depth (front → back),
// Z = height (floor → up).

import { BASES } from './catalog.js';

const SEG = 36;

const P = (key, label, def, extra = {}) => ({ key, label, def, min: 0, ...extra });

export const SHAPES = {
  block: {
    label: 'Rectangular block',
    params: [P('w', 'Width', 400, { min: 1 }), P('d', 'Depth', 400, { min: 1 }), P('h', 'Height', 50, { min: 1 })],
    profile: (p) => ({ axis: 'z', len: p.h, pts: rect(p.w, p.d) }),
  },
  chamfer: {
    label: 'Chamfered block',
    params: [P('w', 'Width', 300, { min: 1 }), P('d', 'Depth', 300, { min: 1 }), P('h', 'Height', 80, { min: 1 }),
      P('c', 'Chamfer (top side edges)', 20)],
    profile: (p) => {
      const c = clamp(p.c, 0, Math.min(p.w / 2 - 0.5, p.h - 0.5));
      const pts = c > 0
        ? [[0, 0], [p.w, 0], [p.w, p.h - c], [p.w - c, p.h], [c, p.h], [0, p.h - c]]
        : rect(p.w, p.h);
      return { axis: 'y', len: p.d, pts };
    },
  },
  wedge: {
    label: 'Wedge',
    params: [P('w', 'Width', 400, { min: 1 }), P('d', 'Depth', 400, { min: 1 }),
      P('h', 'Height at back', 40), P('h2', 'Height at front', 90)],
    profile: (p) => {
      const pts = [[0, 0], [p.d, 0]];
      if (p.h > 0) pts.push([p.d, p.h]);
      if (p.h2 > 0) pts.push([0, p.h2]);
      return { axis: 'x', len: p.w, pts };
    },
    extent: (p) => ({ z: ['h', 'h2'][p.h >= p.h2 ? 0 : 1] }),
  },
  scoop: {
    label: 'Contoured (scooped) block',
    params: [P('w', 'Width', 420, { min: 1 }), P('d', 'Depth', 400, { min: 1 }), P('h', 'Height', 75, { min: 1 }),
      P('sw', 'Contour width', 320), P('s', 'Contour depth', 20)],
    profile: (p) => {
      const sw = clamp(p.sw, 0, p.w);
      const s = clamp(p.s, 0, p.h - 1);
      const pts = [[0, 0], [p.w, 0], [p.w, p.h]];
      if (sw > 0 && s > 0) {
        const x0 = (p.w - sw) / 2;
        pts.push([x0 + sw, p.h]);
        for (const [u, v] of arc(sw, s)) pts.push([x0 + sw - u, p.h - v]);
        pts.push([x0, p.h]);
      }
      pts.push([0, p.h]);
      return { axis: 'y', len: p.d, pts: dedupe(pts) };
    },
  },
  lateral: {
    label: 'Curved lateral pad',
    params: [P('w', 'Thickness', 60, { min: 1 }), P('d', 'Depth', 160, { min: 1 }), P('h', 'Height', 200, { min: 1 }),
      P('s', 'Curve depth (inner face)', 15)],
    profile: (p) => {
      const s = clamp(p.s, 0, p.w - 1);
      const pts = [[0, 0], [p.w, 0], [p.w, p.d], [0, p.d]];
      // Concave arc on the x = 0 face, running from back to front.
      if (s > 0) for (const [u, v] of arc(p.d, s)) pts.push([v, p.d - u]);
      return { axis: 'z', len: p.h, pts: dedupe(pts) };
    },
  },
  lshape: {
    label: 'L-shaped block',
    params: [P('w', 'Width', 400, { min: 1 }), P('d', 'Depth', 400, { min: 1 }), P('h', 'Height', 50, { min: 1 }),
      P('nw', 'Notch width', 120), P('nd', 'Notch depth', 150)],
    profile: (p) => {
      const nw = clamp(p.nw, 0, p.w - 1);
      const nd = clamp(p.nd, 0, p.d - 1);
      const pts = nw > 0 && nd > 0
        ? [[0, 0], [p.w, 0], [p.w, p.d - nd], [p.w - nw, p.d - nd], [p.w - nw, p.d], [0, p.d]]
        : rect(p.w, p.d);
      return { axis: 'z', len: p.h, pts };
    },
  },
  halfround: {
    label: 'Half-round bolster',
    params: [P('w', 'Length', 400, { min: 1 }), P('d', 'Diameter', 120, { min: 1 })],
    profile: (p) => {
      const r = p.d / 2;
      const pts = [];
      for (let i = 0; i <= SEG / 2; i++) {
        const t = (Math.PI * i) / (SEG / 2);
        pts.push([r + r * Math.cos(t), r * Math.sin(t)]);
      }
      return { axis: 'x', len: p.w, pts: dedupe(pts) };
    },
    extent: () => ({ z: 'd', zFactor: 2 }),
  },
  bolster: {
    label: 'Cylindrical roll',
    params: [P('w', 'Length', 400, { min: 1 }), P('d', 'Diameter', 150, { min: 1 })],
    profile: (p) => {
      const r = p.d / 2;
      const pts = [];
      for (let i = 0; i < SEG; i++) {
        const t = (2 * Math.PI * i) / SEG;
        pts.push([r + r * Math.cos(t), r + r * Math.sin(t)]);
      }
      return { axis: 'x', len: p.w, pts };
    },
    extent: () => ({ z: 'd' }),
  },
};

export function defaultParams(shape) {
  return Object.fromEntries(SHAPES[shape].params.map((p) => [p.key, p.def]));
}

// ---------- small helpers ----------

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rect(a, b) {
  return [[0, 0], [a, 0], [a, b], [0, b]];
}

// Circular arc with chord `c` along u and sagitta `s` along v, from u=0 to u=c
// (end points excluded, v measured inward from the chord).
function arc(c, s) {
  const R = (c * c / 4 + s * s) / (2 * s);
  const out = [];
  const n = 24;
  for (let i = 1; i < n; i++) {
    const u = (c * i) / n;
    const v = s - (R - Math.sqrt(Math.max(0, R * R - (u - c / 2) ** 2)));
    out.push([u, v]);
  }
  return out;
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  const a = out[0], z = out[out.length - 1];
  if (out.length > 1 && Math.hypot(a[0] - z[0], a[1] - z[1]) < 1e-6) out.pop();
  return out;
}

export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function perimeter(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
}

// (u, v) profile coordinates plus t along the extrusion axis → local xyz.
function lift(axis, u, v, t) {
  if (axis === 'z') return [u, v, t];
  if (axis === 'x') return [t, u, v];
  return [u, t, v]; // axis 'y': profile is (x, z)
}

// (u, v, t) is right-handed for x and z, left-handed for y.
const LEFT_HANDED = { x: false, y: true, z: false };

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Newell's method: robust normal for any planar polygon.
export function faceNormal(verts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([nx, ny, nz]);
}

// ---------- part geometry ----------

export function profileOf(part) {
  const prof = SHAPES[part.shape].profile(part.params);
  let pts = prof.pts;
  if ((signedArea(pts) < 0) !== LEFT_HANDED[prof.axis]) pts = pts.slice().reverse();
  return { ...prof, pts };
}

// Faces of an extruded profile, in local coordinates, wound so normals face outward.
export function prismFaces({ axis, len, pts }, t0 = 0) {
  const t1 = t0 + len;
  const faces = [];
  faces.push(pts.map(([u, v]) => lift(axis, u, v, t1)));
  faces.push(pts.slice().reverse().map(([u, v]) => lift(axis, u, v, t0)));
  for (let i = 0; i < pts.length; i++) {
    const [u1, v1] = pts[i];
    const [u2, v2] = pts[(i + 1) % pts.length];
    faces.push([lift(axis, u1, v1, t0), lift(axis, u2, v2, t0), lift(axis, u2, v2, t1), lift(axis, u1, v1, t1)]);
  }
  return faces;
}

// Edge information aligned with prismFaces(): for each face, which edges are
// sharp (always drawn) and which neighbouring face lies across each smooth
// edge (drawn only on the silhouette). Faces: top cap, bottom cap, sides.
export function prismEdges(pts, sharpDeg = 25) {
  const n = pts.length;
  const cosLim = Math.cos((sharpDeg * Math.PI) / 180);
  const sharp = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const d1 = [p[0] - a[0], p[1] - a[1]], d2 = [b[0] - p[0], b[1] - p[1]];
    const c = (d1[0] * d2[0] + d1[1] * d2[1]) / ((Math.hypot(...d1) * Math.hypot(...d2)) || 1);
    return c < cosLim;
  });
  const out = [
    { hard: pts.map(() => true), nb: pts.map((_, k) => 2 + k) },
    { hard: pts.map(() => true), nb: pts.map(() => null) },
  ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push({ hard: [true, sharp[j], true, sharp[i]], nb: [1, 2 + j, 0, 2 + ((i - 1 + n) % n)] });
  }
  return out;
}

export function localExtents(part) {
  const { axis, len, pts } = profileOf(part);
  let mu = 0, mv = 0;
  for (const [u, v] of pts) { mu = Math.max(mu, u); mv = Math.max(mv, v); }
  const [x, y, z] = lift(axis, mu, mv, len);
  return { w: x, d: y, h: z };
}

export function baseThickness(part) {
  return BASES[part.base]?.t ?? 0;
}

// Local → world transform: rotation about Z in 90° steps, then translate so
// the rotated footprint's min corner sits at part.pos.
export function transformer(part) {
  const { w, d } = localExtents(part);
  const { x: px, y: py, z: pz } = part.pos;
  const r = ((part.rot % 360) + 360) % 360;
  return ([x, y, z]) => {
    let X, Y;
    if (r === 90) { X = d - y; Y = x; }
    else if (r === 180) { X = w - x; Y = d - y; }
    else if (r === 270) { X = y; Y = w - x; }
    else { X = x; Y = y; }
    return [px + X, py + Y, pz + z];
  };
}

export function foamFaces(part) {
  const tf = transformer(part);
  return prismFaces(profileOf(part)).map((f) => f.map(tf));
}

export function foamEdges(part) {
  return prismEdges(profileOf(part).pts);
}

// Rigid base board under the foam. Follows the footprint for vertical
// extrusions (L-shapes, laterals); otherwise a plain rectangle.
export function baseFaces(part) {
  const t = baseThickness(part);
  if (!t) return [];
  const prof = profileOf(part);
  const { w, d } = localExtents(part);
  const foot = prof.axis === 'z' ? prof.pts : rect(w, d);
  const tf = transformer(part);
  return prismFaces({ axis: 'z', len: t, pts: foot }, -t).map((f) => f.map(tf));
}

export function boundsOf(points) {
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const [x, y, z] of points) {
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
  }
  return b;
}

// World-space bounding box of the foam (optionally including the base board).
export function partBounds(part, withBase = false) {
  const { w, d, h } = localExtents(part);
  const r = ((part.rot % 360) + 360) % 360;
  const [W, D] = r === 90 || r === 270 ? [d, w] : [w, d];
  const t = withBase ? baseThickness(part) : 0;
  const { x, y, z } = part.pos;
  return { x0: x, y0: y, z0: z - t, x1: x + W, y1: y + D, z1: z + h };
}

// Which parameter controls the world extent along an axis, accounting for rotation.
export function extentParam(part, axis) {
  const r = ((part.rot % 360) + 360) % 360;
  const swap = r === 90 || r === 270;
  const ext = SHAPES[part.shape].extent?.(part.params) ?? {};
  if (axis === 'z') return { key: ext.z ?? 'h', factor: ext.zFactor ?? 1 };
  const localAxis = swap ? (axis === 'x' ? 'y' : 'x') : axis;
  if (localAxis === 'x') return { key: 'w', factor: 1 };
  return { key: 'd', factor: 1 };
}

export function volume(part) {
  const { len, pts } = profileOf(part);
  return Math.abs(signedArea(pts)) * len; // mm³
}

export function surfaceArea(part) {
  const { len, pts } = profileOf(part);
  return 2 * Math.abs(signedArea(pts)) + perimeter(pts) * len; // mm²
}

export function footprintArea(part) {
  const prof = profileOf(part);
  if (prof.axis === 'z') return Math.abs(signedArea(prof.pts));
  const { w, d } = localExtents(part);
  return w * d;
}

// ---------- brackets ----------

// Brackets sit on a face of the part's world bounding box (base board included
// for the bottom face). u/v offset the bracket centre from the face centre.
export const FACE_AXES = {
  bottom: { n: [0, 0, -1], u: 0, v: 1 },
  top: { n: [0, 0, 1], u: 0, v: 1 },
  front: { n: [0, -1, 0], u: 0, v: 2 },
  back: { n: [0, 1, 0], u: 0, v: 2 },
  left: { n: [-1, 0, 0], u: 1, v: 2 },
  right: { n: [1, 0, 0], u: 1, v: 2 },
};

export function faceRect(part, face) {
  const b = partBounds(part, true);
  const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
  const fa = FACE_AXES[face];
  const centre = lo.map((l, i) => (l + hi[i]) / 2);
  const ni = fa.n.findIndex((c) => c !== 0);
  centre[ni] = fa.n[ni] > 0 ? hi[ni] : lo[ni];
  return {
    centre,
    uLen: hi[fa.u] - lo[fa.u],
    vLen: hi[fa.v] - lo[fa.v],
    uAxis: fa.u, vAxis: fa.v, nAxis: ni, nSign: fa.n[ni],
  };
}

export function bracketBox(part, br) {
  const fr = faceRect(part, br.face);
  const lo = [0, 0, 0], hi = [0, 0, 0];
  const c = fr.centre.slice();
  c[fr.uAxis] += br.u;
  c[fr.vAxis] += br.v;
  lo[fr.uAxis] = c[fr.uAxis] - br.l / 2; hi[fr.uAxis] = c[fr.uAxis] + br.l / 2;
  lo[fr.vAxis] = c[fr.vAxis] - br.w / 2; hi[fr.vAxis] = c[fr.vAxis] + br.w / 2;
  const n = fr.nAxis;
  if (fr.nSign > 0) { lo[n] = c[n]; hi[n] = c[n] + br.t; } else { lo[n] = c[n] - br.t; hi[n] = c[n]; }
  return { lo, hi, fr };
}

export function boxFaces(lo, hi) {
  const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
  return prismFaces({ axis: 'z', len: z1 - z0, pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }, z0);
}

export function bracketFits(part, br) {
  const fr = faceRect(part, br.face);
  const eps = 0.01;
  return Math.abs(br.u) + br.l / 2 <= fr.uLen / 2 + eps && Math.abs(br.v) + br.w / 2 <= fr.vLen / 2 + eps;
}

// ---------- projection ----------

export const VIEW_BASES = {
  top: { right: [1, 0, 0], up: [0, 1, 0], eye: [0, 0, 1] },
  front: { right: [1, 0, 0], up: [0, 0, 1], eye: [0, -1, 0] },
  right: { right: [0, 1, 0], up: [0, 0, 1], eye: [1, 0, 0] },
};

// Camera basis for an orbiting axonometric view. yaw 0 / pitch 0 = front view.
export function orbitBasis(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const eye = [sy * cp, -cy * cp, sp];
  const right = [cy, sy, 0];
  const up = cross(eye, right);
  return { right, up, eye };
}
