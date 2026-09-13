import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const users = Array.from({ length: 4 }, () => crypto.randomUUID());
await db.exec(`create role anon; create role authenticated;
 grant usage on schema public to anon, authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as
 $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
for (const id of users) await db.query('insert into auth.users values ($1)', [id]);
const migrations = new URL('../supabase/migrations/', import.meta.url);
for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(await readFile(new URL(file, migrations), 'utf8'));
}
async function as(user, sql, args = [], role = user ? 'authenticated' : 'anon') {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  await db.exec('set role ' + role);
  try { return (await db.query(sql, args)).rows[0]?.data; }
  finally { await db.exec('reset role'); }
}
const snapshots = [];
for (const id of users) snapshots.push(await as(id, 'select public.reme_state() as data'));
const [a, b, c, d] = snapshots.map(s => s.me.publicId);
const epoch = snapshots[0].epoch;
const read = (viewer, target, expected = epoch) => as(viewer,
  'select public.reme_connections($1, $2) as data', [target, expected]);
const follow = (viewer, target, enabled = true) => as(viewer,
  'select public.reme_mutate($1, $2::jsonb, $3) as data',
  ['follow', JSON.stringify({ target, enabled }), epoch]);
for (const [viewer, target] of [[users[0], b], [users[1], a], [users[2], a], [users[3], a]]) {
  await follow(viewer, target);
}
after(() => db.close());

test('connections require an authenticated, non-suspended viewer', async () => {
  await assert.rejects(() => read(null, a), /permission denied/);
  await assert.rejects(() => as(null, 'select public.reme_connections($1,$2) as data', [a, epoch], 'authenticated'), /AUTH_REQUIRED/);
  await db.query('update reme_private.accounts set suspended = true where id=$1', [users[3]]);
  await assert.rejects(() => read(users[3], a), /ACCOUNT_SUSPENDED/);
  await db.query('update reme_private.accounts set suspended = false where id=$1', [users[3]]);
});
test('own and other profiles return the two directions, only public fields', async () => {
  for (const viewer of [users[0], users[1]]) {
    const data = await read(viewer, a);
    assert.equal(data.epoch, epoch); assert.equal(data.targetPublicId, a);
    assert.deepEqual(data.following.map(p => p.publicId), [b]);
    assert.deepEqual(new Set(data.followers.map(p => p.publicId)), new Set([b, c, d]));
    for (const p of [...data.following, ...data.followers]) {
      assert.deepEqual(Object.keys(p).sort(), ['bio', 'displayName', 'icon', 'publicId']);
    }
    for (const id of users) assert.equal(JSON.stringify(data).includes(id), false);
    assert.equal(JSON.stringify(data).includes('email'), false);
  }
});
test('unfollow changes both profile lists and empty counts are real zero', async () => {
  await follow(users[0], b, false);
  assert.equal((await read(users[0], a)).following.length, 0);
  assert.equal((await read(users[0], b)).followers.length, 0);
  await follow(users[0], b);
});
test('third-party lists exclude both directions of viewer blocks', async () => {
  for (const [actor, target] of [[b, c], [c, b]]) {
    await db.query('insert into reme_private.blocks values ($1,$2)', [actor, target]);
    const data = await read(users[1], a);
    assert.deepEqual(new Set(data.followers.map(p => p.publicId)), new Set([b, d]));
    await db.exec('delete from reme_private.blocks');
  }
});
test('blocked targets are unavailable and target blocks filter stale edges', async () => {
  for (const [actor, target] of [[a, b], [b, a]]) {
    await db.query('insert into reme_private.blocks values ($1,$2)', [actor, target]);
    await assert.rejects(() => read(users[1], a), /NOT_FOUND/);
    const data = await read(users[2], a);
    assert.equal(data.following.length, 0);
    assert.equal(data.followers.some(p => p.publicId === b), false);
    await db.exec('delete from reme_private.blocks');
  }
});
test('suspended people disappear from counts, lists and target lookup', async () => {
  await db.query('update reme_private.accounts set suspended=true where id=$1', [users[1]]);
  const data = await read(users[2], a);
  assert.equal(data.following.length, 0); assert.equal(data.followers.length, 2);
  await assert.rejects(() => read(users[0], b), /NOT_FOUND/);
  await db.query('update reme_private.accounts set suspended=false where id=$1', [users[1]]);
});
test('internal, unknown and previous-month IDs cannot be used as targets or list members', async () => {
  for (const id of [users[0], crypto.randomUUID(), null]) {
    await assert.rejects(() => read(users[0], id), /NOT_FOUND/);
  }
  await db.query("update reme_private.profiles set epoch='2000-01:0' where id=$1", [b]);
  const data = await read(users[2], a);
  assert.equal(data.following.length, 0);
  assert.equal(data.followers.some(p => p.publicId === b), false);
  await assert.rejects(() => read(users[0], b), /NOT_FOUND/);
  await db.query('update reme_private.profiles set epoch=$1 where id=$2', [epoch, b]);
});
test('reset rejects stale epochs and old targets; new monthly profile has no edges', async () => {
  await db.exec('select reme_private.test_reset()');
  await assert.rejects(() => read(users[0], a), /PERIOD_CHANGED/);
  await assert.rejects(() => read(users[0], a, null), /PERIOD_CHANGED/);
  const fresh = await as(users[0], 'select public.reme_state() as data');
  await assert.rejects(() => read(users[0], a, fresh.epoch), /NOT_FOUND/);
  const data = await read(users[0], fresh.me.publicId, fresh.epoch);
  assert.deepEqual(data.following, []); assert.deepEqual(data.followers, []);
});
