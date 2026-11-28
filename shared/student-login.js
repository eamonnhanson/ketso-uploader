(() => {
 const form=document.getElementById('studentLoginForm'),message=document.getElementById('studentLoginStatus');let timer;
 form.addEventListener('submit',async event=>{event.preventDefault();clearInterval(timer);const button=form.querySelector('button');button.disabled=true;
 try{const response=await fetch('/api/student/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,password:form.elements.password.value})});const data=await response.json();
 if(!response.ok){
  if(data.retry_after){const end=Date.now()+data.retry_after*1000;const show=()=>{const seconds=Math.max(0,Math.ceil((end-Date.now())/1000));message.textContent='Try again in '+seconds+' seconds. Password recovery remains available.';if(!seconds)clearInterval(timer);};show();timer=setInterval(show,1000);return;}
  throw Error((data.error||'Sign-in failed.')+(data.remaining_attempts!==undefined?' Remaining sign-in attempts: '+data.remaining_attempts+'.':''));
 }
 form.elements.password.value='';location.assign('/student-account/');
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
})();
