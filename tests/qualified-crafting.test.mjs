import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { createDevelopmentGame } from '../src/game.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

const actor = { sessionId: 'qualified-craft-player' };
const dispatch = (runtime, requestId, type, payload = {}) => runtime.dispatch({ actor, requestId, action: { type, payload } });

function qualifiedCraftPack() {
  const pack = structuredClone(devStarterPack);
  const base = pack.locations['starter-square'].recipes[0];
  pack.locations['starter-square'].recipes.push({
    id: 'starter-qualified-meal', label: '製作熟手餐', behaviorId: 'craft:starter-qualified-meal',
    inputs: structuredClone(base.inputs), output: structuredClone(base.output),
    requirements: [{ behaviorId: base.behaviorId, minCount: 1 }],
  });
  return pack;
}

async function gatherInputs(runtime, suffix) {
  await dispatch(runtime, `well-${suffix}`, 'location.travel', { destinationId: 'starter-well' });
  await dispatch(runtime, `water-${suffix}`, 'survival.gather', { itemId: 'water' });
  await dispatch(runtime, `square-w-${suffix}`, 'location.travel', { destinationId: 'starter-square' });
  await dispatch(runtime, `grove-${suffix}`, 'location.travel', { destinationId: 'starter-grove' });
  await dispatch(runtime, `food-${suffix}`, 'survival.gather', { itemId: 'food' });
  await dispatch(runtime, `square-f-${suffix}`, 'location.travel', { destinationId: 'starter-square' });
}

test('earned crafting history unlocks a recipe without exposing hidden thresholds', async () => {
  const pack = qualifiedCraftPack(); validateContentPack(pack);
  const { runtime } = createDevelopmentGame({ contentPack: pack, now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '熟手工匠' });
  await gatherInputs(runtime, 'a');
  let scene = await dispatch(runtime, 'before', 'narrative.scene');
  assert.equal(scene.data.utilities.some((entry) => entry.intent.payload?.recipeId === 'starter-qualified-meal'), false);
  assert.equal((await dispatch(runtime, 'forged', 'crafting.craft', { recipeId: 'starter-qualified-meal' })).code, 'CRAFT_REQUIREMENTS_NOT_MET');
  assert.equal((await dispatch(runtime, 'base', 'crafting.craft', { recipeId: 'starter-simple-meal' })).code, 'CRAFT_COMPLETED');
  await gatherInputs(runtime, 'b');
  scene = await dispatch(runtime, 'after', 'narrative.scene');
  const unlocked = scene.data.utilities.find((entry) => entry.intent.payload?.recipeId === 'starter-qualified-meal');
  assert.ok(unlocked);
  assert.equal(JSON.stringify(unlocked).includes('requirements'), false);
  assert.equal(JSON.stringify(unlocked).includes('behaviorId'), false);
  assert.equal((await dispatch(runtime, 'qualified', 'crafting.craft', { recipeId: 'starter-qualified-meal' })).code, 'CRAFT_COMPLETED');
});

test('Content Pack rejects recipe requirements that reference undeclared behavior', () => {
  const pack = qualifiedCraftPack();
  pack.locations['starter-square'].recipes[1].requirements[0].behaviorId = 'craft:missing';
  assert.throws(() => validateContentPack(pack), /references unknown behavior/);
});
