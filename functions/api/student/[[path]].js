import {isStudentStaging,allowedStagingHost,stagingDenied} from '../../_shared/staging-policy.js';
import {account,check,cookie,digest,now,passwordHash,publicAccount,randomToken,rate,readJSON,sameOrigin,sessionToken,validatePassword} from '../../_shared/student-security.js';
import {AREAS,validateContent,ownedFiles,answerQuestion} from '../../_shared/student-content.js';
import {emailReady,queueEmail,dispatchEmail,emailCallback,emailRequest} from '../../_shared/student-email.js';
const LEGACY='https://ptb-tree-map.onrender.com';
const response=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fileType=name=>({pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',odt:'application/vnd.oasis.opendocument.text',txt:'text/plain',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'}[name.split('.').pop().toLowerCase()]||'application/octet-stream');
const encodedFilename=name=>encodeURIComponent(name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
async function withAttachments(db,row){
 const content=JSON.parse(row.content),attachments=[];
 for(const id of content.files){
  const file=await db.prepare('SELECT id,name FROM student_files WHERE id=? AND account_id=?').bind(id,row.account_id).first();
  if(file)attachments.push(file);
 }
 return {...row,content,attachments};
}
async function staff(request,env){
 if(isStudentStaging(request,env)){
  check(typeof env.STUDENT_STAGING_ADMIN_KEY==='string'&&env.STUDENT_STAGING_ADMIN_KEY.length>=32,'Staging staff access is not configured.',503);
  const supplied=await digest(request.headers.get('X-Admin-Key')||''),expected=await digest(env.STUDENT_STAGING_ADMIN_KEY);
  let difference=0;for(let i=0;i<expected.length;i++)difference|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  check(difference===0,'Invalid staging admin key.',403);return;
 }

 const key=request.headers.get('X-Admin-Key');check(key,'Enter the existing tutor admin key.',401);
 const r=await fetch(`${LEGACY}/api/academy-tutor-questions?status=new`,{headers:{'X-Admin-Key':key},signal:AbortSignal.timeout(10000)});
 check(r.ok,'Staff authentication failed or is unavailable.',r.status===401||r.status===403?403:503);
 const data=await r.json();check(data.ok===true,'Staff authentication failed.',403);
}
export async function onRequest(context){
 const {request}=context;
 const staging=isStudentStaging(request,context.env);
 if(staging&&!allowedStagingHost(request,context.env))return stagingDenied();
 // Staging questions remain in D1 for staff; never invoke a shared AI service.
 const env=staging?{...context.env,STUDENT_STAGING:'true',AI:undefined}:context.env;
 try{
  check(env.STUDENT_DB,'Student accounts are not configured yet. Existing course links still work.',503);
  const db=env.STUDENT_DB,url=new URL(request.url),path=url.pathname.replace(/^\/api\/student\/?/,'').split('/').filter(Boolean);
  const method=request.method;
  if(!['GET','POST','PUT','DELETE'].includes(method))return response({error:'Method not allowed.'},405);
  if(path.join('/')==='email/callback')return response(await emailCallback(request,env));
  if(method!=='GET')sameOrigin(request);
  if(path[0]==='email'&&path.length===2&&method==='POST')return response(await emailRequest(request,env,path[1],context));
  if(path[0]==='auth' && method==='POST'){
   const body=await readJSON(request,2000),action=path[1];
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const ip=request.headers.get('CF-Connecting-IP')||'local';
   await rate(db,'auth-ip:'+await digest(ip),30);
   if(['register','login','forgot','resend'].includes(action)){
    check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254,'Enter a valid email.');
    await rate(db,'auth-email:'+await digest(email),10);
   }
   if(action==='register'){
    emailReady(env);
    validatePassword(body.password);check(typeof body.name==='string'&&body.name.trim().length>=2&&body.name.length<=150,'Enter your name.');
    const salt=randomToken(),hash=await passwordHash(body.password,salt);
    await db.prepare('INSERT OR IGNORE INTO student_accounts(id,email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),email,body.name.trim(),hash,salt,now()).run();
    const a=await db.prepare('SELECT * FROM student_accounts WHERE email=?').bind(email).first();
    const delivery=await queueEmail(env,!a.verified?a:null,'verify');
    context.waitUntil(dispatchEmail(env,delivery.id));
    return response({message:'Request recorded. If eligible, email processing is pending. No delivery has been confirmed.',email_receipt:delivery.receipt},202);
   }
   if(action==='forgot'||action==='resend'){
    emailReady(env);
    const a=await db.prepare('SELECT * FROM student_accounts WHERE email=?').bind(email).first();
    const eligible=a&&(action==='forgot'?a.verified:!a.verified);
    const delivery=await queueEmail(env,eligible?a:null,action==='forgot'?'reset':'verify');
    context.waitUntil(dispatchEmail(env,delivery.id));
    return response({message:'Request recorded. If eligible, email processing is pending. No delivery has been confirmed.',email_receipt:delivery.receipt},202);
   }
   if(action==='verify'||action==='reset'){
    validatePassword(body.password);if(action==='verify')check(typeof body.name==='string'&&body.name.trim().length>=2&&body.name.length<=150,'Confirm your name.');check(typeof body.token==='string'&&/^[a-f0-9]{64}$/.test(body.token),'Invalid or expired link.');
    const salt=randomToken(),hash=await passwordHash(body.password,salt);
    const t=await db.prepare('DELETE FROM student_tokens WHERE hash=? AND purpose=? AND expires>? RETURNING account_id').bind(await digest(body.token),action,now()).first();
    check(t,'Invalid or expired link.');
    await db.batch([
     db.prepare('UPDATE student_accounts SET verified=1,password_hash=?,salt=?,name=COALESCE(?,name),password_version=password_version+1 WHERE id=?').bind(hash,salt,action==='verify'?body.name.trim():null,t.account_id),
     db.prepare('DELETE FROM student_tokens WHERE account_id=?').bind(t.account_id),
     db.prepare('DELETE FROM student_sessions WHERE account_id=?').bind(t.account_id)]);
    return response({message:'Your password is saved and email verified. Please sign in.'});
   }
   if(action==='login'){
    validatePassword(body.password);
    const a=await db.prepare('SELECT * FROM student_accounts WHERE email=?').bind(email).first();
    const hash=await passwordHash(body.password,a?.salt||'dummy-salt-for-unknown-account');
    check(a&&a.verified&&hash===a.password_hash,'Email or password incorrect, or email not verified.',401);
    const token=randomToken();
    await db.prepare('INSERT INTO student_sessions(hash,account_id,password_version,expires) VALUES(?,?,?,?)').bind(await digest(token),a.id,a.password_version,now()+28800).run();
    return response({account:publicAccount(a)},200,{'Set-Cookie':cookie(token)});
   }
   if(action==='logout'){
    await db.prepare('DELETE FROM student_sessions WHERE hash=?').bind(await digest(sessionToken(request))).run();
    return response({ok:true},200,{'Set-Cookie':cookie('',0)});
   }
   check(false,'Unknown action.',404);
  }
  if(path[0]==='public'&&method==='GET'){
   const a=await db.prepare('SELECT id,name,legacy_student_id FROM student_accounts WHERE id=? OR legacy_student_id=?').bind(path[1]||'',path[1]||'').first();
   check(a,'Profile not found.',404);
   const rows=await db.prepare('SELECT id,account_id,area,content,created_at,ai_answer,ai_status,staff_answer FROM student_submissions WHERE account_id=? AND public=1 ORDER BY created_at DESC').bind(a.id).all();
   return response({account:publicAccount(a),submissions:await Promise.all(rows.results.map(async x=>{const {account_id,...item}=await withAttachments(db,x);return item;}))});
  }
  if(path[0]==='staff'){
   await staff(request,env);
   if(method==='GET'){
    const rows=await db.prepare(`SELECT s.*,a.name FROM student_submissions s JOIN student_accounts a ON s.account_id=a.id WHERE area='question' ORDER BY reviewed,created_at DESC LIMIT 100`).all();
    return response({questions:await Promise.all(rows.results.map(x=>withAttachments(db,x)))});
   }
   check(method==='POST'&&path[1],'Unknown action.',404);const body=await readJSON(request,15000);
   check(typeof body.answer==='string'&&body.answer.trim()&&body.answer.length<=10000,'Write an answer of at most 10,000 characters.');
   const updated=await db.prepare("UPDATE student_submissions SET staff_answer=?,staff_updated_at=?,reviewed=1 WHERE id=? AND area='question' RETURNING id").bind(body.answer.trim(),now(),path[1]).first();
   check(updated,'Question not found.',404);return response({ok:true});
  }
  if(path[0]==='files'&&method==='GET'){
   const file=await db.prepare('SELECT * FROM student_files WHERE id=?').bind(path[1]||'').first();check(file,'File not found.',404);
   const published=await db.prepare(`SELECT s.id FROM student_submissions s, json_each(s.content,'$.files') f WHERE s.public=1 AND f.value=? LIMIT 1`).bind(file.id).first();
   if(!published){if(request.headers.has('X-Admin-Key')){await staff(request,env);const attached=await db.prepare("SELECT s.id FROM student_submissions s, json_each(s.content,'$.files') f WHERE s.area='question' AND f.value=? LIMIT 1").bind(file.id).first();check(attached,'File not found.',404);}else{const a=await account(request,db);check(a.id===file.account_id,'File not found.',404);}}
   check(env.STUDENT_PRIVATE_FILES,'Private storage is unavailable.',503);
   const object=await env.STUDENT_PRIVATE_FILES.get(file.id);check(object,'File not found.',404);
   return new Response(object.body,{headers:{'Content-Type':fileType(file.name),'Content-Disposition':`attachment; filename*=UTF-8''${encodedFilename(file.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox"}});
  }
  const a=await account(request,db);
  if(method!=='GET')await rate(db,'write:'+a.id,120,60);
  if(path[0]==='me'&&method==='GET'){
   const drafts=await db.prepare('SELECT area,content,revision FROM student_drafts WHERE account_id=?').bind(a.id).all();
   const submissions=await db.prepare('SELECT * FROM student_submissions WHERE account_id=? ORDER BY created_at DESC').bind(a.id).all();
   const files=await db.prepare('SELECT id,name FROM student_files WHERE account_id=?').bind(a.id).all();
   return response({account:publicAccount(a),drafts:drafts.results.map(x=>({...x,content:JSON.parse(x.content)})),submissions:submissions.results.map(x=>({...x,content:JSON.parse(x.content)})),files:files.results});
  }
  if(path[0]==='link'&&method==='POST'){
   check(!staging,'Production course linking is disabled in staging.',403);
   const body=await readJSON(request,2000);check(typeof body.token==='string'&&body.token.length<1000,'Enter your personal course token.');
   const target=new URL('/api/academy-student',LEGACY);target.searchParams.set('token',body.token);
   const r=await fetch(target,{signal:AbortSignal.timeout(10000)}),data=await r.json();
   check(r.ok&&data.ok&&data.student&&String(data.student.email||'').trim().toLowerCase()===a.email,'The course record must match your verified email. Ask staff to correct missing or outdated addresses.',403);
   const id=String(data.student.id||data.student.ketso_student_id||'');check(id,'The course record has no student ID.');
   check(!a.legacy_student_id||a.legacy_student_id===id,'This account is already linked to a different student.',409);
   await db.prepare('UPDATE student_accounts SET legacy_student_id=? WHERE id=?').bind(id,a.id).run();
   return response({ok:true});
  }
  if(path[0]==='drafts'&&method==='PUT'){
   check(AREAS.includes(path[1]),'Unknown student area.',404);const body=await readJSON(request),content=validateContent(body.content);
   check(Number.isInteger(body.revision)&&body.revision>=0,'Invalid revision.');await ownedFiles(db,a.id,content);
   const row=await db.prepare(`INSERT INTO student_drafts(account_id,area,content,updated_at) SELECT ?,?,?,? WHERE ?=0
    ON CONFLICT(account_id,area) DO NOTHING RETURNING revision`).bind(a.id,path[1],JSON.stringify(content),now(),body.revision).first();
   if(row)return response(row);
   const updated=await db.prepare('UPDATE student_drafts SET content=?,updated_at=?,revision=revision+1 WHERE account_id=? AND area=? AND revision=? RETURNING revision').bind(JSON.stringify(content),now(),a.id,path[1],body.revision).first();
   check(updated,'This draft changed in another tab. Copy your unsaved text, then reload.',409);return response(updated);
  }
  if(path[0]==='files'&&method==='POST'){
   check(env.STUDENT_PRIVATE_FILES,'Private file storage is not configured.',503);
   const count=await db.prepare('SELECT COUNT(*) AS n FROM student_files WHERE account_id=?').bind(a.id).first();check(count.n<100,'Attachment limit reached. Contact KETSO staff.',413);
   const length=Number(request.headers.get('Content-Length'));check(length>0&&length<=6*1024*1024,'Upload a file of at most 5 MB.',413);
   const form=await request.formData(),file=form.get('file');check(file&&typeof file!=='string'&&file.size>0&&file.size<=5*1024*1024,'Upload a file of at most 5 MB.',413);
   check(/\.(pdf|docx|odt|txt|jpg|jpeg|png)$/i.test(file.name),'Use PDF, DOCX, ODT, TXT, JPG or PNG.');
   const id=crypto.randomUUID(),clean=file.name.replace(/[\x00-\x1f\x7f/\\]/g,''),ext=clean.slice(clean.lastIndexOf('.')),name=clean.slice(0,clean.length-ext.length).slice(0,180-ext.length)+ext;
   await env.STUDENT_PRIVATE_FILES.put(id,file.stream(),{httpMetadata:{contentType:fileType(name)}});
   try{await db.prepare('INSERT INTO student_files(id,account_id,name,size,created_at) VALUES(?,?,?,?,?)').bind(id,a.id,name,file.size,now()).run();}
   catch(e){await env.STUDENT_PRIVATE_FILES.delete(id);throw e;}
   return response({id,name});
  }
  if(path[0]==='submit'&&method==='POST'){
   const body=await readJSON(request,2000);check(AREAS.includes(body.area),'Unknown student area.');
   check(/^[a-f0-9-]{36}$/.test(body.id||''),'Invalid submission ID.');
   const previous=await db.prepare('SELECT id FROM student_submissions WHERE id=? AND account_id=?').bind(body.id,a.id).first();if(previous)return response(previous);
   const draft=await db.prepare('SELECT * FROM student_drafts WHERE account_id=? AND area=?').bind(a.id,body.area).first();check(draft&&draft.revision===body.revision,'Save your current draft before submitting.',409);
   const content=validateContent(JSON.parse(draft.content));check(content.text.trim()||content.answers.some(x=>x.trim())||content.files.length,'Add text, answers or a file before submitting.');await ownedFiles(db,a.id,content);
   const isPublic=body.publish===true;check(body.area==='question'||isPublic,'Confirm that this work will be public.');
   check(!isPublic||body.publicConsent===true,'Confirm public visibility.');
   await db.prepare('INSERT INTO student_submissions(id,account_id,area,content,public,created_at,ai_status) VALUES(?,?,?,?,?,?,?)').bind(body.id,a.id,body.area,JSON.stringify(content),isPublic?1:0,now(),body.area==='question'?'pending':'not_requested').run();
   if(body.area==='question')context.waitUntil((async()=>{const result=await answerQuestion(env,content);await db.prepare('UPDATE student_submissions SET ai_answer=?,ai_status=? WHERE id=?').bind(result.answer,result.status,body.id).run();})());
   return response({id:body.id});
  }
  if(path[0]==='visibility'&&method==='POST'){
   const body=await readJSON(request,2000);check(typeof body.publish==='boolean','Choose visibility.');check(!body.publish||body.publicConsent===true,'Confirm public visibility.');
   const row=await db.prepare('UPDATE student_submissions SET public=? WHERE id=? AND account_id=? RETURNING id').bind(body.publish?1:0,body.id,a.id).first();check(row,'Submission not found.',404);return response({ok:true});
  }
  check(false,'Not found.',404);
 }catch(e){return response({error:e.status?e.message:'The student service could not complete this request. Please try again.'},e.status||503);}
}
