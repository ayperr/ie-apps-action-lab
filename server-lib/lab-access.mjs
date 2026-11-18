import {createHmac,timingSafeEqual} from 'node:crypto';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const signature=(value,key)=>createHmac('sha256',key).update('mint-lab-session:'+value).digest('hex');
export function labRequestAuthorization(req,res,{env=process.env,now=Date.now(),issueSession=false}={}){
  const key=env.LAB_ACCESS_KEY;
  if(typeof key!=='string'||key.length<32||key.length>256)return '';
  const direct=req.headers.authorization;
  if(typeof direct==='string'&&same(direct,'Bearer '+key)){
    if(issueSession){const expires=String(Math.floor(now/1000)+3600);res.setHeader('Set-Cookie',`mint_lab_session=${expires}.${signature(expires,key)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`);}
    return direct;
  }
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('mint_lab_session='))?.slice('mint_lab_session='.length);
  const match=/^(\d{10})\.([a-f0-9]{64})$/.exec(token||'');
  if(!match)return '';
  const seconds=Math.floor(now/1000),expires=Number(match[1]);
  return expires>seconds&&expires<=seconds+3600&&same(match[2],signature(match[1],key))?'Bearer '+key:'';
}
export function clearLabSession(res){res.setHeader('Set-Cookie','mint_lab_session=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0');}

