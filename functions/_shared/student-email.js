import {stagingOrigin} from './staging-policy.js';
import {check,digest,now,randomToken,rate,readJSON} from './student-security.js';

const FROM = 'info@planteenboom.nu';
const RETRY_SECONDS = 600;
const MAX_ATTEMPTS = 3;
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

export function emailReady(env) {
 check(env.STUDENT_EMAIL_ENABLED === 'true', 'Student email is not enabled. Please contact KETSO staff.',503);
 check(env.STUDENT_STAGING!=='true'||env.STUDENT_EMAIL_ORIGIN===stagingOrigin(env),'Staging email origin must match the isolated application.',503);
 let hook,origin,key;
 try {hook=new URL(env.STUDENT_ZAPIER_HOOK_URL);origin=new URL(env.STUDENT_EMAIL_ORIGIN);key=decode(env.STUDENT_EMAIL_ENCRYPTION_KEY);}
 catch {check(false,'Student email configuration is incomplete.',503);}
 check(hook.protocol==='https:' && hook.hostname==='hooks.zapier.com' && hook.pathname.startsWith('/hooks/catch/') && !hook.username && !hook.password,'Student email configuration is invalid.',503);
 check(origin.protocol==='https:' && origin.origin===env.STUDENT_EMAIL_ORIGIN && key.length===32 && typeof env.STUDENT_EMAIL_CALLBACK_SECRET==='string' && env.STUDENT_EMAIL_CALLBACK_SECRET.length>=43,'Student email configuration is invalid.',503);
}
async function encryptionKey(env) {
 return crypto.subtle.importKey('raw',decode(env.STUDENT_EMAIL_ENCRYPTION_KEY),'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(env,id,value) {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},await encryptionKey(env),new TextEncoder().encode(JSON.stringify(value)));
 return encode(iv)+'.'+encode(data);
}
async function open(env,row) {
 const [iv,data]=row.payload.split('.');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(row.id)},await encryptionKey(env),decode(data));
 return JSON.parse(new TextDecoder().decode(plain));
}
export async function queueEmail(env,a,purpose) {
 emailReady(env);
 const id=crypto.randomUUID(),receipt=randomToken(),token=a?randomToken():null;
 const expires=now()+(purpose==='reset'?1800:86400),hash=token?await digest(token):null;
 const payload=a?{to:a.email,subject:purpose==='verify'?'Verify your KETSO email':'Reset your KETSO password',text:`Open this link to ${purpose==='verify'?'verify your email and confirm your name and chosen password':'choose a new password'}:\n${env.STUDENT_EMAIL_ORIGIN}/student-account/#${purpose}=${token}\nThis link expires in ${purpose==='reset'?'30 minutes':'24 hours'} and can be used once. If you did not request this, ignore this message.`}:{};
 const statements=[];
 if(a)statements.push(env.STUDENT_DB.prepare('INSERT INTO student_tokens(hash,account_id,purpose,expires) VALUES (?,?,?,?)').bind(hash,a.id,purpose,expires));
 statements.push(env.STUDENT_DB.prepare('INSERT INTO student_email_outbox(id,receipt_hash,account_id,purpose,token_hash,payload,created_at,expires) VALUES (?,?,?,?,?,?,?,?)').bind(id,await digest(receipt),a?.id||null,purpose,hash,await seal(env,id,payload),now(),expires));
 await env.STUDENT_DB.batch(statements);
 return {id,receipt};
}
export async function dispatchEmail(env,id) {
 emailReady(env); // Recheck the explicit enable gate before any outbox claim or network request.
 const db=env.STUDENT_DB,attempt=crypto.randomUUID();
 // An atomic claim prevents parallel retries. No dispatch can rotate a link or change its owner.
 const row=await db.prepare(`UPDATE student_email_outbox SET status='pending',attempts=attempts+1,current_attempt=?,retry_after=?
 WHERE id=? AND status IN ('pending','failed') AND attempts<? AND retry_after<=? AND expires>?
 RETURNING *`).bind(attempt,now()+RETRY_SECONDS,id,MAX_ATTEMPTS,now(),now()).first();
 if(!row)return;
 await db.prepare('INSERT INTO student_email_attempts(id,outbox_id,created_at) VALUES (?,?,?)').bind(attempt,id,now()).run();
 if(row.token_hash && !await db.prepare('SELECT hash FROM student_tokens WHERE hash=? AND account_id=? AND expires>?').bind(row.token_hash,row.account_id,now()).first()){
  await db.prepare("UPDATE student_email_outbox SET status='expired' WHERE id=? AND status NOT IN ('sent','skipped')").bind(id).run();return;
 }
 let message;
 try { message=await open(env,row); }
 catch {
  // No request was sent: distinguish unreadable local data from an ambiguous transport failure.
  await db.batch([
   db.prepare("UPDATE student_email_attempts SET status='failed',error_code='payload_unreadable' WHERE id=?").bind(attempt),
   db.prepare("UPDATE student_email_outbox SET status='failed' WHERE id=? AND current_attempt=? AND status NOT IN ('sent','skipped')").bind(id,attempt)]);
  return;
 }
 try {
  const result=await fetch(env.STUDENT_ZAPIER_HOOK_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,request_id:id,attempt_id:attempt,eligible:!!row.account_id,from:FROM,...message,purpose:row.purpose,expires_at:row.expires,callback_url:env.STUDENT_EMAIL_ORIGIN+'/api/student/email/callback'})});
  if(!result.ok){
   await db.prepare("UPDATE student_email_attempts SET error_code='hook_rejected' WHERE id=?").bind(attempt).run();
   await db.prepare("UPDATE student_email_outbox SET status='failed' WHERE id=? AND current_attempt=? AND status NOT IN ('sent','skipped')").bind(id,attempt).run();
  }
  // A 2xx only acknowledges the hook. The durable state remains pending until callback.
 } catch {
  // Ambiguous timeout/transport failure: Zapier may still be running. Never claim delivery.
  await db.prepare("UPDATE student_email_attempts SET error_code='dispatch_unconfirmed' WHERE id=?").bind(attempt).run();
 }
}
export async function emailReceipt(env,receipt) {
 check(typeof receipt==='string'&&/^[a-f0-9]{64}$/.test(receipt),'Invalid email request receipt.',404);
 const row=await env.STUDENT_DB.prepare('SELECT * FROM student_email_outbox WHERE receipt_hash=?').bind(await digest(receipt)).first();
 check(row,'Email request not found.',404);return row;
}
export function receiptStatus(row) {
 // Never disclose account eligibility, recipient, purpose, token, link, or provider metadata.
 const processed=['sent','skipped'].includes(row.status);
 const expired=row.expires<=now()||row.status==='expired';
 return {status:expired?'expired':processed?'processed':row.status,
 retry_allowed:!processed&&!expired&&row.attempts<MAX_ATTEMPTS&&row.retry_after<=now(),
 retry_after:Math.max(0,row.retry_after-now()),
 message:expired?'This request has expired. Request a new email.':processed?'Request processed. If eligible, check your inbox. Provider acceptance does not guarantee inbox delivery.':row.attempts>=MAX_ATTEMPTS?'No confirmation yet and this request has reached its retry limit. Check your inbox or request a new email through the form.':row.status==='failed'?'Email processing failed. You can retry when the cooldown ends.':'Email confirmation is pending. Check your inbox; if confirmation does not arrive, a retry becomes available after ten minutes.'};
}
export async function emailCallback(request,env) {
 check(request.method==='POST','Method not allowed.',405);
 const supplied=request.headers.get('Authorization')||'';
 check(typeof env.STUDENT_EMAIL_CALLBACK_SECRET==='string'&&env.STUDENT_EMAIL_CALLBACK_SECRET.length>=43,'Callback not configured.',503);
 // Fixed-length digest comparison, without reflecting credentials or provider responses.
 const got=await digest(supplied),want=await digest('Bearer '+env.STUDENT_EMAIL_CALLBACK_SECRET);
 let difference=0;for(let i=0;i<want.length;i++)difference|=want.charCodeAt(i)^got.charCodeAt(i);
 check(difference===0,'Unauthorized callback.',401);
 const body=await readJSON(request,2000);
 check(['sent','failed','skipped'].includes(body.status)&&typeof body.request_id==='string'&&typeof body.attempt_id==='string','Invalid callback.');
 const row=await env.STUDENT_DB.prepare('SELECT o.* FROM student_email_outbox o JOIN student_email_attempts a ON a.outbox_id=o.id WHERE o.id=? AND a.id=?').bind(body.request_id,body.attempt_id).first();
 check(row,'Unknown attempt.',404);
 check(body.status!=='sent'||(row.account_id&&typeof body.provider_message_id==='string'&&body.provider_message_id.length>0&&body.provider_message_id.length<=256),'A successful Zoho response and message ID are required.');
 check(body.status!=='skipped'||!row.account_id,'Cannot skip an eligible request.');
 if(body.status==='sent'||body.status==='skipped'){
  await env.STUDENT_DB.batch([
   env.STUDENT_DB.prepare('UPDATE student_email_attempts SET status=?,error_code=NULL WHERE id=?').bind(body.status,body.attempt_id),
   env.STUDENT_DB.prepare("UPDATE student_email_outbox SET status=?,confirmed_at=?,provider_message_id=? WHERE id=? AND status NOT IN ('sent','skipped')").bind(body.status,now(),body.status==='sent'?body.provider_message_id:null,row.id)]);
 }else{
  await env.STUDENT_DB.batch([
   env.STUDENT_DB.prepare("UPDATE student_email_attempts SET status='failed',error_code='zap_failed' WHERE id=? AND status NOT IN ('sent','skipped')").bind(body.attempt_id),
   env.STUDENT_DB.prepare("UPDATE student_email_outbox SET status='failed' WHERE id=? AND current_attempt=? AND status NOT IN ('sent','skipped')").bind(row.id,body.attempt_id)]);
 }
 return {ok:true};
}
export async function emailRequest(request,env,action,context) {
 emailReady(env);
 await rate(env.STUDENT_DB,'email-receipt-ip:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),60);
 const body=await readJSON(request,1000),row=await emailReceipt(env,body.receipt);
 if(action==='retry'){
  await rate(env.STUDENT_DB,'email-retry:'+row.id,3,3600);
  const status=receiptStatus(row);check(status.retry_allowed,'Retry unavailable. Wait for the cooldown, or start a new request after expiry.',429);
  context.waitUntil(dispatchEmail(env,row.id));
  return {status:'pending',retry_allowed:false,retry_after:RETRY_SECONDS,message:'Retry requested. Waiting for email confirmation.'};
 }
 check(action==='status','Not found.',404);return receiptStatus(row);
}
