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

function topicUtilities(scene) {
  return scene.data.utilities.filter((entry) => entry.intent.type === 'npc.ask');
}

test('unknown hidden NPC is absent from Narrative and forged purpose search fails without mutation', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-hidden', 'character.birth', { name: '不知情旅人' });

  const scene = await dispatch(runtime, 'scene-hidden', 'narrative.scene');
  assert.equal(purposeChoices(scene).some((choice) => choice.intent.payload.npcId === 'herbalist'), false);
  assert.equal(JSON.stringify(scene.data.narrative.options).includes('近郊採藥人'), false);

  const before = store.snapshot();
  const forged = await dispatch(runtime, 'guess-hidden', 'purpose.find-npc', { npcId: 'herbalist' });
  assert.equal(forged.ok, false);
  assert.equal(forged.code, 'PURPOSE_TARGET_UNKNOWN');
  assert.equal(forged.data, undefined);
  assert.deepEqual(store.snapshot(), before);
});

test('unlocking unrelated familiarity topics does not silently turn hidden NPCs into known targets', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-topic', 'character.birth', { name: '熟客旅人' });
  await dispatch(runtime, 'talk-topic-1', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-topic-2', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-topic-3', 'npc.interact', { npcId: 'foreman' });

  const scene = await dispatch(runtime, 'scene-topic', 'narrative.scene');
  assert.ok(topicUtilities(scene).some((entry) => entry.intent.payload.topicId === 'foreman-living-advice'));
  assert.equal(purposeChoices(scene).some((choice) => choice.intent.payload.npcId === 'herbalist'), false);

  const before = store.snapshot();
  const forged = await dispatch(runtime, 'guess-after-topic-unlock', 'purpose.find-npc', { npcId: 'herbalist' });
  assert.equal(forged.ok, false);
  assert.equal(forged.code, 'PURPOSE_TARGET_UNKNOWN');
  assert.deepEqual(store.snapshot(), before);
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
  const search = purposeChoices(awayScene).find((choice) => choice.intent.payload.npcId === 'herbalist');
  assert.ok(search);
  assert.deepEqual(search.intent.payload, { npcId: 'herbalist' });
  assert.equal(search.intent.payload.locationId, undefined);
});

test('interaction evidence keeps a discovered NPC known even when Relationship Module is off', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade',
    'crafting', 'progression', 'career', 'estate', 'narrative',
  ];
  const { runtime } = createDevelopmentGame({ now: () => 1000, enabledModules });
  await dispatch(runtime, 'birth-module-off', 'character.birth', { name: '關係停用探路者' });
  await dispatch(runtime, 'walk-grove-off', 'location.travel', { destinationId: 'starter-grove' });
  const interaction = await dispatch(runtime, 'meet-herbalist-off', 'npc.interact', { npcId: 'herbalist' });
  assert.equal(interaction.ok, true);
  await dispatch(runtime, 'walk-back-off', 'location.travel', { destinationId: 'starter-square' });

  const scene = await dispatch(runtime, 'scene-module-off', 'narrative.scene');
  assert.ok(purposeChoices(scene).some((choice) => choice.intent.payload.npcId === 'herbalist'));
});
