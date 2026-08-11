import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptStarterWork, completeStarterWork, getStarterWorkOffers } from '../src/core/starter-work.js';

test('starter work offers depend on birth region', () => {
  const offers = getStarterWorkOffers({ birthRegionTags: ['coast'] });
  assert.equal(offers[0].id, 'dock-cargo');
  assert.equal(offers[0].provisions.food, 'employer');
});

test('starter work can be accepted only from current regional offers', () => {
  const accepted = acceptStarterWork({ birthRegionTags: ['forest'] }, 'timber-haul', { acceptedAt: '2026-08-11T00:00:00.000Z' });
  assert.equal(accepted.activeWorkContract.status, 'active');
  assert.equal(accepted.activeWorkContract.pay, 16);
  assert.throws(() => acceptStarterWork({ birthRegionTags: ['forest'] }, 'dock-cargo'), (error) => error.code === 'unsupported_starter_work');
});

test('a character cannot accept another starter job while one is active', () => {
  const accepted = acceptStarterWork({ birthRegionTags: ['coast'] }, 'dock-cargo');
  assert.throws(() => acceptStarterWork(accepted, 'net-mending'), (error) => error.code === 'active_work_exists');
});

test('completing starter work transfers pay and skill progress exactly once', () => {
  const accepted = acceptStarterWork({ birthRegionTags: ['grassland'], economy: { balances: { copper: 2 } } }, 'cart-loading');
  const completed = completeStarterWork(accepted, { completedAt: '2026-08-11T01:00:00.000Z' });
  assert.equal(completed.economy.balances.copper, 19);
  assert.equal(completed.career.skills.manual_labor, 1);
  assert.equal(completed.activeWorkContract, null);
  assert.equal(completed.workHistory.length, 1);
  assert.throws(() => completeStarterWork(completed), (error) => error.code === 'no_active_work');
});
