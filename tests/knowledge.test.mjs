import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { MAX_CHARACTER_KNOWLEDGE } from '../src/core/world-state.js';
import { createDevelopmentGame } from '../src/game.js';
import { grantKnowledge } from '../src/modules/knowledge/index.js';

const actor = { sessionId: 'knowledge-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function discoveryPack() {
  const pack = structuredClone(devStarterPack);
  pack.id = 'knowledge-discovery-test-pack';
  pack.dataVersion += 1;
  pack.npcs.herbalist = {
    name: '近郊採藥人',
    locationId: 'starter-grove',
    greeting: '採藥時別踩壞旁邊剛長出的嫩芽。',
    searchLabel: '尋找近郊採藥人',
    relationship: {
      behaviorId: 'interact:npc:herbalist',
      levels: [{ name: '見過幾面', minCount: 1 }],
    },
  };
  pack.knowledge['rumor:herbalist'] = {
    name: '聽說近郊有位採藥人',
    revealsNpcIds: ['herbalist'],
  };
  const topic = pack.npcs.foreman.relationship.levels[1].topics[0];
  topic.grantsKnowledgeIds = ['rumor:herbalist'];
  return pack;
}

function purposeChoice(scene, npcId) {
  return scene.data.narrative.options.find(
    (choice) => choice.intent.type === 'purpose.find-npc' && choice.intent.payload.npcId === npcId,
  );
}

async function unlockLivingAdvice(runtime) {
  await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-2', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-3', 'npc.interact', { npcId: 'foreman' });
}

test('topic eligibility is not knowledge; successful ask persists bounded discovery and unlocks Purpose target', async () => {
  const pack = discoveryPack();
  const { runtime, store } = createDevelopmentGame({ now: () => 1000, contentPack: pack });
  await dispatch(runtime, 'birth', 'character.birth', { name: '問路旅人' });
  await unlockLivingAdvice(runtime);

  let scene = await dispatch(runtime, 'scene-before-ask', 'narrative.scene');
  assert.equal(purposeChoice(scene, 'herbalist'), undefined);
  assert.deepEqual(scene.data.knowledge, []);
  assert.equal(JSON.stringify(scene.data).includes('rumor:herbalist'), false);
  assert.equal(JSON.stringify(scene.data).includes('revealsNpcIds'), false);

  const beforeGuess = store.snapshot();
  const guessed = await dispatch(runtime, 'guess-before-ask', 'purpose.find-npc', { npcId: 'herbalist' });
  assert.equal(guessed.code, 'PURPOSE_TARGET_UNKNOWN');
  assert.deepEqual(store.snapshot(), beforeGuess);

  const asked = await dispatch(runtime, 'ask-living-advice', 'npc.ask', {
    npcId: 'foreman',
    topicId: 'foreman-living-advice',
  });
  assert.equal(asked.ok, true);
  assert.equal(asked.code, 'NPC_TOPIC_RESPONSE');

  const learned = store.snapshot().characters[actor.sessionId].knowledgeIds;
  assert.deepEqual(learned, ['rumor:herbalist']);
  const knowledgeEvents = store.snapshot().gameEvents.filter((event) => event.type === 'knowledge.learned');
  assert.equal(knowledgeEvents.length, 1);
  assert.equal(knowledgeEvents[0].data.knowledgeId, 'rumor:herbalist');
  assert.equal(knowledgeEvents[0].data.sourceNpcId, 'foreman');
  assert.equal(knowledgeEvents[0].data.sourceTopicId, 'foreman-living-advice');

  scene = await dispatch(runtime, 'scene-after-ask', 'narrative.scene');
  assert.deepEqual(scene.data.knowledge, [{ name: '聽說近郊有位採藥人' }]);
  const search = purposeChoice(scene, 'herbalist');
  assert.ok(search);
  assert.deepEqual(search.intent.payload, { npcId: 'herbalist' });
  assert.equal(search.intent.payload.locationId, undefined);
  assert.equal(JSON.stringify(scene.data).includes('rumor:herbalist'), false);
  assert.equal(JSON.stringify(scene.data).includes('starter-grove'), false);
});

