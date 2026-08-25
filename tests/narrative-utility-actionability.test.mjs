import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'utility-actionability-player' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function utilityTypes(scene) {
  return scene.data.utilities.map((utility) => utility.intent.type);
}

test('first-session utilities only expose currently actionable craft and buy controls', async () => {
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });

  assert.equal((await dispatch(game.runtime, 'birth', 'character.birth', { name: '行動旅人' })).ok, true);

  const initial = await dispatch(game.runtime, 'scene-initial', 'narrative.scene');
  assert.equal(initial.ok, true);
  assert.equal(utilityTypes(initial).includes('crafting.craft'), false);
  assert.equal(utilityTypes(initial).includes('economy.buy'), false);

  assert.equal((await dispatch(game.runtime, 'employment', 'employment.accept', { jobId: 'first-carrying-work' })).ok, true);
  assert.equal((await dispatch(game.runtime, 'work', 'economy.work', { jobId: 'first-carrying-work' })).ok, true);

  const afterWork = await dispatch(game.runtime, 'scene-after-work', 'narrative.scene');
  const buyUtilities = afterWork.data.utilities.filter((utility) => utility.intent.type === 'economy.buy');
  assert.deepEqual(buyUtilities.map((utility) => utility.intent.payload.itemId).sort(), ['coarse-bread', 'drinking-water']);
  assert.equal(utilityTypes(afterWork).includes('crafting.craft'), false);

  assert.equal((await dispatch(game.runtime, 'buy-bread', 'economy.buy', { itemId: 'coarse-bread' })).ok, true);
  assert.equal((await dispatch(game.runtime, 'buy-water', 'economy.buy', { itemId: 'drinking-water' })).ok, true);

  const afterShopping = await dispatch(game.runtime, 'scene-after-shopping', 'narrative.scene');
  const craftUtilities = afterShopping.data.utilities.filter((utility) => utility.intent.type === 'crafting.craft');
  assert.deepEqual(craftUtilities.map((utility) => utility.intent.payload.recipeId), ['first-simple-ration']);
  assert.equal(utilityTypes(afterShopping).includes('economy.buy'), false);
});
