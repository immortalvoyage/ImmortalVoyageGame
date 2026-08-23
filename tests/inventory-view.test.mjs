import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicInventory } from '../src/modules/inventory/index.js';

test('public inventory uses Content Pack names and stable ordering', () => {
  const view = buildPublicInventory(
    { water: 2, food: 1 },
    { water: { name: '水' }, food: { name: '食物' } },
  );
  assert.deepEqual(view, [
    { name: '食物', quantity: 1 },
    { name: '水', quantity: 2 },
  ]);
});

test('public inventory hides internal ids for unknown items and ignores invalid quantities', () => {
  const view = buildPublicInventory(
    { 'server-secret-item-id': 1, broken: 0, fractional: 1.5 },
    {},
  );
  assert.deepEqual(view, [{ name: '未知物品', quantity: 1 }]);
  assert.equal(JSON.stringify(view).includes('server-secret-item-id'), false);
});
