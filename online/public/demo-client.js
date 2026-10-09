(()=>{
 const realFetch=window.fetch.bind(window);
 const keyName='eth_demo_installation_key';
 const framed=window.parent!==window&&window.location.hash==='#eth-extension';
 let key=framed?null:localStorage.getItem(keyName);

 const ready=framed?new Promise((resolve,reject)=>{
  const receive=async(event)=>{
   if(event.source!==window.parent||!/^chrome-extension:\/\/[a-p]{32}$/.test(event.origin)||event.data?.type!=='eth-demo-extension-key')return;
   const received=event.data.key;
   if(typeof received!=='string'||!/^[a-f0-9]{64}$/.test(received)){reject(Error('Vinculo da extensao invalido'));return;}
   window.removeEventListener('message',receive);
   try{
    const response=await realFetch('/api/demo/me',{headers:{'x-demo-key':received}});
    if(!response.ok||!(await response.json()).active)throw Error('Vinculo expirado. Vincule novamente a extensao.');
    key=received;
    resolve(key);
   }catch(error){reject(error);}
  };
  window.addEventListener('message',receive);
  window.parent.postMessage({type:'eth-demo-frame-ready'},'*');
 }):(async()=>{
  if(key){
   const check=await realFetch('/api/demo/me',{headers:{'x-demo-key':key}});
   if(check.ok&&(await check.json()).active)return key;
   localStorage.removeItem(keyName);key=null;
  }
  const created=await realFetch('/api/demo/create',{method:'POST'});
  const data=await created.json();
  if(!created.ok)throw Error(data.error||'Nao foi possivel iniciar a demonstracao');
  key=data.key;localStorage.setItem(keyName,key);return key;
 })();

 window.fetch=async(input,options={})=>{
  const url=typeof input==='string'?input:input instanceof URL?input.pathname:input.url;
  const pathname=url.startsWith(location.origin)?new URL(url).pathname:url;
  if(pathname.startsWith('/api/')&&!pathname.startsWith('/api/demo/')){
   await ready;
   const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined)||{});
   headers.set('x-demo-key',key);
   return realFetch(input,{...options,headers});
  }
  return realFetch(input,options);
 };
 if(framed)document.addEventListener('DOMContentLoaded',()=>document.body.classList.add('compact'));
 ready.catch(e=>{
  const show=()=>{
   const overlay=document.createElement('div');
   overlay.style='position:fixed;inset:0;background:#101d1b;color:white;display:grid;place-items:center;z-index:99999;font:16px system-ui;padding:28px;text-align:center';
   overlay.textContent=e.message;
   document.body.append(overlay);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
 });
})();