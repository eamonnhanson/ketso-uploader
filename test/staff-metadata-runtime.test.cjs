const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'staff-upload-dashboard/index.html'), 'utf8');
const original = { id: 71, staff_id: 'original_staff', staff_name: 'Original Staff', staff_category: 'nursery',
  caption: 'Existing description', cropped_file_url: '/photo.jpg', collections: ['training'], user_id: 42 };

function editor(row = original, storage = new Map(), send) {
  const el = {};
  for (const id of ['editStaffName','editCategory','editCaption','editUploadStatus','saveUploadEdit','uploadsList','staffName']) {
    el[id] = { value: '', textContent: '', disabled: false, focus() {} };
  }
  el.staffName.value = 'Different current uploader';
  el.editUploadDialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const calls = [];
  const context = { el, window: {}, visibleUploads: [structuredClone(row)], editingUploadId: null,
    Number, JSON, Set, encodeURIComponent,
    getStaffId: () => 'different_current_uploader',
    getStaffCategories: () => [{ value: 'nursery', label: 'Nursery' }, { value: 'training', label: 'Training' }],
    escapeAttr: s => s, escapeHtml: s => s, renderUploadCard: JSON.stringify,
    setStatus(value) { context.status = value; },
    readJsonResponse: res => res.json(),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return send(calls.at(-1)); }
  };
  vm.createContext(context);
  vm.runInContext(page.slice(page.indexOf('window.beginStaffUploadEdit ='), page.indexOf('    function labelCategory(')), context);
  context.window.beginStaffUploadEdit(71);
  return { el, calls, context, storage, save: () => context.saveStaffUploadEdit({ preventDefault() {} }) };
}

for (const [name, changes] of [
  ['description only', { caption: 'New seedlings' }],
  ['name only', { staff_name: 'Renamed Staff' }],
  ['category only', { staff_category: 'training' }],
  ['name and description', { staff_name: 'Renamed Staff', caption: 'New seedlings' }],
  ['long unchanged description with name change', { staff_name: 'Renamed Staff', caption: 'x'.repeat(1500) }]
]) {
  test(name + ': waits for confirmation, preserves unrelated metadata and reloads saved cache', async () => {
    let persisted = structuredClone(original);
    const storage = new Map();
    const e = editor(persisted, storage, async ({ body }) => {
      assert.equal(e.el.editUploadDialog.open, true);
      assert.equal(e.el.saveUploadEdit.disabled, true);
      assert.equal(body.staff_id, original.staff_id);
      persisted = { ...persisted, staff_name: body.staff_name, staff_category: body.category, caption: body.caption };
      return Response.json({ ok: true, upload: persisted });
    });
    e.el.editStaffName.value = changes.staff_name || original.staff_name;
    e.el.editCategory.value = changes.staff_category || original.staff_category;
    e.el.editCaption.value = changes.caption || original.caption;
    await e.save();
    assert.equal(e.el.editUploadDialog.open, false);
    assert.equal(e.context.status, 'Details updated');
    assert.deepEqual(persisted, { ...original, ...changes });
    assert.equal(e.context.visibleUploads[0].user_id, 42);
    const reloaded = editor(persisted, storage);
    assert.equal(reloaded.el.editCaption.value, persisted.caption);
    assert.equal(reloaded.el.editStaffName.value, persisted.staff_name);
    assert.equal(reloaded.context.getCachedUploads(original.staff_id)[0].caption, persisted.caption);
  });
}

test('Cancel and accessible × use the same close function, discard edits and never PATCH', () => {
  assert.match(page, /id="closeUploadEdit"[^>]*type="button"[^>]*aria-label="Close without saving"/);
  for (const button of ['cancelUploadEdit', 'closeUploadEdit']) {
    assert.ok(page.includes('el.' + button + '.addEventListener("click", closeStaffUploadEdit)'));
    const e = editor();
    e.el.editCaption.value = 'Unsaved'; e.context.closeStaffUploadEdit();
    assert.equal(e.el.editUploadDialog.open, false); assert.equal(e.calls.length, 0);
    e.context.window.beginStaffUploadEdit(71);
    assert.equal(e.el.editCaption.value, original.caption);
  }
});

