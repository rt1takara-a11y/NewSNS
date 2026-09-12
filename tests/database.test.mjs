import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
const directory=await mkdtemp(join(tmpdir(),'reme-db-'));
let db=new PGlite(directory);
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
await db.exec(`create role anon; create role authenticated; grant usage on schema public to anon, authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
insert into auth.users values('${A}'),('${B}');`);
await db.exec(await readFile(new URL('../supabase/migrations/202609080001_reme.sql',import.meta.url),'utf8'));
async function as(user,sql,args=[]){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);
 await db.exec('set role '+(user?'authenticated':'anon'));
 try{return await db.query(sql,args);}finally{await db.exec('reset role');}
}
const state=async u=>(await as(u,'select public.reme_state() as data')).rows[0].data;
const mutate=async(u,a,p,e)=>(await as(u,'select public.reme_mutate($1,$2::jsonb,$3) as data',[a,JSON.stringify(p),e])).rows[0].data;
const uuid=()=>crypto.randomUUID();
let a,b,postId;
after(async()=>{await db.close();await rm(directory,{recursive:true,force:true});});
test('anonymous caller cannot read state',async()=>{await assert.rejects(()=>state(null),/permission denied/);});
test('accounts and monthly IDs are separated, no internal IDs in snapshot',async()=>{
 a=await state(A);b=await state(B);assert.notEqual(a.me.publicId,A);assert.notEqual(a.me.publicId,b.me.publicId);
 assert.equal(JSON.stringify(a).includes(A),false);assert.equal(JSON.stringify(a).includes('account_id'),false);
 assert.equal(a.epoch,b.epoch);
});
test('direct table access and operator helpers denied',async()=>{
 for(const table of ['profiles','accounts','reports'])await assert.rejects(()=>as(A,`select * from reme_private.${table}`),/permission denied/);
 await assert.rejects(()=>as(A,'select reme_private.test_reset()'),/permission denied/);
});
test('profile update validates fields and ignores forged actor',async()=>{
 a=await mutate(A,'profile',{displayName:'A',icon:'🌱',bio:'hello',account_id:B},a.epoch);
 b=await mutate(B,'profile',{displayName:'B',icon:'🌙',bio:''},b.epoch);
 assert.equal((await state(B)).me.displayName,'B');
 await assert.rejects(()=>mutate(A,'profile',{displayName:'x'.repeat(31),icon:'🌱'},a.epoch),/INVALID_INPUT/);
});
test('shared post persists and operation retry is idempotent',async()=>{
 postId=uuid(); const p={id:postId,body:'shared hello',author:b.me.publicId};
 await mutate(A,'post',p,a.epoch); await mutate(A,'post',p,a.epoch);
 const s=await state(B);assert.equal(s.posts.length,1);assert.equal(s.posts[0].authorPublicId,a.me.publicId);
});
test('likes, replies and follows use verified actor; retries do not toggle',async()=>{
 await mutate(B,'like',{postId,enabled:true},b.epoch); await mutate(B,'like',{postId,enabled:true},b.epoch);
 const id=uuid();await mutate(B,'reply',{postId,id,body:'reply'},b.epoch);await mutate(B,'reply',{postId,id,body:'reply'},b.epoch);
 b=await mutate(B,'follow',{target:a.me.publicId,enabled:true},b.epoch);
 assert.deepEqual(b.following,[a.me.publicId]);assert.equal(b.posts[0].replies.length,1);assert.deepEqual(b.posts[0].likedBy,[b.me.publicId]);
});
test('cannot delete another person’s post or create overlong content',async()=>{
 await assert.rejects(()=>mutate(B,'delete_post',{postId},b.epoch),/FORBIDDEN/);
 await assert.rejects(()=>mutate(B,'post',{id:uuid(),body:'x'.repeat(501)},b.epoch),/INVALID_INPUT/);
});
test('public profile snapshot includes only public fields and follow/unfollow persists',async()=>{
 const s=await state(B);
 const profile=s.people.find(p=>p.publicId===a.me.publicId);
 assert.deepEqual(Object.keys(profile).sort(),['bio','displayName','icon','publicId']);
 assert.equal(profile.bio,'hello');assert.equal(profile.icon,'🌱');assert.equal(profile.displayName,'A');
 assert.equal(JSON.stringify(s).includes(A),false);assert.equal(JSON.stringify(s).includes(B),false);
 assert.equal(JSON.stringify(s).includes('email'),false);
 await mutate(B,'follow',{target:a.me.publicId,enabled:false},b.epoch);
 assert.deepEqual((await state(B)).following,[]);
 await mutate(B,'follow',{target:a.me.publicId,enabled:true},b.epoch);
 assert.deepEqual((await state(B)).following,[a.me.publicId]);
});
test('report stores evidence privately and is idempotent',async()=>{
 await mutate(B,'report',{postId,reason:'test report'},b.epoch);await mutate(B,'report',{postId,reason:'test report'},b.epoch);
 const r=(await db.query('select * from reme_private.reports')).rows;assert.equal(r.length,1);assert.equal(r[0].subject_account,A);assert.equal(r[0].snapshot.body,'shared hello');
 assert.equal(JSON.stringify(await state(B)).includes('test report'),false);
});
test('blocking hides posts and relationships in both directions',async()=>{
 b=await mutate(B,'block',{target:a.me.publicId},b.epoch);assert.equal(b.posts.length,0);assert.equal(b.following.length,0);assert.equal(b.blocked.length,1);
 assert.equal(b.people.some(p=>p.publicId===a.me.publicId),false);
 assert.equal((await state(A)).people.some(p=>p.publicId===b.me.publicId),false);
 await assert.rejects(()=>mutate(A,'follow',{target:b.me.publicId,enabled:true},a.epoch),/NOT_FOUND/);
 b=await mutate(B,'unblock',{target:a.me.publicId},b.epoch);assert.equal(b.posts.length,1);
});
test('server-owned reset creates new public IDs and rejects stale requests',async()=>{
 const old=a.me.publicId;await db.exec('select reme_private.test_reset()');
 const fresh=await state(A);assert.notEqual(fresh.me.publicId,old);assert.equal(fresh.me.displayName,'');assert.equal(fresh.posts.length,0);assert.equal(fresh.following.length,0);
 assert.equal(fresh.people.some(p=>p.publicId===b.me.publicId),false);
 await assert.rejects(()=>mutate(A,'follow',{target:b.me.publicId,enabled:true},fresh.epoch),/NOT_FOUND/);
 await assert.rejects(()=>mutate(A,'post',{id:uuid(),body:'stale'},a.epoch),/PERIOD_CHANGED/);
 await assert.rejects(()=>mutate(A,'like',{postId,enabled:true},fresh.epoch),/NOT_FOUND/);
 a=fresh;
});
test('suspension persists across reset and is enforced on reads and writes',async()=>{
 await db.query('select reme_private.suspend_account($1,true)',[B]);await db.exec('select reme_private.test_reset()');
 await assert.rejects(()=>state(B),/ACCOUNT_SUSPENDED/);
 await assert.rejects(()=>mutate(B,'profile',{displayName:'escape',icon:'🌱'},a.epoch),/ACCOUNT_SUSPENDED/);
 a=await state(A);
});
test('writes have a per-account rate limit',async()=>{
 await db.query('update reme_private.accounts set writes=30,window_at=now() where id=$1',[A]);
 await assert.rejects(()=>mutate(A,'profile',{displayName:'A',icon:'🌱'},a.epoch),/RATE_LIMITED/);
});
test('expired content purge preserves held evidence and active profiles',async()=>{
 await db.exec("update reme_private.profiles set created_at=now()-interval '100 days' where epoch<>reme_private.epoch(); update reme_private.reports set created_at=now()-interval '100 days', legal_hold=true; select reme_private.purge_expired();");
 assert.equal((await db.query('select count(*)::int as n from reme_private.reports')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int as n from reme_private.profiles where epoch<>reme_private.epoch()')).rows[0].n,0);
 assert.equal((await state(A)).me.publicId,a.me.publicId);
});
test('JST month boundary is based on server time expression',async()=>{
 const r=await db.query(`select to_char($1::timestamptz at time zone 'Asia/Tokyo','YYYY-MM') as month`,['2026-09-30T15:00:00Z']);
 assert.equal(r.rows[0].month,'2026-10');
 const before=await db.query(`select to_char($1::timestamptz at time zone 'Asia/Tokyo','YYYY-MM') as month`,['2026-09-30T14:59:59Z']);assert.equal(before.rows[0].month,'2026-09');
});

test('data remains after closing and reopening the database',async()=>{
 await db.close();db=new PGlite(directory);
 assert.equal((await state(A)).me.publicId,a.me.publicId);
 assert.equal((await db.query('select count(*)::int as n from reme_private.reports')).rows[0].n,1);
});
