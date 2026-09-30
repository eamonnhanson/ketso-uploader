const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const page = fs.readFileSync(path.join(__dirname, '../staff-upload-dashboard/index.html'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../functions/api/staff-uploads/[id].js'), 'utf8');

test('photo and video staff cards expose an inline details editor', () => {
  assert.match(page, /Edit details/);
  assert.match(page, /beginStaffUploadEdit/);
  assert.match(page, /What does this upload show/);
  assert.match(page, /Save changes/);
  assert.match(page, /Cancel/);
  assert.match(page, /Details updated/);
});

test('metadata editor sends only display metadata with immutable staff ownership', () => {
  assert.match(page, /staff_id: getStaffId\(\), staff_name:/);
  assert.match(api, /const allowed = new Set\(\["staff_id", "staff_name", "category", "caption"\]\)/);
  assert.match(api, /method: "PATCH"/);
  assert.doesNotMatch(api, /file_type: body\.file_type/);
});
