const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const page = fs.readFileSync(path.join(__dirname, '../staff-upload-dashboard/index.html'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../functions/api/staff-uploads/[id].js'), 'utf8');
const gallery = fs.readFileSync(path.join(__dirname, '../staff-gallery/index.html'), 'utf8');

test('photo and video staff cards open one reusable responsive details dialog', () => {
  assert.match(page, /Edit details/);
  assert.match(page, /beginStaffUploadEdit/);
  assert.match(page, /<dialog id="editUploadDialog"/);
  assert.match(page, /Edit upload details/);
  assert.match(page, /showModal\(\)/);
  assert.match(page, /editStaffName\.focus\(\)/);
  assert.match(page, /editStaffName\.value = upload\.staff_name \|\| upload\.uploader_name \|\| el\.staffName\.value/);
  assert.match(page, /editCategory\.value = upload\.staff_category \|\| upload\.selected_category \|\| upload\.category \|\| ""/);
  assert.match(page, /editCaption\.value = upload\.caption \|\| ""/);
  assert.match(page, /What does this upload show/);
  assert.match(page, /Save changes/);
  assert.match(page, /Cancel/);
  assert.match(page, /width: min\(560px, calc\(100vw - 24px\)\)/);
  assert.match(page, /max-height: calc\(100vh - 24px\)/);
  assert.match(page, /overflow-y: auto/);
  assert.match(page, /min-height: 120px/);
  assert.doesNotMatch(page, /card\.innerHTML \+=/);
});

test('dialog cancel closes without PATCH and save keeps the metadata PATCH contract', () => {
  assert.match(page, /cancelUploadEdit\.addEventListener\("click", closeStaffUploadEdit\)/);
  assert.match(page, /editUploadDialog\.close\(\)/);
  assert.match(page, /saveUploadEdit\.disabled = true/);
  assert.match(page, /staff_id: getStaffId\(\), staff_name:/);
  assert.match(api, /const allowed = new Set\(\["staff_id", "staff_name", "category", "caption"\]\)/);
  assert.match(api, /method: "PATCH"/);
  assert.doesNotMatch(api, /file_type: body\.file_type/);
  assert.match(page, /visibleUploads\[index\] = \{ \.\.\.visibleUploads\[index\], \.\.\.data\.upload \}/);
  assert.match(page, /closeStaffUploadEdit\(\);/);
  assert.match(page, /setStatus\("Details updated"\)/);
  assert.match(page, /Could not save changes/);
  assert.doesNotMatch(page, /catch \(err\) \{[^}]*closeStaffUploadEdit/s);
});

test('public staff gallery renders only a populated persisted caption as Description for photos and videos', () => {
  assert.match(gallery, /const caption = String\(upload\.caption \|\| ""\)\.trim\(\)/);
  assert.match(gallery, /caption \? `<div>Description: \$\{escapeHtml\(caption\)\}<\/div>` : ""/);
  assert.doesNotMatch(gallery, /What does this upload show\?/);
  assert.match(gallery, /renderPreview\(fileUrl, type\)/);
});
