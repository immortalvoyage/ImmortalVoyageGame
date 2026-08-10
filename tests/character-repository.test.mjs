import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryCharacterRepository } from '../src/modules/character/index.js';

test('saves and reloads the same character', async () => {
  const repository = createMemoryCharacterRepository();
  const character = { characterId: 'c-1', playerId: 'p-1', status: 'alive', attributes: { strength: 12 } };

  await repository.save(character);
  const loaded = await repository.getById('c-1');

  assert.deepEqual(loaded, character);
  assert.notEqual(loaded, character);
});

test('lists only characters owned by the requested player', async () => {
  const repository = createMemoryCharacterRepository();
  await repository.save({ characterId: 'c-1', playerId: 'p-1', status: 'alive' });
  await repository.save({ characterId: 'c-2', playerId: 'p-2', status: 'alive' });

  assert.deepEqual(await repository.getByPlayerId('p-1'), [{ characterId: 'c-1', playerId: 'p-1', status: 'alive' }]);
});

test('rejects overwriting a character with another owner', async () => {
  const repository = createMemoryCharacterRepository();
  await repository.save({ characterId: 'c-1', playerId: 'p-1', status: 'alive' });

  await assert.rejects(
    repository.save({ characterId: 'c-1', playerId: 'p-2', status: 'alive' }),
    /ownership mismatch/,
  );
});
