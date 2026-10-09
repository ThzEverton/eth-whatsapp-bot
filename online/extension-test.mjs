import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile('extension/sidepanel.html','utf8');
const script=await readFile('extension/sidepanel.js','utf8');
const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
assert.ok(manifest.host_permissions.includes('https://eth-whatsapp-bot.onrender.com/*'));
assert.ok(manifest.host_permissions.includes('http://localhost:3100/*'));
assert.ok(manifest.permissions.includes('storage'));

const dom=new JSDOM(html,{url:'chrome-extension://'+'a'.repeat(32)+'/sidepanel.html',runScripts:'outside-only'});
const {window}=dom,{document}=window;
window.AbortSignal=AbortSignal;
const values={},calls=[];
window.chrome={storage:{local:{
 get:async()=>({...values}),
 set:async(data)=>Object.assign(values,data),
 remove:async(name)=>{delete values[name];},
}}};
window.confirm=()=>true;
const extensionKey='a'.repeat(64);
window.fetch=async(url,options={})=>{
 calls.push({url,options});
 if(url.endsWith('/api/demo/redeem'))return Response.json({key:extensionKey},{status:201});
 if(url.endsWith('/api/demo/me'))return Response.json({active:true,remaining:4});
 if(url.endsWith('/api/demo/unlink'))return Response.json({ok:true});
 if(url.endsWith('/api/status'))return Response.json({running:true});
 throw Error('Unexpected URL '+url);
};
window.eval(script);
const tick=()=>new Promise(resolve=>setTimeout(resolve,40));
await tick();
assert.equal(document.getElementById('setup').hidden,false);
document.getElementById('pair-code').value='abcd-efgh';
document.getElementById('pair-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
await tick();
assert.equal(values.ethDemoExtensionKey,extensionKey);
assert.equal(document.getElementById('active').hidden,false);
assert.equal(document.getElementById('manager').src,'https://eth-whatsapp-bot.onrender.com/#eth-extension');
const frame=document.getElementById('manager').contentWindow;
const posted=[];
frame.postMessage=(payload,destination)=>posted.push({payload,destination});
window.dispatchEvent(new window.MessageEvent('message',{source:frame,origin:'https://eth-whatsapp-bot.onrender.com',data:{type:'eth-demo-frame-ready'}}));
assert.equal(posted[0].payload.key,extensionKey);
assert.equal(posted[0].destination,'https://eth-whatsapp-bot.onrender.com');
document.getElementById('mode-local').click();
await tick();
assert.equal(values.ethPanelMode,'local');
assert.equal(document.getElementById('manager').src,'http://localhost:3100/sidebar');
document.getElementById('mode-online').click();
await tick();
assert.equal(values.ethPanelMode,'online');
assert.equal(document.getElementById('manager').src,'https://eth-whatsapp-bot.onrender.com/#eth-extension');
document.getElementById('unlink').click();
await tick();
assert.equal(values.ethDemoExtensionKey,undefined);
assert.equal(document.getElementById('setup').hidden,false);
assert.equal(calls.some(call=>call.url.endsWith('/api/demo/create')),false,'extension never consumes a new installation');
dom.window.close();
console.log('PASSOU: extensao online, vinculo, mensagem segura, modo local, retorno online, desvinculacao; sem criar nova vaga');
