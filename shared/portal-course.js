(()=>{
 const course=KetsoPortal.entries.find(x=>x.href===location.pathname);if(!course)return;
 const registry=KETSO_ACADEMY_COURSES[course.course];const list=document.getElementById('courseModules');
 for(const [id,title]of registry.lessons){const li=document.createElement('li');li.textContent=title;list.append(li);}
 const section=document.createElement('section'),h=document.createElement('h2');h.textContent='Students who choose to share their profiles';section.append(h);document.querySelector('main').append(section);
 fetch('/api/student/portal/public-profiles?course='+encodeURIComponent(course.course),{cache:'no-store'}).then(r=>r.ok?r.json():{students:[]}).then(data=>{for(const s of data.students||[]){const card=document.createElement('article'),name=document.createElement('h3'),img=document.createElement('img');name.textContent=s.full_name;img.src='/api/student/portal/public-photo/'+encodeURIComponent(s.id);img.alt='Profile photograph of '+s.full_name;img.width=140;img.loading='lazy';card.append(name,img);section.append(card);}}).catch(()=>{});
})();
