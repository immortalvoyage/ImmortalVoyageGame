import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'first-relationship-player' };
const dispatch = (runtime, requestId, type, payload = {}) => runtime.dispatch({ actor, requestId, action: { type, payload } });

test('formal first-settlement NPC contact becomes familiarity and learnable living knowledge', async () => {
  const { runtime, store } = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  assert.equal((await dispatch(runtime, 'birth', 'character.birth', { name: '問事旅人' })).ok, true);

  let scene = await dispatch(runtime, 'before', 'narrative.scene');
  assert.deepEqual(scene.data.relationships, []);
  assert.deepEqual(scene.data.knowledge, []);
  assert.equal(scene.data.dialogueTopics.length, 0);

  assert.equal((await dispatch(runtime, 'meet-foreman', 'npc.interact', { npcId: 'first-foreman' })).code, 'NPC_INTERACTION');
  scene = await dispatch(runtime, 'after-meet', 'narrative.scene');
  assert.deepEqual(scene.data.relationships, [{
    npc: { id: 'first-foreman', name: firstSettlementPack.npcs['first-foreman'].name },
    familiarity: { name: firstSettlementPack.npcs['first-foreman'].relationship.levels[0].name },
  }]);
  const topic = scene.data.dialogueTopics.find((entry) => entry.intent.payload.topicId === 'first-foreman-living-basics');
  assert.deepEqual(topic.intent.payload, { npcId: 'first-foreman', topicId: 'first-foreman-living-basics' });

  assert.equal((await dispatch(runtime, 'ask-basics', topic.intent.type, topic.intent.payload)).code, 'NPC_TOPIC_RESPONSE');
  const after = await dispatch(runtime, 'after-ask', 'narrative.scene');
  assert.deepEqual(after.data.knowledge, [{ name: firstSettlementPack.knowledge['first-living-basics'].name }]);
  assert.deepEqual(store.snapshot().characters[actor.sessionId].knowledgeIds, ['first-living-basics']);
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:first-foreman'], 1);
  assert.equal(JSON.stringify(after.data.relationships).includes('behaviorId'), false);
  assert.equal(JSON.stringify(after.data).includes('grantsKnowledgeIds'), false);
});
