import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'crafting-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function gatherMealInputs(runtime) {
  await dispatch(runtime, 'travel-well', 'location.travel', { destinationId: 'starter-well' });
  await dispatch(runtime, 'gather-water', 'survival.gather', { itemId: 'water' });
  await dispatch(runtime, 'return-from-well', 'location.travel', { destinationId: 'starter-square' });
  await dispatch(runtime, 'travel-grove', 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(runtime, 'gather-food', 'survival.gather', { itemId: 'food' });
  await dispatch(runtime, 'return-from-grove', 'location.travel', { destinationId: 'starter-square' });
}

test('crafting converts gathered inputs exactly once and leaves event evidence', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '製作旅人' });
  await gatherMealInputs(runtime);

  const scene = await dispatch(runtime, 'scene-before-craft', 'narrative.scene');
  const craftChoice = scene.data.utilities.find((choice) => choice.intent.type === 'crafting.craft');
  assert.ok(craftChoice);
  assert.equal(craftChoice.intent.payload.recipeId, 'starter-simple-meal');
  assert.match(craftChoice.label, /食物×1/);
  assert.match(craftChoice.label, /水×1/);

  const crafted = await dispatch(runtime, 'craft-once', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  assert.equal(crafted.ok, true);
  assert.equal(crafted.code, 'CRAFT_COMPLETED');
  assert.deepEqual(crafted.data.crafted, { name: '簡單餐食', quantity: 1 });

  let snapshot = store.snapshot();
  assert.deepEqual(snapshot.characters['crafting-session'].inventory, { 'simple-meal': 1 });
  assert.equal(snapshot.gameEvents.filter((event) => event.type === 'crafting.completed').length, 1);

  const replay = await dispatch(runtime, 'craft-once', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  assert.deepEqual(replay, crafted);
  snapshot = store.snapshot();
  assert.deepEqual(snapshot.characters['crafting-session'].inventory, { 'simple-meal': 1 });
  assert.equal(snapshot.gameEvents.filter((event) => event.type === 'crafting.completed').length, 1);

  const consumed = await dispatch(runtime, 'consume-meal', 'survival.consume', { itemId: 'simple-meal' });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.code, 'ITEM_CONSUMED');
});

test('missing crafting materials do not partially consume inventory', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-partial', 'character.birth', { name: '缺料旅人' });
  await dispatch(runtime, 'travel-grove-partial', 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(runtime, 'gather-food-partial', 'survival.gather', { itemId: 'food' });
  await dispatch(runtime, 'return-partial', 'location.travel', { destinationId: 'starter-square' });

  const before = store.snapshot();
  const failed = await dispatch(runtime, 'craft-missing', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'CRAFT_MATERIALS_MISSING');
  assert.deepEqual(store.snapshot(), before);
});

test('crafting is location-scoped and unknown recipes do not mutate world', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-location', 'character.birth', { name: '異地旅人' });
  await dispatch(runtime, 'travel-location', 'location.travel', { destinationId: 'starter-well' });

  const before = store.snapshot();
  const unavailable = await dispatch(runtime, 'craft-away', 'crafting.craft', { recipeId: 'starter-simple-meal' });
  assert.equal(unavailable.code, 'CRAFT_NOT_AVAILABLE');
  assert.deepEqual(store.snapshot(), before);

  const unknown = await dispatch(runtime, 'craft-unknown', 'crafting.craft', { recipeId: 'missing-recipe' });
  assert.equal(unknown.code, 'CRAFT_NOT_AVAILABLE');
  assert.deepEqual(store.snapshot(), before);
});

test('disabling Crafting Module hides crafting utilities without breaking the game', async () => {
  const { runtime } = createDevelopmentGame({
    now: () => 1000,
    enabledModules: ['character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'narrative'],
  });
  await dispatch(runtime, 'birth-disabled', 'character.birth', { name: '不製作旅人' });
  const scene = await dispatch(runtime, 'scene-disabled', 'narrative.scene');
  assert.equal(scene.data.utilities.some((choice) => choice.intent.type === 'crafting.craft'), false);
  assert.equal((await dispatch(runtime, 'craft-disabled', 'crafting.craft', { recipeId: 'starter-simple-meal' })).code, 'UNKNOWN_ACTION');
});
