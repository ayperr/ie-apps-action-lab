export const CONTRACT='1.0.0';
export const DEFAULTS={view:'overview',route:'all',from:'2026-11-12',to:'2026-12-04',asof:'2026-11-10',channel:'all',flight:'',focus:'',back:'pace',compare:'none',q:'',sort:'date-desc',page:'1'};
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
export function validateDataset(data){
  const errors=[];
  if(!data?.meta?.synthetic)errors.push('Dataset must be explicitly synthetic.');
  for(const table of ['routes','flights','bookings','snapshots'])if(!Array.isArray(data?.[table]))errors.push(`Missing ${table} table.`);
  if(errors.length)return errors;
  for(const [table,fields] of [['routes',['id']],['flights',['id']],['bookings',['id']],['snapshots',['flightId','snapshotDate']]]){
    const keys=data[table].map(r=>JSON.stringify(fields.map(k=>r[k])));
    if(new Set(keys).size!==keys.length)errors.push(`Duplicate keys in ${table}.`);
    if(data[table].some(r=>Object.values(r).some(v=>v===null||v===undefined||v==='')))errors.push(`Missing values in ${table}.`);
  }
  const routes=new Set(data.routes.map(r=>r.id)),flights=new Map(data.flights.map(f=>[f.id,f]));
  if(data.flights.some(f=>!routes.has(f.routeId)))errors.push('Unmatched route reference.');
  if(data.bookings.some(b=>!flights.has(b.flightId))||data.snapshots.some(s=>!flights.has(s.flightId)))errors.push('Unmatched departure reference.');
  if(data.bookings.some(b=>!Number.isInteger(b.fare)||b.fare<=0||b.bookingDate>data.meta.asOf))errors.push('Invalid booking fare or date.');
  for(const f of data.flights){
    const b=data.bookings.filter(b=>b.flightId===f.id),s=data.snapshots.find(s=>s.flightId===f.id&&s.snapshotDate===data.meta.asOf);
    if(f.mintBooked<0||f.mintBooked>f.mintCapacity||b.length!==f.mintBooked||sum(b,'fare')!==f.bookedRevenue)errors.push(`Departure balances do not reconcile: ${f.id}.`);
    if(!s||s.booked!==b.length||s.revenue!==sum(b,'fare'))errors.push(`Snapshot balance does not reconcile: ${f.id}.`);
  }
  return [...new Set(errors)];
}
export function cohort(data,state){return data.flights.filter(f=>(state.route==='all'||f.routeId===state.route)&&f.departure>=state.from&&f.departure<=state.to);}
export function checkContext(data,state){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(state.asof)||state.asof<'2026-10-12'||state.asof>data.meta.asOf)throw new Error('Choose an as-of date from 12 Oct to 10 Nov 2026.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(state.from)||!/^\d{4}-\d{2}-\d{2}$/.test(state.to)||state.from>state.to)throw new Error('Choose a valid departure range with the start before the end.');
  if(state.route!=='all'&&!data.routes.some(r=>r.id===state.route))throw new Error('Unknown route filter. Reset the filters to continue.');
  if(!['all','Direct','Travel partner'].includes(state.channel))throw new Error('Unknown booking channel.');
}
export function commonStart(data,flights){
  return flights.map(f=>data.snapshots.filter(s=>s.flightId===f.id).reduce((m,s)=>s.snapshotDate<m?s.snapshotDate:m,'9999-12-31')).sort().at(-1)||data.meta.asOf;
}
export function metrics(data,state,{channel='all',flightId=null}={}){
  checkContext(data,state);
  const fs=cohort(data,state).filter(f=>!flightId||f.id===flightId),ids=new Set(fs.map(f=>f.id));
  const snapshots=data.snapshots.filter(s=>ids.has(s.flightId)&&s.snapshotDate===state.asof);
  if(snapshots.length!==fs.length)throw new Error('Snapshot coverage is incomplete. The departure cohort was not silently reduced.');
  const allBookings=data.bookings.filter(b=>ids.has(b.flightId)&&b.bookingDate<=state.asof);
  const bookings=allBookings.filter(b=>channel==='all'||b.source===channel);
  const revenue=sum(bookings,'fare'),booked=bookings.length,capacity=sum(fs,'mintCapacity'),bookedAll=sum(snapshots,'booked');
  if(bookedAll>capacity)throw new Error('Booked seats exceed modeled capacity.');
  const pickup=bookings.filter(b=>b.bookingDate>addDays(state.asof,-7)).length;
  const previousAvailable=addDays(state.asof,-14)>=commonStart(data,fs);
  const prior=previousAvailable?bookings.filter(b=>b.bookingDate>addDays(state.asof,-14)&&b.bookingDate<=addDays(state.asof,-7)).length:null;
  const empty=!fs.length;
  return {flights:fs,bookings,allBookings,snapshots,revenue:empty?null:revenue,booked,bookedAll,capacity,utilization:capacity?100*bookedAll/capacity:null,remaining:empty?null:capacity-bookedAll,average:booked?revenue/booked:null,pickup:empty?null:pickup,priorPickup:prior,recentRevenue:sum(bookings.filter(b=>b.bookingDate>addDays(state.asof,-7)),'fare')};
}
export function trendSeries(data,state,flightId=null){
  const fs=cohort(data,state).filter(f=>!flightId||f.id===flightId),ids=new Set(fs.map(f=>f.id));
  if(!fs.length)return [];
  const start=[addDays(state.asof,-13),commonStart(data,fs)].sort().at(-1),points=[];
  for(let day=start;day<=state.asof;day=addDays(day,1)){
    const snaps=data.snapshots.filter(s=>ids.has(s.flightId)&&s.snapshotDate===day);
    if(snaps.length!==fs.length)throw new Error('Trend coverage is incomplete.');
    points.push({date:day,booked:sum(snaps,'booked'),revenue:sum(snaps,'revenue')});
  }
  return points;
}
export function routeComparison(data,state){
  return data.routes.map(r=>{const m=metrics(data,{...state,route:r.id});return {...r,...m};}).filter(r=>r.flights.length&&(state.route==='all'||r.id===state.route)).sort((a,b)=>b.remaining-a.remaining||a.id.localeCompare(b.id));
}
export function departureRows(data,state){return cohort(data,state).map(f=>{const m=metrics(data,state,{flightId:f.id});return {...f,asofBooked:m.bookedAll,remaining:m.remaining,pickup:m.pickup,asofRevenue:m.revenue};});}

