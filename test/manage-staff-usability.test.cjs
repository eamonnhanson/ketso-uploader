const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'shared/manage-staff-uploads.js'), 'utf8');
const preferenceKey = 'ketso_staff_collection';
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };

function page({ storage = new Map([['ketso_staff_session', 'fixture-session']]), catalogReady = Promise.resolve() } = {}) {
  class Element {
    constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; this.value = ''; this.textContent = ''; this.open = false; this.disabled = false; this.handlers = {}; }
    append(...children) { for (const child of children) { if (typeof child === 'object') child.parent = this; this.children.push(child); } }
    add(child) { this.append(child); }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    querySelectorAll(selector) {
      const descendants = this.children.flatMap(child => typeof child === 'object' ? [child, ...child.querySelectorAll(selector === '[data-project]' ? '*' : selector)] : []);
      return descendants.filter(child => selector === '*' || selector === '[data-project]' && child.dataset.project || selector === 'label' && child.tag === 'label' || selector === 'input:checked' && child.tag === 'input' && child.checked);
    }
  }
  const ids = ['collection','status','search','from','to','message','grid','filters','cancel','close-editor','logout','edit-form','editor','media','uploaded','caption','location','taken','tags','edit-status','memberships','edit-message','save'];
  const controls = Object.fromEntries(ids.map(id => [id, new Element()]));
  controls.collection.value = 'current'; controls.status.value = 'active';
  const record = { id: 71, caption: 'Original caption', location: 'Nursery', date_taken: null, tags: ['original'], status: 'active', collections: ['nursery'], created_at_utc: '2001-01-01T12:00:00Z', cropped_file_url: '/fixture.svg' };
  const collections = [{ id: 'nursery', name: 'Nursery' }, { id: 'training', name: 'Training' }];
  const calls = [];
  let failSave = false;
  const context = { AbortController, URLSearchParams, Option: class extends Element { constructor(name, value) { super('option'); this.textContent = name; this.value = value; } },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key) },
    location: { replace() {} }, document: { getElementById: id => controls[id], createElement: tag => new Element(tag), createTextNode: text => text },
    async fetch(url, options = {}) {
      calls.push({ url, ...options });
      if (options.method === 'PATCH') {
        if (failSave) { failSave = false; return { ok: false, status: 500, json: async () => ({ ok: false, error: 'Fixture save failed' }) }; }
        Object.assign(record, JSON.parse(options.body));
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      await catalogReady;
      return { ok: true, status: 200, json: async () => ({ ok: true, uploads: [structuredClone(record)], collections }) };
    }
  };
  vm.runInNewContext(source, context);
  return { controls, calls, storage, record, open: () => controls.grid.children[0].handlers.click(), submit: () => controls['edit-form'].onsubmit({ preventDefault() {} }), failSave: () => { failSave = true; }, checkbox: id => controls.memberships.children.flatMap(label => label.children).find(input => input.value === id) };
}

test('visible close button has an accessible name and closes without sending or retaining edits', async () => {
  const html = fs.readFileSync(path.join(root, 'manage-uploads/index.html'), 'utf8');
  assert.match(html, /<button id="close-editor" type="button" aria-label="Close editor">&times;<\/button>/);
  const app = page(); await settle(); app.open();
  app.controls.caption.value = 'Unsaved caption'; app.checkbox('training').checked = true;
  app.controls['close-editor'].onclick();
  assert.equal(app.controls.editor.open, false); assert.equal(app.calls.filter(call => call.method === 'PATCH').length, 0);
  app.open(); assert.equal(app.controls.caption.value, 'Original caption'); assert.equal(app.checkbox('training').checked, false);
});

test('successful save closes automatically and collections remain checked after saving and reopening', async () => {
  const app = page(); await settle(); app.open();
  app.controls.caption.value = 'Saved caption'; app.checkbox('training').checked = true;
  await app.submit();
  assert.equal(app.controls.editor.open, false);
  assert.deepEqual(app.record.collections, ['nursery', 'training']);
  assert.match(app.controls.message.textContent, /^Changes saved\./);
  app.open(); assert.equal(app.controls.caption.value, 'Saved caption');
  assert.equal(app.checkbox('nursery').checked, true); assert.equal(app.checkbox('training').checked, true);
});

