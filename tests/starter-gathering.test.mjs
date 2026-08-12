import assert from 'node:assert/strict';
import test from 'node:test';
import { gatherStarterResource, getStarterGatherOptions } from '../src/core/starter-gathering.js';

test('starter gathering adds an item to persisted character inventory', () => {
  const character = { characterId: 'c1', playerId: 'p1', birthRegionId: 'starter-forest', birthRegionTags: ['forest'], status: 'alive' };
  const gathered = gatherStarterResource(character, 'starter-wild-berry');

  assert.equal(gathered.result.itemId, 'wild-berry');
  assert.equal(gathered.result.quantity, 1);
  assert.deepEqual(gathered.character.inventory.items, [{ itemId: 'wild-berry', quantity: 1 }]);
  assert.equal(gathered.character.starterGathering.gathered['starter-wild-berry'], 1);
});

test('starter gathering survives save-load style character payload reuse', () => {
  const character = { characterId: 'c1', playerId: 'p1', birthRegionId: 'starter-coast', birthRegionTags: ['coast'], status: 'alive' };
  const first = gatherStarterResource(character, 'starter-shellfish').character;
  const second = gatherStarterResource(JSON.parse(JSON.stringify(first)), 'starter-shellfish').character;

  assert.deepEqual(second.inventory.items, [{ itemId: 'shellfish', quantity: 2 }]);
  assert.equal(second.starterGathering.gathered['starter-shellfish'], 2);
  assert.equal(getStarterGatherOptions(second).some((option) => option.id === 'starter-shellfish'), false);
});

test('depleted starter resource cannot be gathered again', () => {
  let character = { characterId: 'c1', playerId: 'p1', birthRegionId: 'starter-grassland', birthRegionTags: ['grassland'], status: 'alive' };
  character = gatherStarterResource(character, 'starter-edible-root').character;
  character = gatherStarterResource(character, 'starter-edible-root').character;

  assert.throws(
    () => gatherStarterResource(character, 'starter-edible-root'),
    (error) => error?.code === 'depleted'
  );
});
