import assert from 'node:assert/strict';
import test from 'node:test';
import { describeItemStack, getItemMetadata } from '../src/modules/inventory/item-catalog.js';

test('starter items expose stable metadata for future visual inventory rendering', () => {
  const herb = getItemMetadata('wild-herb');
  assert.equal(herb.name, '可用野草');
  assert.equal(herb.category, 'material');
  assert.equal(herb.rarity, 'common');
  assert.equal(herb.visual.iconKey, 'wild-herb');
  assert.equal(herb.visual.glyph, '🌿');
  assert.equal(herb.visual.assetPath, '/assets/items/wild-herb.svg');
  assert.equal(herb.visual.motion, 'none');
});

test('starter item stack uses metadata-driven visual glyph', () => {
  assert.equal(describeItemStack('wild-herb', 1), '🌿 可用野草 × 1');
});

test('unknown items remain readable without breaking inventory rendering', () => {
  const unknown = getItemMetadata('old-world-relic');
  assert.equal(unknown.name, 'old-world-relic');
  assert.equal(unknown.rarity, 'common');
  assert.equal(unknown.visual.assetPath, null);
  assert.equal(describeItemStack('old-world-relic', 2), 'old-world-relic × 2');
});
