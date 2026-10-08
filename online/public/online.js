(() => {
 const button=document.createElement('button');
 button.type='button'; button.className='online-signout';button.textContent='Sair do painel';
 button.onclick=async()=>{
  button.disabled=true;
  try{await fetch('/api/auth/logout',{method:'POST'});}finally{location.assign('/login.html');}
 };
 document.body.append(button);
})();
