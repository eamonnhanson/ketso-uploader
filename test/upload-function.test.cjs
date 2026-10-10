const test = require('node:test');
const assert = require('node:assert/strict');
const { File } = require('node:buffer');
const load = () => import('../functions/upload.js');
function request(name='synthetic.jpg',type='image/jpeg') {
  const body=new FormData(); body.set('file',new File(['synthetic bytes'],name,{ type })); body.set('folder','ketso-academy/uploads');
  return new Request('http://test.invalid/upload',{ method:'POST',body });
}
test('readiness reports missing or invalid KETSO_BUCKET without accessing storage or parsing uploads',async()=>{
  const { onRequestGet,onRequestPost }=await load();
  for (const env of [undefined,{}, { KETSO_BUCKET:'not-an-R2-binding' }]) {
    const get=onRequestGet({ env }); assert.equal(get.status,503); assert.equal(get.headers.get('cache-control'),'no-store');
    assert.deepEqual(await get.json(),{ ok:false,storage_ready:false,code:'UPLOAD_STORAGE_UNAVAILABLE',error:'Upload storage is not configured for this environment.' });
    const post=await onRequestPost({ env,request:{ formData(){ throw Error('must not parse'); } } });
    assert.equal(post.status,503);
  }
});
test('configured readiness uses no bucket operation',async()=>{
  const { onRequestGet }=await load(); let writes=0;
  const res=onRequestGet({ env:{ KETSO_BUCKET:{ put(){ writes++; } } } });
  assert.equal(res.status,200); assert.deepEqual(await res.json(),{ ok:true,storage_ready:true }); assert.equal(writes,0);
});
for (const [name,type] of [['synthetic.jpg','image/jpeg'],['synthetic_600px.jpg','image/jpeg'],['synthetic.pdf','application/pdf'],['synthetic.mp4','video/mp4']]) test(name+' keeps existing R2 key, bytes, metadata and response contract',async()=>{
  const { onRequestPost }=await load(); const writes=[];
  const res=await onRequestPost({ request:request(name,type),env:{ KETSO_BUCKET:{ async put(key,stream,options){ writes.push({ key,bytes:await new Response(stream).text(),options }); } } } });
  assert.equal(res.status,200); const data=await res.json(); assert.equal(data.ok,true); assert.equal(writes.length,1);
  assert.equal(writes[0].bytes,'synthetic bytes'); assert.equal(writes[0].options.httpMetadata.contentType,type);
  assert.equal(data.key,writes[0].key); assert.match(data.key,/^ketso-academy\/uploads\//);
});
test('storage failures return a fixed safe code and never leak error details',async()=>{
  const { onRequestPost }=await load();
  const res=await onRequestPost({ request:request(),env:{ KETSO_BUCKET:{ put(){ throw Error('student@example.invalid token=secret bucket/private'); } } } });
  assert.equal(res.status,500); assert.deepEqual(await res.json(),{ ok:false,code:'UPLOAD_FAILED',error:'Could not store the file.' });
});
test('invalid files remain rejected before any R2 write',async()=>{
  const { onRequestPost }=await load(); let writes=0;
  const res=await onRequestPost({ request:request('unsupported.exe','application/octet-stream'),env:{ KETSO_BUCKET:{ put(){ writes++; } } } });
  assert.equal(res.status,400); assert.equal(writes,0);
});
