import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertWorldState,
  createInitialWorld,
  CURRENT_SCHEMA_VERSION,
  MAX_CHARACTER_KNOWLEDGE,
  MAX_GAME_EVENTS,
  MAX_REQUEST_RESULTS,
  MAX_TRADE_LISTINGS,
} from '../src/core/world-state.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'invariant-session' };

function character(overrides = {}) {
  return {
    id: 'char:1',
    ownerSessionId: actor.sessionId,
    name: '完整性旅人',
    status: 'alive',
    locationId: 'starter-square',
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    lastActiveLogicalTimeSeconds: 0,
    lastSurvivalResolvedLogicalTimeSeconds: 0,
    behaviorCounts: {},
    knowledgeIds: [],
    currentEmployment: null,
    inventory: {},
    money: 0,
    ...overrides,
  };
}

function validWorld(characterOverrides = {}) {
  const world = createInitialWorld({ nowMs: 1000 });
  world.characters[actor.sessionId] = character(characterOverrides);
  world.nextCharacterSequence = 2;
  return world;
}

function archivedWorld() {
  const world = validWorld();
  const active = world.characters[actor.sessionId];
  delete world.characters[actor.sessionId];
  world.archivedCharacters['char:1'] = {
    id: active.id,
    ownerSessionId: active.ownerSessionId,
    name: active.name,
    status: 'dead',
    locationId: active.locationId,
    needs: structuredClone(active.needs),
    needProgressSeconds: structuredClone(active.needProgressSeconds),
    behaviorCounts: structuredClone(active.behaviorCounts),
    knowledgeIds: structuredClone(active.knowledgeIds),
    currentEmployment: structuredClone(active.currentEmployment),
    estateId: 'estate:char:1',
    diedLogicalTimeSeconds: 0,
    deathCauseCode: 'hazard.accident',
  };
  world.estates['estate:char:1'] = {
    id: 'estate:char:1',
    deceasedCharacterId: 'char:1',
    status: 'pending',
    openedLogicalTimeSeconds: 0,
    money: 3,
    inventory: { food: 2 },
  };
  return world;
}

function listing(overrides = {}) {
  return {
    id: 'listing:1',
    sellerSessionId: actor.sessionId,
    sellerCharacterId: 'char:1',
    itemId: 'food',
    quantity: 1,
    totalPrice: 2,
    createdLogicalTimeSeconds: 0,
    ...overrides,
  };
}

function expectInvalid(mutator, pattern) {
  const world = validWorld();
  mutator(world);
  assert.throws(() => assertWorldState(world), pattern);
}

test('valid authoritative world and normal gameplay output satisfy invariants', async () => {
  const world = validWorld({
    inventory: { food: 2 },
    money: 3,
    behaviorCounts: { 'work:starter-labor': 1 },
    knowledgeIds: ['starter-living-advice'],
    currentEmployment: {
      jobId: 'starter-labor',
      employerNpcId: 'foreman',
      workLocationId: 'starter-square',
    },
  });
  assert.equal(assertWorldState(world), world);
  assert.equal(assertWorldState(archivedWorld()).schemaVersion, CURRENT_SCHEMA_VERSION);

  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await runtime.dispatch({ actor, requestId: 'birth', action: { type: 'character.birth', payload: { name: '正常旅人' } } });
  await runtime.dispatch({ actor, requestId: 'employment', action: { type: 'employment.accept', payload: { jobId: 'starter-labor' } } });
  await runtime.dispatch({ actor, requestId: 'work', action: { type: 'economy.work', payload: { jobId: 'starter-labor' } } });
  await runtime.dispatch({ actor, requestId: 'scene', action: { type: 'narrative.scene', payload: {} } });
  assert.equal(assertWorldState(store.snapshot()).schemaVersion, CURRENT_SCHEMA_VERSION);
});

test('identity, ownership, and world clock corruption fail closed', () => {
  expectInvalid((world) => { world.worldId = ''; }, /invalid world identity/);
  expectInvalid((world) => { world.logicalTimeSeconds = -1; }, /invalid logical world time/);
  expectInvalid((world) => { world.lastResolvedAtMs = Number.NaN; }, /invalid world timestamp/);
  expectInvalid((world) => { world.characters[actor.sessionId].ownerSessionId = 'other-session'; }, /invalid character ownership/);
  expectInvalid((world) => { world.characters[actor.sessionId].name = ''; }, /invalid character identity/);
  expectInvalid((world) => { world.characters[actor.sessionId].status = 'dead'; }, /invalid character state/);
});

