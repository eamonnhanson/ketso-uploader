const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '../staff-upload-dashboard/index.html'), 'utf8');
const gallery = fs.readFileSync(path.join(__dirname, '../staff-gallery/index.html'), 'utf8');

test('staff dashboard keeps photo mode explicit and declares a separate safe video picker', () => {
  assert.match(page, /id="photoMode"[\s\S]*Upload photo/);
  assert.match(page, /id="videoMode"[\s\S]*Upload short video/);
  assert.match(page, /video\/mp4,video\/quicktime,video\/webm/);
  assert.match(page, /MAX_VIDEO_BYTES = 75 \* 1024 \* 1024/);
  assert.match(page, /MAX_VIDEO_DURATION_SECONDS = 60/);
  assert.match(page, /URL\.revokeObjectURL/);
});

test('staff dashboard sends video metadata only after metadata validation and renders videos without an image thumbnail', () => {
  assert.match(page, /file_type: "video"/);
  assert.match(page, /duration_seconds: videoDurationSeconds/);
  assert.match(page, /Video received/);
  assert.match(page, /video-placeholder/);
  assert.match(page, /Open video/);
  assert.match(page, /uploadStaffPhoto\(\)/);
});

test('staff gallery uses a non-autoplaying metadata-only video player', () => {
  assert.match(gallery, /<video controls preload="metadata"/);
  assert.doesNotMatch(gallery, /autoplay/);
});
