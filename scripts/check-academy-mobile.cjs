// Node 24 + Playwright via NODE_PATH. All application requests are mocked.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  let passed = 0;
  try {
    const cases = [320,360,390,430].flatMap(width => ['portrait','landscape'].map(orientation => ({ width, orientation })));
    cases.push({ width:390,orientation:'portrait',failure:'original' },{ width:390,orientation:'portrait',failure:'preview' });
    for (const { width,orientation,failure } of cases) {
      const page = await browser.newPage({ viewport: { width, height: 740 }, isMobile: true, deviceScaleFactor: 1, hasTouch: true });
      const errors = [], saves = [];
      let uploads = 0;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.hostname === 'cdnjs.cloudflare.com') return route.continue();
        if (url.hostname !== 'academy.test') return route.abort();
        const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/upload') {
          uploads++;
          if (failure === 'original' && uploads === 1) return route.fulfill({ status:503,contentType:'application/json',body:JSON.stringify({ ok:false,code:'UPLOAD_STORAGE_UNAVAILABLE' }) });
          if (failure === 'preview' && uploads === 2) return route.fulfill({ status:500,contentType:'application/json',body:JSON.stringify({ ok:false,error:'private/student@example.invalid/token=secret' }) });
          return json({ ok: true, key: 'synthetic/photo.jpg' });
        }
        if (url.pathname === '/api/academy-student') return json({ ok: true, student: { id: 7, full_name: 'Test Student', email: 'test@example.invalid', whatsapp: '123', track: 'tree' }, enrollment: { course_key: 'online_tree_planting' } });
        if (url.pathname === '/api/save-photo-review') { saves.push(request.postDataJSON()); return json({ ok: true, review_id: 42 }); }
        const file = url.pathname === '/academy-onboarding/' ? 'academy-onboarding/index.html' : url.pathname.slice(1);
        if (!['academy-onboarding/index.html','shared/academy-courses.js'].includes(file)) return route.abort();
        return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : 'text/javascript', body: fs.readFileSync(path.join(root,file),'utf8').replaceAll('https://ptb-tree-map.onrender.com','http://academy.test') });
      });
      await page.goto('http://academy.test/academy-onboarding/?token=synthetic-test-token');
      await page.waitForFunction(() => fullName.value === 'Test Student');
      await page.selectOption('#uploadType','image_photo');
      const bytes = await page.evaluate(async orientation => {
        const canvas = document.createElement('canvas');
        canvas.width = orientation === 'portrait' ? 3000 : 4000;
        canvas.height = orientation === 'portrait' ? 4000 : 3000;
        const ctx = canvas.getContext('2d'); ctx.fillStyle='#51944d'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#e9d397'; ctx.fillRect(canvas.width/3,canvas.height/3,canvas.width/3,canvas.height/3);
        return [...new Uint8Array(await (await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg'))).arrayBuffer())];
      }, orientation);
      await page.setInputFiles(orientation === 'portrait' ? '#cameraInput' : '#fileInput',{ name:'synthetic.jpg', mimeType:'image/jpeg', buffer:Buffer.from(bytes) });
      await page.waitForFunction(() => cropper && !cropBtn.disabled);
      assert.equal(await page.evaluate(() => processedOriginalFile === selectedFile),true,'normal originals are not recompressed');
      for (const height of [740,580,740]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(250);
        const dimensions = await page.evaluate(() => ({ height:document.getElementById('cropViewport').getBoundingClientRect().height, width:document.documentElement.scrollWidth, viewport:innerWidth, scrollHeight:document.documentElement.scrollHeight, screen:innerHeight }));
        assert.ok(dimensions.height <= height * .45 + 1, JSON.stringify(dimensions));
        assert.equal(dimensions.width,dimensions.viewport,'horizontal overflow');
        assert.ok(dimensions.scrollHeight > dimensions.screen,'normal scrolling remains available');
      }
      await page.click('#zoomIn'); await page.click('#zoomOut'); await page.click('#cropBtn'); await page.waitForFunction(() => step === 3);
      const output = await page.evaluate(async () => {
        const bitmap = await createImageBitmap(croppedBlob); return { width:bitmap.width, height:bitmap.height, originalWidth:cropper.getImageData().naturalWidth };
      });
      assert.equal(Math.max(output.width,output.height),600); assert.equal(output.originalWidth,orientation === 'portrait' ? 3000 : 4000);
      await page.selectOption('#lessonKey','onboarding'); await page.check('#consent'); await page.click('#continueBtn');
      await page.click('#backBtn'); assert.equal(await page.inputValue('#fullName'),'Test Student');
      await page.click('#backBtn'); await page.click('#cropBtn'); await page.waitForFunction(() => step === 3);
      assert.equal(await page.inputValue('#lessonKey'),'onboarding'); await page.click('#continueBtn');
      assert.ok(await page.locator('#reviewPhoto').isVisible());
      await page.click('#uploadBtn');
      if (failure) {
        await page.waitForFunction(() => !busy);
        const status = await page.locator('#status').innerText();
        assert.match(status,failure === 'original' ? /Original photo upload \(HTTP 503\)/ : /Photo preview upload \(HTTP 500\)/);
        assert.doesNotMatch(status,/secret|student@example/); assert.equal(saves.length,0);
        assert.equal(await page.inputValue('#fullName'),'Test Student');
        await page.click('#uploadBtn');
      }
      await page.waitForFunction(() => received);
      if (failure) assert.equal(uploads,3,'retry reuses confirmed original');
      assert.equal(saves.length,1); assert.equal(errors.length,0,errors.join('\n'));
      passed++; console.log(`PASS ${width}px ${orientation}${failure ? ' '+failure+' failure and retry' : ''}: viewport resize, scrolling, controls, crop, back, receipt`);
      await page.close();
    }
    console.log(`${passed} browser scenarios passed; 0 failed. Native Android camera still needs device verification.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
