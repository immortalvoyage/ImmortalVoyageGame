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
  assert.deepEqual(migrated.characters.s1.behaviorCounts, {});
  assert.deepEqual(migrated.tradeListings, {});
  assert.equal(migrated.nextTradeListingSequence, 1);
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

test('schema v2 behavior counts are backfilled and existing valid counts are preserved', () => {
  const v2 = migrateWorldState(legacyWorld());
  v2.schemaVersion = 2;
  delete v2.characters.s1.behaviorCounts;
  const backfilled = migrateWorldState(v2);
  assert.deepEqual(backfilled.characters.s1.behaviorCounts, {});

  const withCounts = structuredClone(v2);
  withCounts.characters.s1.behaviorCounts = { 'work:starter-labor': 4 };
  const preserved = migrateWorldState(withCounts);
  assert.deepEqual(preserved.characters.s1.behaviorCounts, { 'work:starter-labor': 4 });
});

test('schema v3 backfills bounded trade state and preserves a valid existing sequence', () => {
  const v3 = migrateWorldState(legacyWorld());
  v3.schemaVersion = 3;
  delete v3.tradeListings;
  delete v3.nextTradeListingSequence;
  const backfilled = migrateWorldState(v3);
  assert.deepEqual(backfilled.tradeListings, {});
  assert.equal(backfilled.nextTradeListingSequence, 1);

  const withListing = structuredClone(v3);
  withListing.tradeListings = {
    'listing:4': {
      id: 'listing:4',
      sellerSessionId: 's1',
      sellerCharacterId: 'char:7',
      itemId: 'food',
      quantity: 1,
      totalPrice: 2,
      createdLogicalTimeSeconds: 0,
    },
  };
  withListing.nextTradeListingSequence = 10;
  const preserved = migrateWorldState(withListing);
  assert.equal(preserved.nextTradeListingSequence, 10);
  assert.ok(preserved.tradeListings['listing:4']);
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

test('invalid behavior counts fail closed', () => {
  const migrated = migrateWorldState(legacyWorld());
  migrated.characters.s1.behaviorCounts = { 'work:starter-labor': -1 };
  assert.throws(() => assertWorldState(migrated), /invalid behavior counts/);
});
