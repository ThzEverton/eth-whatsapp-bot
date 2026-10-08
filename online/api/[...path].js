import {issue,valid,cookie} from '../auth.mjs';
const allowed=new Set(['status','panel','action','bot']);
const respond=(res,status,data)=>res.status(status).setHeader('Cache-Control','no-store').json(data);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const parts=Array.isArray(req.query.path)?req.query.path:[req.query.path];
 const route=parts.join('/');
 if(route==='auth/login'){
  if(req.method!=='POST')return respond(res,405,{error:'Metodo invalido'});
  if(!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET)return respond(res,503,{error:'Autenticacao nao configurada'});
  const {password}=typeof req.body==='object'&&req.body?req.body:{};
  const expected=Buffer.from(process.env.ADMIN_PASSWORD);
  const supplied=Buffer.from(typeof password==='string'?password:'');
  const {timingSafeEqual}=await import('node:crypto');
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return respond(res,401,{error:'Credenciais invalidas'});
  const token=await issue(process.env.SESSION_SECRET);
  res.setHeader('Set-Cookie',`eth_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
  return respond(res,200,{ok:true});
 }
 if(route==='auth/logout'){
  if(req.method!=='POST')return respond(res,405,{error:'Metodo invalido'});
  res.setHeader('Set-Cookie','eth_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  return respond(res,200,{ok:true});
 }
 if(!await valid(cookie({headers:{get:k=>req.headers[k]||''}}),process.env.SESSION_SECRET||''))return respond(res,401,{error:'Autenticacao necessaria'});
 if(!allowed.has(route))return respond(res,404,{error:'Rota nao encontrada'});
 if(req.method!==(route==='action'||route==='bot'?'POST':'GET'))return respond(res,405,{error:'Metodo invalido'});
 if(!process.env.BOT_GATEWAY_URL||!process.env.BOT_GATEWAY_TOKEN)return respond(res,503,{error:'Gateway nao configurado'});
 if(!/^https:\/\//.test(process.env.BOT_GATEWAY_URL))return respond(res,503,{error:'Gateway deve utilizar HTTPS'});
 if((route==='action'||route==='bot')&&req.headers.origin!==`https://${req.headers.host}`)return respond(res,403,{error:'Origem invalida'});
 const body=req.method==='POST'?JSON.stringify(req.body||{}):undefined;
 if(body?.length>20000)return respond(res,413,{error:'Solicitacao muito grande'});
 try{
  const r=await fetch(process.env.BOT_GATEWAY_URL.replace(/\/$/,'')+'/api/'+route,{method:req.method,headers:{Authorization:'Bearer '+process.env.BOT_GATEWAY_TOKEN,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(18000),cache:'no-store'});
  const content=await r.text();
  res.status(r.status).setHeader('Content-Type','application/json; charset=utf-8').send(content);
 }catch{return respond(res,502,{error:'Servidor do bot indisponivel'});}
}
