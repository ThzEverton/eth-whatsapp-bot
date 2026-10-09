import http from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const data=process.env.DEMO_DATA_DIR||path.join(root,'demo-runtime');
const permittedOrigin=(req)=>{try{const origin=new URL(req.headers.origin);const host=req.headers.host;return origin.origin==='https://'+host||origin.origin==='http://'+host||origin.hostname.endsWith('.vercel.app')&&origin.protocol==='https:';}catch{return false;}};
const ledger=path.join(data,'installations.json');
const sessions=new Map();
const max=5;
const port=Number(process.env.PORT||10000);
const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(obj));};
let records=[];
await mkdir(data,{recursive:true,mode:0o700});
try{records=JSON.parse(await readFile(ledger,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!Array.isArray(records)||records.length>max)throw Error('Registro de instalacoes invalido');
function hash(secret){return createHash('sha256').update(secret).digest('hex');}
function authenticate(req){const token=req.headers['x-demo-key'];if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;const h=Buffer.from(hash(token),'hex');return records.find(r=>{const saved=Buffer.from(r.hash,'hex');return saved.length===h.length&&timingSafeEqual(saved,h);})||null;}
async function save(){const tmp=ledger+'.tmp';await writeFile(tmp,JSON.stringify(records),{mode:0o600});const {rename}=await import('node:fs/promises');await rename(tmp,ledger);}
let allocationLock=Promise.resolve();
function allocate(){const task=allocationLock.then(async()=>{if(records.length>=max)return null;const secret=randomBytes(32).toString('hex'),id=randomBytes(12).toString('hex');records.push({id,hash:hash(secret),created:Date.now()});await save();return {secret,id};});allocationLock=task.then(()=>{},()=>{});return task;}
async function ensureProcess(record){let s=sessions.get(record.id);if(s?.child&&!s.child.killed&&s.child.exitCode===null)return s;const dir=path.join(data,record.id);await mkdir(path.join(dir,'runtime'),{recursive:true,mode:0o700});const child=spawn(process.execPath,[path.join(root,'dist/index.js')],{cwd:dir,env:{...process.env,AUTH_DIR:path.join(dir,'auth'),CONFIG_FILE:path.join(dir,'runtime/config.json'),OWNER_JID:'',ALLOWED_GROUP_IDS:''},stdio:'ignore'});s={child,dir};sessions.set(record.id,s);child.on('exit',()=>{if(sessions.get(record.id)===s){s.child=null;sessions.set(record.id,s);}});return s;}
async function state(record,route,body){const s=await ensureProcess(record);let info;for(let i=0;i<12;i++){try{info=JSON.parse(await readFile(path.join(s.dir,'runtime/panel.json'),'utf8'));if(info.pid===s.child?.pid)break;}catch{}await new Promise(r=>setTimeout(r,250));}if(!info||info.pid!==s.child?.pid)throw Error('Bot iniciando. Tente novamente.');
 const response=await fetch('http://127.0.0.1:'+info.port+'/'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+info.token,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(12000)});return {status:response.status,data:await response.json()};}
async function getBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw Error('Requisicao muito grande');}return raw;}
const staticFiles=new Map([['/','index.html'],['/index.html','index.html'],['/ui.css','ui.css'],['/monitor-ui.js','monitor-ui.js'],['/management.js','management.js'],['/legal-documents.json','legal-documents.json'],['/online.css','online.css'],['/demo-client.js','demo-client.js']]);
const mime=f=>f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':'text/html';
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const route=url.pathname;
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(route==='/healthz')return json(res,200,{ok:true});
 if(route==='/admin'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(await readFile(path.join(root,'online/admin.html')));return;}
 if(route.startsWith('/api/admin/')){
  const secret=process.env.DEMO_ADMIN_SECRET||'';
  const given=req.headers['x-admin-secret']||'';
  if(secret.length<32||typeof given!=='string'||Buffer.byteLength(given)!==Buffer.byteLength(secret)||!timingSafeEqual(Buffer.from(given),Buffer.from(secret)))return json(res,403,{error:'Acesso negado'});
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
  const html=buf.toString().replace('<head>','<head><script src="/demo-client.js"></script>').replace(/<script[^>]*online\.js[^>]*><\/script>/g,'');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);return;
 }
 res.writeHead(200,{'Content-Type':mime(file)}).end(buf);
 }catch(e){console.error('Erro demo:',e.message);json(res,503,{error:'Sistema temporariamente indisponivel'});}
});
server.listen(port,'0.0.0.0',()=>console.log('Demo no ar porta '+port));
process.on('SIGTERM',()=>{for(const s of sessions.values())s.child?.kill('SIGTERM');server.close();});
