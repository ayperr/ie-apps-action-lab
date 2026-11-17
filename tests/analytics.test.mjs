import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULTS,metrics,validateDataset,trendSeries,routeComparison} from '../public/analytics.mjs';
import {createWorlds,evaluate,replay} from '../public/model.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./fixtures/foundation.json',import.meta.url)));
test('frozen default KPIs and independent snapshot balances match',()=>{
  assert.deepEqual(validateDataset(data),[]);const m=metrics(data,DEFAULTS);
  assert.equal(m.revenue,777930);assert.equal(m.average,2074.48);assert.equal(m.utilization,48.828125);
  assert.equal(m.remaining,393);assert.equal(m.pickup,126);assert.equal(m.priorPickup,58);assert.equal(m.capacity,768);
});
test('channel selection preserves inventory while filtering booking facts',()=>{
  const state={...DEFAULTS,route:'JFK-LAX',to:'2026-11-25'};
  const all=metrics(data,state),direct=metrics(data,state,{channel:'Direct'});
  assert.equal(direct.revenue,70060);assert.equal(direct.booked,38);assert.equal(direct.pickup,14);
  assert.equal(direct.capacity,80);assert.equal(direct.bookedAll,49);assert.equal(direct.utilization,61.25);
  assert.equal(direct.remaining,all.remaining);assert.equal(direct.utilization,all.utilization);
});
test('time trend and route comparison reconcile to source events',()=>{
  const series=trendSeries(data,DEFAULTS);assert.equal(series.length,14);
  assert.equal(series.find(p=>p.date==='2026-11-03').booked,249);assert.equal(series.at(-1).booked,375);
  const rows=routeComparison(data,DEFAULTS);assert.equal(rows.length,6);assert.equal(rows.reduce((n,r)=>n+r.remaining,0),393);
  assert.equal(rows[0].id,'BOS-LAX');assert.equal(rows[0].remaining,75);
});
test('empty, unsupported and incomplete contexts do not invent values',()=>{
  const empty=metrics(data,{...DEFAULTS,from:'2026-12-05',to:'2026-12-06'});assert.equal(empty.revenue,null);assert.equal(empty.average,null);assert.equal(empty.remaining,null);
  assert.throws(()=>metrics(data,{...DEFAULTS,asof:'2026-11-11'}),/as-of/);
  const broken=structuredClone(data);broken.snapshots=broken.snapshots.filter(s=>!(s.flightId==='ML-001'&&s.snapshotDate===DEFAULTS.asof));
  assert.throws(()=>metrics(broken,DEFAULTS),/coverage/);
  const duplicate=structuredClone(data);duplicate.routes.push(duplicate.routes[0]);assert.ok(validateDataset(duplicate).some(e=>e.includes('Duplicate')));
});
test('paired policy baseline is identical and all scenarios conserve Mint seats',()=>{
  for(const flight of data.flights){
    const available=flight.mintCapacity-flight.mintBooked;
    for(const demand of [.6,1,1.4]){
      const worlds=createWorlds(flight,80,demand);
      const hold=evaluate(flight,worlds,{price:450,protect:available,cannibalization:.15});assert.equal(hold.delta,0);assert.ok(hold.deltas.every(d=>d===0));
      for(const protect of [0,Math.min(3,available),available]){
        const r=evaluate(flight,worlds,{price:650,protect,cannibalization:.15});
        for(const x of r.results){assert.equal(x.empty+x.upgradeSales+x.premiumSales,available);assert.ok(x.empty>=0&&x.rejected>=0&&x.revenue>=0);}
      }
    }
  }
});
test('upgrade revenue avoids counting existing economy tickets again',()=>{
  const f={mintCapacity:2,mintBooked:0,fullFare:2000,economyFare:400};
  const w={upgrades:[{id:1,wtp:700,ready:.1,priority:.1}],premium:[]};
  const r=replay(f,w,{price:500,protect:0,cannibalization:0});assert.equal(r.revenue,500);
  const diverted=replay(f,{upgrades:[],premium:[{id:1,switchU:.1,priority:.1}]},{price:500,protect:0,cannibalization:.2});
  assert.equal(diverted.revenue,900);assert.equal(diverted.diverted,1);assert.equal(diverted.premiumSales,0);
});