test('active character activity clocks are bounded by logical world time', () => {
  expectInvalid((world) => { world.characters[actor.sessionId].lastActiveLogicalTimeSeconds = -1; }, /invalid character activity time/);
  expectInvalid((world) => { world.characters[actor.sessionId].lastActiveLogicalTimeSeconds = 0.5; }, /invalid character activity time/);
  expectInvalid((world) => { world.characters[actor.sessionId].lastSurvivalResolvedLogicalTimeSeconds = -1; }, /invalid character activity time/);

  const future = validWorld();
  future.logicalTimeSeconds = 10;
  future.characters[actor.sessionId].lastActiveLogicalTimeSeconds = 11;
  assert.throws(() => assertWorldState(future), /invalid character activity time/);

  const futureSurvival = validWorld();
  futureSurvival.logicalTimeSeconds = 10;
  futureSurvival.characters[actor.sessionId].lastSurvivalResolvedLogicalTimeSeconds = 11;
  assert.throws(() => assertWorldState(futureSurvival), /invalid character activity time/);
});

test('survival, money, and inventory corruption fail closed', () => {
  expectInvalid((world) => { world.characters[actor.sessionId].needs.hunger = 101; }, /invalid survival needs/);
  expectInvalid((world) => { world.characters[actor.sessionId].needs.thirst = 0.5; }, /invalid survival needs/);
  expectInvalid((world) => { world.characters[actor.sessionId].needProgressSeconds.fatigue = -1; }, /invalid survival progress/);
  expectInvalid((world) => { world.characters[actor.sessionId].money = -1; }, /invalid money state/);
  expectInvalid((world) => { world.characters[actor.sessionId].inventory = []; }, /invalid inventory state/);
  expectInvalid((world) => { world.characters[actor.sessionId].inventory.food = 0; }, /invalid inventory state/);
});

test('behavior counters remain bounded integer aggregates', () => {
  expectInvalid((world) => { world.characters[actor.sessionId].behaviorCounts.bad = -1; }, /invalid behavior counts/);
  expectInvalid((world) => { world.characters[actor.sessionId].behaviorCounts.bad = 1.5; }, /invalid behavior counts/);
});

test('character knowledge is bounded, unique, and structurally valid', () => {
  expectInvalid((world) => { world.characters[actor.sessionId].knowledgeIds = {}; }, /invalid character knowledge/);
  expectInvalid((world) => { world.characters[actor.sessionId].knowledgeIds = ['known', 'known']; }, /invalid character knowledge/);
  expectInvalid((world) => { world.characters[actor.sessionId].knowledgeIds = ['']; }, /invalid character knowledge/);

  const oversized = validWorld({
    knowledgeIds: Array.from({ length: MAX_CHARACTER_KNOWLEDGE + 1 }, (_, index) => `knowledge:${index}`),
  });
  assert.throws(() => assertWorldState(oversized), /character knowledge exceeds limit/);
});

test('current employment is null or a bounded structural reference tuple', () => {
  const employed = validWorld({
    currentEmployment: {
      jobId: 'starter-labor',
      employerNpcId: 'foreman',
      workLocationId: 'starter-square',
    },
  });
  assert.equal(assertWorldState(employed), employed);

  expectInvalid((world) => { world.characters[actor.sessionId].currentEmployment = {}; }, /invalid current employment/);
  expectInvalid((world) => {
    world.characters[actor.sessionId].currentEmployment = { jobId: '', employerNpcId: 'foreman', workLocationId: 'starter-square' };
  }, /invalid current employment/);
  expectInvalid((world) => {
    world.characters[actor.sessionId].currentEmployment = { jobId: 'starter-labor', employerNpcId: '', workLocationId: 'starter-square' };
  }, /invalid current employment/);
  expectInvalid((world) => {
    world.characters[actor.sessionId].currentEmployment = { jobId: 'starter-labor', employerNpcId: 'foreman', workLocationId: '' };
  }, /invalid current employment/);
});

