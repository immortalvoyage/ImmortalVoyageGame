import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMemoryCharacterRepository,
  createPlayerCharacterBootstrap,
} from '../src/modules/character/index.js';

test('existing alive character is returned without creating another one', async () => {
  const repository = createMemoryCharacterRepository();
  await repository.save({ characterId: 'char-1', playerId: 'player-1', status: 'alive' });
  let createCalls = 0;
  const bootstrap = createPlayerCharacterBootstrap({
    repository,
    createCharacter: async () => {
      createCalls += 1;
      return { characterId: 'char-2', playerId: 'player-1', status: 'alive' };
    },
  });

  const result = await bootstrap.resolve({ playerId: 'player-1' });

  assert.equal(result.state, 'existing_character');
  assert.equal(result.character.characterId, 'char-1');
  assert.equal(result.created, false);
  assert.equal(createCalls, 0);
});

test('player without an alive character is sent to character creation', async () => {
  const repository = createMemoryCharacterRepository();
  const bootstrap = createPlayerCharacterBootstrap({
    repository,
    createCharacter: async () => ({ characterId: 'unused', playerId: 'player-1', status: 'alive' }),
  });

  const result = await bootstrap.resolve({ playerId: 'player-1' });

  assert.equal(result.state, 'character_creation_required');
  assert.equal(result.character, null);
  assert.equal(result.created, false);
});

test('character creation saves the new character before returning it', async () => {
  const repository = createMemoryCharacterRepository();
  const bootstrap = createPlayerCharacterBootstrap({
    repository,
    createCharacter: async ({ playerId, characterId }) => ({ characterId, playerId, status: 'alive' }),
  });

  const result = await bootstrap.resolve({
    playerId: 'player-1',
    createInput: { characterId: 'char-1' },
  });

  assert.equal(result.state, 'character_created');
  assert.equal(result.created, true);
  assert.equal((await repository.getById('char-1')).playerId, 'player-1');
});

test('dead-only history still requires a new character', async () => {
  const repository = createMemoryCharacterRepository();
  await repository.save({ characterId: 'dead-1', playerId: 'player-1', status: 'dead' });
  const bootstrap = createPlayerCharacterBootstrap({
    repository,
    createCharacter: async () => ({ characterId: 'unused', playerId: 'player-1', status: 'alive' }),
  });

  const result = await bootstrap.resolve({ playerId: 'player-1' });
  assert.equal(result.state, 'character_creation_required');
});
