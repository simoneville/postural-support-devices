// Project data model, validation and specification calculations.

import { FOAMS, BASES, BRACKETS, COVER_MATERIALS } from './catalog.js';
import {
  SHAPES, defaultParams, partBounds, volume, surfaceArea, footprintArea,
  bracketFits, baseThickness, localExtents,
} from './geometry.js';

export const SCHEMA_VERSION = 1;

let idCounter = 0;
export function uid(prefix = 'p') {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function newProject(meta = {}) {
  return {
    version: SCHEMA_VERSION,
    meta: {
      name: 'Untitled device',
      reference: '',
      prescriber: '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
      ...meta,
    },
    settings: { units: 'mm', grid: 10, snap: true },
    parts: [],
    dimensions: [],
  };
}

export function defaultCover() {
  return {
    material: 'pu-knit',
    colour: '#2b2d2f',
    closure: 'zip',
    zipFace: 'back',
    removable: true,
    liner: false,
    antiSlip: false,
    fire: 'bs7176',
    notes: '',
  };
}

export function newPart(shape = 'block', over = {}) {
  return {
    id: uid('p'),
    name: SHAPES[shape].label,
    shape,
    params: defaultParams(shape),
    pos: { x: 0, y: 0, z: 0 },
    rot: 0,
    foam: 'hr40',
    base: 'none',
    cover: defaultCover(),
    brackets: [],
    hidden: false,
    notes: '',
    ...over,
  };
}

export function newBracket(type = 'custom', over = {}) {
  const c = BRACKETS[type];
  return {
    id: uid('b'),
    type,
    face: 'bottom',
    u: 0,
    v: 0,
    l: c.l,
    w: c.w,
    t: c.t,
    qty: 1,
    material: c.material,
    fixing: c.fixing,
    notes: '',
    ...over,
  };
}

// Change a part's shape while keeping the dimensions both shapes share.
export function changeShape(part, shape) {
  const params = defaultParams(shape);
  for (const k of Object.keys(params)) if (k in part.params) params[k] = part.params[k];
  part.shape = shape;
  part.params = params;
}

export function findPart(project, id) {
  return project.parts.find((p) => p.id === id) || null;
}

// ---------- layout helpers ----------

const overlaps1 = (a0, a1, b0, b1, tol = 0.5) => Math.min(a1, b1) - Math.max(a0, b0) > tol;

// Drop a part onto whatever is below it (or the floor at z = 0).
export function restHeight(project, part) {
  const b = partBounds(part, true);
  const mid = (b.z0 + b.z1) / 2;
  let floor = 0;
  for (const other of project.parts) {
    if (other.id === part.id || other.hidden) continue;
    const o = partBounds(other, true);
    if (!overlaps1(b.x0, b.x1, o.x0, o.x1) || !overlaps1(b.y0, b.y1, o.y0, o.y1)) continue;
    // Anything whose middle is below ours counts as a support.
    if ((o.z0 + o.z1) / 2 < mid) floor = Math.max(floor, o.z1);
  }
  return floor + baseThickness(part);
}

export function assemblyBounds(project, withBase = true) {
  const parts = project.parts.filter((p) => !p.hidden);
  if (!parts.length) return null;
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const p of parts) {
    const pb = partBounds(p, withBase);
    for (const k of ['x0', 'y0', 'z0']) b[k] = Math.min(b[k], pb[k]);
    for (const k of ['x1', 'y1', 'z1']) b[k] = Math.max(b[k], pb[k]);
  }
  return b;
}

// Position for a newly added part: to the right of everything else.
export function freeSpot(project) {
  const b = assemblyBounds(project);
  return b ? { x: Math.ceil((b.x1 + 20) / 10) * 10, y: Math.max(0, b.y0), z: 0 } : { x: 0, y: 0, z: 0 };
}

// ---------- calculations ----------