test('save failure keeps the dialog open and preserves every entered field and collection', async () => {
  const app = page(); await settle(); app.open(); app.failSave();
  for (const [id,value] of Object.entries({ caption: 'Unsaved', location: 'New field', taken: '2026-10-02', tags: 'new\ntag', 'edit-status': 'archived' })) app.controls[id].value = value;
  app.checkbox('training').checked = true;
  await app.submit();
  assert.equal(app.controls.editor.open, true); assert.equal(app.controls['edit-message'].textContent, 'Fixture save failed');
  for (const [id,value] of Object.entries({ caption: 'Unsaved', location: 'New field', taken: '2026-10-02', tags: 'new\ntag', 'edit-status': 'archived' })) assert.equal(app.controls[id].value, value);
  assert.equal(app.checkbox('training').checked, true); assert.equal(app.record.caption, 'Original caption');
  for (const id of ['save','cancel','close-editor']) assert.equal(app.controls[id].disabled, false);
});

test('saved collection is restored only after the API catalog loads and its matching view is fetched', async () => {
  let release; const catalogReady = new Promise(resolve => { release = resolve; });
  const app = page({ storage: new Map([['ketso_staff_session', 'fixture-session'], [preferenceKey, 'training']]), catalogReady });
  assert.equal(app.controls.collection.value, 'current'); assert.equal(app.calls.length, 1); assert.match(app.calls[0].url, /collection=current/);
  release(); await settle();
  assert.equal(app.controls.collection.value, 'training'); assert.equal(app.calls.length, 2); assert.match(app.calls[1].url, /collection=training/);
  assert.equal(app.controls.grid.children.length, 1);
});

test('collection choice survives leaving the management page and returning in the same session', async () => {
  const first = page(); await settle(); first.controls.collection.value = 'nursery'; await first.controls.collection.onchange();
  assert.equal(first.storage.get(preferenceKey), 'nursery');
  const returned = page({ storage: first.storage }); await settle();
  assert.equal(returned.controls.collection.value, 'nursery'); assert.match(returned.calls.at(-1).url, /collection=nursery/);
});

for (const invalid of ['removed-project', '']) test(`invalid collection ${JSON.stringify(invalid)} falls back to Current projects and removes the preference`, async () => {
  const storage = new Map([['ketso_staff_session', 'fixture-session'], [preferenceKey, invalid]]);
  const app = page({ storage }); await settle();
  assert.equal(app.controls.collection.value, 'current'); assert.equal(storage.has(preferenceKey), false); assert.equal(app.calls.length, 1);
});

for (const collection of ['current','unassigned','all']) test(`built-in collection ${collection} can be remembered without an API catalog entry`, async () => {
  const app = page({ storage: new Map([['ketso_staff_session', 'fixture-session'], [preferenceKey, collection]]) }); await settle();
  assert.equal(app.controls.collection.value, collection); assert.equal(app.storage.get(preferenceKey), collection);
});

test('no saved preference defaults to Current projects without an extra request', async () => {
  const app = page(); await settle(); assert.equal(app.controls.collection.value, 'current'); assert.equal(app.calls.length, 1);
});

test('a deliberate selection during catalog loading wins over the previous preference', async () => {
  let release; const catalogReady = new Promise(resolve => { release = resolve; });
  const app = page({ storage: new Map([['ketso_staff_session', 'fixture-session'], [preferenceKey, 'training']]), catalogReady });
  app.controls.collection.value = 'unassigned'; const newest = app.controls.collection.onchange(); release(); await newest; await settle();
  assert.equal(app.controls.collection.value, 'unassigned'); assert.equal(app.storage.get(preferenceKey), 'unassigned'); assert.equal(app.calls.length, 2);
});

test('upload screen exposes a prominent management navigation link with its existing destination', () => {
  const html = fs.readFileSync(path.join(root, 'staff-upload-dashboard/index.html'), 'utf8');
  assert.match(html, /<a class="manage-uploads-button" href="\/manage-uploads\/">Manage existing uploads<\/a>/);
  assert.match(html, /\.manage-uploads-button\s*\{[^}]*min-height: 48px/s);
  assert.match(html, /<script src="\/shared\/staff-session.js"><\/script>/);
});
