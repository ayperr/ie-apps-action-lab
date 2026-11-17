import {createMintEmailService} from '../server-lib/mint-email.mjs';
export const maxDuration=60;
const service=createMintEmailService();
export default async function handler(req,res){
  const reply=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Mint-Email-Version','1.1.0');
  try{
    if(req.method==='GET'){const r=service.status(req.headers.authorization);return reply(r.status,r.body);}
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return reply(405,{state:'rejected',message:'Use GET or POST.'});}
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reply(403,{state:'rejected',message:'Origin not allowed.'});
    if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return reply(415,{state:'rejected',message:'Use application/json.'});
    let raw;
    if(req.body!==undefined)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
    else{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)return reply(413,{state:'rejected',message:'Request too large.'});chunks.push(chunk);}raw=Buffer.concat(chunks).toString('utf8');}
    if(Buffer.byteLength(raw)>16384)return reply(413,{state:'rejected',message:'Request too large.'});
    let body;try{body=JSON.parse(raw);}catch{return reply(400,{state:'rejected',message:'Invalid JSON.'});}
    const r=await service.submit(body,req.headers.authorization);return reply(r.status,r.body);
  }catch{return reply(503,{state:'unavailable',message:'The email service could not complete this request. Check the existing result before retrying a send.'});}
}