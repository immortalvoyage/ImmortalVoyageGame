import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame, createGame } from '../src/game.js';

const actor = { sessionId: 'broke-recovery-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function findRoute(pack, from, to) {
  const queue = [{ locationId: from, path: [] }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (current.locationId === to) return current.path;
    if (visited.has(current.locationId)) continue;
    visited.add(current.locationId);
    for (const route of pack.locations[current.locationId].routes ?? []) {
      queue.push({ locationId: route.destinationId, path: [...current.path, { type: 'location.travel', payload: { destinationId: route.destinationId } }] });
    }
  }
  return null;
}

function findFiniteRecoveryTargets(pack) {
  const recovery = {};
  for (const [locationId, location] of Object.entries(pack.locations)) {
    if (location.rest && !recovery.fatigue) recovery.fatigue = { locationId, actions: [{ type: 'survival.rest', payload: {} }] };
    for (const entry of location.recoveryWork ?? []) {
      const effect = pack.items[entry.reward.itemId]?.consumeEffect;
      if (!effect) continue;
      for (const need of ['hunger', 'thirst']) {
        if (effect[need] < 0 && !recovery[need]) {
          recovery[need] = { locationId, actions: [
            { type: 'economy.recovery-work', payload: { recoveryWorkId: entry.id } },
            { type: 'survival.consume', payload: { itemId: entry.reward.itemId } },
          ] };
        }
      }
    }
  }
  return recovery;
}

async function executeRecovery(runtime, store, prefix, target) {
  const from = store.snapshot().characters[actor.sessionId].locationId;
  const route = findRoute(firstSettlementPack, from, target.locationId);
  assert.ok(route, `recovery target ${target.locationId} must be finitely reachable`);
  for (const [index, action] of [...route, ...target.actions].entries()) {
    const result = await dispatch(runtime, `${prefix}-${index}`, action.type, action.payload);
    assert.equal(result.ok, true, `${action.type} must remain an authoritative recovery step`);
  }
}

test('zero-money critical character retains a finite authoritative recovery path back to work', async () => {
  const healthy = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  assert.equal((await dispatch(healthy.runtime, 'birth', 'character.birth', { name: '窮困旅人' })).ok, true);
  assert.equal((await dispatch(healthy.runtime, 'accept', 'employment.accept', { jobId: 'first-carrying-work' })).ok, true);

  const criticalWorld = healthy.store.snapshot();
  const character = criticalWorld.characters[actor.sessionId];
  character.money = 0;
  character.inventory = {};
  character.needs = { hunger: 90, thirst: 90, fatigue: 90 };
  const store = new MemoryGameStore(criticalWorld);
  const clock = { now: 1000 };
  const { runtime } = createGame({ store, contentPack: firstSettlementPack, now: () => clock.now });

  const beforeRejectedWork = store.snapshot();
  assert.deepEqual(await dispatch(runtime, 'critical-work', 'economy.work', { jobId: 'first-carrying-work' }), { ok: false, code: 'SURVIVAL_CONDITION_TOO_POOR' });
  assert.deepEqual(store.snapshot(), beforeRejectedWork);

  let scene = await dispatch(runtime, 'critical-scene', 'narrative.scene');
  assert.equal(scene.data.survivalCondition.severity, 'critical');
  assert.equal(scene.data.utilities.some((entry) => entry.intent.type === 'economy.work'), false);

  const recovery = findFiniteRecoveryTargets(firstSettlementPack);
  assert.deepEqual(Object.keys(recovery).sort(), ['fatigue', 'hunger', 'thirst']);
  for (const need of ['hunger', 'thirst', 'fatigue']) {
    await executeRecovery(runtime, store, `recover-${need}`, recovery[need]);
    assert.ok(store.snapshot().characters[actor.sessionId].needs[need] < firstSettlementPack.survival.criticalThreshold);
  }
  assert.equal(store.snapshot().characters[actor.sessionId].money, 0);

  const currentLocation = store.snapshot().characters[actor.sessionId].locationId;
  const returnRoute = findRoute(firstSettlementPack, currentLocation, firstSettlementPack.startingLocationId);
  assert.ok(returnRoute, 'recovery must retain a finite authoritative route back to the livelihood hub');
  for (const [index, action] of returnRoute.entries()) {
    assert.equal((await dispatch(runtime, `return-${index}`, action.type, action.payload)).ok, true);
  }

  const recoveredWork = await dispatch(runtime, 'recovered-work', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(recoveredWork.code, 'WORK_STARTED');
  clock.now += 5 * 60 * 1000;
  await dispatch(runtime, 'settle-recovered-work', 'narrative.scene');
  assert.equal(store.snapshot().characters[actor.sessionId].money, 2);

  scene = await dispatch(runtime, 'recovered-scene', 'narrative.scene');
  assert.notEqual(scene.data.survivalCondition.severity, 'critical');
});
