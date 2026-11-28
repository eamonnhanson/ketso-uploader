const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='https://student-staging.ketso-uploader.pages.dev';
const env={STUDENT_STAGING:'true'};
async function middleware(path,method='GET',options={}){
 const {onRequest}=await import('../functions/_middleware.js');let calls=0;
 const response=await onRequest({request:new Request((options.origin||origin)+path,{method}),env:options.env||env,next:async()=>{calls++;return new Response(options.html||'next',{headers:{'Content-Type':options.html?'text/html':'text/plain'}});}});
 return {response,calls};
}
test('all legacy server and browser entrypoints are denied before next for reads and writes',async()=>{
 const paths=['/upload','/list','/api/staff-uploads','/api/staff-uploads/1','/api/staff-managed-uploads','/api/academy-student-search','/app.js','/gallery.html','/student-gallery/','/staff-gallery/','/staff-upload-dashboard/','/manage-uploads/','/admin-gallery/','/admin-review/','/academy-onboarding/','/academy-my-upload/','/my-questions/','/anonymous-upload-claims/','/api/student/link','/api/student/%6cink'];
 for(const path of paths)for(const method of ['GET','POST','PATCH','DELETE']){const {response,calls}=await middleware(path,method);assert.equal(response.status,403,path);assert.equal(calls,0,path);}
});
test('canonical staging host allows student data paths and denies other Preview hosts',async()=>{
 for(const path of ['/api/student/me','/api/student/drafts/report','/api/student/files','/api/student/auth/login','/api/student/email/callback','/shared/student-workspace.js']){const r=await middleware(path);assert.equal(r.calls,1);assert.equal(r.response.headers.get('Cache-Control'),'no-store');assert.match(r.response.headers.get('Content-Security-Policy'),/connect-src 'self'/);}
 for(const origin of ['https://other.ketso-uploader.pages.dev','https://hash.ketso-uploader.pages.dev','https://preview.example.test']){const r=await middleware('/api/student/me','GET',{origin});assert.equal(r.response.status,403);assert.equal(r.calls,0);}
 const auto=await middleware('/upload','POST',{env:{}});assert.equal(auto.response.status,403);
});
test('production requests pass through unchanged; all Pages routes pass through middleware',async()=>{
 const r=await middleware('/upload','POST',{origin:'https://ketso-uploader.pages.dev',env:{CF_PAGES_BRANCH:'main'}});assert.equal(r.calls,1);assert.equal(await r.response.text(),'next');assert.equal(r.response.headers.has('Content-Security-Policy'),false);
 const routes=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../_routes.json')));assert.deepEqual(routes.include,['/*']);assert.deepEqual(routes.exclude,[]);
});
test('staging pages contain no legacy scripts or course token form',async()=>{
 for(const path of ['/student-profile/','/tutor-questions/']){const r=await middleware(path);assert.equal(r.calls,0);const html=await r.response.text();assert.doesNotMatch(html,/onrender|app\.js|cdnjs|forms\.zoho/);assert.match(html,/Synthetic staging/);}
 const html=fs.readFileSync(require('node:path').join(__dirname,'../student-account/index.html'),'utf8');
 const account=await middleware('/student-account/','GET',{html});assert.doesNotMatch(await account.response.text(),/id="courseToken"/);
 const root=await middleware('/');assert.equal(root.response.status,303);assert.equal(root.response.headers.get('Location'),'/student-account/');
});
test('student handler blocks production linking and uses only a separate staging admin credential',async()=>{
 const {onRequest}=await import('../functions/api/student/[[path]].js');let external=0;
 const prior=global.fetch;global.fetch=async()=>{external++;throw Error('External request forbidden');};
 const db={prepare(){return {bind(){return this;},async all(){return {results:[]};},async first(){return {id:'fixture',verified:1,hits:1};}};}};
 const invoke=(path,key,extra={})=>onRequest({request:new Request(origin+'/api/student/'+path,{method:path==='link'?'POST':'GET',headers:{Origin:origin,Cookie:'__Host-ketso_student=fixture','X-Admin-Key':key||''}}),env:{...env,STUDENT_DB:db,...extra},waitUntil(){}});
 try{
  assert.equal((await invoke('link')).status,403);
  assert.equal((await invoke('staff','production-key')).status,503);
  const extra={STUDENT_STAGING_ADMIN_KEY:'fixture-only-staging-key-1234567890'};
  assert.equal((await invoke('staff','wrong',extra)).status,403);
  assert.equal((await invoke('staff',extra.STUDENT_STAGING_ADMIN_KEY,extra)).status,200);assert.equal(external,0);
 }finally{global.fetch=prior;}
});
test('disabled email dispatch neither claims jobs nor invokes the webhook',async()=>{
 const {dispatchEmail}=await import('../functions/_shared/student-email.js');
 await assert.rejects(()=>dispatchEmail({STUDENT_EMAIL_ENABLED:'false',STUDENT_DB:{prepare(){assert.fail('database accessed');}}},'fixture'),/temporarily unavailable/);
});
