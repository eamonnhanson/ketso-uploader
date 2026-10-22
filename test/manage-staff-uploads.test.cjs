const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

async function proxy() {
  const source = fs.readFileSync(path.join(root, 'functions/_shared/manage-staff-uploads.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

test('management proxy forwards staff session, ID, filters and edits without admin credentials', async () => {
  const original = global.fetch, calls = [];
  global.fetch = async (url, options) => { calls.push({ url: String(url), options }); return Response.json({ ok: true }); };
  try {
    const { forward } = await proxy();
    const response = await forward({ request: new Request('https://example.test/api/staff-managed-uploads/71', { method: 'PATCH', headers: { Authorization: 'Bearer session' }, body: JSON.stringify({ collections: ['nursery','training'], status: 'archived' }) }), params: { id: '71' } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer session');
    assert.deepEqual(JSON.parse(calls[0].options.body).collections, ['nursery','training']);
    assert.equal(calls[0].url, 'https://ptb-tree-map.onrender.com/api/staff-managed-uploads/71');
    await forward({ request: new Request('https://example.test/api/staff-managed-uploads?status=archived&search=old') });
    assert.match(calls[1].url, /status=archived&search=old/);
  } finally { global.fetch = original; }
});

test('management proxy preserves unauthorized responses and rejects invalid IDs before fetching', async () => {
  const original = global.fetch;
  global.fetch = async () => Response.json({ ok: false, error: 'Staff login required' }, { status: 401 });
  try {
    const { forward } = await proxy();
    assert.equal((await forward({ request: new Request('https://example.test/api/staff-managed-uploads') })).status, 401);
    global.fetch = () => assert.fail('invalid ID fetched');
    assert.equal((await forward({ request: new Request('https://example.test/api/staff-managed-uploads/bad'), params: { id: 'bad' } })).status, 400);
  } finally { global.fetch = original; }
});

test('gallery requires a staff session before requesting any records', () => {
  const location = { replace(value) { this.target = value; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/manage-staff-uploads.js'), 'utf8'), {
    sessionStorage: { getItem() { return null; } }, location,
    fetch() { assert.fail('unauthorized gallery fetch'); }
  });
  assert.equal(location.target, '/?programme=staff');
});

test('staff session wrapper forwards authentication only to same-origin staff APIs', async () => {
  const calls = [];
  const window = { fetch: async (...args) => calls.push(args) };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/staff-session.js'), 'utf8'), {
    window, URL, Headers, Request, sessionStorage: { getItem() { return 'session'; } }, location: { href: 'https://example.test/staff-upload-dashboard/', origin: 'https://example.test' }
  });
  await window.fetch('/api/staff-uploads/71', { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
  assert.equal(calls[0][1].headers.get('Authorization'), 'Bearer session');
  await window.fetch('https://external.test/api/staff-uploads');
  assert.equal(calls[1][1].headers, undefined);
});

test('existing staff login stores only the issued session and opens the two staff choices', async () => {
  const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const functionSource = source.slice(source.indexOf('async function unlockStaff()'), source.indexOf('function updateStaffCategory()'));
  for (const success of [false, true]) {
    const stored = [], calls = [], window = { location: { href: '/' } };
    const context = { window, SEARCH_API_BASE: 'https://backend.test',
      el: { staffPassword: { value: 'staff-password' }, staffUnlockBtn: {}, staffMessage: {} },
      sessionStorage: { setItem(...args) { stored.push(args); } },
      fetch: async (...args) => { calls.push(args); return { ok: success, json: async () => success ? { ok: true, token: 'signed-session' } : { ok: false, error: 'Wrong password' } }; }
    };
    vm.createContext(context); vm.runInContext(functionSource, context); await context.unlockStaff();
    assert.match(calls[0][0], /academy-staff-auth$/);
    assert.equal(window.location.href, success ? '/staff-home/' : '/');
    assert.deepEqual(stored, success ? [['ketso_staff_session', 'signed-session']] : []);
  }
});

test('a filter change during loading wins over the earlier response', async () => {
  const controls = new Map(), calls = [];
  function element() { return { value: '', textContent: '', children: [], addEventListener() {}, querySelectorAll() { return []; }, replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, add() {} }; }
  for (const id of ['collection','status','search','from','to','message','grid','filters','cancel','close-editor','logout','edit-form']) controls.set(id, element());
  controls.get('collection').value = 'current'; controls.get('status').value = 'active';
  const context = { AbortController, URLSearchParams, Option: function() { this.dataset = {}; },
    sessionStorage: { getItem(key) { return key === 'ketso_staff_session' ? 'session' : null; }, setItem() {}, removeItem() {} }, location: {},
    document: { getElementById(id) { return controls.get(id); }, createElement() { return element(); } },
    fetch(url, options) { return new Promise(resolve => calls.push({ url, options, resolve })); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/manage-staff-uploads.js'), 'utf8'), context);
  controls.get('collection').value = 'unassigned';
  const newest = controls.get('collection').onchange();
  assert.equal(calls.length, 2); assert.equal(calls[0].options.signal.aborted, true);
  assert.match(calls[1].url, /collection=unassigned/);
  calls[1].resolve({ ok: true, status: 200, json: async () => ({ ok: true, collections: [], uploads: [{ id: 7, caption: 'Newest result' }] }) });
  await newest;
  calls[0].resolve({ ok: true, status: 200, json: async () => ({ ok: true, collections: [], uploads: [] }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controls.get('grid').children.length, 1); assert.equal(controls.get('message').textContent, '1 uploads');
});

test('existing metadata PATCH proxy forwards the session and returns JSON without reflecting credentials', async () => {
  const categories = fs.readFileSync(path.join(root, 'functions/_shared/staff-categories.js'), 'utf8');
  const categoryUrl = 'data:text/javascript;base64,' + Buffer.from(categories).toString('base64');
  const source = fs.readFileSync(path.join(root, 'functions/api/staff-uploads/[id].js'), 'utf8').replace('../../_shared/staff-categories.js', categoryUrl);
  const { onRequestPatch } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const original = global.fetch, calls = [];
  const upload = { id: 71, staff_id: 'test_staff', staff_name: 'Test Staff', staff_category: 'nursery', caption: 'Existing editor' };
  global.fetch = async (url, options) => { calls.push(options); return Response.json({ ok: true, review_id: 71, upload }); };
  try {
    const response = await onRequestPatch({ params: { id: '71' }, request: new Request('https://example.test/api/staff-uploads/71', {
      method: 'PATCH', headers: { Authorization: 'Bearer session' },
      body: JSON.stringify({ staff_id: 'test_staff', staff_name: 'Test Staff', category: 'nursery', caption: 'Existing editor', expected: {staff_name: 'Test Staff', category: 'nursery', caption: 'Existing editor'} })
    }) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, review_id: 71, upload });
    assert.equal(calls[0].headers.Authorization, 'Bearer session'); assert.equal(response.headers.get('Authorization'), null);
  } finally { global.fetch = original; }
});
