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
  assert.equal(migrated.characters.s1.lastActiveLogicalTimeSeconds, 0);
  assert.equal(migrated.characters.s1.lastSurvivalResolvedLogicalTimeSeconds, 0);
  assert.deepEqual(migrated.characters.s1.behaviorCounts, {});
  assert.deepEqual(migrated.characters.s1.knowledgeIds, []);
  assert.equal(migrated.characters.s1.currentEmployment, null);
  assert.deepEqual(migrated.tradeListings, {});
  assert.equal(migrated.nextTradeListingSequence, 1);
  assert.deepEqual(migrated.archivedCharacters, {});
  assert.deepEqual(migrated.estates, {});
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

test('schema v4 backfills empty archive and estate collections without moving active assets', () => {
  const v4 = migrateWorldState(legacyWorld());
  v4.schemaVersion = 4;
  delete v4.archivedCharacters;
  delete v4.estates;
  v4.characters.s1.inventory = { food: 2 };
  v4.characters.s1.money = 9;

  const migrated = migrateWorldState(v4);
  assert.deepEqual(migrated.archivedCharacters, {});
  assert.deepEqual(migrated.estates, {});
  assert.deepEqual(migrated.characters.s1.inventory, { food: 2 });
  assert.equal(migrated.characters.s1.money, 9);
  assert.equal(assertWorldState(migrated), migrated);
});

test('schema v5 backfills active and archived knowledge without inventing inheritance', () => {
  const v5 = migrateWorldState(legacyWorld());
  v5.schemaVersion = 5;
  delete v5.characters.s1.knowledgeIds;
  delete v5.characters.s1.currentEmployment;
  delete v5.characters.s1.lastActiveLogicalTimeSeconds;
  delete v5.characters.s1.lastSurvivalResolvedLogicalTimeSeconds;
  v5.archivedCharacters['char:old'] = {
    id: 'char:old',
    ownerSessionId: 'old-session',
    name: '故人',
    status: 'dead',
    locationId: 'retired-location',
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    behaviorCounts: {},
    estateId: 'estate:char:old',
    diedLogicalTimeSeconds: 0,
    deathCauseCode: 'hazard.accident',
  };
  v5.estates['estate:char:old'] = {
    id: 'estate:char:old',
    deceasedCharacterId: 'char:old',
    status: 'pending',
    openedLogicalTimeSeconds: 0,
    money: 0,
    inventory: {},
  };

  const migrated = migrateWorldState(v5);
  assert.deepEqual(migrated.characters.s1.knowledgeIds, []);
  assert.deepEqual(migrated.archivedCharacters['char:old'].knowledgeIds, []);
  assert.equal(migrated.characters.s1.currentEmployment, null);
  assert.equal(migrated.archivedCharacters['char:old'].currentEmployment, null);
  assert.equal(migrated.characters.s1.lastActiveLogicalTimeSeconds, 0);
  assert.equal(migrated.characters.s1.lastSurvivalResolvedLogicalTimeSeconds, 0);
  assert.equal(Object.hasOwn(migrated.archivedCharacters['char:old'], 'lastActiveLogicalTimeSeconds'), false);
  assert.equal(Object.hasOwn(migrated.archivedCharacters['char:old'], 'lastSurvivalResolvedLogicalTimeSeconds'), false);
  assert.equal(assertWorldState(migrated), migrated);

  const withKnowledge = structuredClone(v5);
  withKnowledge.characters.s1.knowledgeIds = ['starter-living-advice'];
  withKnowledge.archivedCharacters['char:old'].knowledgeIds = ['retired-historical-fact'];
  const preserved = migrateWorldState(withKnowledge);
  assert.deepEqual(preserved.characters.s1.knowledgeIds, ['starter-living-advice']);
  assert.deepEqual(preserved.archivedCharacters['char:old'].knowledgeIds, ['retired-historical-fact']);
});

test('schema v6 backfills current employment and preserves an existing valid contract', () => {
  const v6 = migrateWorldState(legacyWorld());
  v6.schemaVersion = 6;
  delete v6.characters.s1.currentEmployment;
  delete v6.characters.s1.lastActiveLogicalTimeSeconds;
  delete v6.characters.s1.lastSurvivalResolvedLogicalTimeSeconds;
  v6.archivedCharacters['char:old'] = {
    id: 'char:old',
    ownerSessionId: 'old-session',
    name: '故人',
    status: 'dead',
    locationId: 'retired-location',
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    behaviorCounts: {},
    knowledgeIds: [],
    estateId: 'estate:char:old',
    diedLogicalTimeSeconds: 0,
    deathCauseCode: 'hazard.accident',
  };
  v6.estates['estate:char:old'] = {
    id: 'estate:char:old',
    deceasedCharacterId: 'char:old',
    status: 'pending',
    openedLogicalTimeSeconds: 0,
    money: 0,
    inventory: {},
  };

  const backfilled = migrateWorldState(v6);
  assert.equal(backfilled.characters.s1.currentEmployment, null);
  assert.equal(backfilled.archivedCharacters['char:old'].currentEmployment, null);
  assert.equal(backfilled.characters.s1.lastActiveLogicalTimeSeconds, 0);
  assert.equal(backfilled.characters.s1.lastSurvivalResolvedLogicalTimeSeconds, 0);
  assert.equal(assertWorldState(backfilled), backfilled);

  const withEmployment = structuredClone(v6);
  withEmployment.characters.s1.currentEmployment = {
    jobId: 'starter-labor',
    employerNpcId: 'foreman',
    workLocationId: 'starter-square',
  };
  withEmployment.archivedCharacters['char:old'].currentEmployment = {
    jobId: 'retired-job',
    employerNpcId: 'retired-employer',
    workLocationId: 'retired-location',
  };
  const preserved = migrateWorldState(withEmployment);
  assert.deepEqual(preserved.characters.s1.currentEmployment, withEmployment.characters.s1.currentEmployment);
  assert.deepEqual(preserved.archivedCharacters['char:old'].currentEmployment, withEmployment.archivedCharacters['char:old'].currentEmployment);
  assert.equal(assertWorldState(preserved), preserved);
});

test('schema v7 backfills per-character activity clocks at current logical time and preserves valid values', () => {
  const v7 = migrateWorldState(legacyWorld());
  v7.schemaVersion = 7;
  v7.logicalTimeSeconds = 7200;
  delete v7.characters.s1.lastActiveLogicalTimeSeconds;
  delete v7.characters.s1.lastSurvivalResolvedLogicalTimeSeconds;

  const backfilled = migrateWorldState(v7);
  assert.equal(backfilled.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(backfilled.characters.s1.lastActiveLogicalTimeSeconds, 7200);
  assert.equal(backfilled.characters.s1.lastSurvivalResolvedLogicalTimeSeconds, 7200);
  assert.equal(assertWorldState(backfilled), backfilled);

  const existing = structuredClone(v7);
  existing.characters.s1.lastActiveLogicalTimeSeconds = 1200;
  existing.characters.s1.lastSurvivalResolvedLogicalTimeSeconds = 3600;
  const preserved = migrateWorldState(existing);
  assert.equal(preserved.characters.s1.lastActiveLogicalTimeSeconds, 1200);
  assert.equal(preserved.characters.s1.lastSurvivalResolvedLogicalTimeSeconds, 3600);
  assert.equal(assertWorldState(preserved), preserved);
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

test('invalid current activity clocks fail closed after migration', () => {
  const migrated = migrateWorldState(legacyWorld());
  migrated.characters.s1.lastActiveLogicalTimeSeconds = -1;
  assert.throws(() => assertWorldState(migrated), /invalid character activity time/);
});
