// HTML for the side panels. Inputs carry data-bind paths; app.js applies
// changes through one delegated handler.

import {
  FOAMS, BASES, BRACKETS, BRACKET_MATERIALS, FIXINGS, FACES,
  COVER_MATERIALS, CLOSURES, FIRE_STANDARDS, COVER_COLOURS,
} from './catalog.js';
import { SHAPES, faceRect } from './geometry.js';
import { partStats, toDisplay, fmtLen, round } from './model.js';
import { esc } from './render.js';

const opts = (map, current, labelOf = (v) => v) =>
  Object.entries(map).map(([k, v]) => `<option value="${esc(k)}"${k === current ? ' selected' : ''}>${esc(labelOf(v))}</option>`).join('');

const unitLabel = (units) => (units === 'in' ? 'in' : 'mm');

function lenField(id, label, bind, mm, units, extra = '') {
  return `<label class="field" for="${id}"><span>${esc(label)}</span>
    <span class="with-unit"><input id="${id}" type="number" inputmode="decimal" step="${units === 'in' ? 0.125 : 1}" value="${toDisplay(mm, units)}" data-bind="${bind}" data-kind="len" ${extra}><i>${unitLabel(units)}</i></span></label>`;
}

function selectField(id, label, bind, map, current, labelOf, extra = '') {
  return `<label class="field" for="${id}"><span>${esc(label)}</span><select id="${id}" data-bind="${bind}" data-kind="text" ${extra}>${opts(map, current, labelOf)}</select></label>`;
}

function checkField(id, label, bind, checked, extra = '') {
  return `<label class="check" for="${id}"><input id="${id}" type="checkbox" data-bind="${bind}" data-kind="bool" ${checked ? 'checked' : ''} ${extra}><span>${esc(label)}</span></label>`;
}

function textField(id, label, bind, value, extra = '', multiline = false) {
  return multiline
    ? `<label class="field wide" for="${id}"><span>${esc(label)}</span><textarea id="${id}" rows="2" data-bind="${bind}" data-kind="text" ${extra}>${esc(value)}</textarea></label>`
    : `<label class="field wide" for="${id}"><span>${esc(label)}</span><input id="${id}" type="text" value="${esc(value)}" data-bind="${bind}" data-kind="text" ${extra}></label>`;
}

const levelIcon = { error: '✕', warning: '!', info: 'i' };

// ---------- left panel ----------

export function partsListHtml(app) {
  const { project, sel } = app;
  const units = project.settings.units;
  const issuesBy = {};
  for (const i of app.issues) {
    if (!i.partId) continue;
    const rank = { error: 3, warning: 2, info: 1 }[i.level];
    issuesBy[i.partId] = Math.max(issuesBy[i.partId] || 0, rank);
  }
  if (!project.parts.length) {
    return '<p class="empty">No parts yet. Add a foam block above, or start from a template with <b>New</b>.</p>';
  }
  return `<ul class="part-list" role="listbox" aria-label="Parts">${project.parts.map((p) => {
    const b = app.boundsFor(p);
    const dims = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0].map((v) => fmtLen(v, units)).join(' × ');
    const flag = issuesBy[p.id] === 3 ? 'error' : issuesBy[p.id] === 2 ? 'warning' : '';
    return `<li role="option" aria-selected="${sel.partId === p.id}" class="part-item${sel.partId === p.id ? ' selected' : ''}${p.hidden ? ' is-hidden' : ''}" data-select="${p.id}" tabindex="0">
      <span class="swatch" style="background:${FOAMS[p.foam]?.colour}"></span>
      <span class="part-text"><b>${esc(p.name)}</b><small>${esc(SHAPES[p.shape].label)} · ${dims}</small></span>
      ${flag ? `<span class="flag flag-${flag}" title="${flag === 'error' ? 'Has errors' : 'Has warnings'}">${levelIcon[flag]}</span>` : ''}
      <button type="button" class="icon-btn eye" data-toggle-hide="${p.id}" title="${p.hidden ? 'Show' : 'Hide'} part" aria-label="${p.hidden ? 'Show' : 'Hide'} ${esc(p.name)}">${p.hidden ? '◌' : '◉'}</button>
    </li>`;
  }).join('')}</ul>`;
}

