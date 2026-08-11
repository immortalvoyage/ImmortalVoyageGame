import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkerCharacterService } from '../src/modules/character/index.js';

function fakeDb(rows = []) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('WHERE character_id')) return rows.find((row) => row.character_id === args[0]) ?? null;
              return null;
            },
            async all() {
              if (sql.includes('WHERE player_id')) return { results: rows.filter((row) => row.player_id === args[0]) };
              return { results: [] };
            },
            async run() {
              const [characterId, playerId, status, payload, now] = args;
              const existing = rows.find((row) => row.character_id === characterId);
              if (existing) Object.assign(existing, { status, payload_json: payload, updated_at: now });
              else rows.push({ character_id: characterId, player_id: playerId, status, payload_json: payload, created_at: now, updated_at: now });
              return { success: true };
            },
          };
        },
      };
    },
  };
}

test('worker character service requests creation when player has no character', async () => {
  const service = createWorkerCharacterService({ DB: fakeDb() });
  const result = await service.resolve('player-1');
  assert.equal(result.state, 'character_creation_required');
});

test('worker character service creates and reloads a persisted character', async () => {
  const rows = [];
  const service = createWorkerCharacterService({ DB: fakeDb(rows) }, { random: () => 0.1 });
  const created = await service.create('player-1', { characterName: 'Johann Müller', originPreference: 'coast' });
  assert.equal(created.state, 'character_created');
  assert.equal(created.character.playerId, 'player-1');
  assert.equal(created.character.name, 'Johann Müller');

  const reloaded = await service.resolve('player-1');
  assert.equal(reloaded.state, 'existing_character');
  assert.equal(reloaded.character.characterId, created.character.characterId);
  assert.equal(reloaded.character.name, 'Johann Müller');
});

test('worker character service saves and reloads scene state in the D1 payload', async () => {
  const rows = [];
  const service = createWorkerCharacterService({ DB: fakeDb(rows) }, { random: () => 0.1 });
  const created = await service.create('player-1', { characterName: '沈無涯', originPreference: 'coast' });
  const changed = {
    ...created.character,
    sceneState: { sceneId: 'birth-coast', lastActionId: 'observe', lastResult: '已觀察港口', updatedAt: '2026-08-11T03:00:00.000Z' },
    actionHistory: [{ sceneId: 'birth-coast', actionId: 'observe', result: '已觀察港口', worldMutation: false, occurredAt: '2026-08-11T03:00:00.000Z' }],
  };

  await service.save(changed);
  const reloaded = await service.resolve('player-1');
  assert.equal(reloaded.character.sceneState.lastActionId, 'observe');
  assert.equal(reloaded.character.actionHistory.length, 1);
  assert.equal(reloaded.character.actionHistory[0].worldMutation, false);
});

test('worker character service refuses to start without D1 binding', () => {
  assert.throws(() => createWorkerCharacterService({}), /DB binding is required/);
});
