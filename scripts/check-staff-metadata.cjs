// Run with Playwright on NODE_PATH; all network and storage writes use fixtures.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  let passed = 0;
  try {
    for (const width of [360, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 740 }, isMobile: width < 500, hasTouch: width < 500 });
      await context.addInitScript(() => sessionStorage.setItem('ketso_staff_session', 'fixture-session'));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', err => errors.push(err.message));
      let row = { id: 71, staff_id: 'fixture_staff', staff_name: 'Fixture Staff', staff_category: 'nursery',
        caption: 'Original description', upload_context: 'staff_upload', cropped_file_url: '/fixture.svg' };
      let fail = false, saves = 0;
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.origin !== 'http://staff.test') return route.abort();
        if (url.pathname === '/api/staff-uploads/71') {
          saves++;
          assert.equal(req.headers().authorization, 'Bearer fixture-session');
          if (fail) return json({ ok: false, diagnostic: 'DATABASE_PERMISSION_DENIED' }, 500);
          const body = req.postDataJSON();
          assert.equal(body.staff_id, 'fixture_staff');
          row = { ...row, staff_name: body.staff_name, staff_category: body.category, caption: body.caption };
          return json({ ok: true, upload: row });
        }
        if (url.pathname === '/api/staff-uploads') return json({ ok: true, uploads: [row] });
        if (url.pathname === '/fixture.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>' });
        const file = url.pathname === '/staff-upload-dashboard/' ? 'staff-upload-dashboard/index.html' : url.pathname.slice(1);
        if (!['staff-upload-dashboard/index.html','shared/staff-session.js','shared/staff-categories.js','shared/staff-photo-submission.js','shared/staff-video-submission.js'].includes(file)) return route.abort();
        return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : 'text/javascript', body: fs.readFileSync(path.join(root, file), 'utf8') });
      });
      await page.goto('http://staff.test/staff-upload-dashboard/');
      const open = () => page.getByRole('button', { name: 'Edit details', exact: true }).click();
      await open();
      for (const height of [740, 480, 740]) {
        await page.setViewportSize({ width, height });
        const rect = await page.locator('#editUploadDialog').boundingBox();
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
        assert.ok(rect.y >= 0 && rect.y + rect.height <= height + 1);
        assert.ok(await page.locator('#closeUploadEdit').isVisible());
      }
      await page.fill('#editCaption', 'Discard ×'); await page.click('#closeUploadEdit');
      await open(); assert.equal(await page.inputValue('#editCaption'), 'Original description');
      await page.fill('#editCaption', 'Discard Cancel'); await page.click('#cancelUploadEdit');
      assert.equal(saves, 0);
      await open();
      await page.fill('#editStaffName', 'Renamed Staff'); await page.selectOption('#editCategory', 'training');
      await page.fill('#editCaption', 'Saved seedlings');
      await page.click('#saveUploadEdit'); await page.waitForFunction(() => !document.getElementById('editUploadDialog').open);
      await page.reload(); await open();
      assert.equal(await page.inputValue('#editStaffName'), 'Renamed Staff');
      assert.equal(await page.inputValue('#editCategory'), 'training');
      assert.equal(await page.inputValue('#editCaption'), 'Saved seedlings');
      fail = true; await page.fill('#editCaption', 'Keep after failure'); await page.click('#saveUploadEdit');
      await page.waitForFunction(() => document.getElementById('editUploadStatus').textContent.includes('Could not save'));
      assert.equal(await page.inputValue('#editCaption'), 'Keep after failure');
      assert.equal(await page.locator('#editUploadDialog').evaluate(el => el.open), true);
      assert.match(await page.locator('#editUploadStatus').innerText(), /DATABASE_PERMISSION_DENIED/);
      assert.deepEqual(errors, []);
      passed++; await context.close();
    }
    console.log(passed + ' desktop/mobile browser scenarios passed (fixture persistence only)');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
