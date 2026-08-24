import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';
import { recordBehavior } from '../src/modules/character/behavior.js';

const actor = { sessionId: 'progression-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('progression tags emerge from authoritative behavior without exposing raw counters', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '成長旅人' });

  let scene = await dispatch(runtime, 'scene-0', 'narrative.scene');
  assert.deepEqual(scene.data.progression, { skills: [], socialTags: [] });

  await dispatch(runtime, 'work-1', 'economy.work', { jobId: 'starter-labor' });
  await dispatch(runtime, 'work-2', 'economy.work', { jobId: 'starter-labor' });
  scene = await dispatch(runtime, 'scene-work', 'narrative.scene');
  assert.deepEqual(scene.data.progression.socialTags, [{ name: '常做雜役' }]);

  await dispatch(runtime, 'to-grove', 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(runtime, 'food-1', 'survival.gather', { itemId: 'food' });
  await dispatch(runtime, 'food-2', 'survival.gather', { itemId: 'food' });
  scene = await dispatch(runtime, 'scene-gather', 'narrative.scene');
  assert.ok(scene.data.progression.skills.some((tag) => tag.name === '採集入門'));

  const serialized = JSON.stringify(scene.data.progression);
  assert.equal(serialized.includes('behaviorId'), false);
  assert.equal(serialized.includes('minCount'), false);
  assert.equal(serialized.includes('work:starter-labor'), false);
  assert.equal(store.snapshot().characters['progression-session'].behaviorCounts['gather:food'], 2);
});

test('crafting behavior unlocks a derived skill only after successful crafting', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-craft', 'character.birth', { name: '料理旅人' });

  const beforeFailure = store.snapshot();
  const failed = await dispatch(runtime, 'craft-missing', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  assert.equal(failed.code, 'CRAFT_MATERIALS_MISSING');
  assert.deepEqual(store.snapshot(), beforeFailure);

  await dispatch(runtime, 'to-well', 'location.travel', { destinationId: 'starter-well' });
  await dispatch(runtime, 'water', 'survival.gather', { itemId: 'water' });
  await dispatch(runtime, 'well-home', 'location.travel', { destinationId: 'starter-square' });
  await dispatch(runtime, 'to-grove-craft', 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(runtime, 'food', 'survival.gather', { itemId: 'food' });
  await dispatch(runtime, 'grove-home', 'location.travel', { destinationId: 'starter-square' });

  const crafted = await dispatch(runtime, 'craft-once', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  const replay = await dispatch(runtime, 'craft-once', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  assert.deepEqual(replay, crafted);
  assert.equal(store.snapshot().characters['progression-session'].behaviorCounts['craft:starter-simple-meal'], 1);

  const progression = await dispatch(runtime, 'observe-progression', 'progression.observe');
  assert.ok(progression.data.skills.some((tag) => tag.name === '簡單料理'));
});

test('gather request idempotency cannot accelerate progression', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-retry', 'character.birth', { name: '重試採集者' });
  await dispatch(runtime, 'to-grove-retry', 'location.travel', { destinationId: 'starter-grove' });
  const first = await dispatch(runtime, 'same-gather', 'survival.gather', { itemId: 'food' });
  const replay = await dispatch(runtime, 'same-gather', 'survival.gather', { itemId: 'food' });
  assert.deepEqual(replay, first);
  assert.equal(store.snapshot().characters['progression-session'].behaviorCounts['gather:food'], 1);
  const progression = await dispatch(runtime, 'progression-after-retry', 'progression.observe');
  assert.deepEqual(progression.data.skills, []);
});

test('disabling Progression Module hides derived tags without disabling authoritative behaviors', async () => {
  const { runtime, store } = createDevelopmentGame({
    now: () => 1000,
    enabledModules: ['character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'crafting', 'career', 'narrative'],
  });
  await dispatch(runtime, 'birth-disabled', 'character.birth', { name: '隱藏成長旅人' });
  await dispatch(runtime, 'work-disabled-1', 'economy.work', { jobId: 'starter-labor' });
  await dispatch(runtime, 'work-disabled-2', 'economy.work', { jobId: 'starter-labor' });
  assert.equal(store.snapshot().characters['progression-session'].behaviorCounts['work:starter-labor'], 2);

  const scene = await dispatch(runtime, 'scene-disabled', 'narrative.scene');
  assert.equal(scene.data.progression, null);
  assert.equal((await dispatch(runtime, 'progression-disabled', 'progression.observe')).code, 'UNKNOWN_ACTION');
});

test('recordBehavior saturates safely instead of overflowing persisted counters', () => {
  const character = { behaviorCounts: { 'work:x': Number.MAX_SAFE_INTEGER } };
  assert.equal(recordBehavior(character, 'work:x'), Number.MAX_SAFE_INTEGER);
  assert.equal(character.behaviorCounts['work:x'], Number.MAX_SAFE_INTEGER);
});
