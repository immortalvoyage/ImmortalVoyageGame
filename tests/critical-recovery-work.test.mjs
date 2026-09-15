import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'critical-recovery-work-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

function recoveryProofPack() {
  const pack = structuredClone(firstSettlementPack);
  pack.locations['first-well'].gatherables = [];
  pack.locations['first-outskirts'].gatherables = [];
  delete pack.progressionTags['first-foraging-basics'];
  return pack;
}

async function setCharacter(game, mutator) {
  const world = game.store.snapshot();
  mutator(world.characters[actor.sessionId]);
  await game.store.replace(world);
}

test('critical-only recovery work replaces free food and water fixtures without creating money', async () => {
  const pack = recoveryProofPack();
  const clock = { now: 1000 };
  const game = createDevelopmentGame({ contentPack: pack, now: () => clock.now });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '困頓旅人' });
  await dispatch(game.runtime, 'accept', 'employment.accept', { jobId: 'first-carrying-work' });
  await setCharacter(game, (character) => {
    character.money = 0;
    character.inventory = {};
    character.needs = { hunger: 90, thirst: 90, fatigue: 90 };
  });

  const scene = await dispatch(game.runtime, 'critical-scene', 'narrative.scene');
  const recoveryChoices = scene.data.utilities.filter((entry) => entry.intent.type === 'economy.recovery-work');
  assert.equal(recoveryChoices.length, 2);
  assert.equal(scene.data.utilities.some((entry) => entry.intent.type === 'survival.gather'), false);

  const meal = await dispatch(game.runtime, 'meal-work', 'economy.recovery-work', { recoveryWorkId: 'first-meal-recovery-work' });
  assert.equal(meal.code, 'RECOVERY_WORK_COMPLETED');
  assert.deepEqual(meal.data.reward, { name: '粗麵餅', quantity: 1 });
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 0);

  const beforeDuplicate = game.store.snapshot();
  assert.equal((await dispatch(game.runtime, 'meal-work-duplicate', 'economy.recovery-work', { recoveryWorkId: 'first-meal-recovery-work' })).code, 'RECOVERY_WORK_NOT_AVAILABLE');
  assert.deepEqual(game.store.snapshot(), beforeDuplicate);
  assert.equal((await dispatch(game.runtime, 'eat', 'survival.consume', { itemId: 'coarse-bread' })).code, 'ITEM_CONSUMED');

  const water = await dispatch(game.runtime, 'water-work', 'economy.recovery-work', { recoveryWorkId: 'first-water-recovery-work' });
  assert.equal(water.code, 'RECOVERY_WORK_COMPLETED');
  assert.equal((await dispatch(game.runtime, 'drink', 'survival.consume', { itemId: 'drinking-water' })).code, 'ITEM_CONSUMED');
  await dispatch(game.runtime, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' });
  assert.equal((await dispatch(game.runtime, 'rest', 'survival.rest')).code, 'REST_COMPLETED');
  await dispatch(game.runtime, 'back-square', 'location.travel', { destinationId: 'first-square' });

  const recovered = game.store.snapshot().characters[actor.sessionId];
  assert.ok(recovered.needs.hunger < pack.survival.criticalThreshold);
  assert.ok(recovered.needs.thirst < pack.survival.criticalThreshold);
  assert.ok(recovered.needs.fatigue < pack.survival.criticalThreshold);
  assert.equal((await dispatch(game.runtime, 'work-after-recovery', 'economy.work', { jobId: 'first-carrying-work' })).code, 'WORK_STARTED');
  clock.now += 5 * 60 * 1000;
  await dispatch(game.runtime, 'settle-work-after-recovery', 'narrative.scene');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 2);

  const recoveryEvents = game.store.snapshot().gameEvents.filter((event) => event.type === 'economy.recovery-supply-earned');
  assert.equal(recoveryEvents.length, 2);
});

test('recovery work contract rejects stockpiling, malformed rewards, and carry overflow atomically', async () => {
  const malformedQuantity = recoveryProofPack();
  malformedQuantity.locations['first-square'].recoveryWork[0].reward.quantity = 2;
  assert.throws(() => validateContentPack(malformedQuantity), /reward.quantity must be exactly 1/);

  const weakReward = recoveryProofPack();
  weakReward.items['coarse-bread'].consumeEffect.hunger = -10;
  assert.throws(() => validateContentPack(weakReward), /must resolve hunger or thirst/);
  const fullPack = recoveryProofPack();
  fullPack.inventory.carryCapacityUnits = 1;
  fullPack.items.ballast = { carryUnits: 1, name: '壓艙物' };
  const game = createDevelopmentGame({ contentPack: fullPack, now: () => 1000 });
  await dispatch(game.runtime, 'birth-full', 'character.birth', { name: '負重旅人' });
  await setCharacter(game, (character) => {
    character.inventory = { ballast: 1 };
    character.needs.hunger = 90;
  });
  const before = game.store.snapshot();
  assert.equal((await dispatch(game.runtime, 'full-recovery', 'economy.recovery-work', { recoveryWorkId: 'first-meal-recovery-work' })).code, 'RECOVERY_WORK_NOT_AVAILABLE');
  assert.deepEqual(game.store.snapshot(), before);
});

test('recovery work fails closed when Survival consumption is disabled and legacy Narrative does not expose it', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'employment', 'economy', 'trade',
    'crafting', 'progression', 'career', 'relationship', 'knowledge', 'estate', 'narrative',
  ];
  const game = createDevelopmentGame({ contentPack: recoveryProofPack(), now: () => 1000, enabledModules });
  await dispatch(game.runtime, 'birth-disabled', 'character.birth', { name: '降級旅人' });
  await setCharacter(game, (character) => { character.needs.hunger = 90; });

  const scene = await dispatch(game.runtime, 'scene-disabled', 'narrative.scene');
  assert.equal(scene.data.utilities.some((entry) => entry.intent.type === 'economy.recovery-work'), false);
  const before = game.store.snapshot();
  assert.equal((await dispatch(game.runtime, 'forged-disabled', 'economy.recovery-work', { recoveryWorkId: 'first-meal-recovery-work' })).code, 'RECOVERY_WORK_NOT_AVAILABLE');
  assert.deepEqual(game.store.snapshot(), before);
});

test('Situation-off Narrative fallback still exposes eligible recovery work while Survival remains active', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'employment', 'economy', 'trade',
    'crafting', 'progression', 'career', 'relationship', 'knowledge', 'estate', 'narrative',
  ];
  const game = createDevelopmentGame({ contentPack: recoveryProofPack(), now: () => 1000, enabledModules });
  await dispatch(game.runtime, 'birth-fallback', 'character.birth', { name: '備援旅人' });
  await setCharacter(game, (character) => { character.needs.hunger = 90; });

  const scene = await dispatch(game.runtime, 'scene-fallback', 'narrative.scene');
  assert.ok(scene.data.utilities.some(
    (entry) => entry.intent.type === 'economy.recovery-work'
      && entry.intent.payload.recoveryWorkId === 'first-meal-recovery-work',
  ));
});
