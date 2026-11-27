// Browser acceptance uses intercepted fixtures only; no production writes or network.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(require('node:fs').existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let signedIn=false,revision=0,emailChecks=0,emailRetries=0;const drafts={},submissions=[];
 const account={id:'11111111-1111-4111-8111-111111111111',name:'Test Student',legacy_student_id:null};
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.origin!=='https://ketso.test')return json({ok:true,questions:[]});
  if(url.pathname.startsWith('/api/student/')){
   const endpoint=url.pathname.slice('/api/student/'.length),body=request.postDataJSON();
   if(endpoint==='auth/register'||endpoint==='auth/forgot')return json({message:'Request recorded; pending confirmation.',email_receipt:'fixture-receipt'},202);
   if(endpoint==='email/status'){emailChecks++;return json(emailChecks===1?{status:'pending',message:'Confirmation pending.',retry_allowed:false,retry_after:600}:{status:'failed',message:'Processing failed; retry available.',retry_allowed:true,retry_after:0});}
   if(endpoint==='email/retry'){assert.equal(body.receipt,'fixture-receipt');emailRetries++;return json({status:'pending',message:'Retry requested.',retry_allowed:false,retry_after:600});}
   if(endpoint==='auth/login'){signedIn=true;return json({account});}
   if(endpoint==='auth/logout'){signedIn=false;return json({ok:true});}
   if(endpoint==='me')return signedIn?json({account,drafts:Object.values(drafts),submissions,files:[]}):json({error:'Please sign in.'},401);
   if(endpoint.startsWith('drafts/')){const area=endpoint.split('/')[1];drafts[area]={area,content:body.content,revision:++revision};return json({revision});}
   if(endpoint==='submit'){submissions.push({id:body.id,area:body.area,content:structuredClone(drafts[body.area].content),public:body.publish,created_at:1000,ai_status:'unavailable'});return json({id:body.id});}
   if(endpoint==='visibility'){submissions.find(s=>s.id===body.id).public=body.publish;return json({ok:true});}
   if(endpoint.startsWith('public/'))return json({account,submissions:submissions.filter(s=>s.public)});
   if(endpoint==='staff')return json({questions:submissions.filter(s=>s.area==='question').map(s=>({...s,name:account.name,reviewed:0}))});
   if(endpoint.startsWith('staff/')){submissions.find(s=>s.id===endpoint.split('/')[1]).staff_answer=body.answer;return json({ok:true});}
   return json({error:'Fixture route not implemented.'},404);
  }
  let filename=path.join(root,url.pathname);if(url.pathname.endsWith('/'))filename=path.join(filename,'index.html');
  if(!filename.startsWith(root+path.sep))return route.abort();
  try{const bytes=await fs.readFile(filename);const ext=path.extname(filename);await route.fulfill({body:bytes,contentType:ext==='.js'?'application/javascript':ext==='.css'?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:'Not found'});}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://ketso.test/student-account/');
 await page.locator('#authAction').selectOption('register');await page.locator('#name').fill('Student');
 await page.locator('#email').fill('student@example.test');await page.locator('#password').fill('A student password 123!');await page.locator('#authSubmit').click();await page.locator('#emailDelivery').waitFor({state:'visible'});
 await page.locator('#checkEmailDelivery').click();await page.waitForFunction(()=>document.getElementById('emailDeliveryStatus').textContent.includes('Confirmation pending'));assert.equal(await page.locator('#retryEmailDelivery').isDisabled(),true);
 await page.locator('#checkEmailDelivery').click();await page.waitForFunction(()=>!document.getElementById('retryEmailDelivery').disabled);await page.locator('#retryEmailDelivery').click();await page.waitForFunction(()=>document.getElementById('emailDeliveryStatus').textContent.includes('Retry requested'));assert.equal(emailRetries,1);
 await page.locator('#authAction').selectOption('forgot');await page.locator('#authSubmit').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Request recorded'));
 await page.locator('#authAction').selectOption('login');
 await page.locator('#email').fill('student@example.test');await page.locator('#password').fill('A student password 123!');await page.locator('#authSubmit').click();await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('[data-area=report]').click();await page.locator('#areaTitle').filter({hasText:'Last year'}).waitFor();
 await page.locator('#answer').fill('2025 — observed results only');await page.locator('#next').click();await page.waitForFunction(()=>document.getElementById('stepCount').textContent==='Question 2 of 11');
 await page.locator('#answer').fill('Plant the recorded trees');await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Private draft saved.');
 await page.reload();await page.locator('#workspace').waitFor({state:'visible'});await page.locator('[data-area=report]').click();await page.waitForFunction(()=>document.getElementById('stepCount').textContent==='Question 2 of 11');assert.equal(await page.locator('#answer').inputValue(),'Plant the recorded trees');
 await page.locator('#previous').click();await page.waitForFunction(()=>document.getElementById('stepCount').textContent==='Question 1 of 11');assert.equal(await page.locator('#answer').inputValue(),'2025 — observed results only');
 const download=page.waitForEvent('download');await page.locator('#download').click();assert.equal((await download).suggestedFilename(),'KETSO-report.odt');
 await page.evaluate(()=>{window.print=()=>{window.printInvoked=true;};});await page.locator('#print').click();assert.equal(await page.evaluate(()=>window.printInvoked),true);assert.match(await page.locator('#printOutput').textContent(),/2025 — observed results only/);
 await page.locator('#submit').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('confirm public visibility'));assert.equal(submissions.length,0);
 await page.locator('#publicConsent').check();await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelectorAll('#submissions article').length===1);assert.equal(submissions[0].public,true);
 await page.locator('#draftText').fill('SECRET later draft');await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('saveStatus').textContent==='Private draft saved.');assert.doesNotMatch(JSON.stringify(submissions[0]),/SECRET/);
 await page.locator('[data-area=question]').click();await page.locator('#draftText').fill('Where can I learn?');await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelectorAll('#submissions article').length===2);assert.equal(submissions[1].public,false);assert.match(await page.locator('#submissions').textContent(),/not configured/);
 const profile=await context.newPage();await profile.goto('https://ketso.test/student-profile/?student_id='+account.id);await profile.getByText('2025 — observed results only',{exact:true}).waitFor();assert.doesNotMatch(await profile.locator('body').textContent(),/SECRET|Where can I learn/);
 const staff=await context.newPage();await staff.goto('https://ketso.test/tutor-questions/');await staff.locator('#adminKey').fill('fixture-only');await staff.locator('#load').click();await staff.getByText('Where can I learn?',{exact:true}).waitFor();await staff.locator('textarea[id^=workspace-answer]').fill('KETSO staff can help you choose a course.');await staff.getByRole('button',{name:'Save staff answer'}).click();await page.locator('#refresh').click();await page.getByText('KETSO staff: KETSO staff can help you choose a course.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('Browser acceptance passed: email request status/retry controls, mobile login, guided progress and reload, ODT, print, publication consent, snapshot privacy, private questions, public profile and staff corrections.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
