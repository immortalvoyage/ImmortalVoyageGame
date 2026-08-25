import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const seller = { sessionId: 'seller-session' };
const buyer = { sessionId: 'buyer-session' };

async function dispatch(runtime, actor, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function birthBoth(runtime) {
  await dispatch(runtime, seller, 'seller-birth', 'character.birth', { name: '賣方旅人' });
  await dispatch(runtime, buyer, 'buyer-birth', 'character.birth', { name: '買方旅人' });
}

async function giveSellerFood(runtime, suffix = '') {
  await dispatch(runtime, seller, `seller-grove${suffix}`, 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(runtime, seller, `seller-food${suffix}`, 'survival.gather', { itemId: 'food' });
  await dispatch(runtime, seller, `seller-home${suffix}`, 'location.travel', { destinationId: 'starter-square' });
}

async function giveBuyerMoney(runtime) {
  await dispatch(runtime, buyer, 'buyer-employment', 'employment.accept', { jobId: 'starter-labor' });
  await dispatch(runtime, buyer, 'buyer-work-1', 'economy.work', { jobId: 'starter-labor' });
  await dispatch(runtime, buyer, 'buyer-work-2', 'economy.work', { jobId: 'starter-labor' });
}

test('fixed-price listing escrows inventory and exposes only public trade data', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await birthBoth(runtime);
  await giveSellerFood(runtime);

  const listed = await dispatch(runtime, seller, 'list-food', 'trade.list', {
    itemId: 'food',
    quantity: 1,
    totalPrice: 3,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.code, 'TRADE_LISTED');
  assert.deepEqual(store.snapshot().characters[seller.sessionId].inventory, {});
  assert.equal(Object.keys(store.snapshot().tradeListings).length, 1);

  const browsed = await dispatch(runtime, buyer, 'browse', 'trade.browse');
  assert.equal(browsed.ok, true);
  assert.equal(browsed.data.listings.length, 1);
  assert.deepEqual(browsed.data.listings[0].item, { name: '食物', quantity: 1 });
  assert.equal(browsed.data.listings[0].sellerName, '賣方旅人');
  assert.equal(browsed.data.listings[0].action.intent.type, 'trade.buy');
  const serialized = JSON.stringify(browsed.data.listings[0]);
  assert.equal(serialized.includes('sellerSessionId'), false);
  assert.equal(serialized.includes('sellerCharacterId'), false);
  assert.equal(serialized.includes('itemId'), false);
});

test('seller can cancel a listing and atomically recover escrowed inventory', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await birthBoth(runtime);
  await giveSellerFood(runtime);
  const listed = await dispatch(runtime, seller, 'list-cancel', 'trade.list', { itemId: 'food', quantity: 1, totalPrice: 2 });
  const listingId = listed.data.listing.id;

  const cancelled = await dispatch(runtime, seller, 'cancel', 'trade.cancel', { listingId });
  assert.equal(cancelled.code, 'TRADE_CANCELLED');
  assert.deepEqual(store.snapshot().characters[seller.sessionId].inventory, { food: 1 });
  assert.equal(store.snapshot().tradeListings[listingId], undefined);
});

test('purchase atomically transfers money and escrowed item exactly once', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await birthBoth(runtime);
  await giveSellerFood(runtime);
  await giveBuyerMoney(runtime);
  const listed = await dispatch(runtime, seller, 'list-buy', 'trade.list', { itemId: 'food', quantity: 1, totalPrice: 3 });
  const listingId = listed.data.listing.id;

  const first = await dispatch(runtime, buyer, 'buy-once', 'trade.buy', { listingId });
  const replay = await dispatch(runtime, buyer, 'buy-once', 'trade.buy', { listingId });
  assert.deepEqual(replay, first);
  assert.equal(first.code, 'TRADE_PURCHASED');

  const world = store.snapshot();
  assert.equal(world.characters[buyer.sessionId].money, 1);
  assert.equal(world.characters[seller.sessionId].money, 3);
  assert.deepEqual(world.characters[buyer.sessionId].inventory, { food: 1 });
  assert.equal(world.tradeListings[listingId], undefined);
  assert.equal(world.gameEvents.filter((event) => event.type === 'trade.completed').length, 1);
  assert.equal(world.gameEvents.filter((event) => event.type === 'economy.money-transferred').length, 1);
});

test('listing request idempotency cannot escrow inventory twice', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await birthBoth(runtime);
  await giveSellerFood(runtime, '-retry');

  const first = await dispatch(runtime, seller, 'same-list', 'trade.list', { itemId: 'food', quantity: 1, totalPrice: 2 });
  const replay = await dispatch(runtime, seller, 'same-list', 'trade.list', { itemId: 'food', quantity: 1, totalPrice: 2 });
  assert.deepEqual(replay, first);
  assert.deepEqual(store.snapshot().characters[seller.sessionId].inventory, {});
  assert.equal(Object.keys(store.snapshot().tradeListings).length, 1);
});

test('invalid trade operations do not mutate authoritative assets', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await birthBoth(runtime);
  await giveSellerFood(runtime);
  const listed = await dispatch(runtime, seller, 'list-guard', 'trade.list', { itemId: 'food', quantity: 1, totalPrice: 5 });
  const listingId = listed.data.listing.id;

  let before = store.snapshot();
  const ownBuy = await dispatch(runtime, seller, 'own-buy', 'trade.buy', { listingId });
  assert.equal(ownBuy.code, 'TRADE_OWN_LISTING');
  assert.deepEqual(store.snapshot(), before);

  before = store.snapshot();
  const poorBuy = await dispatch(runtime, buyer, 'poor-buy', 'trade.buy', { listingId });
  assert.equal(poorBuy.code, 'INSUFFICIENT_FUNDS');
  assert.deepEqual(store.snapshot(), before);

  before = store.snapshot();
  const stolenCancel = await dispatch(runtime, buyer, 'stolen-cancel', 'trade.cancel', { listingId });
  assert.equal(stolenCancel.code, 'TRADE_NOT_OWNER');
  assert.deepEqual(store.snapshot(), before);

  before = store.snapshot();
  const badListing = await dispatch(runtime, buyer, 'bad-list', 'trade.list', { itemId: 'food', quantity: 0, totalPrice: 1 });
  assert.equal(badListing.code, 'INVALID_TRADE_LISTING');
  assert.deepEqual(store.snapshot(), before);
});

test('disabling Trade Module hides trade UI contract without breaking other gameplay', async () => {
  const { runtime, store } = createDevelopmentGame({
    now: () => 1000,
    enabledModules: ['character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'crafting', 'progression', 'career', 'narrative'],
  });
  await dispatch(runtime, seller, 'disabled-birth', 'character.birth', { name: '不交易旅人' });
  await dispatch(runtime, seller, 'disabled-work', 'economy.work', { jobId: 'starter-labor' });
  assert.equal(store.snapshot().characters[seller.sessionId].money, 2);

  const scene = await dispatch(runtime, seller, 'disabled-scene', 'narrative.scene');
  assert.equal(scene.data.trade, null);
  assert.equal((await dispatch(runtime, seller, 'disabled-trade', 'trade.browse')).code, 'UNKNOWN_ACTION');
});
