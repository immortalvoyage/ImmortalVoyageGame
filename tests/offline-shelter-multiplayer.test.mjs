import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const HOUR_MS = 60 * 60 * 1000;
const shelteredActor = { sessionId: 'sheltered-player' };
const activeActor = { sessionId: 'active-player' };

async function dispatch(runtime, actor, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('another player hourly requests cannot reset an offline sheltered character cumulative survival cap', async () => {
  let nowMs = 1000;
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  assert.equal((await dispatch(game.runtime, shelteredActor, 'sheltered-birth', 'character.birth', { name: '留宿旅人' })).ok, true);
  assert.equal((await dispatch(game.runtime, shelteredActor, 'sheltered-lodging', 'location.travel', { destinationId: 'first-lodging' })).ok, true);
  assert.equal((await dispatch(game.runtime, activeActor, 'active-birth', 'character.birth', { name: '街口旅人' })).ok, true);

  for (let hour = 1; hour <= 72; hour += 1) {
    nowMs += HOUR_MS;
    const observed = await dispatch(game.runtime, activeActor, `active-scene-${hour}`, 'narrative.scene');
    assert.equal(observed.ok, true);
  }

  let world = game.store.snapshot();
  let sheltered = world.characters[shelteredActor.sessionId];
  const active = world.characters[activeActor.sessionId];

  assert.equal(world.logicalTimeSeconds, 72 * 60 * 60);
  assert.deepEqual(sheltered.needs, { hunger: 12, thirst: 18, fatigue: 7 });
  assert.equal(sheltered.lastActiveLogicalTimeSeconds, 0);
  assert.equal(sheltered.lastSurvivalResolvedLogicalTimeSeconds, 72 * 60 * 60);
  assert.deepEqual(active.needs, { hunger: 100, thirst: 100, fatigue: 72 });
  assert.equal(active.lastActiveLogicalTimeSeconds, 72 * 60 * 60);

  const returned = await dispatch(game.runtime, shelteredActor, 'sheltered-return', 'narrative.scene');
  assert.equal(returned.ok, true);
  assert.deepEqual(returned.data.character.needs, { hunger: 12, thirst: 18, fatigue: 7 });
  const serializedReturn = JSON.stringify(returned.data);
  assert.equal(serializedReturn.includes('lastActiveLogicalTimeSeconds'), false);
  assert.equal(serializedReturn.includes('lastSurvivalResolvedLogicalTimeSeconds'), false);

  world = game.store.snapshot();
  sheltered = world.characters[shelteredActor.sessionId];
  assert.equal(sheltered.lastActiveLogicalTimeSeconds, 72 * 60 * 60);
  assert.equal(sheltered.lastSurvivalResolvedLogicalTimeSeconds, 72 * 60 * 60);

  nowMs += HOUR_MS;
  assert.equal((await dispatch(game.runtime, activeActor, 'active-scene-73', 'narrative.scene')).ok, true);
  sheltered = game.store.snapshot().characters[shelteredActor.sessionId];
  assert.deepEqual(sheltered.needs, { hunger: 14, thirst: 21, fatigue: 8 });
  assert.equal(sheltered.lastActiveLogicalTimeSeconds, 72 * 60 * 60);
  assert.equal(sheltered.lastSurvivalResolvedLogicalTimeSeconds, 73 * 60 * 60);
});
