import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInventoryItems } from '../src/modules/inventory/inventory-view.js';

test('inventory renderer uses the official SVG asset and player-facing labels', () => {
  const html = renderInventoryItems({ inventory: { items: [{ itemId: 'wild-herb', quantity: 1 }] } });
  assert.match(html, /class="inventory-item-icon"/);
  assert.match(html, /src="\/assets\/items\/wild-herb\.svg"/);
  assert.match(html, /可用野草/);
  assert.match(html, /材料 · 普通/);
  assert.doesNotMatch(html, /material · common/);
  assert.match(html, /×1/);
});

test('inventory renderer falls back safely when an item has no image asset', () => {
  const html = renderInventoryItems({ inventory: { items: [{ itemId: 'wild-berry', quantity: 2 }] } });
  assert.doesNotMatch(html, /inventory-item-icon/);
  assert.match(html, /inventory-item-glyph/);
  assert.match(html, /野莓/);
});
