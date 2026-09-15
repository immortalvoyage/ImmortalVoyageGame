import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'first-settlement-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('first settlement candidate validates and exposes livelihood plus survival capabilities without canon-specific recovery fixtures', () => {
  assert.equal(validateContentPack(firstSettlementPack), firstSettlementPack);
  assert.ok(firstSettlementPack.locations[firstSettlementPack.startingLocationId]);
  const locations = Object.values(firstSettlementPack.locations);
  assert.ok(locations.flatMap((location) => location.jobs).length >= 1);
  assert.ok(locations.flatMap((location) => location.market).some((offer) => firstSettlementPack.items[offer.itemId]?.consumeEffect));
  assert.ok(locations.some((location) => location.rest));
  assert.equal(firstSettlementPack.items['wild-fruit'], undefined);
  assert.equal(locations.flatMap((location) => location.gatherables).length, 0);
  const recoveryWork = locations.flatMap((location) => location.recoveryWork ?? []);
  for (const need of ['hunger', 'thirst']) {
    assert.ok(recoveryWork.some((entry) => firstSettlementPack.items[entry.reward.itemId]?.consumeEffect?.[need] < 0));
  }
});

test('fresh mortal can find an employer, earn, buy food, obtain water, consume supplies, change jobs, and rest', async () => {
  const clock = { now: 1000 };
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => clock.now });
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
  assert.equal((await dispatch(game.runtime, 'work-carrying', 'economy.work', { jobId: 'first-carrying-work' })).code, 'WORK_STARTED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 0);
  clock.now += 5 * 60 * 1000;
  await dispatch(game.runtime, 'settle-carrying', 'narrative.scene');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 2);

  assert.equal((await dispatch(game.runtime, 'buy-bread', 'economy.buy', { itemId: 'coarse-bread' })).code, 'PURCHASE_COMPLETED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 1);
  assert.equal((await dispatch(game.runtime, 'eat-bread', 'survival.consume', { itemId: 'coarse-bread' })).code, 'ITEM_CONSUMED');

  assert.equal((await dispatch(game.runtime, 'buy-water', 'economy.buy', { itemId: 'drinking-water' })).code, 'PURCHASE_COMPLETED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 0);
  assert.equal((await dispatch(game.runtime, 'drink-water', 'survival.consume', { itemId: 'drinking-water' })).code, 'ITEM_CONSUMED');
  assert.equal((await dispatch(game.runtime, 'resign-carrying', 'employment.resign')).code, 'EMPLOYMENT_ENDED');
  await dispatch(game.runtime, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' });
  scene = await dispatch(game.runtime, 'scene-lodging', 'narrative.scene');
  assert.ok(scene.data.narrative.options.some(
    (entry) => entry.intent.type === 'employment.accept' && entry.intent.payload.jobId === 'first-lodging-work',
  ));
  assert.ok(scene.data.utilities.some(
    (entry) => entry.intent.type === 'survival.rest' && entry.label === '在簡易宿所休息',
  ));

  assert.equal((await dispatch(game.runtime, 'accept-lodging', 'employment.accept', { jobId: 'first-lodging-work' })).code, 'EMPLOYMENT_STARTED');
  assert.equal((await dispatch(game.runtime, 'work-lodging', 'economy.work', { jobId: 'first-lodging-work' })).code, 'WORK_STARTED');
  clock.now += 5 * 60 * 1000;
  await dispatch(game.runtime, 'settle-lodging', 'narrative.scene');
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
