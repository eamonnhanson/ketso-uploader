// Offline visual/behavior acceptance. No real account, file upload or enrolment.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/portal-review'),R=require('../shared/portal-registry.js');
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{for(const width of [360,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});let writes=0;
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());if(url.origin!=='https://portal.test')return route.abort();
   if(url.pathname.startsWith('/api/')){
    if(r.method()!=='GET')writes++;
    if(url.pathname.endsWith('/portal/capabilities'))return route.fulfill({json:{registration_available:false,reason:'Registration is temporarily unavailable. You can browse courses or sign in.'}});
    if(url.pathname.endsWith('/auth/login'))return route.fulfill({status:429,headers:{'Retry-After':'3600'},json:{error:'Too many attempts.',retry_after:3600,remaining_attempts:0}});
    return route.fulfill({status:401,json:{error:'Please sign in.'}});
   }
   let file=path.join(root,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
   try{const body=await fs.readFile(file);return route.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});}catch{return route.fulfill({status:404,body:'Not found'});}
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://portal.test/');await page.getByText('Registration is temporarily unavailable. You can browse courses or sign in.',{exact:true}).waitFor();
  const links=page.locator('nav[aria-label="Academy destinations"] a');assert.equal(await links.count(),5);
  assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname)),R.entries.map(x=>x.href));
  assert.equal(await page.locator('input[name=publicProfileConsent]').isChecked(),false);
  await page.locator('input[name=courses]').nth(0).check();await page.locator('input[name=courses]').nth(2).check();assert.equal(await page.locator('input[name=courses]:checked').count(),2);
  assert.equal(await page.locator('#registerAcademy').isDisabled(),true);assert.equal(writes,0);
  await page.screenshot({path:path.join(out,'landing-'+width+'.png'),fullPage:true});
  await page.locator('#centralRegistration').screenshot({path:path.join(out,'registration-'+width+'.png')});
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const g=c.getContext('2d');g.fillStyle='#203A29';g.fillRect(0,0,900,600);g.fillStyle='#CF6600';g.fillRect(200,100,300,400);return c.toDataURL().split(',')[1];});
  await page.locator('#profilePhoto').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('#photoEditor').waitFor({state:'visible'});await page.locator('#adaptPhoto').click();await page.locator('#photoZoom').fill('1.5');
  assert.equal(await page.locator('#photoCanvas').evaluate(c=>c.width),600);
  await page.locator('#photoEditor').screenshot({path:path.join(out,'photo-crop-'+width+'.png')});
  for(const tab of R.entries){
   await page.goto('https://portal.test'+tab.href);await page.locator('nav[aria-label="Academy tabs"]').waitFor();
   assert.equal(await page.locator('nav[aria-label="Academy tabs"] a').count(),5);
   assert.equal(await page.locator('nav a[aria-current=page]').getAttribute('href'),tab.href);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   await page.screenshot({path:path.join(out,tab.id+'-'+width+'.png'),fullPage:true});
  }
  await page.goto('https://portal.test/student-account/');await page.locator('#email').fill('synthetic@example.test');await page.locator('#password').fill('Synthetic password 123!');await page.locator('#authSubmit').click();
  await page.waitForFunction(()=>document.getElementById('authRetry').textContent.includes('59m')||document.getElementById('authRetry').textContent.includes('60m'));
  await page.screenshot({path:path.join(out,'login-lockout-'+width+'.png'),fullPage:true});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Portal passed at 360px, 390px and 1280px: five matching routes, optional browsing/consent, gated multi-course form, local crop, independent staff entry and login countdown. Screenshots saved.');}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
