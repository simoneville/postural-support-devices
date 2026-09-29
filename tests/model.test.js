import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newProject, newPart, newBracket, validate, partStats, restHeight, serialise, deserialise,
  changeShape, fmtLen, fromDisplay,
} from '../js/model.js';
import { TEMPLATES } from '../js/templates.js';

test('foam weight uses density', () => {
  const p = newPart('block', { params: { w: 1000, d: 1000, h: 100 }, foam: 'hr40', base: 'none' });
  p.cover.material = 'none';
  const s = partStats(p);
  assert.equal(Math.round(s.volumeL), 100);
  assert.equal(Math.round(s.foamKg * 10) / 10, 4);
});

test('validation catches geometry and bracket problems', () => {
  const proj = newProject();
  const p = newPart('scoop', { params: { w: 400, d: 400, h: 50, sw: 300, s: 60 } });
  p.brackets.push(newBracket('seat-hook', { face: 'bottom', u: 500 }));
  proj.parts.push(p);
  const msgs = validate(proj).map((i) => `${i.level}: ${i.msg}`);
  assert.ok(msgs.some((m) => m.startsWith('error: Contour depth')), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.includes('overhangs')), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.includes('no base board')), msgs.join('\n'));
});

test('overlapping parts are reported, stacked parts are not', () => {
  const proj = newProject();
  const a = newPart('block', { params: { w: 100, d: 100, h: 50 } });
  const b = newPart('block', { params: { w: 100, d: 100, h: 50 }, pos: { x: 0, y: 0, z: 50 } });
  proj.parts.push(a, b);
  assert.ok(!validate(proj).some((i) => i.msg.startsWith('Overlaps')));
  b.pos.z = 30;
  assert.ok(validate(proj).some((i) => i.msg.startsWith('Overlaps')));
});

test('restHeight drops a part onto the one beneath', () => {
  const proj = newProject();
  const a = newPart('block', { params: { w: 100, d: 100, h: 50 } });
  const b = newPart('block', { params: { w: 50, d: 50, h: 20 }, pos: { x: 20, y: 20, z: 300 }, base: 'abs3' });
  proj.parts.push(a, b);
  assert.equal(restHeight(proj, b), 53);
  b.pos.x = 500;
  assert.equal(restHeight(proj, b), 3);
});

test('templates build valid projects without errors', () => {
  for (const [key, t] of Object.entries(TEMPLATES)) {
    const proj = t.build();
    const errors = validate(proj).filter((i) => i.level === 'error');
    assert.deepEqual(errors, [], key);
    const warnings = validate(proj).filter((i) => i.level === 'warning');
    assert.deepEqual(warnings, [], key);
  }
});

test('serialise round trip keeps parts and brackets', () => {
  const proj = TEMPLATES.system.build();
  const back = deserialise(serialise(proj));
  assert.equal(back.parts.length, proj.parts.length);
  assert.deepEqual(back.parts.map((p) => p.brackets.length), proj.parts.map((p) => p.brackets.length));
  assert.throws(() => deserialise('{"foo":1}'));
});

test('changing shape keeps shared dimensions', () => {
  const p = newPart('block', { params: { w: 321, d: 222, h: 44 } });
  changeShape(p, 'wedge');
  assert.equal(p.params.w, 321);
  assert.equal(p.params.d, 222);
  assert.equal(p.params.h, 44);
  assert.ok('h2' in p.params);
});

test('unit formatting', () => {
  assert.equal(fmtLen(450, 'mm'), '450');
  assert.equal(fmtLen(25.4 * 17.5, 'in'), '17.5″');
  assert.equal(fromDisplay(2, 'in'), 50.8);
});
