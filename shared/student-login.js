(() => {
 const form=document.getElementById('studentLoginForm'),message=document.getElementById('studentLoginStatus');
 form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{const response=await fetch('/api/student/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,password:form.elements.password.value})});const data=await response.json();if(!response.ok)throw Error(data.error||'Sign-in failed.');form.elements.password.value='';location.assign('/student-account/');}
 catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
})();
