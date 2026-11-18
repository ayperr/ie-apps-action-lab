// Contextual email UI. Only the lab phrase enters memory; provider keys stay on the server.
export function createEmailActions({getContext,navigate}){
  document.body.insertAdjacentHTML('beforeend',`
    <div id="finding-menu" class="finding-menu" role="menu" aria-label="Actions for selected Mint KPI" hidden></div>
    <dialog id="mint-email-dialog" aria-labelledby="mint-email-title">
      <form id="mint-email-form">
        <div class="email-dialog-heading"><h2 id="mint-email-title">Share this Mint finding</h2><button type="button" id="email-close" class="quiet-button" aria-label="Close email review">✕</button></div>
        <p class="email-help">Review the current scope, edit your message, then confirm one send. Provider acceptance and inbox receipt are separate checks.</p>
        <p id="email-scope" class="email-scope"></p>
        <div id="email-edit">
          <label class="email-field">Recipient email<input id="email-to" type="email" maxlength="254" autocomplete="email" required></label>
          <label class="email-field">Subject<input id="email-subject" maxlength="200" required></label>
          <label class="email-field">Message<textarea id="email-body" rows="10" maxlength="8000" required></textarea></label>
          <p class="email-help">The test sender permits only your configured Resend account address. A source-scope and request-ID footer will be appended.</p>
        </div>
        <div id="email-review" hidden><h3>Exact email preview</h3><p id="email-reviewed-to"></p><strong id="email-reviewed-subject"></strong><pre id="email-reviewed-body"></pre><label class="email-consent"><input id="email-consent" type="checkbox">I reviewed the recipient, message and Mint filter scope. Send this email once.</label></div>
        <div id="email-result" class="email-result" hidden></div>
        <p id="email-form-status" role="status" aria-live="polite"></p>
        <div class="email-buttons"><button type="button" id="email-cancel" class="button">Cancel</button><button type="button" id="email-back" class="button" hidden>Edit message</button><button id="email-review-button" type="submit" class="button primary">Review exact email</button><button type="button" id="email-send" class="button primary" hidden disabled>Send this email once</button></div>
      </form>
    </dialog>`);
  const $=s=>document.querySelector(s),menu=$('#finding-menu'),dialog=$('#mint-email-dialog');
  let phrase='',connection=null,context=null,preview=null,requestId=null,reviewedDraft=null,originButton=null,busy=false,sendStarted=false,loadController=null;
  const headers=()=>({'Content-Type':'application/json',...(phrase?{Authorization:'Bearer '+phrase}:{})});
  const text=(id,value)=>{$(id).textContent=value;};
  const setupIssues=result=>[result.missing.length?'Missing: '+result.missing.join(', '):'',result.invalid?.length?'Invalid format: '+result.invalid.join(', '):''].filter(Boolean).join('. ');
  async function request(body,{signal}={}){
    const response=await fetch('/api/mint-email',{method:body?'POST':'GET',headers:headers(),...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal});
    const result=await response.json();
    if(!response.ok)throw Object.assign(Error(result.message||'Email request unavailable.'),{result});
    return result;
  }
  function reportConnection(result){
    connection=result;
    text('#email-connection-status',result.message+(setupIssues(result)?' '+setupIssues(result)+'.':''));
    if(!result.configured)text('#email-connection-status',$('#email-connection-status').textContent+' Enter provider settings directly in Vercel; never in this page.');
    if(dialog.open&&!sendStarted)text('#email-form-status',result.configured?(result.authenticated?'Lab access verified. Review the message before sending.':'Enter your lab phrase in Email connection before sending.'):'Server setup needs attention. '+setupIssues(result));
    return result;
  }
  async function checkConnection(){
    phrase=$('#email-lab-phrase').value;
    const button=$('#email-check-connection');button.disabled=true;text('#email-connection-status','Checking server configuration…');
    try{reportConnection(await request());}catch{text('#email-connection-status','Could not read email connection status. No email was sent.');}finally{button.disabled=false;}
  }
  $('#email-check-connection').addEventListener('click',checkConnection);
  $('#email-clear-phrase').addEventListener('click',async()=>{phrase='';$('#email-lab-phrase').value='';try{const response=await fetch('/api/mint-email',{method:'DELETE'});text('#email-connection-status',response.ok?'Lab phrase and verified session cleared.':'Phrase cleared; close this browser session to clear access.');}catch{text('#email-connection-status','Phrase cleared; close this browser session to clear access.');}});
  $('#email-lab-phrase').addEventListener('input',event=>{phrase=event.target.value;});
  const closeMenu=()=>{menu.hidden=true;originButton?.setAttribute('aria-expanded','false');};
  function openMenu(button){
    const {state,data}=getContext();if(!data||state.view!=='overview')return;
    closeMenu();originButton=button;button.setAttribute('aria-expanded','true');
    context={metric:button.dataset.metric,scope:Object.fromEntries(['route','from','to','asof','compare'].map(k=>[k,state[k]])),next:button.dataset.next};
    menu.replaceChildren();const title=document.createElement('strong');title.textContent=button.querySelector('.metric-label').textContent;menu.append(title);
    for(const [label,action] of [[context.next==='mix'?'Explore fares & channels':'Inspect booking pace','explore'],['Share finding by email','email']]){
      const item=document.createElement('button');item.type='button';item.role='menuitem';item.textContent=label;
      item.addEventListener('click',()=>{closeMenu();if(action==='email')openEmail();else navigate({view:context.next==='mix'?'mix':'pace',flight:'',focus:'',booking:''});});menu.append(item);
    }
    menu.hidden=false;const box=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(box.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(box.bottom+6,innerHeight-menu.offsetHeight-8))+'px';menu.querySelector('button').focus();
  }
  menu.addEventListener('keydown',event=>{const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();closeMenu();originButton?.focus();}else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();items[(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
  document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!event.target.closest('[data-action="finding"]'))closeMenu();});
  async function openEmail(){
    loadController?.abort();loadController=new AbortController();preview=null;requestId=crypto.randomUUID();reviewedDraft=null;busy=true;sendStarted=false;
    $('#mint-email-form').reset();$('#email-edit').hidden=false;$('#email-review').hidden=true;$('#email-result').hidden=true;$('#email-review-button').hidden=false;$('#email-review-button').disabled=true;$('#email-send').hidden=true;$('#email-back').hidden=true;$('#email-cancel').textContent='Cancel';
    text('#email-scope',`Selected route: ${context.scope.route==='all'?'All six routes':context.scope.route} · departures ${context.scope.from}–${context.scope.to} · as of ${context.scope.asof} · all channels`);
    text('#email-form-status','Recalculating this Mint cohort from Supabase…');dialog.showModal();
    try{
      const result=await request({operation:'preview',metric:context.metric,scope:context.scope},{signal:loadController.signal});
      if(!dialog.open)return;preview=result;reportConnection(result.connection);
      $('#email-to').value=result.draft.to||'';$('#email-subject').value=result.draft.subject;$('#email-body').value=result.draft.body;
      $('#email-review-button').disabled=false;$('#email-to').focus();
    }catch(error){if(error.name!=='AbortError')text('#email-form-status',error.message+' No email was sent.');}finally{busy=false;}
  }
  function close(){if(busy&&sendStarted)return;loadController?.abort();dialog.close();closeMenu();originButton?.focus();}
  $('#email-close').addEventListener('click',close);$('#email-cancel').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{if(busy&&sendStarted)event.preventDefault();else loadController?.abort();});
  $('#email-back').addEventListener('click',()=>{if(sendStarted)return;$('#email-review').hidden=true;$('#email-edit').hidden=false;$('#email-back').hidden=true;$('#email-send').hidden=true;$('#email-review-button').hidden=false;$('#email-subject').focus();});
  $('#mint-email-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||sendStarted||!preview)return;
    const draft={to:$('#email-to').value.trim(),subject:$('#email-subject').value.trim(),body:$('#email-body').value.trim()};
    busy=true;$('#email-review-button').disabled=true;text('#email-form-status','Validating the exact message and source scope…');
    try{
      const checked=await request({operation:'preview',metric:context.metric,scope:context.scope,draft});
      if(checked.fingerprint!==preview.fingerprint)throw Error('Source facts changed. Close this dialog and open a fresh finding.');
      reviewedDraft=draft;preview=checked;
      text('#email-reviewed-to','To: '+draft.to);text('#email-reviewed-subject',draft.subject);text('#email-reviewed-body',draft.body+preview.sourceFooter+`\n\n---\nSource record: mint-portfolio\nAction request: ${requestId}\n[ie-lab-action:${requestId}]`);
      $('#email-edit').hidden=true;$('#email-review').hidden=false;$('#email-review-button').hidden=true;$('#email-back').hidden=false;$('#email-send').hidden=false;$('#email-consent').checked=false;$('#email-send').disabled=true;
      text('#email-form-status',checked.connection.configured?(checked.connection.authenticated?'Ready for your explicit confirmation. No email has been sent.':'Email is configured. Enter your lab phrase in Email connection before sending.'):'Server setup needs attention. '+setupIssues(checked.connection)+'. No email has been sent.');$('#email-consent').focus();
    }catch(error){text('#email-form-status',error.message);}finally{busy=false;$('#email-review-button').disabled=false;}
  });
  $('#email-consent').addEventListener('change',event=>{$('#email-send').disabled=!event.target.checked||sendStarted;});
  $('#email-send').addEventListener('click',async()=>{
    if(busy||sendStarted||!reviewedDraft||!$('#email-consent').checked)return;
    sendStarted=true;busy=true;$('#email-send').disabled=true;$('#email-back').hidden=true;$('#email-cancel').disabled=true;$('#email-close').disabled=true;text('#email-form-status','Sending once, then reading the provider result…');
    try{
      const result=await request({operation:'execute',scope:context.scope,metric:context.metric,draft:reviewedDraft,fingerprint:preview.fingerprint,confirmed:true,requestId});
      $('#email-result').hidden=false;$('#email-result').replaceChildren();
      const entries=[result.message,'Action request: '+result.requestId,'Resend email ID: '+(result.providerId||'Unavailable'),'Provider delivery state: '+(result.deliveryState||'unknown'),'Exact provider content: '+(result.providerContentMatched?'matched by independent read':'not verified'),'Inbox receipt: pending a separate inbox check.'];
      for(const value of entries){const p=document.createElement('p');p.textContent=value;$('#email-result').append(p);}
      text('#email-form-status','Keep these identifiers. Do not send again to check delivery.');
    }catch(error){text('#email-form-status',error.message+' Action request: '+requestId+'. No automatic retry was made.');}
    finally{busy=false;$('#email-cancel').disabled=false;$('#email-close').disabled=false;$('#email-cancel').textContent='Close';$('#email-send').hidden=true;$('#email-consent').disabled=true;}
  });
  checkConnection();
  return {openMenu,getHeaders:headers};
}

