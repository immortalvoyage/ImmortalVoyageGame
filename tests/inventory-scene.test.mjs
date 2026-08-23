import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'inventory-view-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('narrative scene exposes Content Pack item names for backpack display', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '背包旅人' });
  await dispatch(runtime, 'travel', 'location.travel', { destinationId: 'starter-well' });
  await dispatch(runtime, 'gather', 'survival.gather', { itemId: 'water' });

  const scene = await dispatch(runtime, 'scene', 'narrative.scene');
  assert.deepEqual(scene.data.inventoryItems, [{ name: '水', quantity: 1 }]);
  assert.equal(scene.data.inventoryItems[0].itemId, undefined);
});
