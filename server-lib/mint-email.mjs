import {createHash,timingSafeEqual} from 'node:crypto';
import {DEFAULTS,metrics,validateDataset,addDays,periodComparison} from '../public/analytics.mjs';
import {resendConfigFromEnv,validateResendDestination,createResendEmail,verifyResendEmail} from '../reference/resend-email.mjs';

const labels={revenue:'Booked Mint revenue',utilization:'Booked seat utilization',remaining:'Remaining Mint seats',pickup:'7-day booking pickup'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const allowed=(value,keys)=>object(value)&&Object.keys(value).every(k=>keys.includes(k));
const emailPattern=/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const answer=(status,state,message,extra={})=>({status,body:{state,message,...extra}});

export function mintFinding(data,input){
  if(!allowed(input,['route','from','to','asof','compare']))throw Error('Unsupported overview filter.');
  const scope=Object.fromEntries(['route','from','to','asof','compare'].map(k=>[k,input[k]??DEFAULTS[k]]));
  if(Object.values(scope).some(v=>typeof v!=='string'||v.length>32)||!['none','prior7'].includes(scope.compare))throw Error('Invalid overview filter.');
  if(validateDataset(data).length)throw Error('The live dataset did not pass validation.');
  const state={...DEFAULTS,...scope},m=metrics(data,state);
  if(!m.flights.length)throw Error('No departures match these filters. Adjust the scope before sharing.');
  const values={revenue:m.revenue,booked:m.bookedAll,capacity:m.capacity,utilization:m.utilization,remaining:m.remaining,pickup:m.pickup,priorPickup:m.priorPickup,average:m.average,departures:m.flights.length};
  const snapshot={scope,values,sourceSha256:data.meta.sourceSha256,synthetic:true,flightIds:m.flights.map(f=>f.id).sort(),bookings:m.allBookings.map(b=>[b.id,b.flightId,b.bookingDate,b.source,b.fare]).sort((a,b)=>a[0].localeCompare(b[0]))};
  const fingerprint=hash(JSON.stringify(snapshot));
  const context=`Route: ${scope.route==='all'?'All six routes':scope.route}\nDepartures: ${scope.from} through ${scope.to} (${m.flights.length} departures)\nData as of: ${scope.asof}\nAll booking channels; USD. Booked revenue is cumulative.`;
  const comparison=periodComparison(data,state);
  const body=`Mint Revenue Lab — synthetic teaching data, not JetBlue operating results.\n\n${context}\n\nBooked Mint revenue: ${money(m.revenue)}\nBooked seat utilization: ${m.utilization.toFixed(2)}% (${m.bookedAll}/${m.capacity} modeled seats)\nRemaining Mint seats: ${m.remaining}\n7-day pickup: ${m.pickup} bookings, ${addDays(scope.asof,-6)} through ${scope.asof}\n${m.priorPickup===null?'Prior 7-day comparison unavailable: incomplete history.':`Prior 7-day pickup: ${m.priorPickup} bookings, ${addDays(scope.asof,-13)} through ${addDays(scope.asof,-7)}; same departure cohort.`}${scope.compare==='prior7'&&comparison.available?`\nNew booked fares in those windows: ${money(comparison.currentRevenue)} versus ${money(comparison.priorRevenue)}. These flows do not replace cumulative booked revenue.`:''}\n\nNext step: review booking pace by departure, then inspect the supporting booking records before deciding whether to protect seats for full-fare demand or test a paid-upgrade offer. These data do not establish a pricing effect or real revenue uplift.`;
  return {scope,values,fingerprint,context,body,flightIds:snapshot.flightIds};
}

export function createMintEmailService({env=process.env,fetchImpl=fetch,loadData,transports={}}={}){
  const config=resendConfigFromEnv(env);
  const authorizationConfigured=typeof env.LAB_ACCESS_KEY==='string'&&env.LAB_ACCESS_KEY.length>=32&&env.LAB_ACCESS_KEY.length<=256;
  const authorized=header=>authorizationConfigured&&typeof header==='string'&&header.startsWith('Bearer ')&&timingSafeEqual(Buffer.from(hash(header.slice(7)),'hex'),Buffer.from(hash(env.LAB_ACCESS_KEY),'hex'));
  const missing=()=>['RESEND_API_KEY','LAB_EMAIL_TO','LAB_ACCESS_KEY'].filter(k=>!env[k]?.trim());
  const options={fetchImpl,timeoutMs:12000};
  const transport={createResendEmail,verifyResendEmail,...transports};
  const requests=new Map();
  const getData=loadData||async function(){
    if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(env.SUPABASE_URL||'')||!env.SUPABASE_PUBLISHABLE_KEY)throw Error('Dataset configuration unavailable.');
    const response=await fetchImpl(env.SUPABASE_URL+'/rest/v1/rpc/mint_lab_dataset',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw Error('The current dataset could not be read.');
    return response.json();
  };
  function forMetric(data,input){const finding=mintFinding(data,input.scope);finding.fingerprint=hash(finding.fingerprint+input.metric);return finding;}
  function sourceFooter(finding,metric){return `\n\nSource scope:\n${finding.context}\nSelected KPI: ${labels[metric]}\nDeparture IDs: ${finding.flightIds.join(', ')}\nSnapshot fingerprint: ${finding.fingerprint}\nOpen the scoped overview: https://mint-revenue-lab.vercel.app/?${new URLSearchParams(finding.scope)}`;}
  function status(header){
    const authenticated=authorized(header),configured=validateResendDestination(config)&&authorizationConfigured;
    return answer(200,'connection',configured?(authenticated?'Email connected; lab access verified.':'Email configured. Enter the lab access phrase to authorize sending.'):'Email setup needs attention.',{configured,authenticated,missing:missing(),authorizationConfigured,recipient:authenticated?config.to||'':'',sender:'onboarding@resend.dev'});
  }
  async function submit(input,header){
    if(!allowed(input,['operation','scope','metric','draft','fingerprint','confirmed','requestId'])||!['preview','execute'].includes(input.operation)||!Object.hasOwn(labels,input.metric))return answer(400,'rejected','Choose a supported overview finding.');
    if(input.draft!==undefined&&(!allowed(input.draft,['to','subject','body'])||!emailPattern.test(input.draft.to||'')||input.draft.to.length>254||typeof input.draft.subject!=='string'||!input.draft.subject.trim()||input.draft.subject.length>200||/[\r\n\0]/.test(input.draft.subject)||typeof input.draft.body!=='string'||!input.draft.body.trim()||input.draft.body.length>8000||input.draft.body.includes('\0')))return answer(400,'rejected','Enter one valid recipient, a subject and a message within the stated limits.');
    if(input.operation==='execute'){
      if(!validateResendDestination(config)||!authorizationConfigured)return answer(503,'unconfigured','Configure valid server settings before sending.',{missing:missing()});
      if(!authorized(header))return answer(401,'rejected','Enter the correct lab access phrase. No email was sent.');
      if(input.confirmed!==true||!uuid.test(input.requestId||'')||typeof input.fingerprint!=='string'||!input.draft)return answer(400,'rejected','Review and explicitly confirm the exact email before sending.');
      if(input.draft.to.toLowerCase()!==config.to.toLowerCase())return answer(403,'rejected','The test sender permits only LAB_EMAIL_TO, your configured Resend account address.');
      const digest=hash(JSON.stringify(input));
      if(requests.has(input.requestId)){
        const previous=requests.get(input.requestId);
        return previous.digest===digest?previous.promise:answer(409,'rejected','This request ID belongs to different reviewed content.');
      }
      // Provider idempotency is also scoped by request ID. Unknown outcomes are never retried here.
      const promise=execute(input);requests.set(input.requestId,{digest,promise});
      if(requests.size>200)requests.delete(requests.keys().next().value);
      return promise;
    }
    try{
      const finding=forMetric(await getData(),input);
      const display=input.metric==='revenue'?money(finding.values.revenue):input.metric==='utilization'?finding.values.utilization.toFixed(2)+'%':String(finding.values[input.metric]);
      return answer(200,'preview','No email has been sent.',{...finding,sourceFooter:sourceFooter(finding,input.metric),metric:input.metric,label:labels[input.metric],draft:input.draft||{to:authorized(header)?config.to||'':'',subject:`[Synthetic Mint] ${labels[input.metric]}: ${display} | ${finding.scope.asof}`,body:`Selected finding: ${labels[input.metric]} — ${display}\n\n${finding.body}`},connection:status(header).body});
    }catch{return answer(422,'unavailable','Could not establish a valid current Mint cohort. Check the filters and data connection.');}
  }
  async function execute(input){
    let finding;
    try{finding=forMetric(await getData(),input);}catch{return answer(503,'unavailable','Current Mint data could not be verified. No email was sent.');}
    if(finding.fingerprint!==input.fingerprint)return answer(409,'stale','The source facts changed after review. Refresh and review a new preview. No email was sent.');
    const action={requestId:input.requestId,recordId:'mint-portfolio',title:input.draft.subject.trim(),body:input.draft.body.trim()+sourceFooter(finding,input.metric)};
    const common={requestId:input.requestId,fingerprint:finding.fingerprint,inboxVerified:false};
    let made;
    try{made=await transport.createResendEmail(config,action,options);}catch{return answer(502,'unknown','The send result is uncertain. Check Resend before another attempt.',common);}
    if(made.state!=='accepted')return answer(made.state==='rejected'?422:502,made.state==='rejected'?'rejected':'unknown',made.state==='rejected'?'Resend rejected the request. No successful send is claimed.':'The send result is uncertain. Check Resend before another attempt.',{...common,providerId:made.emailId||null});
    let read;
    try{read=await transport.verifyResendEmail(config,action,made.emailId,options);}catch{read={state:'unknown'};}
    const failed=['bounced','complained','failed','suppressed','canceled'].includes(read.deliveryState);
    return answer(200,failed?'rejected':'accepted',failed?'The provider reports a delivery failure.':'Email accepted by Resend. Verify the actual inbox message separately.',{...common,providerId:made.emailId,deliveryState:read.deliveryState||'unknown',providerContentMatched:read.state==='matched',verification:read.matched||null});
  }
  return {status,submit};
}
