import assert from 'node:assert/strict';
import test from 'node:test';
import { getStarterGatherOption, performStarterGather } from '../src/core/starter-gather.js';

test('forest character gets a forest starter gather option', () => {
  const option = getStarterGatherOption({ birthRegionTags: ['forest'] });
  assert.equal(option.itemId, 'wild-berry');
});

test('starter gather persists one item into character inventory', () => {
  const character = { characterId: 'c1', playerId: 'p1', birthRegionId: 'starter-forest', birthRegionTags: ['forest'] };
  const result = performStarterGather(character, { occurredAt: '2026-08-11T09:10:00.000Z' });
  assert.equal(result.outcome.allowed, true);
  assert.equal(result.character.inventory.items[0].itemId, 'wild-berry');
  assert.equal(result.character.inventory.items[0].quantity, 1);
  assert.equal(result.character.starterGatheredAt, '2026-08-11T09:10:00.000Z');
});

test('starter gather cannot be repeated by the same character', () => {
  const character = { characterId: 'c1', playerId: 'p1', birthRegionId: 'starter-coast', birthRegionTags: ['coast'], starterGatheredAt: '2026-08-11T09:10:00.000Z' };
  assert.equal(getStarterGatherOption(character), null);
  assert.throws(() => performStarterGather(character), (error) => error?.code === 'starter_gather_complete');
});
