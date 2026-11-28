const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../shared/portal-registry.js');
test('one navigation registry supplies exactly five matching destinations and canonical legacy course keys',()=>{
 assert.equal(R.entries.length,5);assert.equal(new Set(R.entries.map(x=>x.href)).size,5);
 assert.deepEqual(R.entries.map(x=>x.color),['#203A29','#7D552C','#CF6600','#547D60','#414740']);
 assert.deepEqual(R.entries.filter(x=>x.course).map(x=>x.course),['online_tree_planting','arboriculture_1','donor_investor_funding']);
 assert.ok(!R.entries.some(x=>x.href==='/'));
 for(const x of R.entries)assert.ok(fs.existsSync(path.join(__dirname,'..',x.href,'index.html')));
});
test('portal has optional unchecked consent, course choices and a fail-closed registration gate',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../shared/portal-registration.js'),'utf8');
 assert.match(html,/name="publicProfileConsent" type="checkbox"/);assert.doesNotMatch(html,/name="publicProfileConsent"[^>]*(checked|required)/);
 assert.match(html,/id="registerAcademy" disabled/);
 assert.match(js,/input.type='checkbox'/);assert.match(js,/No account or enrolment was created/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|auth\/register/);
 assert.doesNotMatch(html,/Help with uploading/);
 assert.match(html,/id="photoEditor"[^>]*hidden/);
});
test('legacy root token and programme flows keep their query strings without exposing student credentials to new pages',async()=>{
 const {onRequest}=await import('../functions/_middleware.js');
 for(const query of ['token=synthetic&course_key=online_tree_planting','programme=staff']){
  const r=await onRequest({env:{},request:new Request('https://ketso-uploader.pages.dev/?'+query),next(){assert.fail('must preserve legacy route');}});
  assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'/uploader/?'+query);assert.equal(r.headers.get('Cache-Control'),'no-store');
 }
});
