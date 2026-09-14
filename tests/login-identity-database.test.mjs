import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
const dir=new URL('../supabase/migrations/',import.meta.url);
for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'));
after(()=>db.close());
async function as(role,sql,args=[]) {
  await db.exec('set role '+role);
  try { return await db.query(sql,args); } finally {await db.exec('reset role');}
}
const identity=(id,create)=>as('service_role','select public.reme_login_identity($1,$2) as value',[id,create]);
const attempt=(client='a'.repeat(64),id='b'.repeat(64),signup=false)=>as('service_role','select public.reme_auth_attempt($1,$2,$3) as value',[client,id,signup]);
test('browser roles cannot resolve login IDs, access private tables or manipulate rate limits',async()=>{
 for(const role of ['anon','authenticated']) for(const sql of [
  "select public.reme_login_identity('user_name',true)",
  "select public.reme_auth_attempt(repeat('a',64),repeat('b',64),false)",
  'select * from reme_private.login_identities',
  'select * from reme_private.auth_attempts',
 ]) await assert.rejects(()=>as(role,sql),/permission denied/);
 const rows=(await db.query("select relrowsecurity from pg_class where oid in ('reme_private.login_identities'::regclass,'reme_private.auth_attempts'::regclass)")).rows;
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.relrowsecurity));
});
test('private registry reserves a unique stable random alias, including across monthly reset',async()=>{
 assert.equal((await identity('user_name',false)).rows[0].value,null);
 const alias=(await identity('user_name',true)).rows[0].value;
 assert.match(alias,/^[a-f0-9-]{36}@login\.reme\.invalid$/);
 assert.equal(alias.includes('user_name'),false);
 assert.equal((await identity('user_name',true)).rows[0].value,alias);
 assert.notEqual((await identity('other_user',true)).rows[0].value,alias);
 await db.query('select reme_private.test_reset()');
 assert.equal((await identity('user_name',false)).rows[0].value,alias);
 for(const id of ['UPPER','abc','email@example.com',null]) await assert.rejects(()=>identity(id,true),/INVALID_INPUT/);
});
test('ID rate limits survive rejected requests and reset only after expiry',async()=>{
 await db.exec('truncate reme_private.auth_attempts');
 for(let i=0;i<15;i++) assert.equal((await attempt()).rows[0].value,true);
 for(let i=0;i<3;i++) assert.equal((await attempt()).rows[0].value,false);
 assert.equal((await db.query("select attempts from reme_private.auth_attempts where bucket='login:'||repeat('b',64)")).rows[0].attempts,16);
 await db.exec("update reme_private.auth_attempts set expires_at=now()-interval '1 second'");
 assert.equal((await attempt()).rows[0].value,true);
});
test('signup client limit applies across different IDs and rejects invalid hashes',async()=>{
 await db.exec('truncate reme_private.auth_attempts');
 for(let i=0;i<7;i++) assert.equal((await attempt('a'.repeat(64),i.toString(16).padStart(64,'0'),true)).rows[0].value,i<5);
 await assert.rejects(()=>attempt('raw-ip'),/INVALID_INPUT/);
});
