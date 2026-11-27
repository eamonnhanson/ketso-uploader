'use strict';
const $=id=>document.getElementById(id),W=KetsoWriting;
let state,area='motivation',drafts={},timer,queue=Promise.resolve(),dirty=false,pendingSubmission=null;
const fragment=new URLSearchParams(location.hash.slice(1));
const linkAction=fragment.has('verify')?'verify':fragment.has('reset')?'reset':null;
const linkToken=linkAction?fragment.get(linkAction):null;
if(linkAction)history.replaceState(null,'',location.pathname);
async function api(path,body,method='POST'){
 const r=await fetch('/api/student/'+path,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed.');return data;
}
function message(error){$('status').textContent=error.message||error;}
function actionFields(){const action=linkAction||$('authAction').value;
 $('nameLabel').hidden=!['register','verify'].includes(action);$('name').required=!$('nameLabel').hidden;
 $('passwordLabel').hidden=['forgot','resend'].includes(action);$('password').required=!$('passwordLabel').hidden;
 $('password').autocomplete=action==='login'?'current-password':'new-password';
 $('emailLabel').hidden=!!linkAction;$('email').required=!linkAction;$('authAction').hidden=!!linkAction;$('verifyNote').hidden=action!=='verify';}
$('authAction').onchange=actionFields;actionFields();
$('authForm').onsubmit=async e=>{e.preventDefault();$('authSubmit').disabled=true;try{
 const action=linkAction||$('authAction').value;
 const data=await api('auth/'+action,{email:$('email').value,password:$('password').value,name:$('name').value,token:linkToken});
 $('password').value='';message(data.message||'Signed in.');
 if(data.email_receipt){emailReceipt=data.email_receipt;$('emailDelivery').hidden=false;$('emailDeliveryStatus').textContent=data.message;$('retryEmailDelivery').disabled=true;}
 if(action==='login')await load();
 if(linkAction){$('authForm').hidden=true;const a=document.createElement('a');a.href='/student-account/';a.textContent='Continue to sign in';$('auth').append(a);}
 }catch(e){message(e);}finally{$('authSubmit').disabled=false;}};
function current(){return drafts[area]||(drafts[area]={revision:0,content:{text:'',answers:[],files:[],step:0,templateVersion:W.templateVersion}});}
function capture(){const d=current().content;d.text=$('draftText').value;if(W.prompts[area])d.answers[d.step]=$('answer').value;return d;}
function changed(){capture();dirty=true;pendingSubmission=null;$('saveStatus').textContent='Unsaved changes…';clearTimeout(timer);timer=setTimeout(()=>save().catch(message),1200);}
function save(){clearTimeout(timer);capture();const selected=area,content=structuredClone(current().content);
 const task=queue.catch(()=>{}).then(async()=>{const draft=drafts[selected];const result=await api('drafts/'+selected,{content,revision:draft.revision},'PUT');draft.revision=result.revision;
 if(selected===area&&JSON.stringify(current().content)===JSON.stringify(content)){dirty=false;$('saveStatus').textContent='Private draft saved.';}return result;});queue=task;return task;}
function renderEditor(){const d=current().content;$('areaTitle').textContent=W.labels[area];$('draftText').value=d.text;
 const prompts=W.prompts[area];$('guided').hidden=!prompts;if(prompts){d.step=Math.min(d.step,prompts.length-1);$('promptLabel').textContent=prompts[d.step];$('answer').value=d.answers[d.step]||'';$('stepCount').textContent=`Question ${d.step+1} of ${prompts.length}`;$('previous').disabled=d.step===0;$('next').disabled=d.step===prompts.length-1;}
 $('publicConsent').checked=false;$('disclosure').textContent=area==='question'?'Questions are private by default. When AI is enabled, your question text is sent to Cloudflare Workers AI with approved KETSO information; uploaded attachments are not sent. Do not include passwords or sensitive personal details. AI guidance can be wrong and is not a promise of employment, grants, funding or investment. Staff can correct it, but a prompt staff response is not guaranteed. Publishing is optional.':'Submitting this work publishes a copy on your public student profile. To keep working privately, use Save private draft.';
 $('submit').textContent=area==='question'?'Send question':'Publish submitted work';$('saveStatus').textContent=current().revision?'Private draft loaded.':'New private draft.';
 document.querySelectorAll('[data-area]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.area===area)));renderFiles();}
function renderFiles(){$('attachments').replaceChildren();for(const id of current().content.files){const li=document.createElement('li'),a=document.createElement('a'),b=document.createElement('button');a.href='/api/student/files/'+id;a.textContent=state.files.find(f=>f.id===id)?.name||'Attachment';b.textContent='Remove from draft';b.onclick=()=>{current().content.files=current().content.files.filter(x=>x!==id);changed();renderFiles();};li.append(a,' ',b);$('attachments').append(li);}}
async function load(){state=await api('me',undefined,'GET');drafts=Object.fromEntries(state.drafts.map(x=>[x.area,{...x,content:W.upgradeDraft(x.area,x.content)}]));$('auth').hidden=true;$('workspace').hidden=false;$('identity').textContent=`Signed in as ${state.account.name}`;$('profileLink').href='/student-profile/?student_id='+encodeURIComponent(state.account.legacy_student_id||state.account.id);renderEditor();renderSubmissions();}
for(const [key,label]of Object.entries(W.labels)){const b=document.createElement('button');b.textContent=label;b.dataset.area=key;b.onclick=async()=>{try{await save();area=key;pendingSubmission=null;renderEditor();}catch(e){message(e);}};$('areas').append(b);}
$('draftText').oninput=changed;$('answer').oninput=changed;
for(const [id,delta]of [['previous',-1],['next',1]])$(id).onclick=async()=>{const oldStep=current().content.step;$('previous').disabled=true;$('next').disabled=true;try{capture();current().content.step=Math.max(0,Math.min(W.prompts[area].length-1,oldStep+delta));await saveStep();renderEditor();}catch(e){current().content.step=oldStep;renderEditor();message(e);}};
// Capture the old answer before changing steps; do not overwrite the new step with the old input.
async function saveStep(){$('answer').value=current().content.answers[current().content.step]||'';dirty=true;await save();}
$('save').onclick=()=>save().catch(message);
$('attachment').onchange=async()=>{const file=$('attachment').files[0];if(!file)return;const selected=area;try{
 if(current().content.files.length>=5)throw Error('Each draft can contain up to five attachments.');
 if(file.size>5*1024*1024)throw Error('Choose a file of at most 5 MB.');
 $('attachment').disabled=true;const form=new FormData();form.append('file',file);
 const r=await fetch('/api/student/files',{method:'POST',body:form}),data=await r.json();if(!r.ok)throw Error(data.error);
 state.files.push(data);drafts[selected].content.files.push(data.id);
 if(area===selected){changed();renderFiles();await save();}else{const d=drafts[selected];const result=await api('drafts/'+selected,{content:d.content,revision:d.revision},'PUT');d.revision=result.revision;}
 }catch(e){message(e);}finally{$('attachment').disabled=false;$('attachment').value='';}};
$('download').onclick=()=>{capture();const url=URL.createObjectURL(W.odt(area,current().content)),a=document.createElement('a');a.href=url;a.download=`KETSO-${area}.odt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('print').onclick=()=>{capture();$('printOutput').replaceChildren();for(const line of W.paragraphs(area,current().content)){const p=document.createElement('p');p.className='writing';p.textContent=line;$('printOutput').append(p);}window.print();};
$('submit').onclick=async()=>{try{if(area!=='question'&&!$('publicConsent').checked)throw Error('Please confirm public visibility, or save a private draft.');$('submit').disabled=true;const submittedArea=area;const consent=$('publicConsent').checked;await save();pendingSubmission||=crypto.randomUUID();await api('submit',{id:pendingSubmission,area:submittedArea,revision:drafts[submittedArea].revision,publish:consent,publicConsent:consent});pendingSubmission=null;message(area==='question'?'Question saved in the staff queue. Refresh answers to check for a response.':'Submitted work is now public.');await refreshSubmissions();}catch(e){message(e);}finally{$('submit').disabled=false;}};
function renderSubmissions(){$('submissions').replaceChildren();for(const s of state.submissions){const article=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=W.labels[s.area];p.textContent=(s.public?'Public':'Private')+' · '+new Date(s.created_at*1000).toLocaleString();article.append(h,p);for(const line of W.paragraphs(s.area,s.content).slice(1)){const p=document.createElement('p');p.className='writing';p.textContent=line;article.append(p);}for(const id of s.content.files){const a=document.createElement('a');a.href='/api/student/files/'+id;a.textContent=state.files.find(f=>f.id===id)?.name||'Download attachment';article.append(a,document.createElement('br'));}
 if(s.area==='question'){for(const line of [s.ai_answer||({pending:'AI guidance is pending.',unavailable:'AI guidance is not configured. Your question is in the staff queue.',failed:'AI could not provide an answer. The request may have been blocked or the service may be unavailable. Your question is saved for staff review; a prompt reply is not guaranteed.'}[s.ai_status]||'Awaiting guidance.'),s.staff_answer?'KETSO staff: '+s.staff_answer:'Awaiting staff review.']){const p=document.createElement('p');p.className='writing';p.textContent=line;article.append(p);}}
 const b=document.createElement('button');b.textContent=s.public?'Make private':'Publish this submission';b.onclick=async()=>{if(!s.public&&!confirm('Publish this submission, attached files, AI answer and any staff replies so anyone with your profile link can read them?'))return;try{await api('visibility',{id:s.id,publish:!s.public,publicConsent:true});await refreshSubmissions();}catch(e){message(e);}};article.append(b);$('submissions').append(article);}}
async function refreshSubmissions(){const latest=await api('me',undefined,'GET');state.submissions=latest.submissions;renderSubmissions();}
$('refresh').onclick=()=>refreshSubmissions().catch(message);
$('logout').onclick=async()=>{try{await save();await api('auth/logout',{});location.replace('/student-account/');}catch(e){message(e);}};
if($('linkForm'))$('linkForm').onsubmit=async e=>{e.preventDefault();try{await save();await api('link',{token:$('courseToken').value.trim()});$('courseToken').value='';await load();message('Your existing course profile is connected.');}catch(e){message(e);}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
if(!linkAction)load().catch(e=>{if(!/sign in/i.test(e.message))message(e);});

// Opaque delivery receipt is memory-only. It is not an account/session or reset token.
let emailReceipt=null;
async function checkEmailRequest(action){
 if(!emailReceipt)return;
 $('checkEmailDelivery').disabled=true;$('retryEmailDelivery').disabled=true;
 try{const data=await api('email/'+action,{receipt:emailReceipt});$('emailDeliveryStatus').textContent=data.message+(data.retry_after?' Retry cooldown: '+data.retry_after+' seconds.':'');$('retryEmailDelivery').disabled=!data.retry_allowed;}
 catch(e){$('emailDeliveryStatus').textContent=e.message;}
 finally{$('checkEmailDelivery').disabled=false;}
}
$('checkEmailDelivery').onclick=()=>checkEmailRequest('status');
$('retryEmailDelivery').onclick=()=>checkEmailRequest('retry');
