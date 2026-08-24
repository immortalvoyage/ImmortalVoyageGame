import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateWorldContentCompatibility } from '../src/content/validate-world-content-compatibility.js';
import { createInitialWorld, CURRENT_SCHEMA_VERSION } from '../src/core/world-state.js';
import { createGame } from '../src/game.js';

const actor = { sessionId: 'compat-session' };

function character(overrides = {}) {
  return {
    id: 'char:1',
    ownerSessionId: actor.sessionId,
    name: '相容性旅人',
    status: 'alive',
    locationId: 'starter-square',
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    behaviorCounts: {},
    inventory: {},
    money: 0,
    ...overrides,
  };
}

function currentWorld(characterOverrides = {}) {
  const world = createInitialWorld({ nowMs: 1000 });
  world.characters[actor.sessionId] = character(characterOverrides);
  world.nextCharacterSequence = 2;
  return world;
}

async function dispatch(runtime, requestId, type = 'location.observe', payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('current authoritative references pass while historical event references may outlive Content Pack entries', () => {
  const world = currentWorld({ inventory: { food: 1, water: 2 } });
  world.gameEvents.push({
    type: 'historical.example',
    logicalTimeSeconds: 0,
    data: { destinationId: 'retired-location', itemId: 'retired-item' },
  });
  assert.equal(validateWorldContentCompatibility(world, devStarterPack), world);
});

test('character location removed by the active Content Pack fails closed', () => {
  const world = currentWorld({ locationId: 'retired-location' });
  assert.throws(
    () => validateWorldContentCompatibility(world, devStarterPack),
    /world\/content mismatch: char:1 references unknown location: retired-location/,
  );
});

test('orphaned or malformed authoritative inventory stacks fail closed', () => {
  const unknownItem = currentWorld({ inventory: { 'retired-item': 1 } });
  assert.throws(
    () => validateWorldContentCompatibility(unknownItem, devStarterPack),
    /inventory references unknown item: retired-item/,
  );

  const invalidQuantity = currentWorld({ inventory: { food: 0 } });
  assert.throws(
    () => validateWorldContentCompatibility(invalidQuantity, devStarterPack),
    /inventory has invalid quantity for item: food/,
  );
});

test('orphaned trade escrow item references fail closed', () => {
  const world = currentWorld();
  world.tradeListings['listing:1'] = {
    id: 'listing:1',
    sellerSessionId: actor.sessionId,
    sellerCharacterId: 'char:1',
    itemId: 'retired-item',
    quantity: 1,
    totalPrice: 2,
    createdLogicalTimeSeconds: 0,
  };
  world.nextTradeListingSequence = 2;
  assert.throws(
    () => validateWorldContentCompatibility(world, devStarterPack),
    /listing:1 trade escrow references unknown item: retired-item/,
  );
});

test('runtime validates compatibility before idempotent replay and never rewrites incompatible state', async () => {
  const world = currentWorld({ locationId: 'retired-location' });
  world.requestResults.cached = {
    sessionId: actor.sessionId,
    result: { ok: true, code: 'OBSERVED', data: { stale: true } },
  };
  world.requestOrder.push('cached');
  const store = new MemoryGameStore(world);
  const before = store.snapshot();
  const { runtime } = createGame({ store, contentPack: devStarterPack, now: () => 2000 });

  await assert.rejects(
    () => dispatch(runtime, 'cached'),
    /world\/content mismatch: char:1 references unknown location: retired-location/,
  );
  assert.deepEqual(store.snapshot(), before);
});

test('supported schema migration runs before Content Pack compatibility validation', async () => {
  const world = currentWorld();
  world.schemaVersion = 2;
  delete world.characters[actor.sessionId].behaviorCounts;
  delete world.tradeListings;
  delete world.nextTradeListingSequence;
  const store = new MemoryGameStore(world);
  const { runtime } = createGame({ store, contentPack: devStarterPack, now: () => 1000 });

  const observed = await dispatch(runtime, 'observe');
  assert.equal(observed.ok, true);
  const stored = store.snapshot();
  assert.equal(stored.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(stored.characters[actor.sessionId].behaviorCounts, {});
  assert.deepEqual(stored.tradeListings, {});
  assert.equal(stored.nextTradeListingSequence, 1);
});
