import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';
import { devStarterPack } from '../src/content/dev-starter.js';

const actor = { sessionId: 'npc-topic-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function topicUtilities(scene) {
  return scene.data.utilities.filter((entry) => entry.intent.type === 'npc.ask');
}

test('familiarity unlocks structured NPC topics cumulatively without exposing response text', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '問事旅人' });

  let scene = await dispatch(runtime, 'scene-0', 'narrative.scene');
  assert.deepEqual(topicUtilities(scene), []);

  await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });
  scene = await dispatch(runtime, 'scene-1', 'narrative.scene');
  const firstTopics = topicUtilities(scene);
  assert.equal(firstTopics.length, 1);
  assert.equal(firstTopics[0].intent.payload.topicId, 'foreman-work-rumors');
  assert.equal(JSON.stringify(firstTopics).includes('responseText'), false);

  await dispatch(runtime, 'talk-2', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-3', 'npc.interact', { npcId: 'foreman' });
  scene = await dispatch(runtime, 'scene-3', 'narrative.scene');
  assert.deepEqual(topicUtilities(scene).map((entry) => entry.intent.payload.topicId), [
    'foreman-work-rumors',
    'foreman-living-advice',
  ]);
});

test('asking an unlocked topic returns deterministic information without increasing familiarity', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '問話旅人' });
  await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });

  const before = store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'];
  const topic = devStarterPack.npcs.foreman.relationship.levels[0].topics[0];
  const result = await dispatch(runtime, 'ask-1', 'npc.ask', { npcId: 'foreman', topicId: topic.id });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'NPC_TOPIC_RESPONSE');
  assert.equal(result.data.text, topic.responseText);
  assert.deepEqual(result.data.topic, { id: topic.id, label: topic.label });
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], before);

  const replay = await dispatch(runtime, 'ask-1', 'npc.ask', { npcId: 'foreman', topicId: topic.id });
  assert.deepEqual(replay, result);
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], before);
});

test('locked or unknown topics fail closed without revealing information or mutating behavior', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '試探旅人' });
  await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });
  const count = store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'];

  const locked = await dispatch(runtime, 'locked', 'npc.ask', { npcId: 'foreman', topicId: 'foreman-living-advice' });
  assert.equal(locked.ok, false);
  assert.equal(locked.code, 'NPC_TOPIC_NOT_AVAILABLE');
  assert.equal(locked.data, undefined);

  const unknown = await dispatch(runtime, 'unknown', 'npc.ask', { npcId: 'foreman', topicId: 'hidden-guess' });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, 'NPC_TOPIC_NOT_AVAILABLE');
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], count);
});

test('Relationship Module off hides topics and forged asks fail while base NPC interaction remains usable', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade',
    'crafting', 'progression', 'career', 'estate', 'narrative',
  ];
  const { runtime } = createDevelopmentGame({ now: () => 1000, enabledModules });
  await dispatch(runtime, 'birth', 'character.birth', { name: '關係停用問事者' });
  const talk = await dispatch(runtime, 'talk', 'npc.interact', { npcId: 'foreman' });
  assert.equal(talk.ok, true);

  const scene = await dispatch(runtime, 'scene', 'narrative.scene');
  assert.deepEqual(topicUtilities(scene), []);
  const forged = await dispatch(runtime, 'ask', 'npc.ask', { npcId: 'foreman', topicId: 'foreman-work-rumors' });
  assert.equal(forged.ok, false);
  assert.equal(forged.code, 'NPC_TOPIC_NOT_AVAILABLE');
});

test('topic questions still require the NPC authoritative current location', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '離開後問事者' });
  await dispatch(runtime, 'talk', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'leave', 'location.travel', { destinationId: 'starter-well' });
  const before = store.snapshot();

  const result = await dispatch(runtime, 'remote-ask', 'npc.ask', { npcId: 'foreman', topicId: 'foreman-work-rumors' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NPC_NOT_AVAILABLE');
  assert.deepEqual(store.snapshot(), before);
});
