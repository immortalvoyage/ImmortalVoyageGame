import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'first-settlement-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('first settlement candidate validates and contains the minimum mortal-life topology', () => {
  assert.equal(validateContentPack(firstSettlementPack), firstSettlementPack);
  assert.equal(firstSettlementPack.startingLocationId, 'first-square');
  assert.equal(Object.keys(firstSettlementPack.locations).length, 4);
  assert.equal(firstSettlementPack.locations['first-square'].routes.length, 3);
  assert.ok(firstSettlementPack.locations['first-well'].gatherables.some((entry) => entry.itemId === 'drinking-water'));
  assert.ok(firstSettlementPack.locations['first-outskirts'].gatherables.some((entry) => entry.itemId === 'wild-fruit'));
  assert.ok(firstSettlementPack.locations['first-square'].market.some((entry) => entry.itemId === 'coarse-bread'));
  assert.ok(firstSettlementPack.locations['first-lodging'].rest);
  assert.equal(
    Object.values(firstSettlementPack.locations).flatMap((location) => location.jobs).length,
    2,
  );
});

test('fresh mortal can find an employer, earn, buy food, obtain water, consume supplies, change jobs, and rest', async () => {
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  const born = await dispatch(game.runtime, 'birth', 'character.birth', { name: '初入聚落者' });
  assert.equal(born.ok, true);
  assert.equal(born.data.character.currentEmployment, undefined);
  assert.equal(born.data.character.locationId, 'first-square');

  let scene = await dispatch(game.runtime, 'scene-start', 'narrative.scene');
  assert.equal(scene.data.location.name, '初始聚落街口');
  const offer = scene.data.narrative.options.find((entry) => entry.intent.type === 'employment.accept');
  assert.deepEqual(offer.intent.payload, { jobId: 'first-carrying-work' });
  assert.match(offer.label, /搬運領班/);
  assert.match(offer.label, /每次報酬 2/);

  assert.equal((await dispatch(game.runtime, 'accept-carrying', 'employment.accept', { jobId: 'first-carrying-work' })).code, 'EMPLOYMENT_STARTED');
  assert.equal((await dispatch(game.runtime, 'work-carrying', 'economy.work', { jobId: 'first-carrying-work' })).code, 'WORK_COMPLETED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 2);

  assert.equal((await dispatch(game.runtime, 'buy-bread', 'economy.buy', { itemId: 'coarse-bread' })).code, 'PURCHASE_COMPLETED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 1);
  assert.equal((await dispatch(game.runtime, 'eat-bread', 'survival.consume', { itemId: 'coarse-bread' })).code, 'ITEM_CONSUMED');

  assert.equal((await dispatch(game.runtime, 'resign-carrying', 'employment.resign')).code, 'EMPLOYMENT_ENDED');
  assert.equal((await dispatch(game.runtime, 'to-well', 'location.travel', { destinationId: 'first-well' })).code, 'TRAVEL_COMPLETED');
  assert.equal((await dispatch(game.runtime, 'get-water', 'survival.gather', { itemId: 'drinking-water' })).code, 'RESOURCE_GATHERED');
  assert.equal((await dispatch(game.runtime, 'drink-water', 'survival.consume', { itemId: 'drinking-water' })).code, 'ITEM_CONSUMED');

  await dispatch(game.runtime, 'well-home', 'location.travel', { destinationId: 'first-square' });
  await dispatch(game.runtime, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' });
  scene = await dispatch(game.runtime, 'scene-lodging', 'narrative.scene');
  assert.ok(scene.data.narrative.options.some(
    (entry) => entry.intent.type === 'employment.accept' && entry.intent.payload.jobId === 'first-lodging-work',
  ));
  assert.ok(scene.data.utilities.some(
    (entry) => entry.intent.type === 'survival.rest' && entry.label === '在公共通鋪休息',
  ));

  assert.equal((await dispatch(game.runtime, 'accept-lodging', 'employment.accept', { jobId: 'first-lodging-work' })).code, 'EMPLOYMENT_STARTED');
  assert.equal((await dispatch(game.runtime, 'work-lodging', 'economy.work', { jobId: 'first-lodging-work' })).code, 'WORK_COMPLETED');
  const beforeRest = game.store.snapshot().characters[actor.sessionId].needs.fatigue;
  assert.ok(beforeRest > 0);
  assert.equal((await dispatch(game.runtime, 'rest-lodging', 'survival.rest')).code, 'REST_COMPLETED');
  assert.ok(game.store.snapshot().characters[actor.sessionId].needs.fatigue < beforeRest);
});

test('first settlement works with official AI completely absent and exposes only server-shaped intents', async () => {
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  await dispatch(game.runtime, 'birth-no-ai', 'character.birth', { name: '凡人' });
  const scene = await dispatch(game.runtime, 'scene-no-ai', 'narrative.scene');

  assert.equal(scene.data.narrative.mode, 'deterministic-fallback');
  assert.ok(scene.data.narrative.options.length >= 2 && scene.data.narrative.options.length <= 4);
  const serialized = JSON.stringify(scene.data);
  assert.equal(serialized.includes('behaviorId'), false);
  assert.equal(serialized.includes('needCosts'), false);
  assert.equal(serialized.includes('currentEmployment'), false);
  assert.equal(serialized.includes('修仙'), false);
});
