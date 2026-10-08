import {valid,cookie} from './auth.mjs';
export const config={matcher:['/((?!_vercel).*)']};
export default async function middleware(req){
 const path=new URL(req.url).pathname;
 if(path==='/login' || path==='/login.html' || path==='/api/auth/login' || path==='/api/auth/logout')return;
 if(!process.env.SESSION_SECRET)return new Response('Servidor nao configurado',{status:503});
 if(await valid(cookie(req),process.env.SESSION_SECRET))return;
 if(path.startsWith('/api/'))return new Response(JSON.stringify({error:'Autenticacao necessaria'}),{status:401,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return Response.redirect(new URL('/login.html',req.url),302);
}
