import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInventoryResult } from '../src/modules/inventory/inventory-result.js';

test('inventory result renders the real item image card for wild herb', () => {
  const html = renderInventoryResult({ inventory: { items: [{ itemId: 'wild-herb', quantity: 1 }] } });
  assert.match(html, /class="inventory-panel"/);
  assert.match(html, /src="\/assets\/items\/wild-herb\.svg"/);
  assert.match(html, /可用野草/);
  assert.match(html, /×1/);
});

test('inventory result explains that viewing inventory is read only', () => {
  const html = renderInventoryResult({ inventory: { items: [] } });
  assert.match(html, /不會因查看而改變世界狀態/);
  assert.match(html, /行囊目前是空的/);
});

test('inventory result leaves close navigation to the page wrapper', () => {
  const html = renderInventoryResult({ inventory: { items: [] } });
  assert.doesNotMatch(html, /收起行囊/);
});
