import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';
import { devStarterPack } from '../src/content/dev-starter.js';

const actor = { sessionId: 'npc-response-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('NPC response uses familiarity established before the current interaction', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '熟面旅人' });

  const first = await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });
  assert.equal(first.data.text, devStarterPack.npcs.foreman.greeting);

  const second = await dispatch(runtime, 'talk-2', 'npc.interact', { npcId: 'foreman' });
  assert.equal(second.data.text, devStarterPack.npcs.foreman.relationship.levels[0].responseText);

  const third = await dispatch(runtime, 'talk-3', 'npc.interact', { npcId: 'foreman' });
  assert.equal(third.data.text, devStarterPack.npcs.foreman.relationship.levels[0].responseText);

  const fourth = await dispatch(runtime, 'talk-4', 'npc.interact', { npcId: 'foreman' });
  assert.equal(fourth.data.text, devStarterPack.npcs.foreman.relationship.levels[1].responseText);
});

test('idempotent replay returns the same response and does not advance familiarity twice', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '重試旅人' });

  const first = await dispatch(runtime, 'talk', 'npc.interact', { npcId: 'foreman' });
  const replay = await dispatch(runtime, 'talk', 'npc.interact', { npcId: 'foreman' });
  assert.deepEqual(replay, first);
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], 1);

  const next = await dispatch(runtime, 'talk-next', 'npc.interact', { npcId: 'foreman' });
  assert.equal(next.data.text, devStarterPack.npcs.foreman.relationship.levels[0].responseText);
});

test('Relationship Module off always falls back to base greeting while interaction remains valid', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade',
    'crafting', 'progression', 'career', 'estate', 'narrative',
  ];
  const { runtime, store } = createDevelopmentGame({ now: () => 1000, enabledModules });
  await dispatch(runtime, 'birth', 'character.birth', { name: '關係停用旅人' });

  for (let index = 1; index <= 4; index += 1) {
    const result = await dispatch(runtime, `talk-${index}`, 'npc.interact', { npcId: 'foreman' });
    assert.equal(result.data.text, devStarterPack.npcs.foreman.greeting);
  }
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], 4);
});

test('invalid remote interaction cannot return familiarity response or mutate behavior', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '遠行旅人' });
  await dispatch(runtime, 'talk-1', 'npc.interact', { npcId: 'foreman' });
  await dispatch(runtime, 'to-well', 'location.travel', { destinationId: 'starter-well' });

  const failed = await dispatch(runtime, 'remote-talk', 'npc.interact', { npcId: 'foreman' });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'NPC_NOT_AVAILABLE');
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['interact:npc:foreman'], 1);
});
