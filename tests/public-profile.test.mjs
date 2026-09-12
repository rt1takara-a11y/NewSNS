import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/publicProfile.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { findPublicProfile, publicProfileHref, publicProfilePosts } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const me = { publicId: 'current-me', displayName: '自分', icon: '🌱', bio: '' };
const person = { publicId: 'current-person', displayName: '今月の人', icon: '🌙', bio: '自己紹介' };
const state = { period: '2026-09', me, people: [person], following: [], blocked: [], posts: [
  { id: 'earlier', authorPublicId: person.publicId, createdAt: 1 },
  { id: 'mine', authorPublicId: me.publicId, createdAt: 3 },
  { id: 'later', authorPublicId: person.publicId, createdAt: 2 },
] };

test('profile links use only the encoded monthly public ID', () => {
  const href = publicProfileHref({ ...person, account_id: 'private-account', email: 'private@example.test' });
  assert.equal(href, '/user/?id=current-person');
  assert.equal(publicProfileHref({ ...person, publicId: 'id&other=x#fragment' }), '/user/?id=id%26other%3Dx%23fragment');
});

test('current profile fields and only its posts are selected newest first', () => {
  assert.deepEqual(findPublicProfile(state, person.publicId), person);
  assert.equal(findPublicProfile(state, me.publicId), me);
  assert.deepEqual(publicProfilePosts(state, person.publicId).map(p => p.id), ['later', 'earlier']);
  assert.deepEqual(state.posts.map(p => p.id), ['earlier', 'mine', 'later']);
});

test('missing, malformed, internal, email and previous-month IDs do not resolve', () => {
  for (const id of [null, '', 'previous-person', 'private-account', 'private@example.test', '<script>']) {
    assert.equal(findPublicProfile(state, id), undefined);
    assert.deepEqual(publicProfilePosts(state, id), []);
  }
});

test('a blocked profile cannot be recovered even from a stale people/posts entry', () => {
  const blocked = { ...state, blocked: [person] };
  assert.equal(findPublicProfile(blocked, person.publicId), undefined);
  assert.deepEqual(publicProfilePosts(blocked, person.publicId), []);
});

test('reset or reverse block removing a person invalidates an open profile', () => {
  const next = { ...state, me: { ...me, publicId: 'new-me' }, people: [] };
  assert.equal(findPublicProfile(next, person.publicId), undefined);
  assert.equal(findPublicProfile(next, me.publicId), undefined);
  assert.deepEqual(publicProfilePosts(next, person.publicId), []);
});

test('a current profile with no posts remains available', () => {
  assert.equal(findPublicProfile({ ...state, posts: [] }, person.publicId), person);
  assert.deepEqual(publicProfilePosts({ ...state, posts: [] }, person.publicId), []);
});
