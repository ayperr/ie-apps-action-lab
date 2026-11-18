import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createUpgradePolicyService,feeComparison} from '../server-lib/upgrade-policy.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/foundation.json',import.meta.url),'utf8'));
const env={LAB_ACCESS_KEY:'x'.repeat(40),SUPABASE_SECRET_KEY:'test_only_not_a_credential'};
const base={operation:'preview',departureId:'ML-001',newFee:500,reason:'Synthetic sensitivity exercise: compare a $50 higher upgrade fee with the existing assumption.'};
function setup(options={}){
  let row={departure_id:'ML-001',upgrade_fee_usd:450,revision:1},calls=0,currentData=structuredClone(fixture);
  const store={read:async()=>({...row}),save:async p=>{calls++;if(row.revision!==p.p_expected_revision||row.upgrade_fee_usd!==p.p_expected_fee)return {state:'conflict',message:'Saved fee changed.'};row={...row,upgrade_fee_usd:p.p_new_fee,revision:row.revision+1};return {state:'saved',record:{...row},receipt:{request_id:p.p_request_id,new_revision:row.revision}};}};
  const service=createUpgradePolicyService({env,store,loadData:async()=>currentData,...options});
  return {service,writeCount:()=>calls,change:()=>{row.revision++;},changeData:()=>{currentData.meta.sourceSha256='changed';}};
}
async function prepared(t){const r=await t.service.submit(base);assert.equal(r.status,200);return {...base,operation:'execute',confirmed:true,expectedFee:450,expectedRevision:1,fingerprint:r.body.fingerprint,requestId:'20000000-0000-4000-8000-000000000001'};}
test('fee sensitivity uses paired scenarios and preserves historical facts',()=>{
  const frozen=JSON.stringify(fixture),f=fixture.flights.find(f=>f.id==='ML-001'),r=feeComparison(f,450,500);
  assert.equal(r.before.baselineRevenue,r.after.baselineRevenue);assert.equal(r.modeledRevenueChange,r.after.revenue-r.before.revenue);
  assert.notEqual(r.before.revenue,r.after.revenue);assert.equal(JSON.stringify(fixture),frozen);assert.equal(r.synthetic,true);
});
test('read and preview are available without granting writes',async()=>{const t=setup({env:{}});assert.equal((await t.service.read('ML-001')).body.record.upgrade_fee_usd,450);assert.equal((await t.service.submit(base)).body.writeConfigured,false);assert.equal((await t.service.submit(await prepared(t))).status,503);assert.equal(t.writeCount(),0);});
test('auth and explicit confirmation are mandatory before a numeric effect',async()=>{const t=setup(),p=await prepared(t);assert.equal((await t.service.submit(p)).status,401);assert.equal((await t.service.submit({...p,confirmed:false},'Bearer '+env.LAB_ACCESS_KEY)).status,400);assert.equal(t.writeCount(),0);});
test('rejects invalid fields, fee steps, empty reasons and unchanged proposals',async()=>{const t=setup();for(const change of [{newFee:499},{newFee:1250},{reason:'short'},{departureId:'../other'},{unexpected:true},{newFee:null}])assert.equal((await t.service.submit({...base,...change})).status,400);assert.equal((await t.service.submit({...base,newFee:450})).status,422);assert.equal(t.writeCount(),0);});
test('saved fee has an independent readback and a source-bound preview',async()=>{const t=setup(),r=await t.service.submit(await prepared(t),'Bearer '+env.LAB_ACCESS_KEY);assert.equal(r.body.state,'saved');assert.equal(r.body.readbackVerified,true);assert.equal((await t.service.read('ML-001')).body.record.upgrade_fee_usd,500);assert.equal(t.writeCount(),1);});
test('stale revisions and changed source facts cannot overwrite quietly',async()=>{const t=setup(),p=await prepared(t);t.change();assert.equal((await t.service.submit(p,'Bearer '+env.LAB_ACCESS_KEY)).status,409);const u=setup(),q=await prepared(u);u.changeData();assert.equal((await u.service.submit(q,'Bearer '+env.LAB_ACCESS_KEY)).status,409);assert.equal(u.writeCount(),0);});
test('unknown write outcome does not retry the database',async()=>{let calls=0;const t=setup({store:{read:async()=>({departure_id:'ML-001',upgrade_fee_usd:450,revision:1}),save:async()=>{calls++;throw Error('network');}}});const r=await t.service.submit(await prepared(t),'Bearer '+env.LAB_ACCESS_KEY);assert.equal(r.body.state,'unknown');assert.equal(calls,1);});