const issueItem = (project) => (i) => {
  const part = project.parts.find((p) => p.id === i.partId);
  return `<li class="issue issue-${i.level}"${i.partId ? ` data-select="${i.partId}"${i.bracketId ? ` data-select-bracket="${i.bracketId}"` : ''} tabindex="0"` : ''}>
    <span class="issue-icon" aria-label="${i.level}">${levelIcon[i.level]}</span>
    <span>${part ? `<b>${esc(part.name)}:</b> ` : ''}${esc(i.msg)}</span></li>`;
};

export function issuesHtml(app, { collapseInfo = true } = {}) {
  const { issues, project } = app;
  if (!issues.length) return '<p class="ok-note">No problems found.</p>';
  const order = { error: 0, warning: 1, info: 2 };
  const sorted = issues.slice().sort((a, b) => order[a.level] - order[b.level]);
  const main = collapseInfo ? sorted.filter((i) => i.level !== 'info') : sorted;
  const info = collapseInfo ? sorted.filter((i) => i.level === 'info') : [];
  const item = issueItem(project);
  return `${main.length ? `<ul class="issues">${main.map(item).join('')}</ul>` : '<p class="ok-note">No errors or warnings.</p>'}
    ${info.length ? `<details class="notes" data-notes><summary>${info.length} fabrication note${info.length > 1 ? 's' : ''}</summary><ul class="issues">${info.map(item).join('')}</ul></details>` : ''}`;
}

// ---------- right panel ----------

export function projectHtml(app) {
  const { project } = app;
  const m = project.meta;
  const P = 'data-scope="project"';
  return `<div class="panel-intro">
      <h2>Project</h2>
      <p>Select a part in the list or any view to edit its dimensions, foam, brackets and cover.</p>
    </div>
    <section class="group">
      ${textField('pj-name', 'Device name', 'meta.name', m.name, P)}
      ${textField('pj-ref', 'Reference (avoid names; use an ID)', 'meta.reference', m.reference, P)}
      ${textField('pj-presc', 'Prescriber / clinic', 'meta.prescriber', m.prescriber, P)}
      <label class="field wide" for="pj-date"><span>Date</span><input id="pj-date" type="date" value="${esc(m.date)}" data-bind="meta.date" data-kind="text" ${P}></label>
      ${textField('pj-notes', 'Clinical notes and fitting instructions', 'meta.notes', m.notes, P, true)}
    </section>
    <section class="group">
      <h3>Drawing settings</h3>
      <div class="row2">
        ${selectField('pj-units', 'Units', 'settings.units', { mm: 'Millimetres', in: 'Inches' }, project.settings.units, undefined, P)}
        ${selectField('pj-grid', 'Grid / snap step', 'settings.grid', { 1: '1 mm', 5: '5 mm', 10: '10 mm', 25: '25 mm', 50: '50 mm' }, String(project.settings.grid), undefined, `${P} data-kind-override="num"`)}
      </div>
      ${checkField('pj-snap', 'Snap to grid and vertices', 'settings.snap', project.settings.snap, P)}
    </section>
    ${summaryHtml(app)}`;
}

function summaryHtml(app) {
  const t = app.totals;
  return `<section class="group">
    <h3>Device totals</h3>
    <dl class="stats">
      <dt>Parts</dt><dd>${app.project.parts.length}</dd>
      <dt>Foam volume</dt><dd>${round(t.volumeL, 2)} L</dd>
      <dt>Cover fabric</dt><dd>${round(t.coverM2, 2)} m²</dd>
      <dt>Brackets</dt><dd>${t.brackets}</dd>
      <dt>Estimated weight</dt><dd>${round(t.totalKg, 2)} kg</dd>
    </dl></section>`;
}

