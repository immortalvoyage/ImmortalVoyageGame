import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'known-purpose-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function purposeChoices(scene) {
  return scene.data.narrative.options.filter((choice) => choice.intent.type === 'purpose.find-npc');
}

test('unknown hidden NPC is absent from Narrative and forged purpose search fails without mutation', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-hidden', 'character.birth', { name: '不知情旅人' });

  const scene = await dispatch(runtime, 'scene-hidden', 'narrative.scene');
  assert.equal(purposeChoices(scene).some((choice) => choice.intent.payload.npcId === 'herbalist'), false);
  assert.equal(JSON.stringify(scene.data.narrative.options).includes('近郊採藥人'), false);
  assert.equal(JSON.stringify(scene.data).includes('revealsNpcIds'), false);

  const before = store.snapshot();
  const forged = await dispatch(runtime, 'guess-hidden', 'purpose.find-npc', { npcId: 'herbalist' });
  assert.equal(forged.ok, false);
  assert.equal(forged.code, 'PURPOSE_TARGET_UNKNOWN');
  assert.equal(forged.data, undefined);
  assert.deepEqual(store.snapshot(), before);
});

test('unlocked structured topic reveals a hidden NPC as a purpose target without leaking its location', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-rumor', 'character.birth', { name: '聽聞旅人' });
  await dispatch(runtime, 'talk-rumor-1', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-rumor-2', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-rumor-3', 'npc.interact', { npcId: 'foreman' });

  const scene = await dispatch(runtime, 'scene-rumor', 'narrative.scene');
  const search = purposeChoices(scene).find((choice) => choice.intent.payload.npcId === 'herbalist');
  assert.ok(search);
  assert.equal(search.label, '尋找近郊採藥人');
  assert.deepEqual(search.intent.payload, { npcId: 'herbalist' });
  assert.equal(search.intent.payload.locationId, undefined);

  const found = await dispatch(runtime, 'find-rumor-target', search.intent.type, search.intent.payload);
  assert.equal(found.ok, true);
  assert.equal(found.code, 'PURPOSE_TARGET_FOUND');
  assert.deepEqual(found.data.npc, { id: 'herbalist', name: '近郊採藥人' });
  assert.equal(found.data.npc.locationId, undefined);
  assert.equal(store.snapshot().characters[actor.sessionId].locationId, 'starter-grove');
});

test('manual discovery plus successful interaction keeps an NPC known after leaving', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-manual', 'character.birth', { name: '探路旅人' });
  await dispatch(runtime, 'walk-grove', 'location.travel', { destinationId: 'starter-grove' });

  const localScene = await dispatch(runtime, 'scene-grove', 'narrative.scene');
  assert.ok(localScene.data.visibleNpcs.some((npc) => npc.id === 'herbalist'));
  const interaction = await dispatch(runtime, 'meet-herbalist', 'npc.interact', { npcId: 'herbalist' });
  assert.equal(interaction.ok, true);
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:herbalist'], 1);

  await dispatch(runtime, 'walk-back', 'location.travel', { destinationId: 'starter-square' });
  const awayScene = await dispatch(runtime, 'scene-after-meet', 'narrative.scene');
  assert.ok(purposeChoices(awayScene).some((choice) => choice.intent.payload.npcId === 'herbalist'));
});

test('Relationship Module off prevents topic-derived target knowledge from leaking through Purpose', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade',
    'crafting', 'progression', 'career', 'estate', 'narrative',
  ];
  const { runtime, store } = createDevelopmentGame({ now: () => 1000, enabledModules });
  await dispatch(runtime, 'birth-module-off', 'character.birth', { name: '關係停用旅人' });
  await dispatch(runtime, 'talk-off-1', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-off-2', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-off-3', 'npc.interact', { npcId: 'foreman' });

  const scene = await dispatch(runtime, 'scene-module-off', 'narrative.scene');
  assert.equal(purposeChoices(scene).some((choice) => choice.intent.payload.npcId === 'herbalist'), false);

  const before = store.snapshot();
  const forged = await dispatch(runtime, 'find-module-off', 'purpose.find-npc', { npcId: 'herbalist' });
  assert.equal(forged.ok, false);
  assert.equal(forged.code, 'PURPOSE_TARGET_UNKNOWN');
  assert.deepEqual(store.snapshot(), before);
});
