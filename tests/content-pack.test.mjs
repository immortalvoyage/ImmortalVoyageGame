import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

const actor = { sessionId: 'content-pack-session' };

test('development Content Pack passes startup validation', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
});

test('Content Pack rejects missing starting location and broken route references', () => {
  const missingStart = clonePack();
  missingStart.startingLocationId = 'missing-start';
  assert.throws(() => validateContentPack(missingStart), /starting location does not exist/);

  const brokenRoute = clonePack();
  brokenRoute.locations['starter-square'].routes.push({
    destinationId: 'missing-route',
    travelSeconds: 60,
    needCosts: {},
  });
  assert.throws(() => validateContentPack(brokenRoute), /routes targets unknown location/);
});

test('Content Pack requires bounded structured route movement rules', () => {
  const stringRoute = clonePack();
  stringRoute.locations['starter-square'].routes[0] = 'starter-well';
  assert.throws(() => validateContentPack(stringRoute), /routes\[0\] must be an object/);

  const zeroDuration = clonePack();
  zeroDuration.locations['starter-square'].routes[0].travelSeconds = 0;
  assert.throws(() => validateContentPack(zeroDuration), /travelSeconds must be an integer/);

  const badNeed = clonePack();
  badNeed.locations['starter-square'].routes[0].needCosts.courage = 1;
  assert.throws(() => validateContentPack(badNeed), /needCosts\.courage is not a known need/);

  const duplicateDestination = clonePack();
  duplicateDestination.locations['starter-square'].routes.push(
    structuredClone(duplicateDestination.locations['starter-square'].routes[0]),
  );
  assert.throws(() => validateContentPack(duplicateDestination), /routes destination ids contains duplicate value/);
});

test('Content Pack rejects unknown item references and duplicate local rules', () => {
  const unknownMarketItem = clonePack();
  unknownMarketItem.locations['starter-square'].market[0].itemId = 'missing-item';
  assert.throws(() => validateContentPack(unknownMarketItem), /references unknown item/);

  const duplicateJob = clonePack();
  duplicateJob.locations['starter-square'].jobs.push(structuredClone(duplicateJob.locations['starter-square'].jobs[0]));
  assert.throws(() => validateContentPack(duplicateJob), /jobs ids contains duplicate value/);
});

test('Content Pack requires own reference keys and rejects malformed need maps', () => {
  const inheritedItemName = clonePack();
  inheritedItemName.locations['starter-square'].market[0].itemId = 'toString';
  assert.throws(() => validateContentPack(inheritedItemName), /references unknown item/);

  const nullEffect = clonePack();
  nullEffect.items.water.consumeEffect = null;
  assert.throws(() => validateContentPack(nullEffect), /consumeEffect must be an object/);
});

test('Content Pack rejects invalid economy and survival numbers', () => {
  const negativePrice = clonePack();
  negativePrice.locations['starter-square'].market[0].price = -1;
  assert.throws(() => validateContentPack(negativePrice), /price must be an integer/);

  const zeroGather = clonePack();
  zeroGather.locations['starter-well'].gatherables[0].quantity = 0;
  assert.throws(() => validateContentPack(zeroGather), /quantity must be an integer/);

  const invalidNeed = clonePack();
  invalidNeed.locations['starter-square'].jobs[0].needCosts.unknownNeed = 1;
  assert.throws(() => validateContentPack(invalidNeed), /is not a known need/);
});

