import test from 'node:test';
import assert from 'node:assert/strict';
import {labRequestAuthorization,clearLabSession} from '../server-lib/lab-access.mjs';
test('verified phrase yields a scoped HttpOnly session without storing the password',()=>{
  const env={LAB_ACCESS_KEY:'a'.repeat(40)},now=1794960000000;let cookie;
  const res={setHeader:(name,value)=>{cookie=value;}};
  assert.equal(labRequestAuthorization({headers:{authorization:'Bearer '+env.LAB_ACCESS_KEY}},res,{env,now,issueSession:true}),'Bearer '+env.LAB_ACCESS_KEY);
  assert.match(cookie,/Path=\/api; HttpOnly; Secure; SameSite=Strict; Max-Age=3600/);assert.equal(cookie.includes(env.LAB_ACCESS_KEY),false);
  const token=cookie.split(';')[0];
  assert.equal(labRequestAuthorization({headers:{cookie:token}},res,{env,now}),'Bearer '+env.LAB_ACCESS_KEY);
  assert.equal(labRequestAuthorization({headers:{cookie:token}},res,{env,now:now+3600001}),'');
  assert.equal(labRequestAuthorization({headers:{cookie:token.replace(/.$/,'z')}},res,{env,now}),'');
  assert.equal(labRequestAuthorization({headers:{cookie:token}},res,{env:{LAB_ACCESS_KEY:'b'.repeat(40)},now}),'');
  clearLabSession(res);assert.match(cookie,/Max-Age=0/);
});

