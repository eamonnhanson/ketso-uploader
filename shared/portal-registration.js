(()=>{
 if((new URLSearchParams(location.search).has('token')||new URLSearchParams(location.search).has('programme'))){location.replace('/uploader/'+location.search+location.hash);return;}
 const $=id=>document.getElementById(id);
 for(const c of KetsoPortal.entries.filter(x=>x.course)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name='courses';input.value=c.course;label.append(input,document.createTextNode(' '+c.title));$('courseChoices').append(label);}
 let available=false;
 fetch('/api/student/portal/capabilities',{cache:'no-store'}).then(r=>r.json()).then(data=>{available=data.registration_available===true;$('registerAcademy').disabled=!available;$('registrationState').textContent=available?'Verify your email, sign in, then confirm your enrolment in My profile.':data.reason;}).catch(()=>{$('registrationState').textContent='Registration is temporarily unavailable. You can browse courses or sign in.';});
 $('centralRegistration').onsubmit=async e=>{
  e.preventDefault();if(!available){$('registrationState').textContent='Registration is temporarily unavailable. No account or enrolment was created.';return;}
  $('registerAcademy').disabled=true;
  try{
   const f=new FormData(e.target),r=await fetch('/api/student/portal/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.get('name'),email:f.get('email'),password:f.get('password'),courses:f.getAll('courses'),publicProfileConsent:f.has('publicProfileConsent'),profilePhoto:$('photoCanvas').toDataURL('image/jpeg',.8)})}),data=await r.json();
   if(!r.ok)throw Error(data.error||'Registration could not complete.');
   $('registrationState').textContent=data.message+' After verification, sign in and choose Complete Academy registration. Existing accounts should sign in.';
   e.target.elements.password.value='';
  }catch(error){$('registrationState').textContent=error.message;}finally{$('registerAcademy').disabled=!available;}
 };
 let image;
 function draw(){if(!image)return;const side=Math.min(image.width,image.height)/Number($('photoZoom').value),x=(image.width-side)*Number($('photoX').value),y=(image.height-side)*Number($('photoY').value);$('photoCanvas').getContext('2d').drawImage(image,x,y,side,side,0,0,600,600);}
 $('profilePhoto').onchange=async()=>{const f=$('profilePhoto').files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024){$('registrationState').textContent='Choose a JPG, PNG or WebP photograph up to 5 MB.';return;}const url=URL.createObjectURL(f);const next=new Image();next.onload=()=>{image=next;$('photoEditor').hidden=false;draw();URL.revokeObjectURL(url);};next.onerror=()=>{URL.revokeObjectURL(url);$('registrationState').textContent='This image could not be opened. Choose another photo.';};next.src=url;};
 $('adaptPhoto').onclick=()=>{$('cropControls').hidden=!$('cropControls').hidden;};for(const id of ['photoZoom','photoX','photoY'])$(id).oninput=draw;
})();
