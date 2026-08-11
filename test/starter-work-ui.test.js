import assert from 'node:assert/strict';
import test from 'node:test';
import { starterWorkPage } from '../src/worker.js';

test('starter work page shows regional offers and current balance', () => {
  const html = starterWorkPage({
    name: '沈無涯',
    birthRegionTags: ['coast'],
    economy: { balances: { copper: 7 } },
    workHistory: [],
  });

  assert.match(html, /碼頭搬運/);
  assert.match(html, /漁網修補/);
  assert.match(html, /目前持有 7 銅/);
  assert.match(html, /\/work\/accept/);
});

test('starter work page shows active contract instead of new offers', () => {
  const html = starterWorkPage({
    name: 'Johann Müller',
    birthRegionTags: ['coast'],
    activeWorkContract: {
      title: '碼頭搬運',
      pay: 18,
      provisions: { food: 'employer', water: 'employer', lodging: 'notProvided' },
    },
  });

  assert.match(html, /今日有工/);
  assert.match(html, /雇主提供/);
  assert.match(html, /不提供/);
  assert.match(html, /\/work\/complete/);
  assert.doesNotMatch(html, /漁網修補/);
});
