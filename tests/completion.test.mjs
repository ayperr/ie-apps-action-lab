import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {DEFAULTS,metrics,periodComparison,exploreBookings} from '../public/analytics.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./fixtures/foundation.json',import.meta.url)));
test('equivalent booking weeks reconcile to source events and leave headline revenue unchanged',()=>{
 const state={...DEFAULTS,route:'JFK-LAX',to:'2026-11-25'},c=periodComparison(data,state);
 const ids=new Set(data.flights.filter(f=>f.routeId==='JFK-LAX'&&f.departure>='2026-11-12'&&f.departure<='2026-11-25').map(f=>f.id));
 const raw=data.bookings.filter(b=>ids.has(b.flightId));
 const current=raw.filter(b=>b.bookingDate>='2026-11-04'&&b.bookingDate<='2026-11-10');
 const prior=raw.filter(b=>b.bookingDate>='2026-10-28'&&b.bookingDate<='2026-11-03');
 assert.equal(c.currentCount,17);assert.equal(c.priorCount,7);assert.equal(c.currentRevenue,current.reduce((n,b)=>n+b.fare,0));assert.equal(c.priorRevenue,prior.reduce((n,b)=>n+b.fare,0));assert.equal(c.currentRevenue,30750);
 assert.equal(metrics(data,{...state,compare:'prior7'}).revenue,91200);assert.equal(c.departures,5);
 assert.equal(periodComparison(data,{...DEFAULTS,asof:'2026-10-12'}).available,false);
 assert.equal(periodComparison(data,{...DEFAULTS,from:'2026-12-05',to:'2026-12-06'}).available,false);
});
test('record exploration preserves all-result totals across pages and searches/sorts without changing cohort',()=>{
 const x=exploreBookings(data.bookings,{sort:'fare-desc',page:'1'}),y=exploreBookings(data.bookings,{sort:'fare-desc',page:'2'});
 assert.equal(x.rows.length,375);assert.equal(x.revenue,777930);assert.equal(y.revenue,x.revenue);assert.equal(x.shown.length,20);assert.equal(new Set([...x.shown,...y.shown].map(b=>b.id)).size,40);
 assert.ok(x.shown.every((b,i,a)=>!i||a[i-1].fare>=b.fare));
 const q=exploreBookings(data.bookings,{q:'ml-001'}),expected=data.bookings.filter(b=>b.flightId==='ML-001');
 assert.equal(q.rows.length,expected.length);assert.equal(q.revenue,expected.reduce((n,b)=>n+b.fare,0));assert.equal(exploreBookings(data.bookings,{q:'NO-SUCH-BOOKING'}).rows.length,0);
 assert.equal(exploreBookings(data.bookings,{page:'99999'}).page,19);
});
