import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';
import { settleCharacterDeath } from '../src/modules/estate/index.js';

const actor = { sessionId: 'relationship-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('successful NPC interactions form and upgrade public familiarity without exposing counters', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '往來旅人' });

  let scene = await dispatch(runtime, 'scene-0', 'narrative.scene');
  assert.deepEqual(scene.data.relationships, []);

  await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });
  scene = await dispatch(runtime, 'scene-1', 'narrative.scene');
  assert.deepEqual(scene.data.relationships, [{
    npc: { id: 'foreman', name: '聚落雜役領班' },
    familiarity: { name: '見過幾面' },
  }]);
  assert.equal(JSON.stringify(scene.data.relationships).includes('behaviorId'), false);
  assert.equal(JSON.stringify(scene.data.relationships).includes('minCount'), false);
  assert.equal(JSON.stringify(scene.data.relationships).includes('count'), false);

  await dispatch(runtime, 'talk-2', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-3', 'npc.interact', { npcId: 'foreman' });
  scene = await dispatch(runtime, 'scene-3', 'narrative.scene');
  assert.equal(scene.data.relationships[0].familiarity.name, '逐漸熟悉');
});

test('request replay and invalid remote interaction cannot inflate familiarity', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '謹慎旅人' });

  await dispatch(runtime, 'talk-once', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'talk-once', 'npc.interact', { npcId: 'foreman' });
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], 1);

  await dispatch(runtime, 'to-well', 'location.travel', { destinationId: 'starter-well' });
  const failed = await dispatch(runtime, 'remote-talk', 'npc.interact', { npcId: 'foreman' });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'NPC_NOT_AVAILABLE');
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], 1);
});

test('Relationship Module off hides familiarity without disabling NPC interaction', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade',
    'crafting', 'progression', 'career', 'estate', 'narrative',
  ];
  const { runtime, store } = createDevelopmentGame({ now: () => 1000, enabledModules });
  await dispatch(runtime, 'birth', 'character.birth', { name: '關係關閉旅人' });
  const interaction = await dispatch(runtime, 'talk', 'npc.interact', { npcId: 'foreman' });
  assert.equal(interaction.ok, true);
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], 1);

  const scene = await dispatch(runtime, 'scene', 'narrative.scene');
  assert.equal(scene.data.relationships, null);
});

test('next life does not inherit prior character familiarity', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  const born = await dispatch(runtime, 'birth-1', 'character.birth', { name: '前世旅人' });
  await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });

  const world = store.snapshot();
  const settled = settleCharacterDeath({
    world,
    sessionId: actor.sessionId,
    characterId: born.data.character.id,
    causeCode: 'test.authoritative-death',
  });
  assert.equal(settled.ok, true);
  await store.replace(world);

  const next = await dispatch(runtime, 'birth-2', 'character.birth', { name: '後世旅人' });
  assert.notEqual(next.data.character.id, born.data.character.id);
  const scene = await dispatch(runtime, 'scene-next', 'narrative.scene');
  assert.deepEqual(scene.data.relationships, []);
  assert.deepEqual(store.snapshot().characters[actor.sessionId].behaviorCounts, {});
});
