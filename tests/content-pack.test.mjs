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
  brokenRoute.locations['starter-square'].routes.push('missing-route');
  assert.throws(() => validateContentPack(brokenRoute), /routes targets unknown location/);
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

test('Content Pack rejects NPC locations that do not exist', () => {
  const pack = clonePack();
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
