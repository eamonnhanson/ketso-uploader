const test = require('node:test');
const assert = require('node:assert/strict');
const { createSubmission } = require('../shared/staff-photo-submission.js');

function fixture(overrides = {}) {
  return createSubmission({ original: 'original', cropped: 'preview', folder: 'attempt',
    metadata: { caption: 'Nursery', forest_hero: { tree_id: 7 } },
    upload: async (file) => file + '-key', recover: async () => ({ retry_safe: true }),
    save: async () => ({ ok: true, review_id: 42 }), ...overrides });
}

test('metadata retry reuses both confirmed files and immutable details', async () => {
  const uploads = [], payloads = [], metadata = { caption: 'Before', forest_hero: { tree_id: 7 } };
  const submission = fixture({ metadata, upload: async (file) => { uploads.push(file); return file; },
    save: async (body) => { payloads.push(body); if (payloads.length === 1) throw new Error('503'); return { ok: true, review_id: 42 }; } });
  metadata.caption = 'After'; metadata.forest_hero.tree_id = 99;
  await assert.rejects(submission.run());
  assert.equal(submission.filesUploaded, true);
  assert.equal(submission.received, false);
  await submission.run();
  assert.deepEqual(uploads, ['original', 'preview']);
  assert.deepEqual(payloads, [{ caption: 'Before', forest_hero: { tree_id: 7 } }, { caption: 'Before', forest_hero: { tree_id: 7 } }]);
});

test('preview failure only retries the missing file', async () => {
  const calls = []; let fail = true;
  const s = fixture({ upload: async (file) => { calls.push(file); if (file === 'preview' && fail) { fail = false; throw Error('offline'); } return file; } });
  await assert.rejects(s.run()); await s.run();
  assert.deepEqual(calls, ['original', 'preview', 'preview']);
});

test('double taps share one request and a received attempt cannot submit again', async () => {
  let release, saves = 0;
  const s = fixture({ save: () => { saves++; return new Promise(r => { release = r; }); } });
  const first = s.run(), second = s.run(); assert.equal(first, second);
  await new Promise(r => setImmediate(r));
  release({ ok: true, review_id: 42 }); await first;
  await s.run(); assert.equal(saves, 1); assert.equal(s.received, true);
});

test('success requires application success and a durable receipt id', async () => {
  for (const result of [{ ok: false, review_id: 4 }, { ok: true }, { ok: true, review_id: null }]) {
    const s = fixture({ save: async () => result });
    await assert.rejects(s.run(), /unconfirmed_receipt/); assert.equal(s.received, false);
  }
});

test('missing upload key never starts metadata save', async () => {
  let saves = 0;
  const s = fixture({ upload: async () => null, save: async () => { saves++; } });
  await assert.rejects(s.run(), /missing_object_key/); assert.equal(saves, 0);
});

test('lost save response is recovered without posting again', async () => {
  let saves = 0;
  const s = fixture({ save: async () => { saves++; throw Error('response lost'); },
    recover: async () => ({ ok: true, review_id: 42 }) });
  await assert.rejects(s.run()); assert.equal((await s.run()).review_id, 42); assert.equal(saves, 1);
});

test('unknown receipt blocks unsafe save retries', async () => {
  let saves = 0;
  const s = fixture({ save: async () => { saves++; throw Error('response lost'); }, recover: async () => ({ ok: true, received: false }) });
  await assert.rejects(s.run()); await assert.rejects(s.run(), /receipt_unknown/); assert.equal(saves, 1);
});
