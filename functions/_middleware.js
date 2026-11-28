import {isStudentStaging,allowedStagingHost,stagingDenied,secureStagingResponse} from './_shared/staging-policy.js';
const assets=new Set([
 '/shared/portal.css','/shared/portal-registry.js','/shared/portal-nav.js',
 '/shared/student-workspace.css','/shared/student-workspace.js','/shared/student-writing.js',
 '/shared/student-public-work.js','/shared/student-question-console.js',
 '/docs/templates/KETSO_Donor_Proposal_Writing_Template.pdf','/docs/templates/Template donor report.pdf'
]);
function page(title,body,scripts) {
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/shared/student-workspace.css"></head><body><main><a href="/student-account/">Student staging workspace</a><h1>${title}</h1><p>Synthetic staging records only. Production integrations are disabled.</p>${body}</main>${scripts.map(s=>`<script src="${s}"></script>`).join('')}</body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});
}
export async function onRequest(context) {
 const {request,env}=context;
 if(!isStudentStaging(request,env)){const url=new URL(request.url);if((url.pathname==='/'||url.pathname==='/index.html')&&(url.searchParams.has('token')||url.searchParams.has('programme')))return new Response(null,{status:302,headers:{Location:'/uploader/'+url.search,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});return context.next();}
 const finish=secureStagingResponse;
 if(!allowedStagingHost(request,env))return finish(stagingDenied('This Preview hostname is not authorized for student staging resources.'));
 let path;try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return finish(stagingDenied());}
 if(path==='/'||path==='/index.html')return finish(new Response(null,{status:303,headers:{Location:'/student-account/'}}));
 if(path.startsWith('/api/student/')) {
  if(path==='/api/student/link'||path==='/api/student/link/')return finish(stagingDenied('Production course linking is disabled in staging.'));
  return finish(await context.next());
 }
 if(!['GET','HEAD'].includes(request.method))return finish(stagingDenied());
 if(['/student-profile','/student-profile/','/student-profile/index.html'].includes(path))return finish(page('Staging student profile','<section id="studentSubmittedWork"></section>',['/shared/student-writing.js','/shared/student-public-work.js']));
 if(['/tutor-questions','/tutor-questions/','/tutor-questions/index.html'].includes(path))return finish(page('Staging student questions','<label>Staging admin key (never use a production key)<input id="adminKey" type="password" autocomplete="off"></label><button id="load" type="button">Load staging questions</button>',['/shared/student-question-console.js']));
 if(['/student-account','/student-account/','/student-account/index.html'].includes(path)){
  const response=await context.next();
  if(!(response.headers.get('Content-Type')||'').includes('text/html'))return finish(response);
  // Static local markup only: remove the production-token form rather than inviting real credentials.
  const html=(await response.text()).replace(/<details id="courseProfileLink">[\s\S]*?<\/details>/,'')
   .replace('<h1>My KETSO workspace</h1>','<h1>My KETSO staging workspace</h1><p>Use synthetic test information only. Production services and course linking are disabled.</p>');
  const headers=new Headers(response.headers);
  for(const name of ['Content-Length','Content-Encoding','ETag'])headers.delete(name);
  return finish(new Response(html,{status:response.status,headers}));
 }
 if(assets.has(path))return finish(await context.next());
 // Includes all legacy APIs, KETSO_BUCKET handlers, scripts, HTML routes and redirects.
 return finish(stagingDenied());
}
