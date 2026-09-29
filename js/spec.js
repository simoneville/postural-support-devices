// Specification sheet, cut list CSV and SVG drawing export.

import {
  FOAMS, BASES, BRACKETS, BRACKET_MATERIALS, FIXINGS, FACES,
  COVER_MATERIALS, CLOSURES, FIRE_STANDARDS, COVER_COLOURS,
} from './catalog.js';
import { SHAPES, VIEW_BASES, orbitBasis, faceRect } from './geometry.js';
import { partStats, projectStats, validate, fmtLen, round, toDisplay } from './model.js';
import { staticViewSvg, esc } from './render.js';

const DRAW_VIEWS = [
  ['top', 'TOP'], ['iso', '3D'], ['front', 'FRONT'], ['right', 'RIGHT SIDE'],
];

const basisFor = (id) => (id === 'iso' ? orbitBasis(0.62, 0.5) : VIEW_BASES[id]);

function paramText(part, units) {
  return SHAPES[part.shape].params.map((p) => `${p.label} ${fmtLen(part.params[p.key], units, true)}`).join('; ');
}

const AXIS_WORDS = ['left', 'front', 'bottom'];

function bracketPosition(part, b, units) {
  const fr = faceRect(part, b.face);
  return `${FACES[b.face]}; centre ${fmtLen(fr.uLen / 2 + b.u, units, true)} from ${AXIS_WORDS[fr.uAxis]}, ${fmtLen(fr.vLen / 2 + b.v, units, true)} from ${AXIS_WORDS[fr.vAxis]}`;
}

function colourName(hex) {
  return COVER_COLOURS[hex] || hex;
}