for (const [name, send] of [
  ['database failure', () => Response.json({ ok: false, error: 'STAFF_METADATA_UPDATE_FAILED', diagnostic: 'SCHEMA_MISMATCH' }, { status: 500 })],
  ['incomplete success', () => Response.json({ ok: true })],
  ['wrong persisted caption', () => Response.json({ ok: true, upload: original })],
  ['network failure', () => { throw new Error('Connection unavailable'); }]
]) {
  test(name + ' keeps dialog and all entered values for retry', async () => {
    const e = editor(original, new Map(), send);
    e.el.editStaffName.value = 'Renamed Staff'; e.el.editCategory.value = 'training'; e.el.editCaption.value = 'Entered description';
    await e.save();
    assert.equal(e.el.editUploadDialog.open, true); assert.equal(e.el.saveUploadEdit.disabled, false);
    assert.equal(e.el.editStaffName.value, 'Renamed Staff'); assert.equal(e.el.editCategory.value, 'training');
    assert.equal(e.el.editCaption.value, 'Entered description'); assert.match(e.el.editUploadStatus.textContent, /Could not save changes/);
    assert.equal(e.context.visibleUploads[0].caption, original.caption); assert.equal(e.storage.size, 0);
  });
}

test('proxy requires matching persisted metadata and sanitizes upstream/database failures', async () => {
  const { onRequestPatch } = await import('../functions/api/staff-uploads/[id].js');
  const originalFetch = global.fetch;
  const body = { staff_id: original.staff_id, staff_name: original.staff_name, category: 'nursery', caption: original.caption };
  try {
    for (const [upstream, expectedStatus, diagnostic] of [
      [() => Response.json({ ok: true, upload: original }), 200, undefined],
      [() => Response.json({ ok: true }), 502, 'PERSISTENCE_UNCONFIRMED'],
      [() => Response.json({ ok: false, error: 'postgres://secret' }), 502, 'UPSTREAM_REJECTED'],
      [() => new Response('postgres://secret', { status: 503 }), 503, 'UPSTREAM_REJECTED'],
      [() => Response.json({ ok: false, error: 'postgres://secret', diagnostic: 'SCHEMA_MISMATCH' }, { status: 500 }), 500, 'SCHEMA_MISMATCH'],
      [() => new Response('{broken', { headers: { 'Content-Type': 'application/json' } }), 502, 'UPSTREAM_REJECTED'],
      [() => { throw new Error('postgres://secret'); }, 502, 'UPSTREAM_UNAVAILABLE'],
      [() => Response.json({ ok: false }, { status: 401 }), 401, 'STAFF_LOGIN_REQUIRED']
    ]) {
      global.fetch = async (url, options) => { assert.equal(options.headers.Authorization, 'Bearer session'); return upstream(); };
      const res = await onRequestPatch({ params: { id: '71' }, request: new Request('https://local.test/api/staff-uploads/71', {
        method: 'PATCH', headers: { Authorization: 'Bearer session' }, body: JSON.stringify(body)
      }) });
      assert.equal(res.status, expectedStatus);
      const data = await res.json(); assert.equal(data.diagnostic, diagnostic);
      assert.ok(!JSON.stringify(data).includes('secret'));
      assert.equal(data.ok, expectedStatus === 200);
    }
  } finally { global.fetch = originalFetch; }
});

test('a save completing after Cancel cannot close a newly opened edit session', async () => {
  let confirm;
  const e = editor(original, new Map(), () => new Promise(resolve => { confirm = resolve; }));
  const pending = e.save();
  e.context.closeStaffUploadEdit();
  e.context.window.beginStaffUploadEdit(71);
  e.el.editCaption.value = 'New unsaved edit';
  confirm(Response.json({ ok: true, upload: original }));
  await pending;
  assert.equal(e.el.editUploadDialog.open, true);
  assert.equal(e.el.editCaption.value, 'New unsaved edit');
});