test('archived characters and pending estates are paired without duplicating spendable assets', () => {
  const valid = archivedWorld();
  valid.archivedCharacters['char:1'].knowledgeIds = ['historical-fact'];
  valid.archivedCharacters['char:1'].currentEmployment = {
    jobId: 'retired-job',
    employerNpcId: 'retired-employer',
    workLocationId: 'retired-place',
  };
  assert.equal(Object.hasOwn(valid.archivedCharacters['char:1'], 'lastActiveLogicalTimeSeconds'), false);
  assert.equal(Object.hasOwn(valid.archivedCharacters['char:1'], 'lastSurvivalResolvedLogicalTimeSeconds'), false);
  assert.equal(assertWorldState(valid), valid);

  const missingEstate = archivedWorld();
  delete missingEstate.estates['estate:char:1'];
  assert.throws(() => assertWorldState(missingEstate), /archived character estate mismatch/);

  const missingArchive = archivedWorld();
  delete missingArchive.archivedCharacters['char:1'];
  assert.throws(() => assertWorldState(missingArchive), /estate archive mismatch/);

  const duplicateAssets = archivedWorld();
  duplicateAssets.archivedCharacters['char:1'].inventory = { food: 2 };
  assert.throws(() => assertWorldState(duplicateAssets), /duplicates estate assets/);

  const activeAndArchived = archivedWorld();
  activeAndArchived.characters[actor.sessionId] = character();
  assert.throws(() => assertWorldState(activeAndArchived), /active and archived/);

  const invalidEstateAsset = archivedWorld();
  invalidEstateAsset.estates['estate:char:1'].inventory.food = 0;
  assert.throws(() => assertWorldState(invalidEstateAsset), /invalid estate inventory state/);
});

test('trade listing collection is bounded and internally consistent', () => {
  const valid = validWorld();
  valid.tradeListings['listing:1'] = listing();
  valid.nextTradeListingSequence = 2;
  assert.equal(assertWorldState(valid), valid);

  expectInvalid((world) => {
    world.tradeListings['listing:1'] = listing({ sellerCharacterId: 'char:other' });
    world.nextTradeListingSequence = 2;
  }, /invalid trade seller/);
  expectInvalid((world) => {
    world.tradeListings['listing:1'] = listing({ quantity: 0 });
    world.nextTradeListingSequence = 2;
  }, /invalid trade quantity/);
  expectInvalid((world) => {
    world.tradeListings['listing:1'] = listing({ totalPrice: 0 });
    world.nextTradeListingSequence = 2;
  }, /invalid trade price/);
  expectInvalid((world) => {
    world.tradeListings['listing:1'] = listing();
    world.nextTradeListingSequence = 1;
  }, /invalid trade listing sequence/);

  const oversized = validWorld();
  for (let index = 1; index <= MAX_TRADE_LISTINGS + 1; index += 1) {
    const listingId = `listing:${index}`;
    oversized.tradeListings[listingId] = listing({ id: listingId });
  }
  oversized.nextTradeListingSequence = MAX_TRADE_LISTINGS + 2;
  assert.throws(() => assertWorldState(oversized), /trade listing collection exceeds limit/);
});

test('request result ledger must stay bounded and internally consistent', () => {
  expectInvalid((world) => {
    world.requestResults.orphan = { sessionId: actor.sessionId, result: { ok: true, code: 'OK', data: null } };
  }, /invalid request result ledger/);

  expectInvalid((world) => {
    world.requestOrder.push('missing');
  }, /invalid request result ledger/);

  const oversized = validWorld();
  for (let index = 0; index <= MAX_REQUEST_RESULTS; index += 1) {
    const requestId = `request-${index}`;
    oversized.requestOrder.push(requestId);
    oversized.requestResults[requestId] = { sessionId: actor.sessionId, result: { ok: true, code: 'OK', data: null } };
  }
  assert.throws(() => assertWorldState(oversized), /request result ledger exceeds limit/);
});

test('game event ledger must stay bounded and cannot contain future or malformed events', () => {
  expectInvalid((world) => {
    world.gameEvents.push({ type: 'future', logicalTimeSeconds: 1, data: null });
  }, /invalid game event time/);

  expectInvalid((world) => {
    world.gameEvents.push({ type: '', logicalTimeSeconds: 0, data: null });
  }, /invalid game event/);

  const oversized = validWorld();
  oversized.gameEvents = Array.from({ length: MAX_GAME_EVENTS + 1 }, (_, index) => ({
    type: `event.${index}`,
    logicalTimeSeconds: 0,
    data: null,
  }));
  assert.throws(() => assertWorldState(oversized), /game event ledger exceeds limit/);
});