export function partStats(part) {
  const foam = FOAMS[part.foam] || FOAMS.hr40;
  const base = BASES[part.base] || BASES.none;
  const cover = COVER_MATERIALS[part.cover.material] || COVER_MATERIALS.none;
  const vol = volume(part); // mm³
  const foamKg = (vol / 1e9) * foam.density;
  const baseKg = (footprintArea(part) * base.t / 1e9) * base.density;
  const area = surfaceArea(part); // mm²
  // Cover fabric: surface area plus 15% for seams and wastage; doubled with a liner.
  const coverM2 = cover.gsm ? (area / 1e6) * 1.15 * (part.cover.liner ? 2 : 1) : 0;
  const coverKg = coverM2 * cover.gsm / 1000;
  const bracketKg = part.brackets.reduce((s, b) => s + (BRACKETS[b.type]?.mass ?? 0) * (b.qty || 1), 0);
  const ext = localExtents(part);
  return {
    volumeL: vol / 1e6,
    foamKg, baseKg, coverM2, coverKg, bracketKg,
    totalKg: foamKg + baseKg + coverKg + bracketKg,
    cut: ext, // the foam block size to cut from
    surfaceM2: area / 1e6,
  };
}

export function projectStats(project) {
  const t = { volumeL: 0, foamKg: 0, baseKg: 0, coverM2: 0, coverKg: 0, bracketKg: 0, totalKg: 0, brackets: 0 };
  for (const p of project.parts) {
    const s = partStats(p);
    for (const k of Object.keys(t)) if (k in s) t[k] += s[k];
    t.brackets += p.brackets.reduce((n, b) => n + (b.qty || 1), 0);
  }
  return t;
}

// ---------- validation ----------

export function validate(project) {
  const issues = [];
  const add = (level, part, msg, bracket) => issues.push({ level, partId: part?.id ?? null, bracketId: bracket?.id ?? null, msg });

  if (!project.parts.length) add('info', null, 'Add a foam part to start the design.');

  for (const part of project.parts) {
    const p = part.params;
    for (const def of SHAPES[part.shape].params) {
      const v = p[def.key];
      if (!Number.isFinite(v) || v < def.min) add('error', part, `${def.label} must be ${def.min > 0 ? 'greater than 0' : '0 or more'}.`);
    }
    const ext = localExtents(part);
    if (Math.max(ext.w, ext.d, ext.h) > 2000) add('warning', part, 'Larger than a standard 2000 mm foam block; it may need joining.');
    if (Math.min(ext.w, ext.d, ext.h) < 10) add('warning', part, 'Thinner than 10 mm; foam this thin tears easily.');

    switch (part.shape) {
      case 'chamfer':
        if (p.c * 2 >= p.w || p.c >= p.h) add('error', part, 'Chamfer is too large for the block.');
        break;
      case 'wedge':
        if (p.h <= 0 && p.h2 <= 0) add('error', part, 'A wedge needs a height at the back or the front.');
        else if (Math.min(p.h, p.h2) < 10 && Math.min(p.h, p.h2) > 0) add('warning', part, 'Thin wedge edge (under 10 mm) will be fragile.');
        break;
      case 'scoop':
        if (p.s >= p.h) add('error', part, 'Contour depth must be less than the block height.');
        else if (p.h - p.s < 20) add('warning', part, `Only ${round(p.h - p.s)} mm of foam remains under the contour; 20 mm or more is recommended.`);
        if (p.sw > p.w) add('error', part, 'Contour width cannot exceed the block width.');
        break;
      case 'lateral':
        if (p.s >= p.w) add('error', part, 'Curve depth must be less than the pad thickness.');
        else if (p.w - p.s < 15) add('warning', part, 'Very little foam behind the curve; the pad may fold under load.');
        break;
      case 'lshape':
        if (p.nw >= p.w || p.nd >= p.d) add('error', part, 'Notch must be smaller than the block.');
        break;
      default:
    }

    const SCREWS = ['M5', 'M6', 'M8', 'wood', 'rivet'];
    for (const br of part.brackets) {
      const label = BRACKETS[br.type]?.label ?? 'Bracket';
      if (!(br.l > 0 && br.w > 0 && br.t >= 0)) add('error', part, `${label}: size must be greater than 0.`, br);
      else if (!bracketFits(part, br)) add('error', part, `${label} overhangs the ${br.face} face.`, br);
      if (SCREWS.includes(br.fixing)) {
        if (br.face === 'bottom' && part.base === 'none') {
          add('warning', part, `${label} is screwed to the bottom but there is no base board. Add a base board or change the fixing.`, br);
        } else if (br.face !== 'bottom') {
          add('info', part, `${label} on the ${br.face} face: embed a rigid backing plate so the screws do not pull through the foam.`, br);
        }
      }
    }

    const c = part.cover;
    if (c.material !== 'none') {
      if (c.removable && c.closure === 'sewn') add('warning', part, 'Cover is marked removable but the closure is sewn closed.');
      const mat = COVER_MATERIALS[c.material];
      if (part.foam === 've50' && !mat.breathable) add('info', part, 'Memory foam under a non-breathable cover can get warm and slow to recover.');
      if (c.fire === 'none') add('info', part, 'No fire standard specified for the cover.');
    } else {
      add('info', part, 'No cover specified.');
    }
    if (part.foam === 'latex') add('info', part, 'Natural latex: confirm the user has no latex allergy.');
  }

  // Overlaps between parts (touching faces are fine).
  const vis = project.parts.filter((p) => !p.hidden);
  for (let i = 0; i < vis.length; i++) {
    for (let j = i + 1; j < vis.length; j++) {
      const a = partBounds(vis[i], true), b = partBounds(vis[j], true);
      if (overlaps1(a.x0, a.x1, b.x0, b.x1, 1) && overlaps1(a.y0, a.y1, b.y0, b.y1, 1) && overlaps1(a.z0, a.z1, b.z0, b.z1, 1)) {
        add('warning', vis[i], `Overlaps “${vis[j].name}”. Check that this is intended (for example, a part sitting in a contour).`);
      }
    }
  }
  return issues;
}

