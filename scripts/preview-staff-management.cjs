// Local-only browser acceptance fixture. No database, R2, production APIs or notifications.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), port = 8770, origin = `http://127.0.0.1:${port}`;
const collections = [{ id: 'tree-planting', name: 'Tree planting' }, { id: 'nursery', name: 'Nursery' }, { id: 'training', name: 'Training' }, { id: 'student-work', name: 'Student work' }];
const uploads = [
  { id: 71, caption: 'Nursery seedlings', collections: ['nursery'] },
  { id: 72, caption: 'Training fieldwork', collections: ['training'] },
  { id: 73, caption: 'Legacy unassigned photo', collections: [] }
].map(row => ({ ...row, location: 'Fixture field', date_taken: null, tags: ['fixture'], status: 'active', file_type: 'image', cropped_file_url: '/fixture-tree.svg', original_file_url: '/fixture-tree.svg', created_at_utc: '2001-01-01T12:00:00Z' }));
const calls = []; let failNextSave = false;
const panel = `<aside style="padding:10px;background:#fff2b5;border:2px dashed #685500">LOCAL FIXTURE ONLY <button onclick="fetch('/__fixture/fail-next-save',{method:'POST'}).then(()=>this.textContent='Next save will fail')">Fail next save</button> <button onclick="sessionStorage.setItem('ketso_staff_collection','removed-collection');location.reload()">Remember removed collection</button> <button onclick="sessionStorage.removeItem('ketso_staff_collection');location.reload()">Reset collection preference</button></aside>`;
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, origin);
  const json = (body,status=200) => { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body)); };
  try {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: blob:; form-action 'self'");
    let raw=''; if(req.method==='POST'||req.method==='PATCH')for await(const chunk of req)raw+=chunk;
    if(url.pathname==='/__fixture/fail-next-save'){failNextSave=true;return json({ok:true});}
    if(url.pathname==='/__fixture/state')return json({uploads,calls});
    if(url.pathname==='/api/academy-staff-auth')return JSON.parse(raw).password==='fixture-password'?json({ok:true,token:'fixture-session'}):json({ok:false,error:'Wrong password'},401);
    if(url.pathname.startsWith('/api/staff-managed-uploads')){
      if(req.headers.authorization!=='Bearer fixture-session')return json({ok:false,error:'Staff login required'},401);
      if(req.method==='PATCH'){
        calls.push({method:'PATCH',id:url.pathname.split('/').pop(),body:JSON.parse(raw)});
        if(failNextSave){failNextSave=false;return json({ok:false,error:'Fixture save failed. Please try again.'},503);}
        const upload=uploads.find(row=>String(row.id)===url.pathname.split('/').pop());if(!upload)return json({ok:false,error:'Upload not found'},404);
        Object.assign(upload,JSON.parse(raw));return json({ok:true,review_id:upload.id});
      }
      const collection=url.searchParams.get('collection')||'current', status=url.searchParams.get('status')||'active';
      calls.push({method:'GET',collection,status});
      const found=uploads.filter(row=>(status==='all'||row.status===status)&&(collection==='all'||collection==='current'&&row.collections.length>0||collection==='unassigned'&&row.collections.length===0||row.collections.includes(collection)));
      return json({ok:true,uploads:found,collections});
    }
    if(url.pathname==='/api/staff-uploads')return json({ok:true,uploads:[]});
    if(url.pathname.startsWith('/api/'))return json([]);
    if(url.pathname==='/fixture-tree.svg'){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="#e4efdf"/><path d="M240 220V100" stroke="#695238" stroke-width="20"/><circle cx="240" cy="85" r="70" fill="#237341"/></svg>');}
    const relative=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
    const target=path.resolve(root,'.'+relative);
    if(!target.startsWith(root+path.sep)||! /\.(html|js|css)$/.test(target)){res.writeHead(404);return res.end();}
    let source=fs.readFileSync(target,'utf8').replaceAll('https://ptb-tree-map.onrender.com',origin).replaceAll('https://ketso-uploader.pages.dev',origin);
    if(url.pathname==='/manage-uploads/')source=source.replace('<main>',panel+'<main>');
    res.setHeader('Content-Type',target.endsWith('.html')?'text/html; charset=utf-8':target.endsWith('.css')?'text/css':'text/javascript');res.end(source);
  }catch(error){json({ok:false,error:'Local fixture request failed'},500);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local staff usability fixture: ${origin}/ (fixture-password)`));
