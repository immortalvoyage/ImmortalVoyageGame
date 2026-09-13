import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

async function dispatch(runtime, actor, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('scene keeps world choices, travel, dialogue and immediate operations on distinct surfaces', async () => {
  const game = createDevelopmentGame();
  const actor = { sessionId: 'surface-audit' };
  await dispatch(game.runtime, actor, 'birth', 'character.birth', { name: 'Surface Audit' });
  const scene = await dispatch(game.runtime, actor, 'scene', 'narrative.scene');
  assert.equal(scene.ok, true);
  const mainTypes = scene.data.narrative.options.map((entry) => entry.intent.type);
  const travelTypes = scene.data.travelOptions.map((entry) => entry.intent.type);
  const dialogueTypes = scene.data.dialogueTopics.map((entry) => entry.intent.type);
  const utilityTypes = scene.data.utilities.map((entry) => entry.intent.type);
  assert.equal(mainTypes.includes('location.travel'), false);
  assert.ok(travelTypes.length > 0);
  assert.ok(travelTypes.every((type) => type === 'location.travel'));
  assert.ok(dialogueTypes.every((type) => type === 'npc.ask'));
  for (const type of ['economy.work','economy.recovery-work','survival.gather','survival.consume','survival.rest','crafting.craft','economy.buy','employment.resign']) {
    assert.equal(mainTypes.includes(type), false);
    assert.equal(travelTypes.includes(type), false);
    assert.equal(dialogueTypes.includes(type), false);
  }
  assert.equal(utilityTypes.includes('location.travel'), false);
  assert.equal(utilityTypes.includes('npc.ask'), false);
});