// ---------- serialisation ----------

export function serialise(project) {
  return JSON.stringify(project, null, 2);
}

export function deserialise(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.parts)) throw new Error('This file is not a foam device project (no parts list found).');
  const proj = newProject(data.meta);
  proj.settings = { ...proj.settings, ...(data.settings || {}) };
  proj.dimensions = Array.isArray(data.dimensions) ? data.dimensions : [];
  proj.parts = data.parts.map((raw) => {
    const shape = SHAPES[raw.shape] ? raw.shape : 'block';
    const part = newPart(shape, {
      ...raw,
      shape,
      params: { ...defaultParams(shape), ...(raw.params || {}) },
      pos: { x: 0, y: 0, z: 0, ...(raw.pos || {}) },
      cover: { ...defaultCover(), ...(raw.cover || {}) },
    });
    part.brackets = (raw.brackets || []).map((b) => newBracket(BRACKETS[b.type] ? b.type : 'custom', b));
    if (!FOAMS[part.foam]) part.foam = 'hr40';
    if (!BASES[part.base]) part.base = 'none';
    return part;
  });
  return proj;
}

// ---------- units ----------

export const round = (v, dp = 1) => {
  const k = 10 ** dp;
  return Math.round(v * k) / k;
};

export function toDisplay(mm, units) {
  return units === 'in' ? round(mm / 25.4, 2) : round(mm, 1);
}

export function fromDisplay(v, units) {
  return units === 'in' ? v * 25.4 : v;
}

export function fmtLen(mm, units, withUnit = false) {
  const v = toDisplay(mm, units);
  const s = units === 'in' ? v.toFixed(2).replace(/\.?0+$/, '') : String(v);
  return withUnit ? `${s} ${units === 'in' ? 'in' : 'mm'}` : s + (units === 'in' ? '″' : '');
}
