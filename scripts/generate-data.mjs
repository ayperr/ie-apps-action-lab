import fs from 'node:fs';
import {rng,SEED,validateData} from '../public/model.mjs';
const routes=[
  {id:'JFK-LAX',origin:'JFK',destination:'LAX',name:'New York → Los Angeles',fullFare:2250,economyFare:390,wtp:590,demand:7.2},
  {id:'JFK-SFO',origin:'JFK',destination:'SFO',name:'New York → San Francisco',fullFare:2150,economyFare:370,wtp:560,demand:6.4},
  {id:'BOS-LAX',origin:'BOS',destination:'LAX',name:'Boston → Los Angeles',fullFare:2050,economyFare:350,wtp:510,demand:4.4},
  {id:'BOS-SFO',origin:'BOS',destination:'SFO',name:'Boston → San Francisco',fullFare:1980,economyFare:340,wtp:490,demand:3.1},
  {id:'JFK-LHR',origin:'JFK',destination:'LHR',name:'New York → London',fullFare:3250,economyFare:650,wtp:760,demand:6.7},
  {id:'BOS-LHR',origin:'BOS',destination:'LHR',name:'Boston → London',fullFare:2950,economyFare:600,wtp:680,demand:3.7},
];
export function generateData() {
const random=rng(SEED);
const flights=[],bookings=[],snapshots=[];
for(const [ri,r] of routes.entries()) for(let i=0;i<8;i++) {
  const index=ri*8+i, dtd=2+i*3+(ri%2),capacity=16;
  const booked=Math.min(14,Math.max(3,Math.round(5+random()*7+(ri===0?2:0)-(i>4?2:0))));
  const departure=new Date(Date.UTC(2026,10,10+dtd)).toISOString().slice(0,10);
  const f={id:`ML-${String(index+1).padStart(3,'0')}`,seed:index+1,routeId:r.id,departure,departureTime:i%2?'18:30':'09:15',daysToDeparture:dtd,mintCapacity:capacity,mintBooked:booked,fullFare:r.fullFare, economyFare:r.economyFare,upgradeWtp:r.wtp,eligibleEconomy:70+Math.floor(random()*40),futurePremiumMean:Number((r.demand*(.55+dtd/30)*(.8+random()*.4)).toFixed(2)),bookedRevenue:0};
  for(let b=0;b<booked;b++) {
    const fare=Math.round(r.fullFare*(.65+.4*random())/10)*10;
    // More bookings close to the current observation than at 60 days out.
    const daysToDeparture=dtd+1+Math.floor(Math.pow(random(),1.65)*(59-dtd));
    const bookingDate=new Date(Date.parse(departure+'T00:00:00Z')-daysToDeparture*86400000).toISOString().slice(0,10);
    bookings.push({id:`BK-${index+1}-${b+1}`,flightId:f.id,bookingDate,daysToDeparture,fare,cabin:'Mint',source:random()<(.2+ri*.06)?'Travel partner':'Direct'});
    f.bookedRevenue+=fare;
  }
  for(let d=60;d>=dtd;d--) {
    const bookedRows=bookings.filter(b=>b.flightId===f.id&&b.daysToDeparture>=d);
    const snapshotDate=new Date(Date.parse(departure+'T00:00:00Z')-d*86400000).toISOString().slice(0,10);
    snapshots.push({flightId:f.id,snapshotDate,daysToDeparture:d,booked:bookedRows.length,revenue:bookedRows.reduce((a,b)=>a+b.fare,0)});
  }
  flights.push(f);
}
const data={meta:{seed:SEED,asOf:'2026-11-10',currency:'USD',synthetic:true,version:1,description:'Reproducible teaching simulation; fictional departures and fares, not JetBlue operational data.'},routes,flights,bookings,snapshots};
const errors=validateData(data); if(errors.length) throw new Error(errors.join('\n'));
return data;
}
const data=generateData();
fs.writeFileSync(new URL('../public/data.json',import.meta.url),JSON.stringify(data));
console.log(JSON.stringify({flights:data.flights.length,bookings:data.bookings.length,snapshots:data.snapshots.length,bookedRevenue:data.flights.reduce((a,f)=>a+f.bookedRevenue,0),validation:'passed'}));