// Flow comparisons use equivalent booking windows, never cumulative balances as flows.
export function periodComparison(data,state){
  const m=metrics(data,state),start=addDays(state.asof,-6),priorStart=addDays(state.asof,-13),priorEnd=addDays(state.asof,-7);
  const current=m.allBookings.filter(b=>b.bookingDate>=start),prior=m.allBookings.filter(b=>b.bookingDate>=priorStart&&b.bookingDate<=priorEnd);
  return {start,end:state.asof,priorStart,priorEnd,departures:m.flights.length,available:m.flights.length>0&&m.priorPickup!==null,currentCount:current.length,priorCount:m.priorPickup===null?null:prior.length,currentRevenue:sum(current,'fare'),priorRevenue:m.priorPickup===null?null:sum(prior,'fare')};
}
export function exploreBookings(bookings,{q='',sort='date-desc',page='1'}={},pageSize=20){
  const query=String(q).trim().toLowerCase().slice(0,80);
  const rows=bookings.filter(b=>!query||[b.id,b.flightId,b.bookingDate,b.source,b.fare].some(v=>String(v).toLowerCase().includes(query)));
  const order={ 'date-desc':(a,b)=>b.bookingDate.localeCompare(a.bookingDate), 'date-asc':(a,b)=>a.bookingDate.localeCompare(b.bookingDate), 'fare-desc':(a,b)=>b.fare-a.fare, 'fare-asc':(a,b)=>a.fare-b.fare }[sort]||((a,b)=>b.bookingDate.localeCompare(a.bookingDate));
  rows.sort((a,b)=>order(a,b)||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(rows.length/pageSize)),currentPage=Math.min(pages,Math.max(1,Math.floor(Number(page)||1)));
  return {rows,shown:rows.slice((currentPage-1)*pageSize,currentPage*pageSize),pages,page:currentPage,revenue:sum(rows,'fare')};
}
