import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame, createGame } from '../src/game.js';

const actor = { sessionId: 'broke-recovery-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('zero-money critical character retains deterministic food, water, rest, and work recovery path', async () => {
  const healthy = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  assert.equal((await dispatch(healthy.runtime, 'birth', 'character.birth', { name: '窮困旅人' })).ok, true);
  assert.equal((await dispatch(healthy.runtime, 'accept', 'employment.accept', { jobId: 'first-carrying-work' })).ok, true);

  const criticalWorld = healthy.store.snapshot();
  const character = criticalWorld.characters[actor.sessionId];
  character.money = 0;
  character.inventory = {};
  character.needs = { hunger: 90, thirst: 90, fatigue: 90 };
  const store = new MemoryGameStore(criticalWorld);
  const { runtime } = createGame({ store, contentPack: firstSettlementPack, now: () => 1000 });

  const beforeRejectedWork = store.snapshot();
  const rejectedWork = await dispatch(runtime, 'critical-work', 'economy.work', { jobId: 'first-carrying-work' });
  assert.deepEqual(rejectedWork, { ok: false, code: 'SURVIVAL_CONDITION_TOO_POOR' });
  assert.deepEqual(store.snapshot(), beforeRejectedWork);

  let scene = await dispatch(runtime, 'critical-scene', 'narrative.scene');
  assert.equal(scene.data.survivalCondition.severity, 'critical');
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'), false);
  assert.ok(scene.data.narrative.options.some(
    (entry) => entry.intent.type === 'location.travel' && entry.intent.payload.destinationId === 'first-outskirts',
  ));

  assert.equal((await dispatch(runtime, 'outskirts', 'location.travel', { destinationId: 'first-outskirts' })).ok, true);
  assert.equal((await dispatch(runtime, 'fruit', 'survival.gather', { itemId: 'wild-fruit' })).ok, true);
  assert.equal((await dispatch(runtime, 'eat-fruit', 'survival.consume', { itemId: 'wild-fruit' })).ok, true);

  assert.equal((await dispatch(runtime, 'back-square-1', 'location.travel', { destinationId: 'first-square' })).ok, true);
  assert.equal((await dispatch(runtime, 'well', 'location.travel', { destinationId: 'first-well' })).ok, true);
  assert.equal((await dispatch(runtime, 'water', 'survival.gather', { itemId: 'drinking-water' })).ok, true);
  assert.equal((await dispatch(runtime, 'drink', 'survival.consume', { itemId: 'drinking-water' })).ok, true);

  assert.equal((await dispatch(runtime, 'back-square-2', 'location.travel', { destinationId: 'first-square' })).ok, true);
  assert.equal((await dispatch(runtime, 'lodging', 'location.travel', { destinationId: 'first-lodging' })).ok, true);
  assert.equal((await dispatch(runtime, 'rest', 'survival.rest')).ok, true);

  const recoveredAtLodging = store.snapshot().characters[actor.sessionId];
  assert.ok(recoveredAtLodging.needs.hunger < firstSettlementPack.survival.criticalThreshold);
  assert.ok(recoveredAtLodging.needs.thirst < firstSettlementPack.survival.criticalThreshold);
  assert.ok(recoveredAtLodging.needs.fatigue < firstSettlementPack.survival.criticalThreshold);
  assert.equal(recoveredAtLodging.money, 0);

  assert.equal((await dispatch(runtime, 'back-square-3', 'location.travel', { destinationId: 'first-square' })).ok, true);
  const recoveredWork = await dispatch(runtime, 'recovered-work', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(recoveredWork.code, 'WORK_COMPLETED');
  assert.equal(store.snapshot().characters[actor.sessionId].money, 2);

  scene = await dispatch(runtime, 'recovered-scene', 'narrative.scene');
  assert.notEqual(scene.data.survivalCondition.severity, 'critical');
});