test('Content Pack rejects unsafe crafting recipes', () => {
  const missingInputItem = clonePack();
  missingInputItem.locations['starter-square'].recipes[0].inputs[0].itemId = 'missing-item';
  assert.throws(() => validateContentPack(missingInputItem), /references unknown item/);

  const freeRecipe = clonePack();
  freeRecipe.locations['starter-square'].recipes[0].inputs = [];
  assert.throws(() => validateContentPack(freeRecipe), /inputs must not be empty/);

  const duplicateRecipe = clonePack();
  duplicateRecipe.locations['starter-square'].recipes.push(structuredClone(duplicateRecipe.locations['starter-square'].recipes[0]));
  assert.throws(() => validateContentPack(duplicateRecipe), /recipes ids contains duplicate value/);

  const invalidOutput = clonePack();
  invalidOutput.locations['starter-square'].recipes[0].output.quantity = 0;
  assert.throws(() => validateContentPack(invalidOutput), /output.quantity must be an integer/);
});

test('Content Pack rejects missing behavior ids on gatherables and recipes', () => {
  const missingGatherBehavior = clonePack();
  delete missingGatherBehavior.locations['starter-grove'].gatherables[0].behaviorId;
  assert.throws(() => validateContentPack(missingGatherBehavior), /behaviorId must be non-empty text/);

  const missingRecipeBehavior = clonePack();
  delete missingRecipeBehavior.locations['starter-square'].recipes[0].behaviorId;
  assert.throws(() => validateContentPack(missingRecipeBehavior), /behaviorId must be non-empty text/);
});

test('Content Pack rejects broken progression tag rules', () => {
  const missingTags = clonePack();
  delete missingTags.progressionTags;
  assert.throws(() => validateContentPack(missingTags), /progressionTags must be an object/);

  const invalidKind = clonePack();
  invalidKind.progressionTags['starter-foraging-basics'].kind = 'secret';
  assert.throws(() => validateContentPack(invalidKind), /kind must be skill or social/);

  const unknownBehavior = clonePack();
  unknownBehavior.progressionTags['starter-foraging-basics'].requirements[0].behaviorId = 'gather:missing';
  assert.throws(() => validateContentPack(unknownBehavior), /references unknown behavior/);

  const zeroThreshold = clonePack();
  zeroThreshold.progressionTags['starter-foraging-basics'].requirements[0].minCount = 0;
  assert.throws(() => validateContentPack(zeroThreshold), /minCount must be an integer/);

  const duplicateRequirement = clonePack();
  duplicateRequirement.progressionTags['starter-foraging-basics'].requirements.push(
    structuredClone(duplicateRequirement.progressionTags['starter-foraging-basics'].requirements[0]),
  );
  assert.throws(() => validateContentPack(duplicateRequirement), /requirements behavior ids contains duplicate value/);
});

test('Content Pack rejects broken career behavior rules', () => {
  const missingJobBehavior = clonePack();
  delete missingJobBehavior.locations['starter-square'].jobs[0].behaviorId;
  assert.throws(() => validateContentPack(missingJobBehavior), /behaviorId must be non-empty text/);

  const unknownBehavior = clonePack();
  unknownBehavior.careers['starter-labor-hand'].requirements[0].behaviorId = 'work:missing';
  assert.throws(() => validateContentPack(unknownBehavior), /references unknown behavior/);

  const zeroThreshold = clonePack();
  zeroThreshold.careers['starter-labor-hand'].requirements[0].minCount = 0;
  assert.throws(() => validateContentPack(zeroThreshold), /minCount must be an integer/);

  const noRequirements = clonePack();
  noRequirements.careers['starter-labor-hand'].requirements = [];
  assert.throws(() => validateContentPack(noRequirements), /requirements must not be empty/);
});

test('Content Pack rejects NPC locations that do not exist', () => {
  const pack = clonePack();
  pack.locations['starter-square'].jobs = [];
  pack.npcs.foreman.locationId = 'missing-place';
  assert.throws(() => validateContentPack(pack), /references unknown location/);
});

test('new characters use the Content Pack starting location', async () => {
  const { runtime } = createDevelopmentGame({ now: () => 1000 });
  const result = await runtime.dispatch({
    actor,
    requestId: 'birth',
    action: { type: 'character.birth', payload: { name: '起點旅人' } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.character.locationId, devStarterPack.startingLocationId);
});
