import assert from 'node:assert/strict';
import test from 'node:test';
import { createD1CharacterRepository } from '../src/modules/character/d1-character-repository.js';

function createFakeD1() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT player_id')) {
                const row = rows.get(args[0]);
                return row ? { player_id: row.player_id } : null;
              }
              if (sql.includes('SELECT payload_json')) {
                const row = rows.get(args[0]);
                return row ? { payload_json: row.payload_json } : null;
              }
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO characters')) {
                const [character_id, player_id, status, payload_json, now] = args;
                const existing = rows.get(character_id);
                rows.set(character_id, {
                  character_id,
                  player_id: existing?.player_id ?? player_id,
                  status,
                  payload_json,
                  created_at: existing?.created_at ?? now,
                  updated_at: now,
                });
              }
              return { success: true };
            },
            async all() {
              if (sql.includes('WHERE player_id')) {
                return { results: [...rows.values()].filter((row) => row.player_id === args[0]).map((row) => ({ payload_json: row.payload_json })) };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

test('D1 repository saves and reloads a character', async () => {
  const repository = createD1CharacterRepository(createFakeD1());
  const character = { characterId: 'c1', playerId: 'p1', status: 'alive', attributes: { strength: 12 } };
  await repository.save(character);
  assert.deepEqual(await repository.getById('c1'), character);
});

test('D1 repository lists characters by player and blocks ownership mismatch', async () => {
  const repository = createD1CharacterRepository(createFakeD1());
  await repository.save({ characterId: 'c1', playerId: 'p1', status: 'alive' });
  assert.equal((await repository.getByPlayerId('p1')).length, 1);
  await assert.rejects(() => repository.save({ characterId: 'c1', playerId: 'p2', status: 'alive' }), /ownership mismatch/);
});
