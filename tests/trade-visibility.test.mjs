import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowTradePanel } from '../public/trade-visibility.js';

test('empty trade state stays hidden during first-session play', () => {
  assert.equal(shouldShowTradePanel(null), false);
  assert.equal(shouldShowTradePanel({ sellables: [], listings: [] }), false);
});

test('trade appears as soon as the player can sell or a listing exists', () => {
  assert.equal(shouldShowTradePanel({ sellables: [{ name: '飲用水' }], listings: [] }), true);
  assert.equal(shouldShowTradePanel({ sellables: [], listings: [{ id: 'listing:1' }] }), true);
});