export function partHtml(app, part) {
  const units = app.project.settings.units;
  const shape = SHAPES[part.shape];
  const foam = FOAMS[part.foam];
  const st = partStats(part);
  const issues = app.issues.filter((i) => i.partId === part.id);

  const dims = shape.params.map((p) => lenField(`pp-${p.key}`, p.label, `params.${p.key}`, part.params[p.key], units, `min="${p.min}"`)).join('');
  const rots = [0, 90, 180, 270].map((r) => `<button type="button" class="seg${part.rot === r ? ' on' : ''}" data-rot="${r}" aria-pressed="${part.rot === r}">${r}°</button>`).join('');

  return `<div class="panel-intro part-head">
      <input id="pt-name" class="name-input" type="text" value="${esc(part.name)}" data-bind="name" data-kind="text" aria-label="Part name">
      <div class="head-actions">
        <button type="button" class="btn small" data-action="duplicate" title="Duplicate (Ctrl+D)">Duplicate</button>
        <button type="button" class="btn small danger" data-action="delete" title="Delete (Del)">Delete</button>
      </div>
    </div>

    <details class="group" open data-group="shape"><summary>Shape and dimensions</summary>
      ${selectField('pt-shape', 'Shape', 'shape', SHAPES, part.shape, (s) => s.label)}
      <div class="grid2">${dims}</div>
      <div class="field wide"><span>Rotation about vertical axis</span><div class="segs" role="group" aria-label="Rotation">${rots}</div></div>
      <div class="grid3">
        ${lenField('pt-x', 'X (left)', 'pos.x', part.pos.x, units)}
        ${lenField('pt-y', 'Y (front)', 'pos.y', part.pos.y, units)}
        ${lenField('pt-z', 'Z (bottom)', 'pos.z', part.pos.z, units)}
      </div>
      <div class="btn-row">
        <button type="button" class="btn small" data-action="drop" title="Lower the part onto whatever is beneath it">Drop to rest</button>
        <button type="button" class="btn small" data-action="stack" title="Place on top of the part beneath, aligned to its corner">Align to part below</button>
      </div>
      <p class="hint">Tip: click a highlighted dimension in the Top, Front or Side view to type a new value.</p>
    </details>

    <details class="group" open data-group="foam"><summary>Foam and base board</summary>
      ${selectField('pt-foam', 'Foam grade', 'foam', FOAMS, part.foam, (f) => f.label)}
      <p class="foam-info"><span class="swatch" style="background:${foam.colour}"></span>
        ${foam.density} kg/m³ · hardness ≈ ${foam.hardness} N (ISO 2439) · ${esc(foam.use)}</p>
      ${selectField('pt-base', 'Rigid base board', 'base', BASES, part.base, (b) => b.label)}
      <p class="hint">Cut size: ${fmtLen(st.cut.w, units, true)} × ${fmtLen(st.cut.d, units, true)} × ${fmtLen(st.cut.h, units, true)}</p>
    </details>

    <details class="group" open data-group="brackets"><summary>Mounting brackets <span class="count">${part.brackets.length}</span></summary>
      <div class="add-row">
        <select id="add-bracket-type" aria-label="Bracket type">${opts(BRACKETS, 'seat-hook', (b) => b.label)}</select>
        <button type="button" class="btn small primary" data-action="add-bracket">Add</button>
      </div>
      ${part.brackets.map((b) => bracketHtml(app, part, b)).join('') || '<p class="empty">No brackets. Add hooks, clamps or plates to mount the part.</p>'}
    </details>

    <details class="group" open data-group="cover"><summary>Cover</summary>
      ${coverHtml(part)}
    </details>

    <details class="group" data-group="notes"><summary>Part notes</summary>
      ${textField('pt-notes', 'Notes for the fabricator', 'notes', part.notes, '', true)}
    </details>

    <section class="group">
      <h3>This part</h3>
      <dl class="stats">
        <dt>Foam volume</dt><dd>${round(st.volumeL, 2)} L</dd>
        <dt>Foam weight</dt><dd>${round(st.foamKg, 2)} kg</dd>
        <dt>Cover fabric</dt><dd>${round(st.coverM2, 2)} m²</dd>
        <dt>Total weight</dt><dd>${round(st.totalKg, 2)} kg</dd>
      </dl>
      ${issues.length ? `<div class="part-issues">${issuesHtml({ issues, project: { parts: [] } }, { collapseInfo: false })}</div>` : ''}
    </section>`;
}

const AXIS_WORDS = [['left', 'right'], ['front', 'back'], ['bottom', 'top']];
const AXIS_LABEL = ['Across (X)', 'Front → back (Y)', 'Up (Z)'];