test('repeated topic ask and idempotent replay do not duplicate knowledge or evidence', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000, contentPack: discoveryPack() });
  await dispatch(runtime, 'birth', 'character.birth', { name: '重問旅人' });
  await unlockLivingAdvice(runtime);

  const first = await dispatch(runtime, 'ask-once', 'npc.ask', {
    npcId: 'foreman',
    topicId: 'foreman-living-advice',
  });
  const replay = await dispatch(runtime, 'ask-once', 'npc.ask', {
    npcId: 'foreman',
    topicId: 'foreman-living-advice',
  });
  assert.deepEqual(replay, first);

  const secondRequest = await dispatch(runtime, 'ask-again', 'npc.ask', {
    npcId: 'foreman',
    topicId: 'foreman-living-advice',
  });
  assert.equal(secondRequest.ok, true);
  assert.deepEqual(store.snapshot().characters[actor.sessionId].knowledgeIds, ['rumor:herbalist']);
  assert.equal(store.snapshot().gameEvents.filter((event) => event.type === 'knowledge.learned').length, 1);
});

test('Knowledge Module off keeps topic readable but does not persist or apply discovery effects', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade',
    'crafting', 'progression', 'career', 'relationship', 'estate', 'narrative',
  ];
  const { runtime, store } = createDevelopmentGame({
    now: () => 1000,
    enabledModules,
    contentPack: discoveryPack(),
  });
  await dispatch(runtime, 'birth', 'character.birth', { name: '情報停用旅人' });
  await unlockLivingAdvice(runtime);

  const asked = await dispatch(runtime, 'ask', 'npc.ask', {
    npcId: 'foreman',
    topicId: 'foreman-living-advice',
  });
  assert.equal(asked.ok, true);
  assert.deepEqual(store.snapshot().characters[actor.sessionId].knowledgeIds, []);
  assert.equal(store.snapshot().gameEvents.some((event) => event.type === 'knowledge.learned'), false);

  const scene = await dispatch(runtime, 'scene', 'narrative.scene');
  assert.equal(scene.data.knowledge, null);
  assert.equal(purposeChoice(scene, 'herbalist'), undefined);
  const forged = await dispatch(runtime, 'forged-search', 'purpose.find-npc', { npcId: 'herbalist' });
  assert.equal(forged.code, 'PURPOSE_TARGET_UNKNOWN');
});

test('Knowledge observation respects ownership and only exposes public names', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '知識旅人' });
  await unlockLivingAdvice(runtime);
  await dispatch(runtime, 'ask', 'npc.ask', { npcId: 'foreman', topicId: 'foreman-living-advice' });

  const observed = await dispatch(runtime, 'observe-knowledge', 'knowledge.observe');
  assert.deepEqual(observed.data.knowledge, [{ name: '聚落生活的基本建議' }]);
  assert.equal(JSON.stringify(observed).includes('starter-living-advice'), false);

  const other = await runtime.dispatch({
    actor: { sessionId: 'other-session' },
    requestId: 'other-observe',
    action: { type: 'knowledge.observe', payload: {} },
  });
  assert.equal(other.code, 'NO_ACTIVE_CHARACTER');
});

test('knowledge grant capacity fails atomically and duplicate grants are no-ops', () => {
  const character = {
    knowledgeIds: Array.from({ length: MAX_CHARACTER_KNOWLEDGE }, (_, index) => `fact:${index}`),
  };
  const before = structuredClone(character.knowledgeIds);
  const overflow = grantKnowledge(character, ['fact:extra']);
  assert.equal(overflow.ok, false);
  assert.equal(overflow.code, 'KNOWLEDGE_LIMIT_REACHED');
  assert.deepEqual(character.knowledgeIds, before);

  const duplicate = grantKnowledge(character, ['fact:0']);
  assert.equal(duplicate.ok, true);
  assert.deepEqual(duplicate.learnedIds, []);
  assert.deepEqual(character.knowledgeIds, before);
});
