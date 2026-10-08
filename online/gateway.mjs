import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
const secret=process.env.BOT_GATEWAY_TOKEN;
if(!secret||secret.length<32)throw Error('Defina BOT_GATEWAY_TOKEN com pelo menos 32 caracteres');
const routes=new Set(['/api/status','/api/panel','/api/action','/api/bot']);
const port=Number(process.env.GATEWAY_PORT||3200);
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 const provided=req.headers.authorization?.replace(/^Bearer /,'')||'';
 const a=Buffer.from(provided),b=Buffer.from(secret);
 if(a.length!==b.length||!timingSafeEqual(a,b)){res.writeHead(401).end(JSON.stringify({error:'Nao autorizado'}));return}
 if(!routes.has(req.url)){res.writeHead(404).end('{}');return}
 const mutation=req.url==='/api/action'||req.url==='/api/bot';
 if(req.method!==(mutation?'POST':'GET')){res.writeHead(405).end('{}');return}
 try{
  let body='';
  if(mutation){for await(const chunk of req){body+=chunk;if(body.length>20000){res.writeHead(413).end('{}');return}}}
  const target=await fetch('http://127.0.0.1:3100'+req.url,{method:req.method,headers:{Origin:'http://127.0.0.1:3100','Content-Type':'application/json'},body:mutation?body:undefined,signal:AbortSignal.timeout(18000)});
  res.writeHead(target.status).end(await target.text());
 }catch{res.writeHead(502).end(JSON.stringify({error:'Monitor local indisponivel'}))}
}).listen(port,'127.0.0.1',()=>console.log('Gateway local ativo na porta '+port));
