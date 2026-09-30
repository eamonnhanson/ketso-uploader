const test = require('node:test');
const assert = require('node:assert/strict');
const { createSubmission } = require('../shared/staff-video-submission.js');

function fixture(overrides = {}) {
  return createSubmission({
    file: 'video', folder: 'attempt', metadata: { file_type: 'video', duration_seconds: 30 },
    upload: async () => 'video-key', save: async () => ({ ok: true, review_id: 42 }),
    recover: async () => ({ retry_safe: true }), ...overrides
  });
}

test('video submits one original object and only succeeds with a durable receipt', async () => {
  const uploads = [], saves = [];
  const submission = fixture({
    upload: async (file) => { uploads.push(file); return 'video-key'; },
    save: async (metadata, keys) => { saves.push({ metadata, keys }); return { ok: true, review_id: 42 }; }
  });
  await submission.run();
  assert.deepEqual(uploads, ['video']);
  assert.deepEqual(saves[0].keys, { objectKey: 'video-key' });
  assert.equal(submission.received, true);
});

test('a lost video receipt response recovers without a second metadata POST', async () => {
  let saves = 0;
  const submission = fixture({
    save: async () => { saves++; throw new Error('response lost'); },
    recover: async () => ({ ok: true, review_id: 42 })
  });
  await assert.rejects(submission.run());
  await submission.run();
  assert.equal(saves, 1);
});
