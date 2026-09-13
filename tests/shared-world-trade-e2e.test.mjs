import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOnboardingDevServer } from '../dev/server.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function postAction(base, cookie, requestId, type, payload = {}) {
  const response = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ requestId, action: { type, payload } }),
  });
  return { response, body: await response.json() };
}

function sessionIdFrom(cookie) {
  return decodeURIComponent(cookie.slice('iv_session='.length));
}
async function createFormalPlayer(base, cookie, prefix, name) {
  let result = await postAction(base, cookie, `${prefix}-avatar`, 'character.birth', { name: `${name}教學` });
  assert.equal(result.response.status, 200);
  result = await postAction(base, cookie, `${prefix}-leave`, 'onboarding.leave-tutorial', { confirmDiscard: true });
  assert.equal(result.body.code, 'TUTORIAL_LEFT');
  result = await postAction(base, cookie, `${prefix}-birth`, 'life.formal-birth', {
    name,
    birthLocationId: 'first-square',
  });
  assert.equal(result.body.code, 'FORMAL_LIFE_BORN');
}

async function earnAndBuyBread(base, cookie, prefix) {
  let result = await postAction(base, cookie, `${prefix}-employment`, 'employment.accept', { jobId: 'first-carrying-work' });
  assert.equal(result.body.code, 'EMPLOYMENT_STARTED');
  result = await postAction(base, cookie, `${prefix}-work`, 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(result.body.code, 'WORK_COMPLETED');
  result = await postAction(base, cookie, `${prefix}-bread`, 'economy.buy', { itemId: 'coarse-bread' });
  assert.equal(result.body.code, 'PURCHASE_COMPLETED');
  return result;
}

test('two formal players affect the same authoritative world through trade', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-shared-trade-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'formal-world.json');
  const server = createOnboardingDevServer({ filePath, now: () => 5000 });
  const base = await listen(server);
  t.after(() => close(server));
  const sellerPage = await fetch(base + '/');
  const sellerCookie = sellerPage.headers.get('set-cookie').split(';')[0];
  const buyerPage = await fetch(base + '/');
  const buyerCookie = buyerPage.headers.get('set-cookie').split(';')[0];
  assert.notEqual(sellerCookie, buyerCookie);

  await createFormalPlayer(base, sellerCookie, 'seller', '寄售者');
  await createFormalPlayer(base, buyerCookie, 'buyer', '購買者');

  let result = await earnAndBuyBread(base, sellerCookie, 'seller');
  assert.equal(result.body.data.money, 1);
  result = await postAction(base, sellerCookie, 'seller-list', 'trade.list', {
    itemId: 'coarse-bread',
    quantity: 1,
    totalPrice: 1,
  });
  assert.equal(result.body.code, 'TRADE_LISTED');
  const listingId = result.body.data.listing.id;

  result = await postAction(base, buyerCookie, 'buyer-employment', 'employment.accept', { jobId: 'first-carrying-work' });
  assert.equal(result.body.code, 'EMPLOYMENT_STARTED');
  result = await postAction(base, buyerCookie, 'buyer-work', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(result.body.code, 'WORK_COMPLETED');
  assert.equal(result.body.data.money, 2);

  result = await postAction(base, buyerCookie, 'buyer-browse', 'trade.browse');
  assert.equal(result.body.code, 'TRADE_BROWSED');
  assert.ok(result.body.data.listings.some((entry) => entry.id === listingId && entry.sellerName === '寄售者'));
  const firstBuy = await postAction(base, buyerCookie, 'buyer-buy', 'trade.buy', { listingId });
  assert.equal(firstBuy.body.code, 'TRADE_PURCHASED');
  const replay = await postAction(base, buyerCookie, 'buyer-buy', 'trade.buy', { listingId });
  assert.deepEqual(replay.body, firstBuy.body);

  const world = JSON.parse(await readFile(filePath, 'utf8'));
  const sellerId = sessionIdFrom(sellerCookie);
  const buyerId = sessionIdFrom(buyerCookie);
  assert.equal(Object.keys(world.characters).length, 2);
  assert.equal(world.characters[sellerId].money, 2);
  assert.equal(world.characters[buyerId].money, 1);
  assert.equal(world.characters[buyerId].inventory['coarse-bread'], 1);
  assert.equal(world.characters[sellerId].inventory['coarse-bread'] ?? 0, 0);
  assert.equal(world.tradeListings[listingId], undefined);
  assert.equal(world.gameEvents.filter((event) => event.type === 'trade.completed').length, 1);
  assert.equal(world.gameEvents.filter((event) => event.type === 'economy.money-transferred').length, 1);
});
