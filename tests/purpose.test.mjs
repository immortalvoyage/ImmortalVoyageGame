import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'purpose-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('purpose NPC search advances only one authoritative route step and does not expose hidden target location', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '尋人旅人' });
  await dispatch(runtime, 'leave', 'location.travel', { destinationId: 'starter-well' });

  const scene = await dispatch(runtime, 'scene-away', 'narrative.scene');
  const searchChoice = scene.data.narrative.options.find((choice) => choice.intent.type === 'purpose.find-npc');
  assert.ok(searchChoice);
  assert.equal(searchChoice.intent.payload.npcId, 'foreman');

  const progress = await dispatch(runtime, 'search', searchChoice.intent.type, searchChoice.intent.payload);
  assert.equal(progress.ok, true);
  assert.equal(progress.code, 'PURPOSE_SEARCH_PROGRESS');
  assert.equal(progress.data.location.id, 'starter-square');
  assert.equal(progress.data.target.id, 'foreman');
  assert.equal(progress.data.target.locationId, undefined);
  assert.equal(store.snapshot().characters['purpose-session'].locationId, 'starter-square');

  const arrived = await dispatch(runtime, 'scene-arrived', 'narrative.scene');
  assert.ok(arrived.data.visibleNpcs.some((npc) => npc.id === 'foreman'));
  assert.equal(arrived.data.narrative.options.some((choice) => choice.intent.type === 'purpose.find-npc'), false);
});

test('purpose search rejects unknown targets without mutating authoritative state', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-unknown', 'character.birth', { name: '謹慎旅人' });
  const before = store.snapshot();
  const result = await dispatch(runtime, 'unknown-target', 'purpose.find-npc', { npcId: 'secret-or-missing' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PURPOSE_TARGET_UNKNOWN');
  assert.deepEqual(store.snapshot(), before);
});

test('narrative omits purpose choices when purpose module is disabled', async () => {
  const { runtime } = createDevelopmentGame({
    now: () => 1000,
    enabledModules: ['character', 'inventory', 'location', 'npc', 'survival', 'economy', 'narrative'],
  });
  await dispatch(runtime, 'birth-disabled', 'character.birth', { name: '降級旅人' });
  await dispatch(runtime, 'leave-disabled', 'location.travel', { destinationId: 'starter-well' });
  const scene = await dispatch(runtime, 'scene-disabled', 'narrative.scene');
  assert.equal(scene.data.narrative.options.some((choice) => choice.intent.type === 'purpose.find-npc'), false);
  assert.ok(scene.data.narrative.options.some((choice) => choice.intent.type === 'survival.gather'));
  assert.ok(scene.data.narrative.options.some((choice) => choice.intent.type === 'location.travel'));
});
