import {mkdir,cp,readFile,writeFile,access} from 'node:fs/promises';
const base=new URL('../monitor/',import.meta.url);
const out=new URL('./public/',import.meta.url);
await mkdir(new URL('./assets/',out),{recursive:true});
try{
 await access(new URL('index.html',base));
 for(const file of ['index.html','ui.css','monitor-ui.js','management.js','legal-documents.json'])await cp(new URL(file,base),new URL(file,out));
 await cp(new URL('assets/',base),new URL('assets/',out),{recursive:true});
 console.log('Dashboard sincronizado da pasta monitor.');
}catch{
 console.log('Usando o snapshot versionado em online/public (build isolada da Vercel).');
}
let html=await readFile(new URL('index.html',out),'utf8');
if(!html.includes('window.ETH_ONLINE=true'))html=html.replace('<body>','<body><script>window.ETH_ONLINE=true</script>');
if(!html.includes('href="/online.css"'))html=html.replace('</head>','<link rel="stylesheet" href="/online.css"></head>');
if(!html.includes('src="/online.js"'))html=html.replace('</body>','<script src="/online.js"></script></body>');
await writeFile(new URL('index.html',out),html);
console.log('Dashboard online pronto.');
