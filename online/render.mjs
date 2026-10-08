import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const required=['BOT_GATEWAY_TOKEN','OWNER_JID','AUTH_DIR','CONFIG_FILE'];
for(const name of required)if(!process.env[name])throw Error('Variavel obrigatoria ausente: '+name);
if(process.env.BOT_GATEWAY_TOKEN.length<32)throw Error('BOT_GATEWAY_TOKEN deve ter no minimo 32 caracteres');
const env={...process.env,GATEWAY_HOST:'0.0.0.0',GATEWAY_PORT:process.env.PORT||'10000'};
const children=new Set();
let stopping=false;
function launch(name,args){const child=spawn(process.execPath,args,{cwd:process.cwd(),env,stdio:'inherit'});children.add(child);child.on('exit',(code,signal)=>{children.delete(child);if(!stopping){console.error(name+' encerrou: '+code+'/'+signal);shutdown(1)}});return child}
function shutdown(code){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');delay(5000).then(()=>process.exit(code));}
process.on('SIGTERM',()=>shutdown(0));process.on('SIGINT',()=>shutdown(0));
launch('monitor',['monitor/server.mjs']);
launch('gateway',['online/gateway.mjs']);
