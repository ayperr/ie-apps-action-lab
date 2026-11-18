const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createPolicyActions({getContext,getHeaders,setPolicy}){
  let current=null,preview=null,requestId=null,busy=false,generation=0;
  const $=s=>document.querySelector(s);
  document.body.insertAdjacentHTML('beforeend',`<dialog id="policy-dialog" aria-labelledby="policy-title"><h2 id="policy-title">Review saved upgrade fee</h2><div id="policy-preview"></div><label class="email-consent"><input id="policy-confirm" type="checkbox">I reviewed this synthetic adjustment and its expected effect.</label><p id="policy-save-status" role="status"></p><div class="email-buttons"><button type="button" class="button" id="policy-cancel">Cancel</button><button type="button" class="button primary" id="policy-save" disabled>Save fee once</button></div></dialog>`);
  async function request(body,flightId){
    const response=await fetch('/api/upgrade-policy'+(body?'':'?departure='+encodeURIComponent(flightId)),{method:body?'POST':'GET',headers:getHeaders(),cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw Error(result.message||'Scenario storage unavailable.');return result;
  }
  function panel(){return `<section class="panel saved-policy" id="saved-policy"><h2>Save the upgrade-fee assumption</h2><p class="panel-subtitle">A Supabase practice record for this fictional departure. Saving changes the scenario fee; it does not change bookings or offer a fare to customers. Other simulation controls remain temporary.</p><p id="policy-current" role="status">Reading saved fee…</p><label class="email-field">Reason for this scenario adjustment<textarea id="policy-reason" rows="3" maxlength="1000" placeholder="Explain the synthetic practice adjustment; no personal information."></textarea></label><div class="email-buttons"><button type="button" class="button" id="policy-reload">Read saved fee</button><button type="button" class="button primary" id="policy-review" disabled>Review current slider fee</button></div><p class="panel-footnote" id="policy-status" role="status">No change is saved until you review and confirm.</p></section>`;}
  async function mount(){
    const token=++generation,element=$('#saved-policy');current=null;if(!element)return;
    const {state}=getContext(),flightId=state.flight;
    $('#policy-reload').onclick=()=>load(true);
    $('#policy-review').onclick=review;
    async function load(force=false){
      $('#policy-review').disabled=true;
      try{
        const result=await request(null,flightId);if(token!==generation||!document.contains(element))return;
        current=result.record;
        $('#policy-current').textContent=`${current.departure_id} · saved upgrade fee ${money(current.upgrade_fee_usd)} · revision ${current.revision} · ${new Date(current.updated_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})}`;
        $('#policy-status').textContent=result.writeConfigured?'Explore with the slider, add a reason, then review. Lab access is required to save.':'Saved value loaded. Server write setup still needs SUPABASE_SECRET_KEY.';
        $('#policy-review').disabled=false;
        setPolicy(flightId,current.upgrade_fee_usd,{resetAssumptions:force});
      }catch(error){if(token===generation&&document.contains(element))$('#policy-status').textContent=error.message;}
    }
    await load(true);
  }
  async function review(){
    if(busy||!current)return;busy=true;$('#policy-review').disabled=true;
    try{
      const departureId=getContext().state.flight,newFee=Number($('#upgrade-price').value),reason=$('#policy-reason').value.trim();
      const result=await request({operation:'preview',departureId,newFee,reason});
      if(departureId!==getContext().state.flight)return;
      preview=result;requestId=crypto.randomUUID();const p=result.proposal,c=result.comparison;
      $('#policy-preview').innerHTML=`<dl class="definition-list"><div><dt>Record / field</dt><dd>${escape(p.departureId)} / upgrade_fee_usd</dd></div><div><dt>Exact change</dt><dd>${money(p.oldFee)} → ${money(p.newFee)} · expected revision ${p.revision}</dd></div><div><dt>Reason</dt><dd>${escape(p.reason)}</dd></div><div><dt>Predicted modeled future revenue</dt><dd>${money(c.before.revenue)} → ${money(c.after.revenue)} (${c.modeledRevenueChange>=0?'+':''}${money(c.modeledRevenueChange)})</dd></div><div><dt>Hold-all baseline</dt><dd>${money(c.before.baselineRevenue)} · unchanged</dd></div></dl><p>Comparison uses 240 paired seeded scenarios, base demand, 15% potential switching, and up to 3 protected seats. Saving restores these assumptions for a comparable display. This is an uncalibrated simulation, not proven uplift.</p><p>Booked revenue, booked passengers, remaining seats and pickup stay unchanged.</p><p class="context-code">Action request: ${requestId}</p>`;
      $('#policy-confirm').checked=false;$('#policy-save').disabled=true;$('#policy-save').hidden=false;$('#policy-cancel').textContent='Cancel';$('#policy-save-status').textContent=result.writeConfigured?'Review before confirming. No change has been saved.':'Server write setup is missing. Review is available; saving is blocked.';
      $('#policy-dialog').showModal();
    }catch(error){$('#policy-status').textContent=error.message;}finally{busy=false;if($('#policy-review'))$('#policy-review').disabled=false;}
  }
  $('#policy-confirm').onchange=()=>{$('#policy-save').disabled=!$('#policy-confirm').checked||!preview?.writeConfigured||busy;};
  $('#policy-cancel').onclick=()=>{if(!busy)$('#policy-dialog').close();};
  $('#policy-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('#policy-save').onclick=async()=>{
    if(busy||!preview||!$('#policy-confirm').checked)return;busy=true;$('#policy-save').disabled=true;$('#policy-cancel').disabled=true;$('#policy-save-status').textContent='Saving once and reading the current database value…';
    const p=preview.proposal;
    try{
      const result=await request({operation:'execute',departureId:p.departureId,newFee:p.newFee,reason:p.reason,expectedFee:p.oldFee,expectedRevision:p.revision,fingerprint:preview.fingerprint,requestId,confirmed:true});
      $('#policy-save-status').textContent=`${result.message} Request ${result.receipt.request_id}; revision ${result.receipt.old_revision} → ${result.receipt.new_revision}.`;
      if(getContext().state.flight===p.departureId){current=result.record;setPolicy(p.departureId,result.record.upgrade_fee_usd,{resetAssumptions:true});$('#policy-current').textContent=`${p.departureId} · saved upgrade fee ${money(result.record.upgrade_fee_usd)} · revision ${result.record.revision}`;$('#policy-status').textContent='Saved and read back. Reload this page to verify persistence.';}
    }catch(error){$('#policy-save-status').textContent=error.message+' No automatic retry was made. Read the saved value before another attempt.';}
    finally{busy=false;$('#policy-save').hidden=true;$('#policy-cancel').disabled=false;$('#policy-cancel').textContent='Close';}
  };
  return {panel,mount};
}

