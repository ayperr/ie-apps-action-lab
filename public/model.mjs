// All scenarios are synthetic. Common random numbers make policy comparisons paired.
export const SEED = 20261110;
export function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function poisson(mean, random) {
  const limit = Math.exp(-mean); let p = 1, k = 0;
  do { k++; p *= random(); } while (p > limit);
  return k - 1;
}
export function quantile(values, q) {
  const a = [...values].sort((x,y) => x-y); return a[Math.floor((a.length-1)*q)] ?? 0;
}
export function mean(values) { return values.reduce((a,b) => a+b,0)/(values.length || 1); }
export function createWorlds(flight, n=240, demand=1, seed=SEED) {
  if (!Number.isInteger(n) || n < 1 || demand < 0) throw new Error('Invalid scenario parameters');
  const worlds = [];
  for (let i=0; i<n; i++) {
    const random = rng(seed + flight.seed*101 + i*7919);
    // A shared market shock produces uncertainty beyond independent arrivals.
    const shock = .55 + random()*.9;
    const premium = Array.from({length:poisson(flight.futurePremiumMean*demand*shock,random)},(_,j) => ({id:j, switchU:random(), priority:random()}));
    const upgrades = Array.from({length:flight.eligibleEconomy},(_,j) => ({id:j, wtp:Math.max(80,flight.upgradeWtp*(.3+1.4*random())), ready:random(), priority:random()}));
    worlds.push({premium,upgrades});
  }
  return worlds;
}
export function replay(flight, world, policy) {
  const remaining = flight.mintCapacity-flight.mintBooked;
  if (!Number.isFinite(policy.price) || policy.price < 0 || !Number.isInteger(policy.protect) || policy.protect < 0 || policy.protect > remaining || policy.cannibalization < 0 || policy.cannibalization > 1) throw new Error('Invalid policy');
  let seats = remaining, revenue = 0, upgradeSales=0, diverted=0, premiumSales=0;
  const divertedIds = new Set();
  const offers = world.upgrades.filter(p => p.wtp >= policy.price && p.ready < .25).map(p=>({...p,type:'upgrade'}));
  // Some otherwise full-fare buyers choose economy + an upgrade when offered.
  // Include their economy fare, while ordinary upgrades add only the upgrade fee.
  if (flight.economyFare+policy.price < flight.fullFare) {
    offers.push(...world.premium.filter(p=>p.switchU<policy.cannibalization).map(p=>({...p,type:'diverted'})));
  }
  offers.sort((a,b)=>a.priority-b.priority);
  for (const offer of offers) {
    if (seats <= policy.protect) break;
    seats--; upgradeSales++; revenue += policy.price;
    if (offer.type==='diverted') { diverted++; divertedIds.add(offer.id); revenue+=flight.economyFare; }
  }
  let rejected=0;
  for (const buyer of world.premium) {
    if (divertedIds.has(buyer.id)) continue;
    if (seats>0) { seats--; premiumSales++; revenue+=flight.fullFare; } else rejected++;
  }
  return {revenue,empty:seats,upgradeSales,premiumSales,rejected,diverted};
}
export function evaluate(flight, worlds, policy) {
  const baseline = worlds.map(w=>replay(flight,w,{price:policy.price,protect:flight.mintCapacity-flight.mintBooked,cannibalization:policy.cannibalization}));
  const results = worlds.map(w=>replay(flight,w,policy));
  const deltas = results.map((r,i)=>r.revenue-baseline[i].revenue);
  const stats = key=>mean(results.map(r=>r[key]));
  const delta=mean(deltas), sd=Math.sqrt(mean(deltas.map(x=>(x-delta)**2)));
  return {policy,results,baseline,deltas,revenue:stats('revenue'),baselineRevenue:mean(baseline.map(r=>r.revenue)),delta,p10:quantile(deltas,.1),p90:quantile(deltas,.9),mc95:1.96*sd/Math.sqrt(worlds.length),winRate:mean(deltas.map(d=>d>0?1:0)),empty:stats('empty'),upgrades:stats('upgradeSales'),premium:stats('premiumSales'),rejected:stats('rejected'),diverted:stats('diverted')};
}
export function recommend(flight, worlds, cannibalization=.15) {
  const remaining=flight.mintCapacity-flight.mintBooked;
  let best=evaluate(flight,worlds,{price:450,protect:remaining,cannibalization});
  for (const price of [250,450,650,850]) {
    for (let protect=0; protect<=remaining; protect++) {
      const r=evaluate(flight,worlds,{price,protect,cannibalization});
      if (r.delta>best.delta+.001) best=r;
    }
  }
  return best;
}
export function validateData(data) {
  const errors=[];
  const ids=new Set(data.flights.map(f=>f.id));
  const routes=new Set(data.routes.map(r=>r.id));
  if(ids.size!==data.flights.length) errors.push('Duplicate flight identifiers');
  if(new Set(data.bookings.map(b=>b.id)).size!==data.bookings.length) errors.push('Duplicate booking identifiers');
  if(new Set(data.snapshots.map(s=>`${s.flightId}:${s.daysToDeparture}`)).size!==data.snapshots.length) errors.push('Duplicate daily snapshots');
  for(const f of data.flights) {
    const b=data.bookings.filter(b=>b.flightId===f.id);
    const s=data.snapshots.find(s=>s.flightId===f.id&&s.daysToDeparture===f.daysToDeparture);
    if(!routes.has(f.routeId)) errors.push(`Unknown route ${f.id}`);
    if(f.mintBooked>f.mintCapacity||f.mintBooked<0) errors.push(`Invalid inventory ${f.id}`);
    if(b.length!==f.mintBooked||b.reduce((a,x)=>a+x.fare,0)!==f.bookedRevenue) errors.push(`Bookings do not reconcile ${f.id}`);
    if(!s||s.booked!==f.mintBooked||s.revenue!==f.bookedRevenue) errors.push(`Snapshot does not reconcile ${f.id}`);
    if(b.some(b=>b.daysToDeparture<f.daysToDeparture)) errors.push(`Future booking leakage ${f.id}`);
  }
  if(data.bookings.some(b=>!ids.has(b.flightId))||data.snapshots.some(s=>!ids.has(s.flightId))) errors.push('Orphan flight references');
  return errors;
}
