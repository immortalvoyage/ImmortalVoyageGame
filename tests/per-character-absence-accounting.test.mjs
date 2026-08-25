import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const HOUR_MS = 60 * 60 * 1000;
const THREE_DAYS_SECONDS = 72 * 60 * 60;

async function dispatch(runtime, actor, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function advanceWorldHourlyWithOtherPlayer({ runtime, actor, setNow }) {
  for (let hour = 1; hour <= 72; hour += 1) {
    setNow(1000 + hour * HOUR_MS);
    const result = await dispatch(runtime, actor, `other-scene-${hour}`, 'narrative.scene');
    assert.equal(result.ok, true);
  }
}

test('other-player requests cannot split a sheltered character personal absence into uncapped short gaps', async () => {
  let nowMs = 1000;
  const sheltered = { sessionId: 'sheltered-offline' };
  const other = { sessionId: 'active-other' };
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  const born = await dispatch(game.runtime, sheltered, 'sheltered-birth', 'character.birth', { name: '留宿旅人' });
  assert.equal(born.data.character.lastActiveLogicalTimeSeconds, undefined);
  assert.equal((await dispatch(game.runtime, sheltered, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' })).ok, true);
  assert.equal((await dispatch(game.runtime, other, 'other-birth', 'character.birth', { name: '活動旅人' })).ok, true);

  await advanceWorldHourlyWithOtherPlayer({
    runtime: game.runtime,
    actor: other,
    setNow: (value) => { nowMs = value; },
  });

  const beforeReturn = game.store.snapshot();
  assert.equal(beforeReturn.logicalTimeSeconds, THREE_DAYS_SECONDS);
  assert.equal(beforeReturn.characters[sheltered.sessionId].lastActiveLogicalTimeSeconds, 0);
  assert.deepEqual(beforeReturn.characters[sheltered.sessionId].needs, { hunger: 0, thirst: 0, fatigue: 1 });

  const returned = await dispatch(game.runtime, sheltered, 'sheltered-return', 'narrative.scene');
  assert.equal(returned.ok, true);
  assert.deepEqual(returned.data.character.needs, { hunger: 12, thirst: 18, fatigue: 7 });

  const afterReturn = game.store.snapshot();
  assert.equal(afterReturn.characters[sheltered.sessionId].lastActiveLogicalTimeSeconds, THREE_DAYS_SECONDS);
  assert.equal(afterReturn.logicalTimeSeconds, THREE_DAYS_SECONDS);
});

test('other-player requests also cannot erase full absence pressure for an unsheltered character', async () => {
  let nowMs = 1000;
  const absent = { sessionId: 'street-offline' };
  const other = { sessionId: 'street-other' };
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  await dispatch(game.runtime, absent, 'absent-birth', 'character.birth', { name: '街口旅人' });
  await dispatch(game.runtime, other, 'other-birth', 'character.birth', { name: '活動旅人' });
  await advanceWorldHourlyWithOtherPlayer({
    runtime: game.runtime,
    actor: other,
    setNow: (value) => { nowMs = value; },
  });

  assert.deepEqual(game.store.snapshot().characters[absent.sessionId].needs, { hunger: 0, thirst: 0, fatigue: 0 });
  const returned = await dispatch(game.runtime, absent, 'street-return', 'narrative.scene');
  assert.equal(returned.ok, true);
  assert.deepEqual(returned.data.character.needs, { hunger: 100, thirst: 100, fatigue: 72 });
  assert.equal(game.store.snapshot().characters[absent.sessionId].lastActiveLogicalTimeSeconds, THREE_DAYS_SECONDS);
});

test('successful requests advance the generic activity clock even when Survival Module is disabled', async () => {
  let nowMs = 1000;
  const actor = { sessionId: 'survival-disabled' };
  const game = createDevelopmentGame({
    contentPack: firstSettlementPack,
    now: () => nowMs,
    enabledModules: ['character', 'inventory', 'location'],
  });

  await dispatch(game.runtime, actor, 'birth', 'character.birth', { name: '無生存模組旅人' });
  nowMs += 5 * HOUR_MS;
  const observed = await dispatch(game.runtime, actor, 'observe', 'location.observe');
  assert.equal(observed.ok, true);

  const character = game.store.snapshot().characters[actor.sessionId];
  assert.deepEqual(character.needs, { hunger: 0, thirst: 0, fatigue: 0 });
  assert.equal(character.lastActiveLogicalTimeSeconds, 5 * 60 * 60);
});