export function specHtml(project) {
  const units = project.settings.units;
  const m = project.meta;
  const tot = projectStats(project);
  const issues = validate(project);
  const partsVisible = project.parts;

  const drawings = DRAW_VIEWS.map(([id, title]) =>
    `<figure class="sheet-view">${staticViewSvg(project, basisFor(id), 520, 340, { viewId: id, units, ortho: id !== 'iso', title })}</figure>`).join('');

  const partRows = partsVisible.map((p, i) => {
    const s = partStats(p);
    return `<tr><td>${i + 1}</td><td><b>${esc(p.name)}</b><br><small>${esc(SHAPES[p.shape].label)}${p.rot ? `, rotated ${p.rot}°` : ''}</small></td>
      <td>${esc(paramText(p, units))}</td>
      <td class="num">${fmtLen(s.cut.w, units)} × ${fmtLen(s.cut.d, units)} × ${fmtLen(s.cut.h, units)}</td>
      <td>${esc(FOAMS[p.foam].label)}<br><small>${FOAMS[p.foam].density} kg/m³</small></td>
      <td>${esc(BASES[p.base].label)}</td>
      <td class="num">${fmtLen(p.pos.x, units)}, ${fmtLen(p.pos.y, units)}, ${fmtLen(p.pos.z, units)}</td>
      <td class="num">${round(s.volumeL, 2)}</td><td class="num">${round(s.totalKg, 2)}</td></tr>
      ${p.notes ? `<tr class="note-row"><td></td><td colspan="8">Note: ${esc(p.notes)}</td></tr>` : ''}`;
  }).join('');

  const brRows = partsVisible.flatMap((p) => p.brackets.map((b) => `<tr>
      <td>${esc(p.name)}</td><td>${esc(BRACKETS[b.type].label)}</td><td class="num">${b.qty}</td>
      <td>${esc(bracketPosition(p, b, units))}</td>
      <td class="num">${fmtLen(b.l, units)} × ${fmtLen(b.w, units)} × ${fmtLen(b.t, units)}</td>
      <td>${esc(BRACKET_MATERIALS[b.material] || b.material)}</td><td>${esc(FIXINGS[b.fixing] || b.fixing)}</td>
      <td>${esc(b.notes || BRACKETS[b.type].note)}</td></tr>`)).join('');

  const coverRows = partsVisible.filter((p) => p.cover.material !== 'none').map((p) => {
    const c = p.cover;
    const s = partStats(p);
    const extras = [c.removable && 'removable', c.liner && 'waterproof liner', c.antiSlip && 'anti-slip base'].filter(Boolean).join(', ');
    return `<tr><td>${esc(p.name)}</td><td>${esc(COVER_MATERIALS[c.material].label)}</td>
      <td><span class="chip" style="background:${esc(c.colour)}"></span>${esc(colourName(c.colour))}</td>
      <td>${esc(CLOSURES[c.closure])}${c.closure !== 'sewn' ? `, ${esc(FACES[c.zipFace])}` : ''}</td>
      <td>${esc(extras || '—')}</td><td>${esc(FIRE_STANDARDS[c.fire])}</td><td class="num">${round(s.coverM2, 2)}</td>
      <td>${esc(c.notes)}</td></tr>`;
  }).join('');

  const issueRows = issues.filter((i) => i.level !== 'info' || i.partId).map((i) => {
    const p = project.parts.find((x) => x.id === i.partId);
    return `<li class="issue-${i.level}"><b>${i.level.toUpperCase()}</b> ${p ? `${esc(p.name)}: ` : ''}${esc(i.msg)}</li>`;
  }).join('');

  return `<article class="sheet">
    <header class="sheet-head">
      <div>
        <p class="eyebrow">Postural support device · specification</p>
        <h1>${esc(m.name)}</h1>
      </div>
      <dl class="title-block">
        <dt>Reference</dt><dd>${esc(m.reference) || '—'}</dd>
        <dt>Prescriber</dt><dd>${esc(m.prescriber) || '—'}</dd>
        <dt>Date</dt><dd>${esc(m.date)}</dd>
        <dt>Units</dt><dd>${units === 'in' ? 'inches' : 'millimetres'}</dd>
      </dl>
    </header>
    ${m.notes ? `<p class="sheet-notes">${esc(m.notes)}</p>` : ''}
    <section class="sheet-views">${drawings}</section>
    <p class="small">Third-angle views. Origin at the front-left-bottom corner. X across, Y front to back, Z up. Overall dimensions shown; part sizes below.</p>

    <h2>Foam parts and cut list</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Part</th><th>Shape dimensions</th><th>Cut block (W × D × H)</th><th>Foam</th><th>Base board</th><th>Position X, Y, Z</th><th>Vol. (L)</th><th>Mass (kg)</th></tr></thead>
      <tbody>${partRows || '<tr><td colspan="9">No parts.</td></tr>'}</tbody>
    </table></div>

    <h2>Mounting brackets</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Part</th><th>Bracket</th><th>Qty</th><th>Position</th><th>Size (L × W × proj.)</th><th>Material</th><th>Fixing</th><th>Notes</th></tr></thead>
      <tbody>${brRows || '<tr><td colspan="8">No brackets specified.</td></tr>'}</tbody>
    </table></div>

    <h2>Covers</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Part</th><th>Material</th><th>Colour</th><th>Closure</th><th>Features</th><th>Fire standard</th><th>Fabric (m²)</th><th>Notes</th></tr></thead>
      <tbody>${coverRows || '<tr><td colspan="8">No covers specified.</td></tr>'}</tbody>
    </table></div>
    <p class="small">Fabric area includes 15% for seams and wastage (doubled where a liner is specified).</p>

    <h2>Totals</h2>
    <dl class="sheet-totals">
      <dt>Foam volume</dt><dd>${round(tot.volumeL, 2)} L</dd>
      <dt>Foam</dt><dd>${round(tot.foamKg, 2)} kg</dd>
      <dt>Base boards</dt><dd>${round(tot.baseKg, 2)} kg</dd>
      <dt>Brackets</dt><dd>${tot.brackets} (${round(tot.bracketKg, 2)} kg)</dd>
      <dt>Cover fabric</dt><dd>${round(tot.coverM2, 2)} m²</dd>
      <dt>Estimated device weight</dt><dd><b>${round(tot.totalKg, 2)} kg</b></dd>
    </dl>

    ${issueRows ? `<h2>Design checks</h2><ul class="sheet-issues">${issueRows}</ul>` : ''}

    <footer class="signoff">
      <div><span>Specified by</span></div><div><span>Checked by</span></div><div><span>Fitted by / date</span></div>
    </footer>
    <p class="small">Material properties are typical values. Confirm density, hardness and fire performance with the supplier before manufacture.</p>
  </article>`;
}

