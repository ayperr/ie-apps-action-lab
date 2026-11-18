import {createUpgradePolicyService} from '../server-lib/upgrade-policy.mjs';
import {labRequestAuthorization} from '../server-lib/lab-access.mjs';
const service=createUpgradePolicyService();
export const maxDuration=60;
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const send=result=>{res.statusCode=result.status;res.end(JSON.stringify(result.body));};
  try{
    if(req.method==='GET')return send(await service.read(new URL(req.url,'https://mint-revenue-lab.vercel.app').searchParams.get('departure')));
    if(req.method!=='POST')return send({status:405,body:{message:'Use GET or POST.'}});
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send({status:403,body:{message:'Origin not allowed.'}});
    if(!(req.headers['content-type']||'').startsWith('application/json'))return send({status:415,body:{message:'Use application/json.'}});
    let raw;
    if(req.body!==undefined)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
    else{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>8192)return send({status:413,body:{message:'Request too large.'}});chunks.push(c);}raw=Buffer.concat(chunks).toString('utf8');}
    if(Buffer.byteLength(raw)>8192)return send({status:413,body:{message:'Request too large.'}});
    let body;try{body=JSON.parse(raw);}catch{return send({status:400,body:{message:'Invalid JSON.'}});}
    return send(await service.submit(body,labRequestAuthorization(req,res)));
  }catch{return send({status:503,body:{message:'Scenario storage unavailable. Check the current value before retrying.'}});}
}

