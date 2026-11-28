(()=>{
 const course=KetsoPortal.entries.find(x=>x.href===location.pathname);if(!course)return;
 const registry=KETSO_ACADEMY_COURSES[course.course];const list=document.getElementById('courseModules');
 for(const [id,title]of registry.lessons){const li=document.createElement('li');li.textContent=title;list.append(li);}
})();
