import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { MAX_GAME_EVENTS, MAX_REQUEST_RESULTS } from '../src/core/world-state.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'three-day-session' };
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const THREE_DAYS_SECONDS = 3 * 24 * 60 * 60;

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('first settlement remains playable across three lazy-resolved mortal days', async () => {
  let nowMs = 1000;
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  assert.equal((await dispatch(game.runtime, 'birth', 'character.birth', { name: '三日旅人' })).ok, true);
  assert.equal(
    (await dispatch(game.runtime, 'accept-work', 'employment.accept', { jobId: 'first-carrying-work' })).code,
    'EMPLOYMENT_STARTED',
  );

  for (let cycle = 1; cycle <= 12; cycle += 1) {
    nowMs += SIX_HOURS_MS;

    const scene = await dispatch(game.runtime, `scene-${cycle}`, 'narrative.scene');
    assert.equal(scene.ok, true);
    assert.notEqual(scene.data.survivalCondition.severity, 'critical');
    assert.ok(scene.data.narrative.options.some(
      (entry) => entry.intent.type === 'economy.work' && entry.intent.payload.jobId === 'first-carrying-work',
    ));

    assert.equal(
      (await dispatch(game.runtime, `work-${cycle}`, 'economy.work', { jobId: 'first-carrying-work' })).code,
      'WORK_COMPLETED',
    );
    assert.equal(
      (await dispatch(game.runtime, `buy-bread-${cycle}`, 'economy.buy', { itemId: 'coarse-bread' })).code,
      'PURCHASE_COMPLETED',
    );
    assert.equal(
      (await dispatch(game.runtime, `buy-water-${cycle}`, 'economy.buy', { itemId: 'drinking-water' })).code,
      'PURCHASE_COMPLETED',
    );
    assert.equal(
      (await dispatch(game.runtime, `eat-${cycle}`, 'survival.consume', { itemId: 'coarse-bread' })).code,
      'ITEM_CONSUMED',
    );
    assert.equal(
      (await dispatch(game.runtime, `drink-${cycle}`, 'survival.consume', { itemId: 'drinking-water' })).code,
      'ITEM_CONSUMED',
    );
    assert.equal(
      (await dispatch(game.runtime, `to-lodging-${cycle}`, 'location.travel', { destinationId: 'first-lodging' })).code,
      'TRAVEL_COMPLETED',
    );
    assert.equal((await dispatch(game.runtime, `rest-${cycle}`, 'survival.rest')).code, 'REST_COMPLETED');
    assert.equal(
      (await dispatch(game.runtime, `to-square-${cycle}`, 'location.travel', { destinationId: 'first-square' })).code,
      'TRAVEL_COMPLETED',
    );

    const current = game.store.snapshot().characters[actor.sessionId];
    assert.equal(current.locationId, 'first-square');
    assert.equal(current.money, 0);
    assert.ok(current.needs.hunger < firstSettlementPack.survival.criticalThreshold);
    assert.ok(current.needs.thirst < firstSettlementPack.survival.criticalThreshold);
    assert.ok(current.needs.fatigue < firstSettlementPack.survival.criticalThreshold);

    if (cycle % 4 === 0) {
      assert.equal(game.store.snapshot().logicalTimeSeconds, cycle * 6 * 60 * 60);
    }
  }

  const finalWorld = game.store.snapshot();
  const finalCharacter = finalWorld.characters[actor.sessionId];
  assert.equal(finalWorld.logicalTimeSeconds, THREE_DAYS_SECONDS);
  assert.equal(finalWorld.lastResolvedAtMs, nowMs);
  assert.equal(finalCharacter.status, 'alive');
  assert.equal(finalCharacter.locationId, 'first-square');
  assert.deepEqual(finalCharacter.currentEmployment, {
    jobId: 'first-carrying-work',
    employerNpcId: 'first-foreman',
    workLocationId: 'first-square',
  });
  assert.equal(finalCharacter.behaviorCounts['work:first-carrying'], 12);
  assert.equal(finalCharacter.money, 0);
  assert.ok(finalWorld.requestOrder.length < MAX_REQUEST_RESULTS);
  assert.ok(finalWorld.gameEvents.length < MAX_GAME_EVENTS);

  const progression = await dispatch(game.runtime, 'progression-after-three-days', 'progression.observe');
  assert.ok(progression.data.socialTags.some((tag) => tag.name === '搬運熟手'));
  const careers = await dispatch(game.runtime, 'career-after-three-days', 'career.observe');
  assert.ok(careers.data.careers.some((career) => career.name === '聚落短工熟手'));
});
