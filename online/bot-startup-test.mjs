import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir=await mkdtemp(path.join(tmpdir(),'eth-bot-startup-'));
const child=spawn(process.execPath,[path.resolve('dist/index.js')],{
 cwd:dir,
 env:{...process.env,AUTH_DIR:path.join(dir,'auth'),CONFIG_FILE:path.join(dir,'runtime/config.json'),OWNER_JID:'',ALLOWED_GROUP_IDS:''},
 stdio:['ignore','pipe','pipe'],
});
child.stdout.resume();child.stderr.resume();
let exitCode=null;
child.once('exit',code=>{exitCode=code;});
try{
 let info;
 for(let i=0;i<65;i++){
  try{
   info=JSON.parse(await readFile(path.join(dir,'runtime/panel.json'),'utf8'));
   if(info.pid===child.pid)break;
  }catch{}
  if(exitCode!==null)throw Error('Processo encerrado antes do painel iniciar');
  await new Promise(r=>setTimeout(r,200));
 }
 assert.ok(info&&info.pid===child.pid,'Painel interno iniciou no diretorio isolado');
 const response=await fetch('http://127.0.0.1:'+info.port+'/state',{headers:{Authorization:'Bearer '+info.token},signal:AbortSignal.timeout(5000)});
 assert.equal(response.status,200,'API do processo WhatsApp respondeu');
 const result=await response.json();
 assert.equal(result.pid,child.pid);
 assert.ok(result.connection&&typeof result.connection.status==='string');
 assert.ok(Array.isArray(result.chats));
 console.log('PASSOU: subprocesso isolado, painel interno, conexao em inicializacao e API acessivel');
}finally{
 if(child.exitCode===null)child.kill('SIGTERM');
 await new Promise(r=>setTimeout(r,650));
 await rm(dir,{recursive:true,force:true,maxRetries:8,retryDelay:150});
}
