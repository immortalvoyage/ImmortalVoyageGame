import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'first-craft-progression-player' };
const dispatch = (runtime, requestId, type, payload = {}) => runtime.dispatch({ actor, requestId, action: { type, payload } });

test('formal first-settlement livelihood can branch into crafting and visible derived skill', async () => {
  const { runtime, store } = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  assert.equal((await dispatch(runtime, 'birth', 'character.birth', { name: '手作旅人' })).ok, true);
  assert.equal((await dispatch(runtime, 'accept', 'employment.accept', { jobId: 'first-carrying-work' })).ok, true);
  assert.equal((await dispatch(runtime, 'work', 'economy.work', { jobId: 'first-carrying-work' })).code, 'WORK_COMPLETED');
  assert.equal((await dispatch(runtime, 'bread', 'economy.buy', { itemId: 'coarse-bread' })).code, 'PURCHASE_COMPLETED');
  assert.equal((await dispatch(runtime, 'water', 'economy.buy', { itemId: 'drinking-water' })).code, 'PURCHASE_COMPLETED');

  const ready = await dispatch(runtime, 'ready-scene', 'narrative.scene');
  const craft = ready.data.utilities.find((entry) => entry.intent.type === 'crafting.craft');
  assert.equal(craft?.intent.payload.recipeId, 'first-simple-ration');
  assert.deepEqual(ready.data.progression.skills, []);

  const crafted = await dispatch(runtime, 'craft', craft.intent.type, craft.intent.payload);
  assert.equal(crafted.code, 'CRAFT_COMPLETED');
  assert.deepEqual(store.snapshot().characters[actor.sessionId].inventory, { 'simple-ration': 1 });
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['craft:first-simple-ration'], 1);

  const after = await dispatch(runtime, 'after-scene', 'narrative.scene');
  assert.ok(after.data.progression.skills.some((tag) => tag.name === '乾糧整理'));
  assert.ok(after.data.utilities.some((entry) => entry.intent.type === 'survival.consume' && entry.intent.payload.itemId === 'simple-ration'));
  assert.equal(JSON.stringify(after.data.progression).includes('behaviorId'), false);
});
