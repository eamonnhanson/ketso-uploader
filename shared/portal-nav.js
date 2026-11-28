(()=>{
 const R=KetsoPortal,home=location.pathname==='/'||location.pathname==='/index.html';
 const host=document.querySelector('[data-portal-nav]');if(!host)return;
 const header=document.createElement('header');header.className='portal-header';
 const logo=document.createElement('a');logo.href='/';logo.setAttribute('aria-label','KETSO Academy home');
 const img=document.createElement('img');img.src=R.logo;img.alt='KETSO Academy';img.className='portal-logo';img.width=180;
 // Never replace the approved logo with generated artwork.
 logo.append(img);header.append(logo);host.append(header);
 const nav=document.createElement('nav');nav.setAttribute('aria-label',home?'Academy destinations':'Academy tabs');nav.className=home?'portal-grid':'portal-tabs';
 for(const item of R.entries){const a=document.createElement('a');a.href=item.href;a.dataset.id=item.id;a.style.setProperty('--tab-color',item.color);a.className='portal-destination';if(location.pathname===item.href)a.setAttribute('aria-current','page');const title=document.createElement('strong');title.textContent=item.title;a.append(title);if(home){const text=document.createElement('span');text.textContent=item.description;a.append(text);}nav.append(a);}
 (document.querySelector('[data-primary-navigation]')||host).append(nav);
 for(const a of document.querySelectorAll('[data-extra-course]'))a.href=R.extraCourse;
})();
