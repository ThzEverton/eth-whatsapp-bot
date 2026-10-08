import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'eth-demo-test-'));
const port=19874;
const child=spawn(process.execPath,['online/demo-server.mjs'],{env:{...process.env,PORT:String(port),DEMO_DATA_DIR:dir},stdio:'pipe'});
const origin='http://localhost:'+port;
try{
 let ready=false;
 for(let n=0;n<40;n++){try{const r=await fetch(origin+'/healthz');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,150))}
 assert.equal(ready,true,'HTTP startup');
 const keys=[];
 const attempts=await Promise.all(Array.from({length:7},()=>fetch(origin+'/api/demo/create',{method:'POST',headers:{Origin:origin}})));
 for(const r of attempts)if(r.status===201)keys.push((await r.json()).key);
 assert.equal(keys.length,5,'exact five slots, including concurrent requests');
 assert.equal(attempts.filter(r=>r.status===409).length,2,'capacity blocked');
 const me=await fetch(origin+'/api/demo/me',{headers:{'x-demo-key':keys[0]}});
 assert.equal((await me.json()).active,true);
 const invalid=await fetch(origin+'/api/demo/me',{headers:{'x-demo-key':'f'.repeat(64)}});
 assert.equal((await invalid.json()).active,false);
 const forbidden=await fetch(origin+'/api/panel');
 assert.equal(forbidden.status,401);
 const page=await fetch(origin+'/');assert.equal(page.status,200);assert.match(await page.text(),/demo-client.js/);
 console.log('PASSOU: 5 vagas, concorrencia, chaves independentes, acesso sem chave bloqueado, pagina');
}finally{child.kill('SIGTERM');await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
