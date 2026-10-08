(()=>{
 const realFetch=window.fetch.bind(window);
 const keyName='eth_demo_installation_key';
 let key=localStorage.getItem(keyName);
 const ready=(async()=>{
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
  if(url.startsWith('/api/')&&!url.startsWith('/api/demo/')){
   await ready;const headers=new Headers(options.headers||{});
   headers.set('x-demo-key',key);
   return realFetch(input,{...options,headers});
  }
  return realFetch(input,options);
 };
 ready.catch(e=>{
  const show=()=>{const overlay=document.createElement('div');overlay.style='position:fixed;inset:0;background:#101d1b;color:white;display:grid;place-items:center;z-index:99999;font:18px system-ui;padding:28px;text-align:center';overlay.textContent=e.message;document.body.append(overlay);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
 });
})();