function bracketHtml(app, part, b) {
  const units = app.project.settings.units;
  const sel = app.sel.bracketId === b.id;
  const fr = faceRect(part, b.face);
  const from = (axis, len, off) => `${fmtLen(len / 2 + off, units, true)} from ${AXIS_WORDS[axis][0]}`;
  const B = `data-bracket="${b.id}"`;
  const id = (k) => `br-${b.id}-${k}`;
  return `<div class="bracket${sel ? ' selected' : ''}" data-bracket-card="${b.id}">
    <div class="bracket-head">
      <button type="button" class="linkish" data-select-bracket="${b.id}" data-select="${part.id}">${esc(BRACKETS[b.type]?.label)}</button>
      <button type="button" class="icon-btn" data-action="del-bracket" ${B} title="Remove bracket" aria-label="Remove bracket">✕</button>
    </div>
    <div class="grid2">
      ${selectField(id('type'), 'Type', 'type', BRACKETS, b.type, (x) => x.label, B)}
      ${selectField(id('face'), 'Mounted on', 'face', FACES, b.face, undefined, B)}
      ${lenField(id('u'), `Offset: ${AXIS_LABEL[fr.uAxis]}`, 'u', b.u, units, B)}
      ${lenField(id('v'), `Offset: ${AXIS_LABEL[fr.vAxis]}`, 'v', b.v, units, B)}
    </div>
    <p class="hint">Centre ${from(fr.uAxis, fr.uLen, b.u)}, ${from(fr.vAxis, fr.vLen, b.v)} edge.</p>
    <div class="grid3">
      ${lenField(id('l'), 'Length', 'l', b.l, units, B)}
      ${lenField(id('w'), 'Width', 'w', b.w, units, B)}
      ${lenField(id('t'), 'Projection', 't', b.t, units, B)}
    </div>
    <div class="grid3">
      <label class="field" for="${id('qty')}"><span>Qty</span><input id="${id('qty')}" type="number" min="1" step="1" value="${b.qty}" data-bind="qty" data-kind="int" ${B}></label>
      ${selectField(id('mat'), 'Material', 'material', BRACKET_MATERIALS, b.material, undefined, B)}
      ${selectField(id('fix'), 'Fixing', 'fixing', FIXINGS, b.fixing, undefined, B)}
    </div>
    ${textField(id('notes'), 'Notes', 'notes', b.notes, `${B} placeholder="${esc(BRACKETS[b.type]?.note || 'Tube size, handing, finish…')}"`)}
  </div>`;
}

function coverHtml(part) {
  const c = part.cover;
  const none = c.material === 'none';
  const swatches = Object.entries(COVER_COLOURS).map(([hex, name]) =>
    `<button type="button" class="colour${c.colour === hex ? ' on' : ''}" style="background:${hex}" data-colour="${hex}" title="${name}" aria-label="${name}" aria-pressed="${c.colour === hex}"></button>`).join('');
  return `${selectField('cv-mat', 'Material', 'cover.material', COVER_MATERIALS, c.material, (m) => m.label)}
    ${none ? '' : `
    <div class="field wide"><span>Colour</span><div class="colours">${swatches}
      <label class="colour custom" title="Custom colour"><input type="color" id="cv-colour" value="${c.colour}" data-bind="cover.colour" data-kind="text" aria-label="Custom cover colour"></label></div></div>
    <div class="grid2">
      ${selectField('cv-closure', 'Closure', 'cover.closure', CLOSURES, c.closure)}
      ${c.closure === 'sewn' ? '' : selectField('cv-zipface', 'Closure position', 'cover.zipFace', FACES, c.zipFace)}
    </div>
    ${selectField('cv-fire', 'Fire standard', 'cover.fire', FIRE_STANDARDS, c.fire)}
    <div class="checks">
      ${checkField('cv-removable', 'Removable for washing', 'cover.removable', c.removable)}
      ${checkField('cv-liner', 'Waterproof inner liner', 'cover.liner', c.liner)}
      ${checkField('cv-antislip', 'Anti-slip base panel', 'cover.antiSlip', c.antiSlip)}
    </div>
    ${textField('cv-notes', 'Cover notes', 'cover.notes', c.notes, 'placeholder="Piping, handles, labels…"', true)}`}`;
}
