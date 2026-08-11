import assert from 'node:assert/strict';
import test from 'node:test';
import { gatherIntoCharacter } from '../src/core/character-gather.js';
import { GatherableResourceRegistry } from '../src/modules/resources/index.js';

test('successful gather returns a character payload with persisted inventory', () => {
  const character = Object.freeze({ characterId: 'char-1', playerId: 'player-1', status: 'alive' });
  const resources = new GatherableResourceRegistry();
  resources.register({ id: 'spring-1', locationId: 'forest-edge', itemId: 'fresh-water', quantity: 3 });

  const result = gatherIntoCharacter(character, {
    playerLocationId: 'forest-edge',
    resourceRegistry: resources,
    resourceId: 'spring-1',
    quantity: 2,
  });

  assert.equal(result.outcome.allowed, true);
  assert.deepEqual(result.character.inventory, {
    schemaVersion: 1,
    items: [{ itemId: 'fresh-water', quantity: 2 }],
  });
  assert.equal(resources.get('spring-1').quantity, 1);
});

test('gathering adds to inventory already stored on the character', () => {
  const character = Object.freeze({
    characterId: 'char-1',
    playerId: 'player-1',
    status: 'alive',
    inventory: Object.freeze({ schemaVersion: 1, items: Object.freeze([{ itemId: 'wild-berry', quantity: 1 }]) }),
  });
  const resources = new GatherableResourceRegistry();
  resources.register({ id: 'berry-bush-1', locationId: 'forest-edge', itemId: 'wild-berry', quantity: 2 });

  const result = gatherIntoCharacter(character, {
    playerLocationId: 'forest-edge',
    resourceRegistry: resources,
    resourceId: 'berry-bush-1',
  });

  assert.equal(result.character.inventory.items[0].quantity, 2);
});

test('rejected gather leaves the original character payload unchanged', () => {
  const character = Object.freeze({ characterId: 'char-1', playerId: 'player-1', status: 'alive' });
  const resources = new GatherableResourceRegistry();
  resources.register({ id: 'spring-1', locationId: 'mountain', itemId: 'fresh-water', quantity: 3 });

  const result = gatherIntoCharacter(character, {
    playerLocationId: 'village',
    resourceRegistry: resources,
    resourceId: 'spring-1',
  });

  assert.equal(result.outcome.allowed, false);
  assert.equal(result.outcome.reason, 'wrong_location');
  assert.equal(result.character, character);
  assert.equal(result.character.inventory, undefined);
});
