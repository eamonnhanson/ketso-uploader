// Local-only browser fixture. No backend, database, notifications or R2 calls.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let scenario = 'success', photoCount = 0, id = 9000;
const media = new Map(), receipts = [], calls = [];
const bar = `<aside style="padding:12px;background:#fff2b5;border:2px dashed #685500;font:14px Arial">LOCAL TEST ONLY <button type="button" onclick="testPhoto()">Use test photo</button><label>Scenario <select id="scenario" onchange="fetch('/__scenario?value='+this.value)"><option>success</option><option>preview-fail-once</option><option>save-response-lost</option><option>save-not-received</option></select></label></aside><script>
async function testPhoto(){const c=document.createElement('canvas');c.width=800;c.height=1000;const x=c.getContext('2d');x.fillStyle='#dfebd9';x.fillRect(0,0,800,1000);x.fillStyle='#4f703e';x.fillRect(375,300,50,600);x.beginPath();x.arc(400,300,220,0,7);x.fill();const f=new File([await new Promise(r=>c.toBlob(r,'image/jpeg'))],'test-tree.jpg',{type:'image/jpeg'});const input=document.getElementById('fileInput');if(input.disabled)return;const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
</script>`;
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost:8767');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: blob:; form-action 'self'");
    const json = (body,status=200) => { res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body)); };
    if(url.pathname==='/__scenario'){scenario=url.searchParams.get('value');photoCount=0;return json({ok:true});}
    if(url.pathname==='/__evidence') return json({calls,receipts});
    if(url.pathname.startsWith('/media/')){
      const file=media.get(url.pathname.slice(7));if(!file){res.writeHead(404);return res.end();}
      res.setHeader('Content-Type',file.type);return res.end(file.bytes);
    }
    if(url.pathname==='/upload'){
      const chunks=[];for await(const c of req)chunks.push(c);
      const request=new Request(url,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)});
      const fd=await request.formData(),file=fd.get('file');photoCount++;
      calls.push({method:'POST',path:'/upload',scenario});
      if(scenario==='preview-fail-once'&&photoCount===2)return json({ok:false},503);
      const key=fd.get('folder')+'/'+photoCount+'.jpg';media.set(key,{bytes:Buffer.from(await file.arrayBuffer()),type:file.type});
      return json({ok:true,key});
    }
    if(url.pathname==='/api/staff-uploads'){
      calls.push({method:req.method,path:url.pathname,receiptCheck:url.searchParams.has('file_url'),scenario});
      if(req.method==='POST'){
        let raw='';for await(const chunk of req)raw+=chunk;
        const body=JSON.parse(raw),upload={...body,id:++id,uploader_name:body.staff_name,upload_context:'staff_upload',staff_category:body.category,verification_status:'not_required',public_gallery_status:'public',created_at:new Date().toISOString()};
        if(scenario!=='save-not-received')receipts.push(upload);
        if(scenario==='save-not-received'||scenario==='save-response-lost')return json({ok:false},503);
        return json({ok:true,review_id:upload.id,upload});
      }
      if(url.searchParams.has('file_url')){
        const upload=receipts.find(r=>r.file_url===url.searchParams.get('file_url'));
        return json(upload?{ok:true,review_id:upload.id,received:true,upload}:{ok:true,received:false,retry_safe:false});
      }
      return json({ok:true,uploads:receipts.filter(r=>r.staff_id===url.searchParams.get('staff_id'))});
    }
    if(url.pathname.startsWith('/api/'))return json([]);
    const requested=url.pathname==='/'?'/staff-upload-dashboard/index.html':url.pathname;
    let file=path.resolve(root,'.'+requested);
    if(!file.startsWith(root+path.sep)||(!file.endsWith('.html')&&!file.endsWith('.js')&&!file.endsWith('.css'))){res.writeHead(404);return res.end();}
    if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
    let text=fs.readFileSync(file,'utf8').replaceAll('https://ptb-tree-map.onrender.com','http://localhost:8767').replaceAll('https://pub-146513161ecf43ebbf81dda0cf702fde.r2.dev/','http://localhost:8767/media/');
    if(file.endsWith('.html'))text=text.replace('<body>','<body>'+bar);
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript');res.end(text);
  }catch(_){res.writeHead(500);res.end('Local fixture error');}
});
server.listen(8767,'127.0.0.1',()=>console.log('Local fixtures only: http://localhost:8767/?staff_name=Test%20Staff'));
