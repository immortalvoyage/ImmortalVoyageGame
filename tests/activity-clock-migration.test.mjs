import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateWorldState } from '../src/core/schema-migration.js';
import { assertWorldState, createInitialWorld, CURRENT_SCHEMA_VERSION } from '../src/core/world-state.js';

function v7World({ lastActiveLogicalTimeSeconds } = {}) {
  const world = createInitialWorld({ nowMs: 1000 });
  world.schemaVersion = 7;
  world.logicalTimeSeconds = 123;
  world.characters.s1 = {
    id: 'char:1',
    ownerSessionId: 's1',
    name: '舊版活動旅人',
    status: 'alive',
    locationId: 'starter-square',
    needs: { hunger: 1, thirst: 2, fatigue: 3 },
    needProgressSeconds: { hunger: 10, thirst: 20, fatigue: 30 },
    behaviorCounts: {},
    knowledgeIds: [],
    currentEmployment: null,
    inventory: {},
    money: 0,
  };
  if (lastActiveLogicalTimeSeconds !== undefined) {
    world.characters.s1.lastActiveLogicalTimeSeconds = lastActiveLogicalTimeSeconds;
  }
  world.nextCharacterSequence = 2;
  return world;
}

test('schema v7 backfills active activity clock at current logical time to avoid retroactive double exposure', () => {
  const migrated = migrateWorldState(v7World());
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.characters.s1.lastActiveLogicalTimeSeconds, 123);
  assert.deepEqual(migrated.characters.s1.needs, { hunger: 1, thirst: 2, fatigue: 3 });
  assert.equal(assertWorldState(migrated), migrated);
});

test('schema v7 preserves an existing valid activity clock', () => {
  const migrated = migrateWorldState(v7World({ lastActiveLogicalTimeSeconds: 77 }));
  assert.equal(migrated.characters.s1.lastActiveLogicalTimeSeconds, 77);
  assert.equal(assertWorldState(migrated), migrated);
});
