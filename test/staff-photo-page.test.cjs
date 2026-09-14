const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createSubmission } = require('../shared/staff-photo-submission.js');
const html = fs.readFileSync(path.join(__dirname, '../staff-upload-dashboard/index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];

function setup({ failPreview = false, loseSave = false, received = true, cacheThrows = false } = {}) {
  const elements = new Map(), calls = [];
  const element = () => ({ value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
    addEventListener() {}, focus() {}, removeAttribute() {}, appendChild() {} });
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  let uploads = 0, savedBody = null;
  const context = vm.createContext({
    document: { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element },
    window: { location: { search: '?staff_name=Test%20Staff' }, addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() { if (cacheThrows) throw Error('quota'); } },
    KetsoStaffPhotoSubmission: { createSubmission }, URL, URLSearchParams, AbortController, File, Blob, FormData, crypto,
    setTimeout, clearTimeout, console,
    fetch: async (input, opts = {}) => {
      const url = new URL(input, 'http://localhost');
      if (url.pathname === '/upload') {
        uploads++; calls.push('file');
        if (failPreview && uploads === 2) return json({ ok: false }, 503);
        return json({ ok: true, key: opts.body.get('folder') + '/' + uploads + '.jpg' });
      }
      if (opts.method === 'POST') {
        calls.push('save'); savedBody = JSON.parse(opts.body);
        if (loseSave) throw Error('response lost');
        return json({ ok: true, review_id: 42, upload: { ...savedBody, id: 42 } });
      }
      if (url.searchParams.has('file_url')) {
        calls.push('receipt');
        return json(received ? { ok: true, received: true, review_id: 42, upload: { ...savedBody, id: 42 } } : { ok: true, received: false, retry_safe: false });
      }
      return json({ ok: true, uploads: [] });
    }
  });
  vm.runInContext(script, context);
  vm.runInContext(`el.category.value = 'nursery'; el.caption.value = 'Seedlings';
    selectedFile = new File(['original'], 'tree.jpg', { type: 'image/jpeg' });
    originalFile = selectedFile; croppedBlob = new Blob(['preview'], { type: 'image/jpeg' });`, context);
  return { elements, calls, run: code => vm.runInContext(code, context) };
}

test('page double tap sends once, freezes fields, and success survives cache failure', async () => {
  const p = setup({ cacheThrows: true });
  const first = p.run('uploadStaffPhoto()');
  assert.equal(p.elements.get('fileInput').disabled, true);
  assert.equal(p.elements.get('caption').disabled, true);
  await p.run('uploadStaffPhoto()'); await first;
  assert.deepEqual(p.calls, ['file', 'file', 'save']);
  assert.match(p.elements.get('status').textContent, /Photo received/);
  assert.match(p.elements.get('receiptHelp').textContent, /could not remember/);
  assert.equal(p.elements.get('uploadBtn').disabled, true);
  assert.equal(p.elements.get('clearBtn').textContent, 'Send another photo');
  await p.run('uploadStaffPhoto()'); assert.equal(p.calls.length, 3);
});

test('page retries only the missing preview and retains note after file error', async () => {
  const p = setup({ failPreview: true }); await p.run('uploadStaffPhoto()');
  assert.equal(p.elements.get('caption').value, 'Seedlings');
  assert.equal(p.elements.get('uploadBtn').textContent, 'Try again');
  await p.run('uploadStaffPhoto()');
  assert.deepEqual(p.calls, ['file', 'file', 'file', 'save']);
  assert.match(p.elements.get('status').textContent, /Photo received/);
});

test('page checks lost response and does not resend files or metadata', async () => {
  const p = setup({ loseSave: true }); await p.run('uploadStaffPhoto()');
  assert.equal(p.elements.get('uploadBtn').textContent, 'Check receipt');
  assert.equal(p.elements.get('clearBtn').disabled, true);
  await p.run('uploadStaffPhoto()');
  assert.deepEqual(p.calls, ['file', 'file', 'save', 'receipt']);
  assert.match(p.elements.get('status').textContent, /Photo received/);
});

test('unconfirmed receipt prevents both reset and unsafe second POST', async () => {
  const p = setup({ loseSave: true, received: false }); await p.run('uploadStaffPhoto()');
  await p.run('uploadStaffPhoto()'); p.run('resetForm()');
  assert.equal(p.elements.get('caption').value, 'Seedlings');
  assert.equal(p.run('submission !== null'), true);
  assert.deepEqual(p.calls, ['file', 'file', 'save', 'receipt']);
  assert.match(p.elements.get('status').textContent, /could not confirm receipt/);
});

test('remove selected photo preserves entered note, while send another resets received form', async () => {
  const p = setup(); p.run('resetForm()'); assert.equal(p.elements.get('caption').value, 'Seedlings');
  const done = setup(); await done.run('uploadStaffPhoto()'); done.run('resetForm()');
  assert.equal(done.elements.get('caption').value, ''); assert.equal(done.elements.get('fileInput').disabled, false);
  assert.equal(done.elements.get('uploadBtn').textContent, 'Send photo');
});

test('file validation agrees with backend MIME and extension requirements', () => {
  const p = setup();
  for (const [name, type, expected] of [['a.jpg','image/jpeg',true],['a.png','image/png',true],['a.webp','image/webp',true],['a.jpg','video/mp4',false],['a.mp4','video/mp4',false],['a.jpg','',false]]) {
    p.run(`globalThis.validationFile = new File(['bytes'], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} })`);
    assert.equal(p.run('isSupportedImage(validationFile)'), expected);
  }
});