// ---------- CSV cut list ----------

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function cutListCsv(project) {
  const units = project.settings.units;
  const u = units === 'in' ? 'in' : 'mm';
  const rows = [[
    'Item', 'Part', 'Shape', `Cut width (${u})`, `Cut depth (${u})`, `Cut height (${u})`, 'Shape dimensions',
    'Foam', 'Density (kg/m3)', 'Base board', 'Volume (L)', 'Foam mass (kg)', 'Cover', 'Cover colour', 'Closure',
    'Fabric (m2)', 'Brackets', 'Notes',
  ]];
  project.parts.forEach((p, i) => {
    const s = partStats(p);
    rows.push([
      i + 1, p.name, SHAPES[p.shape].label,
      toDisplay(s.cut.w, units), toDisplay(s.cut.d, units), toDisplay(s.cut.h, units),
      paramText(p, units), FOAMS[p.foam].label, FOAMS[p.foam].density, BASES[p.base].label,
      round(s.volumeL, 3), round(s.foamKg, 3),
      COVER_MATERIALS[p.cover.material].label, p.cover.material === 'none' ? '' : colourName(p.cover.colour),
      p.cover.material === 'none' ? '' : CLOSURES[p.cover.closure],
      round(s.coverM2, 3),
      p.brackets.map((b) => `${b.qty} × ${BRACKETS[b.type].label} (${bracketPosition(p, b, units)})`).join(' | '),
      p.notes,
    ]);
  });
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// ---------- SVG drawing sheet ----------

export const DRAWING_CSS = `
.cad{font-family:"IBM Plex Mono",ui-monospace,monospace}
.face{stroke-width:0.6;stroke-linejoin:round}
.edge{fill:none;stroke:#26302c;stroke-width:0.9;stroke-linejoin:round;stroke-linecap:round}
.dim .ext,.dim .dim-line{stroke:#b4461d;stroke-width:0.8;fill:none}
.dim .arrow{fill:#b4461d}
.dim-text{font-size:11px;fill:#8a3212;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.dim-env .ext,.dim-env .dim-line{stroke:#5b6b66}.dim-env .arrow{fill:#5b6b66}.dim-env .dim-text{fill:#39443f}
.triad{stroke-width:1.4}.triad-x{stroke:#c0392b}.triad-y{stroke:#2e8b57}.triad-z{stroke:#2e6fb7}
.triad-text{font-size:10px;fill:#39443f}
.view-title{font-size:11px;letter-spacing:.12em;fill:#39443f;font-weight:600}
.frame{fill:none;stroke:#26302c;stroke-width:1}
.tb-label{font-size:9px;fill:#5b6b66;letter-spacing:.08em}
.tb-value{font-size:13px;fill:#1d2522}
`;

export function drawingSheetSvg(project) {
  const W = 1188, H = 840; // A-series proportions
  const units = project.settings.units;
  const vw = 560, vh = 330;
  const cells = [[20, 20], [608, 20], [20, 370], [608, 370]];
  const views = DRAW_VIEWS.map(([id, title], i) => {
    const inner = staticViewSvg(project, basisFor(id), vw, vh, { viewId: id, units, ortho: id !== 'iso', title })
      .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const [x, y] = cells[i];
    return `<g transform="translate(${x},${y})"><rect class="frame" width="${vw}" height="${vh}"/>${inner}</g>`;
  }).join('');
  const m = project.meta;
  const tb = [
    ['DEVICE', m.name], ['REFERENCE', m.reference || '—'], ['PRESCRIBER', m.prescriber || '—'],
    ['DATE', m.date], ['UNITS', units === 'in' ? 'inches' : 'mm'], ['PROJECTION', 'third angle'],
  ];
  const tbSvg = tb.map(([k, v], i) => {
    const x = 20 + i * 191;
    return `<g transform="translate(${x},730)"><rect class="frame" width="191" height="90"/><text class="tb-label" x="10" y="22">${esc(k)}</text><text class="tb-value" x="10" y="52">${esc(String(v).slice(0, 26))}</text></g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${DRAWING_CSS}</style>
<rect width="${W}" height="${H}" fill="#ffffff"/>
${views}${tbSvg}
</svg>`;
}
