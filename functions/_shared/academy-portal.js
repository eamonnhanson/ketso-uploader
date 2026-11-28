import {check,now,readJSON} from './student-security.js';
export function portalReady(env,staging=false){return !staging&&env.ACADEMY_PORTAL_ENABLED==='true'&&env.ACADEMY_PORTAL_SECRET?.length>=32&&!!env.ACADEMY_PORTAL_ISSUER;}
export function registrationIntent(body){
 check(Array.isArray(body.courses)&&body.courses.length<=3&&body.courses.every(c=>['online_tree_planting','arboriculture_1','donor_investor_funding'].includes(c)),'Choose valid courses.');
 check(typeof body.publicProfileConsent==='boolean','Choose your profile visibility.');
 check(typeof body.profilePhoto==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.profilePhoto)&&body.profilePhoto.length<=450000,'Choose a photograph up to 330 KB after cropping.');
 return {courses:[...new Set(body.courses)].sort(),consent:body.publicProfileConsent,photo:body.profilePhoto};
}
export async function saveIntent(env,a,intent){
 const key=`portrait/${a.id}/${crypto.randomUUID()}.jpg`,bytes=Uint8Array.from(atob(intent.photo.split(',')[1]),c=>c.charCodeAt(0));
 check(bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'Invalid photograph.');
 check(env.STUDENT_PRIVATE_FILES,'Private storage is unavailable.',503);
 await env.STUDENT_PRIVATE_FILES.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 try{await env.STUDENT_DB.prepare('INSERT INTO student_registration_intents(account_id,request_id,courses,consent,photo_key,created_at) VALUES(?,?,?,?,?,?)').bind(a.id,crypto.randomUUID(),JSON.stringify(intent.courses),intent.consent?1:0,key,now()).run();}
 catch(e){await env.STUDENT_PRIVATE_FILES.delete(key);throw e;}
}
export async function academyCall(env,subject,action,fields={}){
 const path='/api/academy-portal/'+action,body=JSON.stringify({issuer:env.ACADEMY_PORTAL_ISSUER,subject,...fields}),timestamp=String(Date.now());
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ACADEMY_PORTAL_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}\nPOST\n${path}\n${body}`))),b=>b.toString(16).padStart(2,'0')).join('');
 let r;try{r=await fetch('https://ptb-tree-map.onrender.com'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Academy-Timestamp':timestamp,'X-Academy-Signature':signature},body,redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{check(false,'Academy service is unavailable. Your private work is saved.',503);}
 check(r.ok,'Academy integration could not complete. Retry later or ask staff to check your personal course link.',[403,409,404].includes(r.status)?r.status:503);
 return r.json();
}
export async function portalAccount(request,env,a,path){
 const db=env.STUDENT_DB;
 if(path==='intent'&&request.method==='GET'){const intent=await db.prepare('SELECT courses,consent,completed FROM student_registration_intents WHERE account_id=?').bind(a.id).first();check(intent,'No pending registration.',404);return {...intent,courses:JSON.parse(intent.courses)};}
 if(path==='prepare'&&request.method==='POST'){
  const b=await readJSON(request,460000);
  const previous=await db.prepare('SELECT account_id FROM student_registration_intents WHERE account_id=?').bind(a.id).first();check(!previous,'A registration intent already exists. Complete it first.',409);
  await saveIntent(env,a,registrationIntent(b));return {ok:true};
 }
 if(path==='complete'&&request.method==='POST'){
  const b=await readJSON(request,2000),intent=await db.prepare('SELECT * FROM student_registration_intents WHERE account_id=?').bind(a.id).first();
  check(intent,'No pending registration. Use your existing personal course link or ask staff.',409);
  check(b.confirm===true&&typeof b.consent==='boolean','Review your selected courses and photograph, then confirm enrolment and visibility.');
  check(!b.token||typeof b.token==='string'&&b.token.length<=1000,'Invalid course token.');
  const result=await academyCall(env,a.id,'register',{email:a.email,name:a.name,courses:JSON.parse(intent.courses),consent:b.consent,photo_key:intent.photo_key,request_id:intent.request_id,expected_id:a.legacy_student_id||null,token:b.token||null});
  check(!a.legacy_student_id||a.legacy_student_id===result.student_id,'Canonical identity conflict. Contact staff.',409);
  await db.batch([db.prepare('UPDATE student_accounts SET legacy_student_id=? WHERE id=?').bind(result.student_id,a.id),db.prepare('UPDATE student_registration_intents SET completed=1 WHERE account_id=?').bind(a.id)]);
  return result;
 }
 if(path==='profile'&&request.method==='GET')return academyCall(env,a.id,'profile');
 if(path==='profile'&&request.method==='PUT'){
  const b=await readJSON(request,460000);
  let photo_key=null;
  if(b.profilePhoto){const intent=registrationIntent({courses:[],publicProfileConsent:b.consent,profilePhoto:b.profilePhoto});photo_key=`portrait/${a.id}/${crypto.randomUUID()}.jpg`;await env.STUDENT_PRIVATE_FILES.put(photo_key,Uint8Array.from(atob(intent.photo.split(',')[1]),c=>c.charCodeAt(0)),{httpMetadata:{contentType:'image/jpeg'}});}
  const result=await academyCall(env,a.id,'profile-update',{name:b.name,consent:b.consent,revision:b.revision,photo_key});
  await db.prepare('UPDATE student_accounts SET name=? WHERE id=?').bind(b.name.trim(),a.id).run();return result;
 }
 check(false,'Unknown Academy operation.',404);
}
