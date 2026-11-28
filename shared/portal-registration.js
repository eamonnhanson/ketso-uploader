(()=>{
 if((new URLSearchParams(location.search).has('token')||new URLSearchParams(location.search).has('programme'))){location.replace('/uploader/'+location.search+location.hash);return;}
 const $=id=>document.getElementById(id);
 for(const c of KetsoPortal.entries.filter(x=>x.course)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name='courses';input.value=c.course;label.append(input,document.createTextNode(' '+c.title));$('courseChoices').append(label);}
 // No competing profile store: keep data transient and do not submit until the canonical integration exists.
 fetch('/api/student/portal/capabilities',{cache:'no-store'}).then(r=>r.json()).then(data=>{$('registrationState').textContent=data.reason||'Registration is temporarily unavailable. You can browse courses or sign in.';}).catch(()=>{$('registrationState').textContent='Registration is temporarily unavailable. You can browse courses or sign in.';});
 $('centralRegistration').onsubmit=e=>{e.preventDefault();$('registrationState').textContent='Registration is temporarily unavailable. No account or enrolment was created.';};
 let image;
 function draw(){if(!image)return;const side=Math.min(image.width,image.height)/Number($('photoZoom').value),x=(image.width-side)*Number($('photoX').value),y=(image.height-side)*Number($('photoY').value);$('photoCanvas').getContext('2d').drawImage(image,x,y,side,side,0,0,600,600);}
 $('profilePhoto').onchange=async()=>{const f=$('profilePhoto').files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024){$('registrationState').textContent='Choose a JPG, PNG or WebP photograph up to 5 MB.';return;}const url=URL.createObjectURL(f);const next=new Image();next.onload=()=>{image=next;$('photoEditor').hidden=false;draw();URL.revokeObjectURL(url);};next.onerror=()=>{URL.revokeObjectURL(url);$('registrationState').textContent='This image could not be opened. Choose another photo.';};next.src=url;};
 $('adaptPhoto').onclick=()=>{$('cropControls').hidden=!$('cropControls').hidden;};for(const id of ['photoZoom','photoX','photoY'])$(id).oninput=draw;
})();
