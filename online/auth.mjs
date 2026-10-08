const enc=new TextEncoder();
function b64u(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromB64u(input){const raw=atob(input.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function hmac(value,secret){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64u(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))))}
export async function issue(secret){const payload=b64u(enc.encode(JSON.stringify({exp:Date.now()+8*60*60*1000,v:1})));return payload+'.'+await hmac(payload,secret)}
export async function valid(token,secret){if(!token||!secret||token.length>2000)return false;const parts=token.split('.');if(parts.length!==2)return false;try{const expected=await hmac(parts[0],secret);if(expected.length!==parts[1].length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^parts[1].charCodeAt(i);if(diff)return false;const p=JSON.parse(new TextDecoder().decode(fromB64u(parts[0])));return p.v===1&&Number.isFinite(p.exp)&&p.exp>Date.now()}catch{return false}}
export function cookie(req){return /(?:^|; )eth_session=([^;]*)/.exec(req.headers.get('cookie')||'')?.[1]||''}
