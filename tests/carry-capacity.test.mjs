import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';

function actor(sessionId) {
  return { sessionId };
}

async function dispatch(runtime, who, requestId, type, payload = {}) {
  return runtime.dispatch({ actor: who, requestId, action: { type, payload } });
}

async function birth(game, who, name = '負重測試者') {
  const result = await dispatch(game.runtime, who, `birth-${who.sessionId}`, 'character.birth', { name });
  assert.equal(result.ok, true);
}

function boundedPack(capacity = 2) {
  const pack = structuredClone(firstSettlementPack);
  pack.dataVersion = 999;
  pack.inventory.carryCapacityUnits = capacity;
  return pack;
}

test('Content Pack requires bounded carry capacity and per-item carry units', () => {
  const noCapacity = structuredClone(firstSettlementPack);
  delete noCapacity.inventory;
  assert.throws(() => validateContentPack(noCapacity), /pack.inventory/);

  const noUnits = structuredClone(firstSettlementPack);
  delete noUnits.items['drinking-water'].carryUnits;
  assert.throws(() => validateContentPack(noUnits), /carryUnits/);

  const invalidCapacity = structuredClone(firstSettlementPack);
  invalidCapacity.inventory.carryCapacityUnits = 0;
  assert.throws(() => validateContentPack(invalidCapacity), /carryCapacityUnits/);
});

test('gather, market buy, and crafting fail atomically when they would increase load past capacity', async () => {
  const pack = boundedPack(2);
  pack.items['simple-ration'].carryUnits = 3;
  validateContentPack(pack);
  const game = createDevelopmentGame({ contentPack: pack, now: () => 1000 });
  const who = actor('carry-main');
  await birth(game, who);

  let world = game.store.snapshot();
  Object.assign(world.characters[who.sessionId], {
    money: 10,
    inventory: { 'coarse-bread': 2 },
    locationId: 'first-square',
  });
  await game.store.replace(world);

  const beforeBuy = game.store.snapshot();
  const buy = await dispatch(game.runtime, who, 'buy-over-cap', 'economy.buy', { itemId: 'drinking-water' });
  assert.equal(buy.code, 'CARRY_CAPACITY_EXCEEDED');
  assert.deepEqual(game.store.snapshot().characters[who.sessionId], beforeBuy.characters[who.sessionId]);

  world = game.store.snapshot();
  world.characters[who.sessionId].locationId = 'first-well';
  await game.store.replace(world);
  const beforeGather = game.store.snapshot();
  const gather = await dispatch(game.runtime, who, 'gather-over-cap', 'survival.gather', { itemId: 'drinking-water' });
  assert.equal(gather.code, 'CARRY_CAPACITY_EXCEEDED');
  assert.deepEqual(game.store.snapshot().characters[who.sessionId], beforeGather.characters[who.sessionId]);

  world = game.store.snapshot();
  Object.assign(world.characters[who.sessionId], {
    inventory: { 'coarse-bread': 1, 'drinking-water': 1 },
    locationId: 'first-square',
  });
  await game.store.replace(world);
  const projected = await dispatch(game.runtime, who, 'scene-full-cap', 'narrative.scene');
  assert.equal(projected.data.utilities.some((entry) => entry.intent.type === 'crafting.craft'), false);
  assert.equal(projected.data.utilities.some((entry) => entry.intent.type === 'economy.buy'), false);

  const beforeCraft = game.store.snapshot();
  const craft = await dispatch(game.runtime, who, 'craft-over-cap', 'crafting.craft', { recipeId: 'first-simple-ration' });
  assert.equal(craft.code, 'CARRY_CAPACITY_EXCEEDED');
  assert.deepEqual(game.store.snapshot().characters[who.sessionId], beforeCraft.characters[who.sessionId]);

  assert.equal((await dispatch(game.runtime, who, 'eat-to-free-space', 'survival.consume', { itemId: 'coarse-bread' })).ok, true);
  const buyAfterRelief = await dispatch(game.runtime, who, 'buy-after-relief', 'economy.buy', { itemId: 'coarse-bread' });
  assert.equal(buyAfterRelief.ok, true);
});

