import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { getItemHttpAsset } from '../src/modules/inventory/item-http-assets.js';

test('worker routes view-inventory to the inventory result page without saving read-only state', () => {
  const workerSource = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
  assert.match(workerSource, /applied\.outcome\.readOnly \? resolved\.character : await service\.save/);
  assert.match(workerSource, /actionId === 'view-inventory'/);
  assert.match(workerSource, /renderInventoryResult\(character\)/);
});

test('wild herb SVG is available through the item asset route contract', () => {
  const asset = getItemHttpAsset('/assets/items/wild-herb.svg');
  assert.ok(asset);
  assert.equal(asset.contentType, 'image/svg+xml; charset=UTF-8');
  assert.match(asset.body, /<title id="title">可用野草<\/title>/);
});
