import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPeriod,periodLabel,periodParts} from '../src/lib/period.ts';

test('JST week changes exactly at Monday 00:00',()=>{
 assert.equal(currentPeriod(new Date('2026-09-20T14:59:59Z')),'2026-W38');
 assert.equal(currentPeriod(new Date('2026-09-20T15:00:00Z')),'2026-W39');
});

test('ISO week-year is used around New Year',()=>{
 assert.equal(currentPeriod(new Date('2027-01-03T14:59:59Z')),'2026-W53');
 assert.equal(currentPeriod(new Date('2027-01-03T15:00:00Z')),'2027-W01');
});

test('weekly period has a readable label and panel parts',()=>{
 assert.equal(periodLabel('2026-W39'),'2026年第39週');
 assert.deepEqual(periodParts('2026-W39'),{year:'2026',week:'39'});
 assert.equal(periodLabel('invalid'),'invalid');
 assert.deepEqual(periodParts('invalid'),{year:'—',week:'—'});
});
