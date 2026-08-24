import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { createInitialWorld, assertWorldState } from '../src/core/world-state.js';
import { createGame } from '../src/game.js';
import { settleCharacterDeath } from '../src/modules/estate/index.js';

function character(sessionId, id, overrides = {}) {
  return {
    id,
    ownerSessionId: sessionId,
    name: overrides.name ?? `旅人${id}`,
    status: 'alive',
    locationId: 'starter-square',
    needs: { hunger: 10, thirst: 20, fatigue: 30 },
    needProgressSeconds: { hunger: 1, thirst: 2, fatigue: 3 },
    behaviorCounts: { 'work:starter-labor': 2 },
    knowledgeIds: [],
    inventory: {},
    money: 0,
    ...overrides,
  };
}

function baseWorld() {
  const world = createInitialWorld({ nowMs: 1000 });
  world.logicalTimeSeconds = 42;
  world.characters.seller = character('seller', 'char:1', {
    name: '故人',
    knowledgeIds: ['starter-living-advice'],
    inventory: { food: 2, water: 1 },
    money: 7,
  });
  world.characters.other = character('other', 'char:2', {
    name: '旁人',
    inventory: { food: 1 },
    money: 5,
  });
  world.nextCharacterSequence = 3;
  world.tradeListings['listing:1'] = {
    id: 'listing:1',
    sellerSessionId: 'seller',
    sellerCharacterId: 'char:1',
    itemId: 'food',
    quantity: 3,
    totalPrice: 6,
    createdLogicalTimeSeconds: 40,
  };
  world.tradeListings['listing:2'] = {
    id: 'listing:2',
    sellerSessionId: 'other',
    sellerCharacterId: 'char:2',
    itemId: 'food',
    quantity: 1,
    totalPrice: 2,
    createdLogicalTimeSeconds: 41,
  };
  world.nextTradeListingSequence = 3;
  return world;
}

test('death settlement archives character, knowledge, and behavior while moving spendable assets to Estate', () => {
  const world = baseWorld();
  const result = settleCharacterDeath({
    world,
    sessionId: 'seller',
    characterId: 'char:1',
    causeCode: 'hazard.starvation',
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'ESTATE_OPENED');
  assert.equal(world.characters.seller, undefined);
  assert.ok(world.characters.other);
  assert.equal(world.tradeListings['listing:1'], undefined);
  assert.ok(world.tradeListings['listing:2']);

  const archived = world.archivedCharacters['char:1'];
  assert.equal(archived.status, 'dead');
  assert.equal(archived.ownerSessionId, 'seller');
  assert.equal(archived.deathCauseCode, 'hazard.starvation');
  assert.equal(archived.diedLogicalTimeSeconds, 42);
  assert.deepEqual(archived.knowledgeIds, ['starter-living-advice']);
  assert.equal(Object.hasOwn(archived, 'inventory'), false);
  assert.equal(Object.hasOwn(archived, 'money'), false);

  const estate = world.estates['estate:char:1'];
  assert.equal(estate.status, 'pending');
  assert.equal(estate.money, 7);
  assert.deepEqual(estate.inventory, { food: 5, water: 1 });
  assert.deepEqual(result.events[1].data.settledTradeListingIds, ['listing:1']);
  assert.equal(assertWorldState(world), world);
});

test('same account may start a new life only after the old character is archived, without asset or knowledge inheritance', async () => {
  const world = baseWorld();
  const settled = settleCharacterDeath({
    world,
    sessionId: 'seller',
    characterId: 'char:1',
    causeCode: 'hazard.accident',
  });
  assert.equal(settled.ok, true);

  const store = new MemoryGameStore(world);
  const { runtime } = createGame({ store, now: () => 1000 });
  const born = await runtime.dispatch({
    actor: { sessionId: 'seller' },
    requestId: 'new-life',
    action: { type: 'character.birth', payload: { name: '下一世' } },
  });

  assert.equal(born.ok, true);
  assert.equal(born.data.character.id, 'char:3');
  assert.equal(born.data.character.money, 0);
  assert.deepEqual(born.data.character.inventory, {});
  assert.equal(born.data.character.knowledgeIds, undefined);
  const stored = store.snapshot();
  assert.deepEqual(stored.characters.seller.knowledgeIds, []);
  assert.deepEqual(stored.archivedCharacters['char:1'].knowledgeIds, ['starter-living-advice']);
  assert.equal(stored.estates['estate:char:1'].money, 7);
  assert.deepEqual(stored.estates['estate:char:1'].inventory, { food: 5, water: 1 });
});

test('settlement rejects invalid or stale authority without mutation', () => {
  const world = baseWorld();
  const before = structuredClone(world);

  assert.equal(settleCharacterDeath({ world, sessionId: 'seller', characterId: 'char:1', causeCode: '自由文字 死亡' }).code, 'INVALID_DEATH_CAUSE');
  assert.deepEqual(world, before);
  assert.equal(settleCharacterDeath({ world, sessionId: 'seller', characterId: 'char:999', causeCode: 'hazard.accident' }).code, 'DEATH_CHARACTER_NOT_ACTIVE');
  assert.deepEqual(world, before);
});

test('repeating the same settlement cannot archive a later life or duplicate estate assets', () => {
  const world = baseWorld();
  const first = settleCharacterDeath({ world, sessionId: 'seller', characterId: 'char:1', causeCode: 'hazard.accident' });
  assert.equal(first.ok, true);
  const afterFirst = structuredClone(world);
  const second = settleCharacterDeath({ world, sessionId: 'seller', characterId: 'char:1', causeCode: 'hazard.accident' });
  assert.equal(second.code, 'DEATH_CHARACTER_NOT_ACTIVE');
  assert.deepEqual(world, afterFirst);
});

test('estate asset overflow fails before changing active character, trade, or assets', () => {
  const world = baseWorld();
  world.characters.seller.inventory.food = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(world);
  const result = settleCharacterDeath({
    world,
    sessionId: 'seller',
    characterId: 'char:1',
    causeCode: 'hazard.accident',
  });
  assert.equal(result.code, 'ESTATE_ASSET_LIMIT');
  assert.deepEqual(world, before);
});

test('Estate Module exposes no player-callable death action', async () => {
  const store = new MemoryGameStore(baseWorld());
  const { runtime } = createGame({ store, now: () => 1000 });
  const before = store.snapshot();
  const result = await runtime.dispatch({
    actor: { sessionId: 'seller' },
    requestId: 'browser-death-attempt',
    action: { type: 'estate.resolve-death', payload: { characterId: 'char:1' } },
  });
  assert.equal(result.code, 'UNKNOWN_ACTION');
  assert.deepEqual(store.snapshot(), before);
});
