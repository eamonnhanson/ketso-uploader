(async()=>{
 const id=new URLSearchParams(location.search).get('student_id');if(!id)return;
 const host=document.getElementById('studentSubmittedWork');
 try{const r=await fetch('/api/student/public/'+encodeURIComponent(id),{cache:'no-store'});if(r.status===404||r.status===503)return;if(!r.ok)throw Error();const data=await r.json();
 const title=document.createElement('h2');title.textContent=`${data.account.name} — submitted work`;host.append(title);
 if(!data.submissions.length){const p=document.createElement('p');p.textContent='No publicly submitted work yet.';host.append(p);}
 for(const s of data.submissions){const card=document.createElement('article');card.className='upload-card';const h=document.createElement('h3');h.textContent=KetsoWriting.labels[s.area];card.append(h);
 for(const line of KetsoWriting.paragraphs(s.area,s.content).slice(1)){const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=line;card.append(p);}
 for(const id of s.content.files){const a=document.createElement('a');a.href='/api/student/files/'+encodeURIComponent(id);a.textContent='Uploaded attachment: '+(s.attachments?.find(f=>f.id===id)?.name||'Attachment');card.append(a,document.createElement('br'));}
 for(const [label,value]of [['AI guidance (awaiting or subject to staff review)',s.ai_answer],['KETSO staff',s.staff_answer]])if(value){const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=label+': '+value;card.append(p);}host.append(card);}
 }catch{host.textContent='Submitted work could not be loaded. Please try again.';}
})();
