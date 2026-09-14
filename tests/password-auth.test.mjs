import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/reme-password-auth/handler.ts';

const origin = 'https://reme.example';
const alias = '00000000-0000-4000-8000-000000000001@login.reme.invalid';
const password = 'a long test password';
function setup(overrides = {}) {
  const calls = [];
  const handler = createHandler({ url: 'https://db.example', serviceKey: 'server-secret', publicKey: 'public-key',
    allowedOrigins: [origin], minimumFailureMs: 0,
    fetcher: async (url, init) => {
      const path = new URL(url).pathname;
      const body = JSON.parse(init.body);
      calls.push({path, body, headers:init.headers});
      const response = overrides[path];
      if (response instanceof Error) throw response;
      const defaults = {
        '/rest/v1/rpc/reme_auth_attempt': true,
        '/rest/v1/rpc/reme_login_identity': alias,
        '/auth/v1/admin/users': {id:'private-account'},
        '/auth/v1/token': {access_token:'access',refresh_token:'refresh',user:{email:alias}},
        '/rest/v1/rpc/reme_state': {me:{publicId:'monthly'}},
      };
      assert.ok(path in defaults, `unexpected upstream request ${path}`);
      return new Response(JSON.stringify(response ? response.body : defaults[path]), {status:response?.status ?? 200});
    } });
  const send = (body = {}, headers = {}) => handler(new Request(origin, {
    method:'POST', headers:{origin,'content-type':'application/json',...headers},
    body:JSON.stringify({action:'login',loginId:'  Test_User ',password,...body}),
  }));
  return {handler,send,calls};
}
test('login keeps aliases and admin credentials out of responses and authorizes with the new user token', async () => {
  const {send,calls} = setup(); const response = await send();
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{access_token:'access',refresh_token:'refresh'});
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(calls[1].body.login_id,'test_user');
  assert.equal(calls[1].body.create_if_missing,false);
  assert.equal(calls.at(-1).headers.Authorization,'Bearer access');
  assert.equal(calls.at(-1).headers.apikey,'public-key');
  assert.equal(calls.some(c=>c.path.includes('admin')),false);
  assert.equal(JSON.stringify(calls[0].body).includes('test_user'),false);
});
test('registration requires consent, uses private alias and never sends an OTP', async () => {
  const {send,calls}=setup();
  assert.equal((await send({action:'register'})).status,400); assert.equal(calls.length,0);
  assert.equal((await send({action:'register',noRecoveryAccepted:true})).status,200);
  const created=calls.find(c=>c.path.includes('admin'));
  assert.deepEqual(created.body,{email:alias,password,email_confirm:true,app_metadata:{reme_login_method:'login_id'}});
  assert.equal(calls[1].body.create_if_missing,true);
});
test('duplicate registration never changes a password or logs into the existing account', async () => {
  const {send,calls}=setup({'/auth/v1/admin/users':{status:422,body:{message:'private details'}}});
  const response=await send({action:'register',noRecoveryAccepted:true});
  assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:'REGISTRATION_UNAVAILABLE'});
  assert.equal(calls.length,3);
});
test('unknown ID, wrong password and suspension share a generic rejection', async () => {
  for(const override of [
    {'/rest/v1/rpc/reme_login_identity':{body:null}},
    {'/auth/v1/token':{status:400,body:{message:'wrong password'}}},
    {'/rest/v1/rpc/reme_state':{status:400,body:{message:'ACCOUNT_SUSPENDED'}}},
  ]) {
    const response=await setup(override).send();
    assert.equal(response.status,401); assert.deepEqual(await response.json(),{error:'INVALID_CREDENTIALS'});
  }
});
test('rate denial stops before identity lookup; upstream errors never leak secrets', async () => {
  const limited=setup({'/rest/v1/rpc/reme_auth_attempt':{body:false}});
  assert.equal((await limited.send()).status,429);assert.equal(limited.calls.length,1);
  const response=await setup({'/rest/v1/rpc/reme_login_identity':new Error('server-secret '+password)}).send();
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'UNAVAILABLE'});
});
test('invalid bodies and disallowed origins do not contact the backend', async () => {
  const {send,calls,handler}=setup();
  for(const body of [{loginId:'abc'}, {password:'short'}, {password:'a'.repeat(73)}, {password:'全角'.repeat(15)}, {padding:'x'.repeat(2048)}]) {
    assert.equal((await send(body)).status,400);
  }
  assert.equal((await send({}, {origin:'https://other.example'})).status,403);
  const preflight=await handler(new Request(origin,{method:'OPTIONS',headers:{origin}}));
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
  assert.equal(calls.length,0);
});
