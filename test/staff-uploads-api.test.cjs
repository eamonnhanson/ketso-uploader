const test = require('node:test');
const assert = require('node:assert/strict');
const base = 'https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/';
const url = base + 'staff_uploads/test_staff/attempt/photo.jpg';
const payload = { staff_id: 'test_staff', staff_name: 'Test Staff', category: 'nursery', caption: 'Seedlings', file_url: url };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function withFetch(fn, run) { const original = global.fetch; global.fetch = fn; try { await run(await import('../functions/api/staff-uploads.js')); } finally { global.fetch = original; } }
const post = () => new Request('http://localhost/api/staff-uploads', { method: 'POST', body: JSON.stringify(payload) });
const receipt = (file = url) => new Request('http://localhost/api/staff-uploads?staff_id=test_staff&file_url=' + encodeURIComponent(file));

test('staff save fails closed on HTTP 200 application error or missing receipt', async () => {
  for (const body of [{ ok: false, error: 'not saved' }, { ok: true }, { ok: true, review_id: 'not-an-id' }]) {
    await withFetch(async () => json(body), async api => { const r = await api.onRequestPost({ request: post() }); assert.equal(r.status, 502); assert.equal((await r.json()).ok, false); });
  }
});
test('staff save keeps metadata and confirms valid receipt', async () => {
  await withFetch(async (_url, opts) => {
    const b = JSON.parse(opts.body); assert.equal(b.caption, 'Seedlings'); assert.equal(b.staff_category, 'nursery'); assert.equal(b.staff_id, 'test_staff');
    return json({ ok: true, review_id: 51 });
  }, async api => { const r = await api.onRequestPost({ request: post() }); const d = await r.json(); assert.equal(r.status, 200); assert.equal(d.review_id, 51); });
});
test('receipt lookup requires matching staff, exact photo URL and durable ID', async () => {
  await withFetch(async () => json({ ok: true, photos: [
    { id: 50, upload_context: 'staff_upload', uploader_name: 'Another Person', cropped_file_url: url },
    { id: 51, upload_context: 'staff_upload', uploader_name: 'Test Staff', cropped_file_url: url }
  ] }), async api => { const d = await (await api.onRequestGet({ request: receipt() })).json(); assert.equal(d.review_id, 51); assert.equal(d.received, true); });
});
test('missing gallery item never authorizes unsafe resubmission', async () => {
  await withFetch(async () => json({ ok: true, photos: [] }), async api => { const d = await (await api.onRequestGet({ request: receipt() })).json(); assert.equal(d.received, false); assert.equal(d.retry_safe, false); });
});
test('receipt lookup rejects another staff folder before requesting backend', async () => {
  await withFetch(async () => { throw Error('must not call backend'); }, async api => { const r = await api.onRequestGet({ request: receipt(base + 'staff_uploads/other/attempt/photo.jpg') }); assert.equal(r.status, 400); });
});
test('backend outage and non-JSON save never return success', async () => {
  for (const fake of [async () => { throw Error('offline'); }, async () => new Response('Bad gateway', { status: 502 })]) {
    await withFetch(fake, async api => { const r = await api.onRequestPost({ request: post() }); assert.ok(r.status >= 500); assert.equal((await r.json()).ok, false); });
  }
});
