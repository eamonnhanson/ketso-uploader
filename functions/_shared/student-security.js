export const COOKIE = '__Host-ketso_student';
export const now = () => Math.floor(Date.now() / 1000);
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export async function passwordHash(password, salt) {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt:new TextEncoder().encode(salt),iterations:100000},key,256));
}
export function check(condition, message, status = 400) {
 if (!condition) { const e = new Error(message); e.status = status; throw e; }
}
export function cookie(value, age = 28800) { return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
export function sessionToken(request) {
 return request.headers.get('Cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) || '';
}
export async function account(request, db) {
 const token = sessionToken(request);
 check(token, 'Please sign in.', 401);
 const a = await db.prepare(`SELECT a.* FROM student_accounts a JOIN student_sessions s ON a.id=s.account_id
 WHERE s.hash=? AND s.expires>? AND s.password_version=a.password_version AND a.verified=1`).bind(await digest(token),now()).first();
 check(a, 'Please sign in again.',401); return a;
}
export async function rate(db, key, limit, seconds = 900) {
 const row = await db.prepare(`INSERT INTO student_rate_limits(key,hits,expires) VALUES (?,1,?)
 ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN expires<=? THEN 1 ELSE hits+1 END,
 expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING hits`).bind(key,now()+seconds,now(),now()).first();
 check(row.hits<=limit,'Too many attempts. Please try again later.',429);
}
export function sameOrigin(request) {
 check(request.headers.get('Origin') === new URL(request.url).origin,'Request origin is not allowed.',403);
}
export async function readJSON(request, maximum = 100000) {
 check(request.headers.get('Content-Type')?.startsWith('application/json'),'Expected JSON.',415);
 const reader=request.body?.getReader(); check(reader,'Missing request body.');
 const chunks=[]; let size=0;
 while(true){const {done,value}=await reader.read(); if(done)break; size+=value.length;
 if(size>maximum){await reader.cancel(); check(false,'Request is too large.',413);} chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{check(false,'Invalid JSON.');}
}
export function publicAccount(a) { return {id:a.id,name:a.name,legacy_student_id:a.legacy_student_id}; }
export function validatePassword(value) { check(typeof value==='string' && value.length>=15 && value.length<=128,'Use a password of 15–128 characters.'); }
