import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/connections.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { currentConnections, demoConnections } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const me = { publicId: 'monthly-me', displayName: '自分', bio: '', icon: '🙂' };
const other = { publicId: 'monthly-other', displayName: '相手', bio: '', icon: '🌱' };
const state = { me, people: [other], following: [other.publicId], posts: [], epoch: '2026-09:0', period: '2026-09' };

test('demo follow and unfollow are reflected in both profile directions', () => {
  assert.deepEqual(demoConnections(state, me.publicId).following, [other]);
  assert.deepEqual(demoConnections(state, other.publicId).followers, [me]);
  assert.deepEqual(demoConnections({ ...state, following: [] }, other.publicId).followers, []);
  assert.deepEqual(demoConnections({ ...state, blocked: [other] }, me.publicId).following, []);
  assert.deepEqual(demoConnections({ ...state, blocked: [other] }, other.publicId).followers, []);
  assert.deepEqual(demoConnections(state, 'previous-month').followers, []);
});
test('late responses cannot reappear after state, identity, target or month changes', () => {
  const data = demoConnections(state, me.publicId);
  const result = { snapshot: state, data };
  assert.equal(currentConnections(state, me.publicId, result), data);
  for (const changed of [
    { ...state, following: [] },
    { ...state, people: [] }, // reverse block or suspension from a refreshed snapshot
    { ...state, blocked: [other] },
    { ...state, me: other },
    { ...state, epoch: '2026-10:0' },
  ]) assert.equal(currentConnections(changed, me.publicId, result), undefined);
  assert.equal(currentConnections(state, other.publicId, result), undefined);
  assert.equal(currentConnections(state, me.publicId, { snapshot: state, data: { ...data, epoch: 'old' } }), undefined);
});
test('failed and pending responses remain unknown instead of showing zero', () => {
  assert.equal(currentConnections(state, me.publicId), undefined);
  assert.equal(currentConnections(state, me.publicId, { snapshot: state }), undefined);
  const empty = { ...demoConnections(state, me.publicId), following: [], followers: [] };
  assert.equal(currentConnections(state, me.publicId, { snapshot: state, data: empty }).following.length, 0);
});