test('legacy overloaded inventory remains loadable, can recover downward, and cannot increase load', async () => {
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  const who = actor('carry-legacy');
  await birth(game, who, '舊檔旅人');

  let world = game.store.snapshot();
  Object.assign(world.characters[who.sessionId], {
    inventory: { 'drinking-water': 25 },
    locationId: 'first-well',
  });
  await game.store.replace(world);

  const scene = await dispatch(game.runtime, who, 'legacy-scene', 'narrative.scene');
  assert.deepEqual(scene.data.carry, { load: 25, capacity: 20, overloaded: true });
  const visible = [...scene.data.narrative.options, ...scene.data.utilities];
  assert.equal(visible.some((entry) => entry.intent.type === 'survival.gather'), false);

  const beforeGather = game.store.snapshot();
  const blocked = await dispatch(game.runtime, who, 'legacy-gather', 'survival.gather', { itemId: 'drinking-water' });
  assert.equal(blocked.code, 'CARRY_CAPACITY_EXCEEDED');
  assert.deepEqual(game.store.snapshot().characters[who.sessionId], beforeGather.characters[who.sessionId]);

  const consumed = await dispatch(game.runtime, who, 'legacy-consume', 'survival.consume', { itemId: 'drinking-water' });
  assert.equal(consumed.ok, true);
  assert.equal(game.store.snapshot().characters[who.sessionId].inventory['drinking-water'], 24);
});

test('trade purchase and cancel preserve escrow atomically when the receiver has no carry space', async () => {
  const pack = boundedPack(2);
  validateContentPack(pack);
  const game = createDevelopmentGame({ contentPack: pack, now: () => 1000 });
  const seller = actor('carry-seller');
  const buyer = actor('carry-buyer');
  await birth(game, seller, '賣方');
  await birth(game, buyer, '買方');

  const world = game.store.snapshot();
  Object.assign(world.characters[seller.sessionId], {
    money: 0,
    inventory: { 'coarse-bread': 1 },
    locationId: 'first-square',
  });
  Object.assign(world.characters[buyer.sessionId], {
    money: 10,
    inventory: { 'drinking-water': 2 },
    locationId: 'first-square',
  });
  await game.store.replace(world);

  const listed = await dispatch(game.runtime, seller, 'list-bread', 'trade.list', {
    itemId: 'coarse-bread',
    quantity: 1,
    totalPrice: 1,
  });
  assert.equal(listed.ok, true);
  const listingId = listed.data.listing.id;

  const beforeBuy = game.store.snapshot();
  const blocked = await dispatch(game.runtime, buyer, 'buy-listing-over-cap', 'trade.buy', { listingId });
  assert.equal(blocked.code, 'CARRY_CAPACITY_EXCEEDED');
  const afterBlocked = game.store.snapshot();
  assert.equal(afterBlocked.characters[buyer.sessionId].money, beforeBuy.characters[buyer.sessionId].money);
  assert.deepEqual(afterBlocked.characters[buyer.sessionId].inventory, beforeBuy.characters[buyer.sessionId].inventory);
  assert.ok(afterBlocked.tradeListings[listingId]);
  assert.equal(afterBlocked.characters[seller.sessionId].money, 0);

  const sellerFull = game.store.snapshot();
  sellerFull.characters[seller.sessionId].inventory = { 'drinking-water': 2 };
  await game.store.replace(sellerFull);
  const blockedCancel = await dispatch(game.runtime, seller, 'cancel-over-cap', 'trade.cancel', { listingId });
  assert.equal(blockedCancel.code, 'CARRY_CAPACITY_EXCEEDED');
  assert.ok(game.store.snapshot().tradeListings[listingId]);

  assert.equal((await dispatch(game.runtime, seller, 'seller-drink', 'survival.consume', { itemId: 'drinking-water' })).ok, true);
  const cancelled = await dispatch(game.runtime, seller, 'cancel-listing', 'trade.cancel', { listingId });
  assert.equal(cancelled.ok, true);
  assert.deepEqual(game.store.snapshot().characters[seller.sessionId].inventory, { 'drinking-water': 1, 'coarse-bread': 1 });
});
