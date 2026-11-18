import {createHash,timingSafeEqual} from 'node:crypto';
import {createWorlds,evaluate,SEED} from '../public/model.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const reply=(status,state,message,extra={})=>({status,body:{state,message,...extra}});
const idPattern=/^ML-\d{3}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function feeComparison(flight,oldFee,newFee){
  const assumptions={protect:Math.min(3,flight.mintCapacity-flight.mintBooked),cannibalization:.15,demand:1};
  const worlds=createWorlds(flight,240,1,SEED);
  const before=evaluate(flight,worlds,{...assumptions,price:oldFee});
  const after=evaluate(flight,worlds,{...assumptions,price:newFee});
  return {assumptions,before,after,modeledRevenueChange:after.revenue-before.revenue,
    unchanged:['Booked revenue','Booked passengers','Remaining seats','Booking pickup','Hold-all baseline'],synthetic:true};
}
export function createUpgradePolicyService({env=process.env,fetchImpl=fetch,store,loadData}={}){
  const configured=()=>!!env.SUPABASE_SECRET_KEY;
  const authorized=header=>typeof env.LAB_ACCESS_KEY==='string'&&env.LAB_ACCESS_KEY.length>=32&&typeof header==='string'&&header.startsWith('Bearer ')&&timingSafeEqual(Buffer.from(hash(header.slice(7)),'hex'),Buffer.from(hash(env.LAB_ACCESS_KEY),'hex'));
  async function rpc(name,body,key=env.SUPABASE_PUBLISHABLE_KEY){
    if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(env.SUPABASE_URL||'')||!key)throw Error('Database configuration unavailable.');
    const response=await fetchImpl(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw Error('Database request failed.');return response.json();
  }
  const db=store||{
    async read(id){
      const response=await fetchImpl(env.SUPABASE_URL+'/rest/v1/mint_lab_upgrade_policy?departure_id=eq.'+encodeURIComponent(id)+'&select=departure_id,upgrade_fee_usd,revision,updated_at',{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!response.ok)throw Error('Saved assumptions unavailable.');return (await response.json())[0];
    },
    save:proposal=>rpc('mint_lab_save_upgrade_fee',proposal,env.SUPABASE_SECRET_KEY)
  };
  const dataset=loadData||(()=>rpc('mint_lab_dataset',{}));
  async function read(id){
    if(!idPattern.test(id||''))return reply(400,'rejected','Select a supported departure.');
    try{const record=await db.read(id);return record?reply(200,'current','Saved synthetic assumption loaded.',{record,writeConfigured:configured()}):reply(404,'rejected','No saved scenario for this departure.');}
    catch{return reply(503,'unavailable','Could not read the saved fee. No write was made.');}
  }
  async function submit(input,header){
    if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).some(k=>!['operation','departureId','newFee','reason','expectedFee','expectedRevision','fingerprint','confirmed','requestId'].includes(k))||!['preview','execute'].includes(input.operation)||!idPattern.test(input.departureId||'')||!Number.isInteger(input.newFee)||input.newFee<250||input.newFee>1200||input.newFee%50!==0||typeof input.reason!=='string'||input.reason.trim().length<12||input.reason.trim().length>1000)return reply(400,'rejected','Use a $250–$1,200 fee in $50 steps and a reason of 12–1,000 characters.');
    if(input.operation==='execute'){
      if(!configured())return reply(503,'unconfigured','Save needs SUPABASE_SECRET_KEY in the server settings. No write was made.');
      if(!authorized(header))return reply(401,'rejected','Verify lab access before saving. No write was made.');
      if(input.confirmed!==true||!uuid.test(input.requestId||'')||!Number.isInteger(input.expectedFee)||!Number.isInteger(input.expectedRevision)||typeof input.fingerprint!=='string')return reply(400,'rejected','Review and confirm the exact adjustment before saving.');
    }
    try{
      const current=await db.read(input.departureId),data=await dataset(),flight=data.flights.find(f=>f.id===input.departureId);
      if(!current||!flight)return reply(404,'rejected','Departure not found.');
      if(input.newFee===current.upgrade_fee_usd&&input.operation==='preview')return reply(422,'rejected','Choose a different fee before reviewing a change.');
      const oldFee=input.operation==='execute'?input.expectedFee:current.upgrade_fee_usd;
      const revision=input.operation==='execute'?input.expectedRevision:current.revision;
      const proposal={departureId:input.departureId,oldFee,newFee:input.newFee,revision,reason:input.reason.trim()};
      const comparison=feeComparison(flight,oldFee,input.newFee);
      const fingerprint=hash(JSON.stringify({proposal,flight,source:data.meta.sourceSha256}));
      if(input.operation==='preview')return reply(200,'preview','No change has been saved.',{proposal,comparison,fingerprint,writeConfigured:configured()});
      if(fingerprint!==input.fingerprint)return reply(409,'stale','The reviewed source or proposal changed. Read again and reconsider. No write was made.');
      const saved=await db.save({p_departure_id:proposal.departureId,p_expected_revision:proposal.revision,p_expected_fee:proposal.oldFee,p_new_fee:proposal.newFee,p_reason:proposal.reason,p_request_id:input.requestId});
      if(saved.state!=='saved')return reply(saved.state==='conflict'?409:422,saved.state,saved.message,{record:saved.record});
      const reread=await db.read(proposal.departureId);
      const verified=reread?.revision===saved.record.revision&&reread?.upgrade_fee_usd===proposal.newFee;
      return reply(200,'saved',verified?'Saved in Supabase and independently read back.':'The save returned a receipt; current value needs a separate read.',{...saved,comparison,readbackVerified:verified});
    }catch{return reply(503,input.operation==='execute'?'unknown':'unavailable',input.operation==='execute'?'Save result uncertain. Read the saved fee and audit before retrying.':'Could not build a current proposal. No write was made.');}
  }
  return {read,submit};
}

