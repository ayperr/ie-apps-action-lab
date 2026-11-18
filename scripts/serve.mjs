import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import emailHandler from '../api/mint-email.js';
import policyHandler from '../api/upgrade-policy.js';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const envFile=fileURLToPath(new URL('../.env.local',import.meta.url));
if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
  const i=line.indexOf('=');if(i>0&&!line.startsWith('#'))process.env[line.slice(0,i)]=line.slice(i+1);
}
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/mint-email'){await emailHandler(req,res);return;}
  if(url.pathname==='/api/upgrade-policy'){await policyHandler(req,res);return;}
  if(url.pathname==='/api/config'){
    const config={url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY};
    res.writeHead(config.url&&config.publishableKey?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(config.url&&config.publishableKey?config:{error:'Supabase configuration is not available.'}));return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Mint Revenue Lab: http://127.0.0.1:4173'));

