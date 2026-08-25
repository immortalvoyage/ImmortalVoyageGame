import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'first-session-player' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function optionTypes(scene) {
  return scene.data.narrative.options.map((choice) => choice.intent.type);
}

test('first settlement exposes an immediate meaningful choice and a short visible consequence loop', async () => {
  let nowMs = 1000;
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => nowMs });

  const born = await dispatch(game.runtime, 'birth', 'character.birth', { name: '初來旅人' });
  assert.equal(born.ok, true);

  const firstScene = await dispatch(game.runtime, 'scene-1', 'narrative.scene');
  assert.equal(firstScene.ok, true);
  assert.equal(firstScene.data.narrative.options.length <= 4, true);
  assert.equal(optionTypes(firstScene).includes('npc.interact'), true);
  assert.equal(optionTypes(firstScene).includes('employment.accept'), true);
  assert.equal(optionTypes(firstScene).includes('location.travel'), true);

  const talked = await dispatch(game.runtime, 'talk-foreman', 'npc.interact', { npcId: 'first-foreman' });
  assert.equal(talked.ok, true);
  assert.equal(talked.code, 'NPC_INTERACTION');

  const consequenceScene = await dispatch(game.runtime, 'scene-2', 'narrative.scene');
  assert.equal(consequenceScene.ok, true);
  assert.deepEqual(consequenceScene.data.relationships, [
    {
      npc: { id: 'first-foreman', name: '搬運領班' },
      familiarity: { name: '見過幾面' },
    },
  ]);
  const livingBasicsTopic = consequenceScene.data.utilities.find((utility) => utility.intent.type === 'npc.ask');
  assert.deepEqual(livingBasicsTopic?.intent.payload, {
    npcId: 'first-foreman',
    topicId: 'first-foreman-living-basics',
  });

  const learned = await dispatch(game.runtime, 'ask-basics', livingBasicsTopic.intent.type, livingBasicsTopic.intent.payload);
  assert.equal(learned.ok, true);
  assert.equal(learned.code, 'NPC_TOPIC_RESPONSE');

  const learnedScene = await dispatch(game.runtime, 'scene-3', 'narrative.scene');
  assert.deepEqual(learnedScene.data.knowledge, [
    { name: '初始聚落的基本生活去處' },
  ]);

  const employed = await dispatch(game.runtime, 'accept-work', 'employment.accept', { jobId: 'first-carrying-work' });
  assert.equal(employed.ok, true);
  assert.equal(employed.code, 'EMPLOYMENT_STARTED');

  const worked = await dispatch(game.runtime, 'work-once', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(worked.ok, true);
  assert.equal(worked.code, 'WORK_COMPLETED');
  assert.equal(worked.data.money, 2);
  assert.deepEqual(worked.data.needs, { hunger: 4, thirst: 5, fatigue: 2 });

  assert.equal((await dispatch(game.runtime, 'buy-bread', 'economy.buy', { itemId: 'coarse-bread' })).ok, true);
  assert.equal((await dispatch(game.runtime, 'buy-water', 'economy.buy', { itemId: 'drinking-water' })).ok, true);
  assert.equal((await dispatch(game.runtime, 'eat-bread', 'survival.consume', { itemId: 'coarse-bread' })).ok, true);
  assert.equal((await dispatch(game.runtime, 'drink-water', 'survival.consume', { itemId: 'drinking-water' })).ok, true);

  const completedScene = await dispatch(game.runtime, 'scene-4', 'narrative.scene');
  assert.equal(completedScene.ok, true);
  assert.equal(completedScene.data.character.money, 0);
  assert.deepEqual(completedScene.data.character.needs, { hunger: 0, thirst: 0, fatigue: 2 });
  assert.deepEqual(completedScene.data.inventoryItems, []);
  assert.equal(completedScene.data.employment.current.job.title, '搬運雜役');
  assert.equal(completedScene.data.relationships[0].familiarity.name, '見過幾面');
  assert.equal(completedScene.data.knowledge[0].name, '初始聚落的基本生活去處');
});
