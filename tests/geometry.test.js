import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES, foamFaces, faceNormal, localExtents, partBounds, volume, surfaceArea,
  bracketBox, bracketFits, extentParam, dot, sub, orbitBasis, cross,
} from '../js/geometry.js';
import { newPart, newBracket } from '../js/model.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('block volume, area and extents', () => {
  const p = newPart('block', { params: { w: 400, d: 300, h: 50 } });
  close(volume(p), 400 * 300 * 50);
  close(surfaceArea(p), 2 * (400 * 300 + 400 * 50 + 300 * 50));
  assert.deepEqual(localExtents(p), { w: 400, d: 300, h: 50 });
});

test('wedge volume is a trapezoid prism', () => {
  const p = newPart('wedge', { params: { w: 400, d: 450, h: 40, h2: 90 } });
  close(volume(p), 400 * 450 * (40 + 90) / 2);
  assert.equal(localExtents(p).h, 90);
});

test('every shape has outward-facing normals', () => {
  for (const shape of Object.keys(SHAPES)) {
    const p = newPart(shape, { pos: { x: 10, y: 20, z: 30 }, rot: 90 });
    const faces = foamFaces(p);
    // For each face, the normal must point away from the body: sum of signed
    // volumes (divergence theorem) is positive only if faces are consistently outward.
    let v = 0;
    for (const f of faces) {
      for (let i = 1; i < f.length - 1; i++) {
        v += dot(f[0], cross(f[i], f[i + 1])) / 6;
      }
    }
    close(v, volume(p), volume(p) * 1e-6 + 1e-6);
    for (const f of faces) assert.ok(faceNormal(f).every(Number.isFinite), shape);
  }
});

test('rotation swaps world width and depth', () => {
  const p = newPart('block', { params: { w: 400, d: 300, h: 50 }, pos: { x: 5, y: 7, z: 0 }, rot: 90 });
  const b = partBounds(p);
  assert.deepEqual([b.x0, b.y0, b.x1, b.y1], [5, 7, 305, 407]);
  const faces = foamFaces(p).flat();
  const xs = faces.map((v) => v[0]), ys = faces.map((v) => v[1]);
  close(Math.min(...xs), 5); close(Math.max(...xs), 305);
  close(Math.min(...ys), 7); close(Math.max(...ys), 407);
  assert.equal(extentParam(p, 'x').key, 'd');
  assert.equal(extentParam(p, 'y').key, 'w');
});

test('scooped contour removes material', () => {
  const flat = newPart('scoop', { params: { w: 400, d: 400, h: 80, sw: 300, s: 0 } });
  const scooped = newPart('scoop', { params: { w: 400, d: 400, h: 80, sw: 300, s: 20 } });
  assert.ok(volume(scooped) < volume(flat));
  // Segment area of a shallow arc ≈ 2/3 · chord · sagitta.
  close(volume(flat) - volume(scooped), (2 / 3) * 300 * 20 * 400, 300 * 20 * 400 * 0.01);
});

test('bracket sits outside the face it is attached to', () => {
  const p = newPart('block', { params: { w: 400, d: 300, h: 50 }, base: 'ply9', pos: { x: 0, y: 0, z: 9 } });
  const br = newBracket('seat-hook', { face: 'bottom', u: 100, v: 50 });
  const { lo, hi } = bracketBox(p, br);
  close(hi[2], 0); // under the base board
  close(lo[2], -br.t);
  close((lo[0] + hi[0]) / 2, 300);
  close((lo[1] + hi[1]) / 2, 200);
  assert.ok(bracketFits(p, br));
  assert.ok(!bracketFits(p, { ...br, u: 190 }));
});

test('orbit basis is orthonormal and right-handed', () => {
  const { right, up, eye } = orbitBasis(0.6, 0.5);
  close(dot(right, up), 0); close(dot(up, eye), 0); close(dot(right, eye), 0);
  const c = cross(right, up);
  close(dot(sub(c, eye), sub(c, eye)), 0);
});
