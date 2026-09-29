// Application controller: state, undo history, panels, file handling.

import { BRACKETS } from './catalog.js';
import { SHAPES, partBounds, extentParam } from './geometry.js';
import {
  newProject, newPart, newBracket, changeShape, findPart, restHeight, freeSpot,
  validate, projectStats, serialise, deserialise, fromDisplay, uid,
} from './model.js';
import { TEMPLATES } from './templates.js';
import { Viewport } from './viewport.js';
import { partsListHtml, issuesHtml, projectHtml, partHtml } from './panels.js';
import { specHtml, cutListCsv, drawingSheetSvg } from './spec.js';

const STORE_KEY = 'foamwright.project.v1';
const $ = (s, r = document) => r.querySelector(s);

const storage = {
  get() { try { return localStorage.getItem(STORE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(STORE_KEY, v); } catch { /* storage unavailable */ } },
};

class App {
  constructor() {
    this.project = this.loadInitial();
    this.sel = { partId: null, bracketId: null, dimId: null };
    this.undoStack = [];
    this.redoStack = [];
    this.tool = 'select';
    this.dimMode = 'auto';
    this.showGrid = true;
    this.colourMode = 'foam';
    this.issues = [];
    this.totals = projectStats(this.project);

    this.views = ['top', 'iso', 'front', 'right'].map((id) => new Viewport($(`#vp-${id}`), id, this));
    this.bindChrome();
    this.bindPanels();
    this.bindKeys();
    this.refresh();
  }

  loadInitial() {
    const saved = storage.get();
    if (saved) {
      try { return deserialise(saved); } catch { /* fall through to the sample */ }
    }
    return TEMPLATES.system.build();
  }

  // ---------- state changes ----------

  checkpoint() {
    this.undoStack.push(serialise(this.project));
    if (this.undoStack.length > 150) this.undoStack.shift();
    this.redoStack = [];
  }

  mutate(fn) {
    this.checkpoint();
    fn(this.project);
    this.refresh();
  }

  undo() {
    if (!this.undoStack.length) return this.toast('Nothing to undo');
    this.redoStack.push(serialise(this.project));
    this.project = deserialise(this.undoStack.pop());
    this.fixSelection();
    this.refresh();
  }

  redo() {
    if (!this.redoStack.length) return this.toast('Nothing to redo');
    this.undoStack.push(serialise(this.project));
    this.project = deserialise(this.redoStack.pop());
    this.fixSelection();
    this.refresh();
  }

  fixSelection() {
    const part = findPart(this.project, this.sel.partId);
    if (!part) this.sel = { partId: null, bracketId: null, dimId: null };
    else if (this.sel.bracketId && !part.brackets.some((b) => b.id === this.sel.bracketId)) this.sel.bracketId = null;
    if (this.sel.dimId && !this.project.dimensions.some((d) => d.id === this.sel.dimId)) this.sel.dimId = null;
  }

  get part() {
    return findPart(this.project, this.sel.partId);
  }

  select(partId, bracketId = null, { quiet = false } = {}) {
    const changed = partId !== this.sel.partId;
    this.sel = { partId, bracketId, dimId: null };
    if (quiet) { this.renderViews(); return; }
    this.refresh({ panels: true, scrollToBracket: bracketId, resetScroll: changed });
  }

  selectDim(id) {
    this.sel = { partId: null, bracketId: null, dimId: id };
    this.refresh();
  }

  refresh({ panels = true, scrollToBracket = null, resetScroll = false } = {}) {
    this.issues = validate(this.project);
    this.totals = projectStats(this.project);
    this.renderViews();
    if (panels) this.renderPanels({ scrollToBracket, resetScroll });
    this.renderStatus();
    this.updateChrome();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => storage.set(serialise(this.project)), 300);
  }

  renderViews() {
    for (const v of this.views) v.render();
  }

  boundsFor(part) {
    return partBounds(part, false);
  }

  // ---------- panels ----------

  renderPanels({ scrollToBracket, resetScroll } = {}) {
    // Keep focus on the same field across re-renders so Tab works naturally.
    const active = document.activeElement;
    const activeId = active && active.id && active.closest('.panel') ? active.id : null;
    const openState = {};
    document.querySelectorAll('#props details[data-group]').forEach((d) => { openState[d.dataset.group] = d.open; });

    $('#parts').innerHTML = partsListHtml(this);
    const notesOpen = $('#issues [data-notes]')?.open;
    $('#issues').innerHTML = issuesHtml(this);
    if (notesOpen) $('#issues [data-notes]')?.setAttribute('open', '');
    const counts = { error: 0, warning: 0 };
    for (const i of this.issues) if (i.level in counts) counts[i.level] += 1;
    $('#issue-count').textContent = counts.error ? `${counts.error} error${counts.error > 1 ? 's' : ''}` : counts.warning ? `${counts.warning} warning${counts.warning > 1 ? 's' : ''}` : 'OK';
    $('#issue-count').className = `count ${counts.error ? 'bad' : counts.warning ? 'warn' : 'good'}`;

    const props = $('#props');
    const part = this.part;
    const scroll = props.scrollTop;
    props.innerHTML = part ? partHtml(this, part) : projectHtml(this);
    props.querySelectorAll('details[data-group]').forEach((d) => {
      if (d.dataset.group in openState) d.open = openState[d.dataset.group];
    });
    props.scrollTop = resetScroll ? 0 : scroll;
    if (scrollToBracket) {
      const card = props.querySelector(`[data-bracket-card="${scrollToBracket}"]`);
      card?.closest('details')?.setAttribute('open', '');
      card?.scrollIntoView({ block: 'nearest' });
    }
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) { el.focus(); if (el.select && el.type !== 'checkbox') try { el.select(); } catch { /* not selectable */ } }
    }
  }

  renderStatus() {
    const t = this.totals;
    const units = this.project.settings.units;
    $('#status').innerHTML = `
      <span><b>${this.project.parts.length}</b> parts</span>
      <span><b>${(t.volumeL).toFixed(1)}</b> L foam</span>
      <span><b>${t.brackets}</b> brackets</span>
      <span><b>${t.coverM2.toFixed(2)}</b> m² fabric</span>
      <span><b>${t.totalKg.toFixed(2)}</b> kg est.</span>
      <span class="status-units">${units === 'in' ? 'inches' : 'mm'} · grid ${this.project.settings.grid} mm${this.project.settings.snap ? ' · snap on' : ''}</span>`;
  }

  updateChrome() {
    $('#project-name').value = this.project.meta.name;
    $('#btn-undo').disabled = !this.undoStack.length;
    $('#btn-redo').disabled = !this.redoStack.length;
    document.querySelectorAll('[data-tool]').forEach((b) => {
      b.classList.toggle('on', b.dataset.tool === this.tool);
      b.setAttribute('aria-pressed', b.dataset.tool === this.tool);
    });
    document.querySelectorAll('[data-units]').forEach((b) => {
      b.classList.toggle('on', b.dataset.units === this.project.settings.units);
      b.setAttribute('aria-pressed', b.dataset.units === this.project.settings.units);
    });
    $('#dim-mode').hidden = this.tool !== 'dim';
    $('#views').classList.toggle('tool-dim', this.tool === 'dim');
    $('#btn-clear-dims').disabled = !this.project.dimensions.length;
  }

  bindPanels() {
    const onChange = (e) => {
      const el = e.target.closest('[data-bind]');
      if (!el) return;
      this.applyBinding(el);
    };
    for (const id of ['#props', '#parts']) {
      $(id).addEventListener('change', onChange);
    }

    document.body.addEventListener('click', (e) => {
      const t = e.target;
      const hide = t.closest('[data-toggle-hide]');
      if (hide) {
        e.stopPropagation();
        const part = findPart(this.project, hide.dataset.toggleHide);
        this.mutate(() => { part.hidden = !part.hidden; });
        return;
      }
      const selEl = t.closest('[data-select]');
      if (selEl && selEl.closest('.panel')) {
        this.select(selEl.dataset.select, selEl.dataset.selectBracket || null);
        return;
      }
      const rot = t.closest('[data-rot]');
      if (rot) { this.rotateTo(Number(rot.dataset.rot)); return; }
      const col = t.closest('[data-colour]');
      if (col) { const p = this.part; this.mutate(() => { p.cover.colour = col.dataset.colour; }); return; }
      const act = t.closest('[data-action]');
      if (act) this.action(act.dataset.action, act);
    });

    document.body.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[data-select]')) {
        e.preventDefault();
        this.select(e.target.dataset.select, e.target.dataset.selectBracket || null);
      }
    });

    $('#add-part').addEventListener('change', (e) => {
      const shape = e.target.value;
      if (!shape) return;
      e.target.value = '';
      this.addPart(shape);
    });
  }

  applyBinding(el) {
    const scope = el.dataset.scope === 'project' ? this.project : this.part;
    if (!scope) return;
    const kind = el.dataset.kindOverride || el.dataset.kind;
    const units = this.project.settings.units;
    let value;
    if (kind === 'bool') value = el.checked;
    else if (kind === 'len' || kind === 'num' || kind === 'int') {
      value = parseFloat(el.value);
      if (!Number.isFinite(value)) { this.refresh(); return; }
      if (kind === 'len') value = fromDisplay(value, units);
      if (kind === 'int') value = Math.max(1, Math.round(value));
    } else value = el.value;

    const path = el.dataset.bind;
    const brId = el.dataset.bracket;
    this.mutate(() => {
      if (path === 'shape') { changeShape(scope, value); return; }
      let target = brId ? scope.brackets.find((b) => b.id === brId) : scope;
      if (brId && path === 'type') {
        const d = BRACKETS[value];
        Object.assign(target, { type: value, l: d.l, w: d.w, t: d.t, material: d.material, fixing: d.fixing });
        return;
      }
      const keys = path.split('.');
      for (const k of keys.slice(0, -1)) target = target[k];
      target[keys.at(-1)] = value;
      if (path === 'cover.closure' && value === 'sewn') scope.cover.removable = false;
    });
  }

  // ---------- actions ----------

  addPart(shape) {
    const part = newPart(shape, { pos: freeSpot(this.project) });
    this.mutate((p) => { p.parts.push(part); });
    this.select(part.id);
    this.fitAll();
  }

  rotateTo(r) {
    const part = this.part;
    if (!part) return;
    this.mutate(() => { part.rot = r; });
  }

  action(name, el) {
    const part = this.part;
    switch (name) {
      case 'duplicate': return this.duplicate();
      case 'delete': return this.deleteSelection();
      case 'drop':
        if (part) this.mutate((p) => { part.pos.z = restHeight(p, part); });
        break;
      case 'stack': {
        if (!part) return;
        const b = partBounds(part, true);
        const below = this.project.parts
          .filter((o) => o.id !== part.id && !o.hidden)
          .map((o) => ({ o, ob: partBounds(o, true) }))
          .filter(({ ob }) => ob.z1 <= b.z0 + 0.5 && ob.x0 < b.x1 && ob.x1 > b.x0 && ob.y0 < b.y1 && ob.y1 > b.y0)
          .sort((a, c) => c.ob.z1 - a.ob.z1)[0];
        if (!below) return this.toast('No part underneath to align to.');
        this.mutate(() => {
          part.pos.x = below.ob.x0;
          part.pos.y = below.ob.y0;
          part.pos.z = below.ob.z1 + (part.pos.z - b.z0); // keep room for this part's base board
        });
        break;
      }
      case 'add-bracket': {
        if (!part) return;
        const type = $('#add-bracket-type').value;
        const br = newBracket(type, { face: type === 'lateral-swing' || type === 'lateral-fixed' ? 'right' : type === 'headrest-mount' || type === 'back-hardware' ? 'back' : 'bottom' });
        this.mutate(() => { part.brackets.push(br); });
        this.select(part.id, br.id);
        break;
      }
      case 'del-bracket': {
        const id = el.dataset.bracket;
        this.mutate(() => { part.brackets = part.brackets.filter((b) => b.id !== id); });
        if (this.sel.bracketId === id) this.select(part.id);
        break;
      }
      default:
    }
    return undefined;
  }

  duplicate() {
    const part = this.part;
    if (!part) return;
    const copy = JSON.parse(JSON.stringify(part));
    copy.id = uid('p');
    copy.name = `${part.name} (copy)`;
    copy.brackets.forEach((b) => { b.id = uid('b'); });
    const b = partBounds(part, true);
    copy.pos.x = b.x1 + 20;
    this.mutate((p) => { p.parts.splice(p.parts.indexOf(part) + 1, 0, copy); });
    this.select(copy.id);
  }

  deleteSelection() {
    const { partId, bracketId, dimId } = this.sel;
    if (dimId) {
      this.mutate((p) => { p.dimensions = p.dimensions.filter((d) => d.id !== dimId); });
      this.sel.dimId = null;
      this.refresh();
      return;
    }
    const part = this.part;
    if (!part) return;
    if (bracketId) {
      this.mutate(() => { part.brackets = part.brackets.filter((b) => b.id !== bracketId); });
      this.select(partId);
      return;
    }
    this.mutate((p) => { p.parts = p.parts.filter((x) => x.id !== partId); });
    this.sel = { partId: null, bracketId: null, dimId: null };
    this.refresh();
    this.toast(`Deleted “${part.name}”. Press Ctrl+Z to undo.`);
  }

  editExtent(partId, axis, mm) {
    const part = findPart(this.project, partId);
    if (!part) return;
    const { key, factor } = extentParam(part, axis);
    this.mutate(() => { part.params[key] = Math.round((mm / factor) * 10) / 10; });
  }

  addDimension(d) {
    this.mutate((p) => { p.dimensions.push({ id: uid('d'), ...d }); });
  }

  nudge(dx, dy, dz) {
    const part = this.part;
    if (!part) return;
    const g = this.project.settings.grid;
    this.mutate(() => {
      part.pos.x += dx * g; part.pos.y += dy * g; part.pos.z += dz * g;
    });
  }

  setTool(tool) {
    this.tool = tool;
    for (const v of this.views) v.cancelTool();
    this.updateChrome();
  }

  toggleMax(id) {
    const grid = $('#views');
    const cur = grid.dataset.max;
    if (cur === id) delete grid.dataset.max; else grid.dataset.max = id;
    this.views.forEach((v) => { v.root.hidden = grid.dataset.max ? v.id !== grid.dataset.max : false; });
    requestAnimationFrame(() => this.views.forEach((v) => { if (!v.root.hidden) { v.resize(); v.fit(); v.render(); } }));
  }

  fitAll() {
    for (const v of this.views) { v.fit(); v.render(); }
  }

  // ---------- chrome: toolbar, menus, files ----------

  bindChrome() {
    $('#btn-undo').addEventListener('click', () => this.undo());
    $('#btn-redo').addEventListener('click', () => this.redo());
    document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => this.setTool(b.dataset.tool)));
    document.querySelectorAll('[data-units]').forEach((b) => b.addEventListener('click', () => {
      if (this.project.settings.units !== b.dataset.units) this.mutate((p) => { p.settings.units = b.dataset.units; });
    }));
    $('#dim-mode').addEventListener('change', (e) => { this.dimMode = e.target.value; });
    $('#chk-grid').addEventListener('change', (e) => { this.showGrid = e.target.checked; this.renderViews(); });
    $('#colour-mode').addEventListener('change', (e) => { this.colourMode = e.target.value; this.renderViews(); });
    $('#btn-fit').addEventListener('click', () => this.fitAll());
    $('#btn-clear-dims').addEventListener('click', () => this.mutate((p) => { p.dimensions = []; }));
    $('#project-name').addEventListener('change', (e) => this.mutate((p) => { p.meta.name = e.target.value || 'Untitled device'; }));

    // New / templates
    const dlg = $('#new-dialog');
    $('#template-list').innerHTML = [
      '<button type="button" class="template" data-template="blank"><b>Blank project</b><span>Start with an empty workspace.</span></button>',
      ...Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="template" data-template="${k}"><b>${t.label}</b><span>${t.desc}</span></button>`),
    ].join('');
    $('#btn-new').addEventListener('click', () => dlg.showModal());
    $('#template-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-template]');
      if (!b) return;
      this.checkpoint();
      const key = b.dataset.template;
      this.project = key === 'blank' ? newProject() : TEMPLATES[key].build();
      this.sel = { partId: null, bracketId: null, dimId: null };
      dlg.close();
      this.refresh();
      this.fitAll();
      this.toast(key === 'blank' ? 'New blank project. Ctrl+Z restores the previous one.' : `Loaded “${TEMPLATES[key].label}”. Ctrl+Z restores the previous project.`);
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    // Open / save / export
    const fileInput = $('#file-input');
    $('#btn-open').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      try {
        const proj = deserialise(await f.text());
        this.checkpoint();
        this.project = proj;
        this.sel = { partId: null, bracketId: null, dimId: null };
        this.refresh();
        this.fitAll();
        this.toast(`Opened “${proj.meta.name}”.`);
      } catch (err) {
        this.toast(`Could not open ${f.name}: ${err.message}`, true);
      }
    });
    const base = () => (this.project.meta.name || 'device').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'device';
    $('#btn-save').addEventListener('click', () => this.download(`${base()}.foam.json`, serialise(this.project), 'application/json'));
    $('#export-menu').addEventListener('change', (e) => {
      const v = e.target.value;
      e.target.value = '';
      if (v === 'csv') this.download(`${base()}-cut-list.csv`, cutListCsv(this.project), 'text/csv');
      if (v === 'svg') this.download(`${base()}-drawing.svg`, drawingSheetSvg(this.project), 'image/svg+xml');
      if (v === 'json') this.download(`${base()}.foam.json`, serialise(this.project), 'application/json');
    });

    // Specification sheet
    const spec = $('#spec-dialog');
    $('#btn-spec').addEventListener('click', () => {
      $('#spec-body').innerHTML = specHtml(this.project);
      spec.showModal();
      $('#spec-body').scrollTop = 0;
    });
    $('#spec-close').addEventListener('click', () => spec.close());
    $('#spec-print').addEventListener('click', () => window.print());
    spec.addEventListener('close', () => { $('#spec-body').innerHTML = ''; });
  }

  download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.toast(`Downloaded ${name}`);
  }

  toast(msg, bad = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show${bad ? ' bad' : ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.className = 'toast'; }, 3200);
  }

  bindKeys() {
    document.addEventListener('keydown', (e) => {
      const inField = e.target.closest?.('input, select, textarea, dialog[open]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !inField) { e.preventDefault(); this.redo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); $('#btn-save').click(); return; }
      if (inField) return;
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicate(); return; }
      if (mod) return;
      switch (e.key) {
        case 'Delete': case 'Backspace': e.preventDefault(); this.deleteSelection(); break;
        case 'Escape':
          if (this.tool === 'dim') this.setTool('select');
          else this.select(null);
          break;
        case 'v': case 'V': this.setTool('select'); break;
        case 'd': case 'D': this.setTool('dim'); break;
        case 'f': case 'F': this.fitAll(); break;
        case 'r': case 'R': if (this.part) this.rotateTo((this.part.rot + 90) % 360); break;
        case 'ArrowLeft': e.preventDefault(); this.nudge(-1, 0, 0); break;
        case 'ArrowRight': e.preventDefault(); this.nudge(1, 0, 0); break;
        case 'ArrowUp': e.preventDefault(); this.nudge(0, 1, 0); break;
        case 'ArrowDown': e.preventDefault(); this.nudge(0, -1, 0); break;
        case 'PageUp': e.preventDefault(); this.nudge(0, 0, 1); break;
        case 'PageDown': e.preventDefault(); this.nudge(0, 0, -1); break;
        default:
      }
    });
  }
}

// Shape menu for "Add part".
function fillShapeMenu() {
  $('#add-part').innerHTML = `<option value="">＋ Add part…</option>${Object.entries(SHAPES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}`;
}

fillShapeMenu();
window.foamwright = new App();
