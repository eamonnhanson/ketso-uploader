// Exercise the actual Pages middleware in Chromium; every network request is intercepted.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),origin='https://staging.ketso.test';
(async()=>{
 const {onRequest}=await import('../functions/_middleware.js');
 const browser=await chromium.launch({headless:true,...(require('node:fs').existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 try{
  const context=await browser.newContext();let external=0,legacyNext=0;const errors=[];
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());
   if(url.origin!==origin){external++;return route.abort();}
   const request=new Request(r.url(),{method:r.method(),headers:r.headers(),...(['GET','HEAD'].includes(r.method())?{}:{body:r.postData()})});
   const response=await onRequest({request,env:{STUDENT_STAGING:'true',STUDENT_STAGING_ORIGIN:origin},next:async()=>{
    if(url.pathname==='/api/student/me')return Response.json({error:'Please sign in.'},{status:401});
    if(url.pathname==='/api/student/public/fixture')return Response.json({account:{name:'Synthetic student'},submissions:[]});
    if(url.pathname==='/api/student/staff')return Response.json({questions:[]});
    if(url.pathname.startsWith('/api/')||url.pathname==='/upload'){legacyNext++;return Response.json({error:'Unexpected handler'},{status:500});}
    let file=path.join(root,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
    try{return new Response(await fs.readFile(file),{headers:{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'}});}catch{return new Response('Not found',{status:404});}
   }});
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/student-account/');await page.getByRole('heading',{name:'My KETSO staging workspace'}).waitFor();
  assert.equal(await page.locator('#courseToken').count(),0);
  for(const url of ['https://ptb-tree-map.onrender.com/api/academy-student','https://ketso-uploader.pages.dev/upload','https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/file']){
   assert.equal(await page.evaluate(async url=>{try{await fetch(url,{method:'POST',body:'synthetic'});return false;}catch{return true;}},url),true);
  }
  for(const path of ['/upload','/api/staff-uploads','/list','/api/academy-student-search'])assert.equal(await page.evaluate(async path=>(await fetch(path,{method:'POST'})).status,path),403);
  for(const path of ['/admin-review/','/academy-onboarding/','/student-gallery/','/app.js'])assert.equal((await page.goto(origin+path)).status(),403);
  await page.goto(origin+'/student-profile/?student_id=fixture');await page.getByText('Synthetic student — submitted work').waitFor();
  await page.goto(origin+'/tutor-questions/');await page.locator('#adminKey').fill('synthetic-staging-only');await page.locator('#load').click();await page.getByText('0 awaiting staff review.',{exact:false}).waitFor();
  assert.equal(external,0);assert.equal(legacyNext,0);assert.deepEqual(errors,[]);
  console.log('Staging browser checks passed: restricted entrypoints, safe profile/console, no production requests, CSP blocks external writes, no production-token form.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
