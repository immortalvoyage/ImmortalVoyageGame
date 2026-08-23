import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateWorldState } from '../src/core/schema-migration.js';
import { assertWorldState, CURRENT_SCHEMA_VERSION } from '../src/core/world-state.js';

function legacyWorld(overrides = {}) {
  return {
    schemaVersion: 1,
    worldId: 'legacy-v1',
    logicalTimeSeconds: 0,
    lastResolvedAtMs: 1000,
    characters: {
      s1: {
        id: 'char:7',
        ownerSessionId: 's1',
        name: '舊存檔旅人',
        status: 'alive',
        locationId: 'starter-square',
        needs: { hunger: 3, thirst: 4, fatigue: 5 },
        inventory: {},
        money: 0,
      },
    },
    requestResults: {},
    requestOrder: [],
    gameEvents: [],
    ...overrides,
  };
}

test('schema v1 migrates to current schema without losing character state', () => {
  const migrated = migrateWorldState(legacyWorld());
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.nextCharacterSequence, 8);
  assert.deepEqual(migrated.characters.s1.needs, { hunger: 3, thirst: 4, fatigue: 5 });
  assert.deepEqual(migrated.characters.s1.needProgressSeconds, { hunger: 0, thirst: 0, fatigue: 0 });
  assert.equal(assertWorldState(migrated), migrated);
});

test('migration never moves an existing character sequence backwards', () => {
  const migrated = migrateWorldState(legacyWorld({ nextCharacterSequence: 50 }));
  assert.equal(migrated.nextCharacterSequence, 50);
});

test('migration preserves valid fractional survival progress', () => {
  const world = legacyWorld();
  world.characters.s1.needProgressSeconds = { hunger: 10, thirst: 20, fatigue: 30 };
  const migrated = migrateWorldState(world);
  assert.deepEqual(migrated.characters.s1.needProgressSeconds, { hunger: 10, thirst: 20, fatigue: 30 });
});

test('newer world schemas fail closed', () => {
  assert.throws(
    () => migrateWorldState(legacyWorld({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })),
    /newer than runtime/,
  );
});

test('invalid migrated survival progress is rejected rather than silently repaired', () => {
  const world = legacyWorld();
  world.characters.s1.needProgressSeconds = { hunger: -1, thirst: 0, fatigue: 0 };
  const migrated = migrateWorldState(world);
  assert.throws(() => assertWorldState(migrated), /invalid survival progress/);
});
