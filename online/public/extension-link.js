(()=>{
 document.addEventListener('DOMContentLoaded',()=>{
  const dialog=document.getElementById('extension-install');
  const button=document.getElementById('install-extension');
  if(!dialog||!button)return;
  const text=dialog.querySelector('p');
  if(text)text.textContent='Instale a extensao e vincule a mesma instalacao que voce ja usa no site. O vinculo nao ocupa outra vaga.';
  const link=dialog.querySelector('a.download-button');
  if(link){link.href='/extension.zip';link.download='eth-whatsapp-extension.zip';}
  const list=dialog.querySelector('ol');
  if(list)list.innerHTML='<li>Baixe a extensao e extraia o ZIP.</li><li>Abra <code>chrome://extensions</code>, ative o Modo do desenvolvedor e selecione <strong>Carregar sem compactacao</strong>, escolhendo a pasta <code>extension</code>.</li><li>Clique em <strong>Gerar codigo para extensao</strong> abaixo. Copie o codigo e cole na extensao quando abrir seu painel lateral.</li><li>Pronto! Ela usara a sua instalacao online, sem criar outra vaga.</li>';
  const pane=document.createElement('section');
  pane.style='padding:16px 0;display:grid;gap:10px';
  const generate=document.createElement('button');
  generate.type='button';generate.className='primary';
  generate.textContent='Gerar codigo para extensao';
  const code=document.createElement('output');
  code.style='display:block;word-break:break-all;font:600 17px ui-monospace,monospace;letter-spacing:.05em;user-select:all';
  code.setAttribute('aria-live','polite');
  const copy=document.createElement('button');
  copy.type='button';copy.textContent='Copiar codigo';copy.hidden=true;
  const status=document.createElement('p');
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  pane.append(generate,code,copy,status);
  const controls=dialog.querySelector('.controls');
  if(controls)controls.before(pane);else dialog.append(pane);
  generate.addEventListener('click',async()=>{
   generate.disabled=true;status.textContent='Preparando codigo...';
   copy.hidden=true;code.textContent='';
   try{
    const key=localStorage.getItem('eth_demo_installation_key');
    if(!key)throw Error('A instalacao nao esta pronta. Recarregue o site.');
    const response=await fetch('/api/demo/link',{method:'POST',headers:{'x-demo-key':key}});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Nao foi possivel gerar o codigo');
    code.textContent=data.code.match(/.{1,4}/g).join('-');
    status.textContent='Codigo valido por 5 minutos e para uma unica vinculacao. Nao compartilhe com outras pessoas.';
    copy.hidden=false;
   }catch(e){status.textContent=e.message;}
   finally{generate.disabled=false;}
  });
  copy.addEventListener('click',async()=>{
   try{
    await navigator.clipboard.writeText(code.textContent);
    status.textContent='Codigo copiado. Cole na extensao do Chrome.';
   }catch{status.textContent='Selecione e copie o codigo exibido acima.';}
  });
 });
})();