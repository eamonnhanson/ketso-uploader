const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { File } = require('node:buffer');
const html = fs.readFileSync(require('node:path').join(__dirname, '../academy-onboarding/index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
function setup({ type = 'image_photo', failUpload = false, uploadResponse = null, loseSave = false, badReceipt = false, enrollment = 'online_tree_planting', legacy = false } = {}) {
  const elements = new Map(), calls = [], handlers = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', checked: false,
      disabled: false, hidden: false, style: {}, files: [], selectedIndex: 0, options: [{ text: 'Onboarding' }],
      classList: { add() {}, remove() {} }, addEventListener(name, fn) { handlers.set(id + ':' + name, fn); }, click() {},
    });
    return elements.get(id);
  }
  const json = b => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
  let uploadCount = 0;
  const context = vm.createContext({ document: { getElementById: element, querySelectorAll: () => [...elements.values()],
    createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob(fn) { fn(new Blob(['preview'], { type: 'image/jpeg' })); } }) },
    window: { location: { search: '?token=synthetic-test-token' }, KETSO_DEFAULT_COURSE: 'online_tree_planting', KETSO_ACADEMY_COURSES: { [enrollment]: { name: enrollment, lessons: [['onboarding','Onboarding']] } } },
    URL, URLSearchParams, Blob, File, FormData, console: { warn() {}, error() {} },
    fetch: async (url, opts = {}) => {
      if (String(url).includes('academy-student?')) return json({ ok: true, student: { id: 7, full_name: 'Test Student', email: 'student@example.invalid', whatsapp: '123', track: 'tree planting' }, enrollment: { course_key: enrollment, legacy } });
      if (url === '/upload') {
        calls.push('file'); uploadCount++;
        if (uploadResponse) return uploadResponse(opts.body, uploadCount);
        if (failUpload && uploadCount === 2) throw Error('offline');
        return json({ ok: true, key: 'synthetic/' + calls.length });
      }
      calls.push(JSON.parse(opts.body));
      if (loseSave) throw Error('response lost');
      return json(badReceipt ? { ok: false } : { ok: true, review_id: 42 });
    }
  });
  vm.runInContext(script, context);
  const run = code => vm.runInContext(code, context);
  async function ready() {
    await new Promise(resolve => setImmediate(resolve));
    element('uploadType').value = type; element('lessonKey').value = 'onboarding'; element('consent').checked = true;
    run(`selectedFile = new File(['original'], 'test.jpg', { type: 'image/jpeg' }); processedOriginalFile = selectedFile; croppedBlob = new Blob(['crop'], { type: 'image/jpeg' }); textInput.value = 'My answer'; uploadBtn.disabled = false;`);
  }
  return { elements, calls, run, ready, event: (id, name = 'click', ev = {}) => handlers.get(id + ':' + name)(ev) };
}
test('photo flow validates details, supports back navigation and keeps entered values', async () => {
  const p = setup(); await p.ready();
  p.event('continueBtn'); assert.equal(p.run('step'), 2);
  p.run('showStep(3)'); p.elements.get('lessonKey').value = '';
  p.event('continueBtn'); assert.equal(p.run('step'), 3);
  p.elements.get('lessonKey').value = 'onboarding'; p.event('continueBtn'); assert.equal(p.run('step'), 4);
  p.event('backBtn'); assert.equal(p.run('step'), 3); assert.equal(p.elements.get('fullName').value, 'Test Student');
  p.event('backBtn'); assert.equal(p.run('step'), 2); assert.equal(p.run('croppedBlob.size'), 4);
});
test('confirm photo automatically processes existing 600px canvas and advances', async () => {
  const p = setup(); await p.ready();
  p.run(`cropper = { getCroppedCanvas(options) { globalThis.cropOptions = options; return document.createElement('canvas'); } }; showStep(2);`);
  await p.event('cropBtn'); assert.equal(p.run('step'), 3); assert.equal(p.run('cropOptions.width'), 600); assert.equal(p.run('cropOptions.height'), 600);
  assert.equal(p.run('croppedBlob.type'), 'image/jpeg');
});
for (const type of ['document', 'video', 'text']) test(type + ' skips photo adjustment and retains its submission contract', async () => {
  const p = setup({ type }); await p.ready(); p.event('continueBtn'); assert.equal(p.run('step'), 3);
  p.event('continueBtn'); await p.event('uploadBtn'); assert.equal(p.calls.length, 2); assert.equal(p.calls[1].upload_type, type);
  assert.equal(p.calls[1].academy_student_id, 7); assert.match(p.elements.get('status').innerHTML, /academy-my-upload/);
});
test('double submit sends one record and locks inputs during upload and after receipt', async () => {
  const p = setup(); await p.ready(); const first = p.event('uploadBtn');
  assert.equal(p.elements.get('fullName').disabled, true); await p.event('uploadBtn'); await first;
  await p.event('uploadBtn'); assert.equal(p.calls.length, 3); assert.equal(p.run('received'), true);
});
test('failed preview upload preserves original, metadata and manual retry', async () => {
  const p = setup({ failUpload: true }); await p.ready(); await p.event('uploadBtn');
  assert.equal(p.elements.get('uploadBtn').textContent, 'Try again'); assert.equal(p.elements.get('fullName').value, 'Test Student');
  assert.match(p.elements.get('status').textContent, /Photo preview upload \(No HTTP response\)/);
  await p.event('uploadBtn'); assert.equal(p.calls.filter(c => c === 'file').length, 3); assert.equal(p.calls.filter(c => c !== 'file').length, 1);
});
test('missing Cloudflare R2 binding fails at original upload with safe HTTP 503 diagnostics', async () => {
  const { onRequestPost } = await import('../functions/upload.js');
  const p = setup({ uploadResponse: body => onRequestPost({ request: new Request('http://test.invalid/upload', { method:'POST', body }), env:{} }) });
  await p.ready(); await p.event('uploadBtn');
  assert.deepEqual(p.calls,['file']); assert.equal(p.run('saveAttempted'),false);
  const message = p.elements.get('status').textContent;
  assert.match(message,/Original photo upload \(HTTP 503\)/); assert.match(message,/Upload storage is unavailable/);
  assert.doesNotMatch(message,/synthetic-test-token|student@example|Test Student|test.jpg/);
  assert.equal(p.run('selectedFile.size'),8); assert.equal(p.elements.get('uploadBtn').textContent,'Try again');
});
test('Cloudflare preview upload failure reports its stage and retries only the failed preview', async () => {
  const { onRequestPost } = await import('../functions/upload.js'); let puts=0;
  const p = setup({ uploadResponse: body => onRequestPost({ request:new Request('http://test.invalid/upload',{ method:'POST',body }),
    env:{ KETSO_BUCKET:{ async put() { if (++puts === 2) throw Error('private/student@example.invalid/token=secret'); } } } }) });
  await p.ready(); await p.event('uploadBtn');
  assert.match(p.elements.get('status').textContent,/Photo preview upload \(HTTP 500\)/);
  assert.doesNotMatch(p.elements.get('status').textContent,/private|secret|example.invalid/);
  await p.event('uploadBtn'); assert.equal(puts,3); assert.equal(p.calls.filter(c=>c!=='file').length,1);
});
for (const [label,response] of [
  ['HTML error',()=>new Response('student@example.invalid token=secret',{ status:502,headers:{'Content-Type':'text/html'} })],
  ['malformed JSON',()=>new Response('token=secret',{ status:500,headers:{'Content-Type':'application/json'} })],
  ['validation error',()=>new Response(JSON.stringify({ ok:false,error:'student@example.invalid token=secret' }),{ status:400,headers:{'Content-Type':'application/json'} })]
]) test(label+' preserves HTTP status without exposing response content',async()=>{
  const p=setup({ uploadResponse:response }); await p.ready(); await p.event('uploadBtn');
  assert.match(p.elements.get('status').textContent,new RegExp('Original photo upload \\(HTTP '+response().status+'\\)'));
  assert.doesNotMatch(p.elements.get('status').textContent,/secret|example.invalid/); assert.deepEqual(p.calls,['file']);
});
for (const option of ['loseSave', 'badReceipt']) test(option + ' blocks unsafe resubmission without discarding work', async () => {
  const p = setup({ [option]: true }); await p.ready(); await p.event('uploadBtn'); await p.event('uploadBtn');
  assert.equal(p.calls.length, 3); assert.equal(p.elements.get('uploadBtn').disabled, true);
  assert.match(p.elements.get('status').textContent, /may have been received/); assert.equal(p.run('selectedFile.size'), 8);
});
for (const enrollment of ['online_tree_planting', 'arboriculture_1', 'donor_investor_funding']) test(enrollment + ' personal link retains enrollment course and association', async () => {
  const p = setup({ enrollment }); await p.ready(); await p.event('uploadBtn');
  assert.equal(p.calls.at(-1).course_key, enrollment); assert.equal(p.calls.at(-1).lesson_key, 'onboarding');
});
test('legacy response remains compatible', async () => {
  const p = setup({ legacy: true }); await p.ready(); assert.equal(p.run('activeCourseKey'), 'online_tree_planting');
});
test('camera cancellation keeps confirmed photo and camera input has direction-free gallery fallback', async () => {
  const p = setup(); await p.ready(); await p.event('cameraInput', 'change', { target: { files: [] } });
  assert.equal(p.run('selectedFile.size'), 8);
  assert.match(html, /id="cameraInput"[^>]* capture hidden/); assert.doesNotMatch(html, /capture="(user|environment)"/);
  assert.match(html, /id="chooseGallery"/);
});
test('invalid and oversized selections cannot advance', async () => {
  const p = setup(); await p.ready();
  for (const file of [new File(['x'], 'bad.gif', { type: 'image/gif' }), { name: 'huge.jpg', type: 'image/jpeg', size: 101 * 1024 * 1024 }]) {
    await p.event('fileInput','change',{ target: { files: [file] } });
    p.run('showStep(1)'); p.event('continueBtn'); assert.equal(p.run('step'), 1); assert.equal(p.elements.get('uploadBtn').disabled,true);
  }
});
test('large images use existing compression limits; normal originals are unchanged', async () => {
  const p = setup(); await p.ready();
  const original = p.run('selectedFile'); assert.equal(await p.run('resizeOriginalIfNeeded(selectedFile)'), original);
  p.run(`loadImageFromFile = async () => ({ naturalWidth: 6000, naturalHeight: 4000 }); globalThis.large = { name: 'large.jpg', size: 9 * 1024 * 1024 };`);
  const reduced = await p.run('resizeOriginalIfNeeded(large)');
  assert.ok(reduced.size <= 8 * 1024 * 1024); assert.equal(reduced.type,'image/jpeg');
});
test('captured and gallery photos use the same processing handler', async () => {
  for (const input of ['fileInput','cameraInput']) {
    const p = setup(); await p.ready();
    p.run(`FileReader = class { readAsDataURL() { this.result = 'synthetic-photo'; this.onload(); } };
      Cropper = class { constructor(image, options) { options.ready(); } getCroppedCanvas() { return document.createElement('canvas'); } };`);
    await p.event(input,'change',{ target: { files: [new File(['camera'], 'camera.jpg', { type:'image/jpeg' })] } });
    assert.equal(p.run('step'),2); assert.equal(p.elements.get('cropBtn').disabled,false);
    await p.event('cropBtn'); assert.equal(p.run('step'),3); assert.equal(p.run('croppedBlob.type'),'image/jpeg');
  }
});
for (const [type,name,mime] of [['document','answer.pdf','application/pdf'],['video','answer.mp4','video/mp4']]) test(type + ' file validation accepts its own files and enforces its limit', async () => {
  const p = setup({ type }); await p.ready();
  await p.event('fileInput','change',{ target: { files: [new File(['x'],name,{ type:mime })] } });
  assert.equal(p.elements.get('uploadBtn').disabled,false); p.event('continueBtn'); assert.equal(p.run('step'),3);
  await p.event('fileInput','change',{ target: { files: [{ name, type:mime, size:(type === 'document' ? 11 : 101) * 1024 * 1024 }] } });
  assert.equal(p.elements.get('uploadBtn').disabled,true);
});

