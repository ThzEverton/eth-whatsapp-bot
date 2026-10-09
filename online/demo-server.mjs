import http from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extensionPackage} from '../monitor/extension-package.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const data=process.env.DEMO_DATA_DIR||path.join(root,'demo-runtime');
const permittedOrigin=(req)=>{try{const origin=new URL(req.headers.origin);const host=req.headers.host;return origin.origin==='https://'+host||origin.origin==='http://'+host||origin.hostname.endsWith('.vercel.app')&&origin.protocol==='https:';}catch{return false;}};
const ledger=path.join(data,'installations.json');
const sessions=new Map();
const adminAttempts=new Map();
const pairCodes=new Map();
const max=5;
const port=Number(process.env.PORT||10000);
const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(obj));};
let records=[];
await mkdir(data,{recursive:true,mode:0o700});
try{records=JSON.parse(await readFile(ledger,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!Array.isArray(records)||records.length>max)throw Error('Registro de instalacoes invalido');
function hash(secret){return createHash('sha256').update(secret).digest('hex');}
function authenticate(req){const token=req.headers['x-demo-key'];if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;const h=Buffer.from(hash(token),'hex');return records.find(r=>[r.hash,...(r.extensionHashes||[])].some(key=>{const saved=Buffer.from(key,'hex');return saved.length===h.length&&timingSafeEqual(saved,h);}))||null;}
let saveLock=Promise.resolve();
function save(){const task=saveLock.then(async()=>{const tmp=ledger+'.tmp';await writeFile(tmp,JSON.stringify(records),{mode:0o600});const {rename}=await import('node:fs/promises');await rename(tmp,ledger);});saveLock=task.then(()=>{},()=>{});return task;}
let allocationLock=Promise.resolve();
function allocate(){const task=allocationLock.then(async()=>{if(records.length>=max)return null;const secret=randomBytes(32).toString('hex'),id=randomBytes(12).toString('hex');records.push({id,hash:hash(secret),created:Date.now()});await save();return {secret,id};});allocationLock=task.then(()=>{},()=>{});return task;}
// Apenas eventos operacionais permitidos sao publicados no log geral.
// Nao encaminhe QR codes, mensagens de grupos nem credenciais do subprocesso.
const visibleBotEvents=new Set([
 'WhatsApp conectado',
 'WhatsApp desconectado; partidas canceladas',
 'Comando de jogo observado',
 'Comando de jogo ignorado',
 'Comando encaminhado ao motor de jogos',
 'Falha de envio/jogo',
 'Falha ao processar mensagem',
 'Não foi possível iniciar',
]);
function forwardOperationalLogs(stream){
 let pending='';
 stream.on('data',chunk=>{
  pending+=chunk.toString('utf8');
  if(pending.length>20000)pending=pending.slice(-20000);
  let index;
  while((index=pending.indexOf('\n'))!==-1){
   const line=pending.slice(0,index).trim();pending=pending.slice(index+1);
   if(!line.startsWith('{'))continue;
   try{
    const event=JSON.parse(line);
    if(!visibleBotEvents.has(event.msg))continue;
    console.log(JSON.stringify({
     source:'bot',event:event.msg,
     eventType:typeof event.eventType==='string'?event.eventType:undefined,
     fromMe:typeof event.fromMe==='boolean'?event.fromMe:undefined,
     ownerMatched:typeof event.ownerMatched==='boolean'?event.ownerMatched:undefined,
     reason:typeof event.reason==='string'?event.reason:undefined,
    }));
   }catch{}
  }
 });
}
async function ensureProcess(record){
 let s=sessions.get(record.id);
 if(s?.child&&!s.child.killed&&s.child.exitCode===null)return s;
 const dir=path.join(data,record.id);
 await mkdir(path.join(dir,'runtime'),{recursive:true,mode:0o700});
 const child=spawn(process.execPath,[path.join(root,'dist/index.js')],{
  cwd:dir,
  env:{...process.env,AUTH_DIR:path.join(dir,'auth'),CONFIG_FILE:path.join(dir,'runtime/config.json'),OWNER_JID:'',ALLOWED_GROUP_IDS:''},
  stdio:['ignore','pipe','pipe'],
 });
 s={child,dir};
 sessions.set(record.id,s);
 forwardOperationalLogs(child.stdout);
 let hasStderr=false;
 child.stderr.on('data',()=>{
  if(!hasStderr){hasStderr=true;console.warn('Processo do bot reportou erro interno; conteudo protegido nao foi publicado');}
 });
 child.on('error',error=>{console.error('Falha ao criar processo do bot:',error.code||'erro_desconhecido');});
 child.on('exit',(code,signal)=>{
  console.warn('Processo do bot encerrado:',JSON.stringify({code,signal}));
  if(sessions.get(record.id)===s){s.child=null;sessions.set(record.id,s);}
 });
 return s;
}
async function state(record,route,body){const s=await ensureProcess(record);let info;for(let i=0;i<24;i++){try{info=JSON.parse(await readFile(path.join(s.dir,'runtime/panel.json'),'utf8'));if(info.pid===s.child?.pid)break;}catch{}if(!s.child||s.child.exitCode!==null)break;await new Promise(r=>setTimeout(r,350));}if(!info||info.pid!==s.child?.pid)throw Error('Bot iniciando. Tente novamente.');
 const response=await fetch('http://127.0.0.1:'+info.port+'/'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+info.token,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(12000)});return {status:response.status,data:await response.json()};}
async function getBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw Error('Requisicao muito grande');}return raw;}
const staticFiles=new Map([['/','index.html'],['/index.html','index.html'],['/ui.css','ui.css'],['/monitor-ui.js','monitor-ui.js'],['/management.js','management.js'],['/legal-documents.json','legal-documents.json'],['/online.css','online.css'],['/demo-client.js','demo-client.js'],['/extension-link.js','extension-link.js']]);
const mime=f=>f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':'text/html';
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const route=url.pathname;
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(route==='/healthz')return json(res,200,{ok:true});
 if(route==='/extension.zip'&&req.method==='GET'){const zip=await extensionPackage();res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="eth-whatsapp-extension.zip"','Cache-Control':'no-store'}).end(zip);return;}
 if(route==='/admin'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(await readFile(path.join(root,'online/admin.html')));return;}
 if(route.startsWith('/api/admin/')){
  const secret=process.env.DEMO_ADMIN_SECRET||'';
  const given=req.headers['x-admin-secret']||'';
  const visitor=req.socket.remoteAddress||'desconhecido';
  const now=Date.now();
  const attempt=adminAttempts.get(visitor)||{failures:0,reset:now+60000};
  if(now>attempt.reset){attempt.failures=0;attempt.reset=now+60000;}
  if(attempt.failures>=5)return json(res,429,{error:'Muitas tentativas. Aguarde um minuto.'});
  const valid=secret.length>0&&typeof given==='string'&&timingSafeEqual(createHash('sha256').update(secret).digest(),createHash('sha256').update(given).digest());
  if(!valid){attempt.failures++;adminAttempts.set(visitor,attempt);return json(res,403,{error:'Acesso negado'});}
  adminAttempts.delete(visitor);
  if(route==='/api/admin/list'&&req.method==='GET')return json(res,200,{max,installations:records.map(r=>({id:r.id,created:r.created,running:!!sessions.get(r.id)?.child&&sessions.get(r.id).child.exitCode===null}))});
  if(route==='/api/admin/remove'&&req.method==='POST'){
   if(!permittedOrigin(req))return json(res,403,{error:'Origem invalida'});
   const payload=JSON.parse(await getBody(req));const id=payload.id;
   if(typeof id!=='string'||!/^[a-f0-9]{24}$/.test(id))return json(res,400,{error:'Identificador invalido'});
   const index=records.findIndex(r=>r.id===id);if(index<0)return json(res,404,{error:'Instalacao nao encontrada'});
   const current=sessions.get(id);if(current?.child){current.child.kill('SIGTERM');}
   sessions.delete(id);records.splice(index,1);await save();
   await rm(path.join(data,id),{recursive:true,force:true});
   return json(res,200,{ok:true,remaining:max-records.length});
  }
  return json(res,404,{error:'Nao encontrado'});
 }
 if(route==='/api/demo/link'&&req.method==='POST'){
  if(!permittedOrigin(req))return json(res,403,{error:'Origem invalida'});
  const account=authenticate(req);
  if(!account)return json(res,401,{error:'Instalacao nao reconhecida'});
  if((account.extensionHashes||[]).length>=5)return json(res,409,{error:'Limite de extensoes vinculadas atingido'});
  const code=randomBytes(12).toString('hex');
  const now=Date.now();
  for(const [value,item] of pairCodes)if(item.expires<now||item.id===account.id)pairCodes.delete(value);
  pairCodes.set(hash(code),{id:account.id,expires:now+300000});
  return json(res,201,{code,expiresIn:300});
 }
 if(route==='/api/demo/redeem'&&req.method==='POST'){
  const origin=req.headers.origin;
  if(origin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)&&!permittedOrigin(req))return json(res,403,{error:'Origem invalida'});
  const body=JSON.parse(await getBody(req));
  const code=typeof body.code==='string'?body.code.toLowerCase().replace(/[\s-]/g,''):'';
  if(!/^[a-f0-9]{24}$/.test(code))return json(res,400,{error:'Codigo invalido'});
  const entry=pairCodes.get(hash(code));
  if(!entry||entry.expires<Date.now())return json(res,404,{error:'Codigo expirado ou ja utilizado'});
  pairCodes.delete(hash(code));
  const account=records.find(r=>r.id===entry.id);
  if(!account)return json(res,404,{error:'Instalacao removida'});
  if((account.extensionHashes||[]).length>=5)return json(res,409,{error:'Limite de extensoes vinculadas atingido'});
  const secret=randomBytes(32).toString('hex');
  account.extensionHashes=[...(account.extensionHashes||[]),hash(secret)];
  await save();
  return json(res,201,{key:secret});
 }
 if(route==='/api/demo/unlink'&&req.method==='POST'){
  if(!permittedOrigin(req)&&!/^chrome-extension:\/\/[a-p]{32}$/.test(req.headers.origin||''))return json(res,403,{error:'Origem invalida'});
  const account=authenticate(req);
  if(!account)return json(res,401,{error:'Instalacao nao reconhecida'});
  const keyHash=hash(req.headers['x-demo-key']);
  if(!account.extensionHashes?.includes(keyHash))return json(res,403,{error:'Apenas vinculos da extensao podem ser removidos'});
  account.extensionHashes=account.extensionHashes.filter(h=>h!==keyHash);
  await save();
  return json(res,200,{ok:true});
 }
 if(route==='/api/demo/create'&&req.method==='POST'){
   if(!permittedOrigin(req))return json(res,403,{error:'Origem invalida'});
   const entry=await allocate();return entry?json(res,201,{key:entry.secret,remaining:max-records.length}):json(res,409,{error:'Vagas da demonstracao encerradas'});
 }
 if(route==='/api/demo/me')return json(res,200,{active:!!authenticate(req),remaining:max-records.length});
 if(route.startsWith('/api/')){
  const account=authenticate(req);if(!account)return json(res,401,{error:'Instalacao nao reconhecida'});
  if(route==='/api/status'){const result=await state(account,'state',null);const c=result.data.connection||{};return json(res,200,{running:true,connection:c.status==='connected'?'connected':'disconnected',groups:(result.data.chats||[]).filter(g=>g.group),events:[],errors:[],pid:result.data.pid});}
  if(!['/api/panel','/api/action','/api/bot'].includes(route))return json(res,404,{error:'Rota inexistente'});
  if(req.method!==(route==='/api/panel'?'GET':'POST'))return json(res,405,{error:'Metodo invalido'});
  if(route==='/api/bot')return json(res,400,{error:'Controle do processo desativado nesta demonstracao'});
  if(route==='/api/action'&&!permittedOrigin(req))return json(res,403,{error:'Origem invalida'});
  const result=await state(account,route==='/api/action'?'action':'state',route==='/api/action'?await getBody(req):null);
  return json(res,result.status,result.data);
 }
 if(req.method!=='GET')return json(res,405,{error:'Metodo invalido'});
 const file=staticFiles.get(route)||(/^\/assets\/[a-zA-Z0-9._-]+$/.test(route)?route.slice(1):null);if(!file)return json(res,404,{error:'Nao encontrado'});
 const buf=await readFile(path.join(root,'online/public',file));
 if(file==='index.html'){
  const html=buf.toString().replace('<head>','<head><script src="/demo-client.js"></script>').replace(/<script[^>]*online\.js[^>]*><\/script>/g,'').replace('</body>','<script src="/extension-link.js"></script></body>');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);return;
 }
 res.writeHead(200,{'Content-Type':mime(file)}).end(buf);
 }catch(e){console.error('Erro demo:',e.message);const temporary=String(e?.message||'').includes('Bot iniciando');json(res,503,{error:temporary?'O bot ainda esta iniciando. Aguarde alguns segundos e tente novamente.':'Sistema temporariamente indisponivel'});}
});
server.listen(port,'0.0.0.0',()=>console.log('Demo no ar porta '+port));
process.on('SIGTERM',()=>{for(const s of sessions.values())s.child?.kill('SIGTERM');server.close();});
