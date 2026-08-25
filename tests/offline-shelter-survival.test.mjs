import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

async function dispatch(runtime, actor, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('three-day absence at the designated lodging remains recoverable without background work', async () => {
  let nowMs = 1000;
  const actor = { sessionId: 'sheltered-absence' };
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  await dispatch(game.runtime, actor, 'birth', 'character.birth', { name: '留宿旅人' });
  await dispatch(game.runtime, actor, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' });
  const before = game.store.snapshot();
  assert.equal(before.characters[actor.sessionId].locationId, 'first-lodging');

  nowMs += THREE_DAYS_MS;
  const scene = await dispatch(game.runtime, actor, 'return-after-three-days', 'narrative.scene');
  assert.equal(scene.ok, true);
  assert.deepEqual(scene.data.character.needs, { hunger: 12, thirst: 18, fatigue: 7 });
  assert.notEqual(scene.data.survivalCondition.severity, 'critical');
  assert.equal(JSON.stringify(scene.data).includes('absenceSurvivalCapSeconds'), false);
  assert.equal(JSON.stringify(scene.data).includes('shelter'), false);

  const world = game.store.snapshot();
  assert.equal(world.logicalTimeSeconds, 3 * 24 * 60 * 60);
  assert.equal(world.lastResolvedAtMs, nowMs);
});

test('the same three-day absence outside shelter keeps full survival pressure', async () => {
  let nowMs = 1000;
  const actor = { sessionId: 'unsheltered-absence' };
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  await dispatch(game.runtime, actor, 'birth', 'character.birth', { name: '街口旅人' });
  nowMs += THREE_DAYS_MS;
  const scene = await dispatch(game.runtime, actor, 'return-after-three-days', 'narrative.scene');

  assert.equal(scene.ok, true);
  assert.deepEqual(scene.data.character.needs, { hunger: 100, thirst: 100, fatigue: 72 });
  assert.equal(scene.data.survivalCondition.severity, 'critical');
  assert.equal(game.store.snapshot().logicalTimeSeconds, 3 * 24 * 60 * 60);
});

test('shelter protection is location-bound and stops after leaving the lodging', async () => {
  let nowMs = 1000;
  const actor = { sessionId: 'leave-shelter' };
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  await dispatch(game.runtime, actor, 'birth', 'character.birth', { name: '往返旅人' });
  await dispatch(game.runtime, actor, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' });
  nowMs += THREE_DAYS_MS;
  await dispatch(game.runtime, actor, 'sheltered-return', 'narrative.scene');
  await dispatch(game.runtime, actor, 'leave-lodging', 'location.travel', { destinationId: 'first-square' });

  nowMs += 24 * 60 * 60 * 1000;
  const scene = await dispatch(game.runtime, actor, 'street-next-day', 'narrative.scene');
  assert.equal(scene.data.character.needs.hunger, 60);
  assert.equal(scene.data.character.needs.thirst, 90);
  assert.equal(scene.data.character.needs.fatigue, 32);
  assert.equal(scene.data.survivalCondition.severity, 'critical');
});
