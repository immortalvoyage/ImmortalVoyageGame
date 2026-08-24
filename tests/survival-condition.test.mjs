import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'survival-condition-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function bornGame(options = {}) {
  const game = createDevelopmentGame({ now: () => 1000, ...options });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '求生旅人' });
  const employment = await dispatch(game.runtime, 'employment', 'employment.accept', { jobId: 'starter-labor' });
  if (employment.code !== 'UNKNOWN_ACTION') assert.equal(employment.code, 'EMPLOYMENT_STARTED');
  return game;
}

async function setCharacter(game, mutator) {
  const world = game.store.snapshot();
  mutator(world.characters[actor.sessionId]);
  await game.store.replace(world);
}

test('warning condition is visible but does not block contracted work', async () => {
  const game = await bornGame();
  await setCharacter(game, (character) => { character.needs.hunger = 60; });

  const scene = await dispatch(game.runtime, 'warning-scene', 'narrative.scene');
  assert.equal(scene.data.survivalCondition.severity, 'warning');
  assert.ok(scene.data.survivalCondition.warningNeeds.some((entry) => entry.name === '飢餓'));
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'));

  const work = await dispatch(game.runtime, 'warning-work', 'economy.work', { jobId: 'starter-labor' });
  assert.equal(work.code, 'WORK_COMPLETED');
});

test('critical hunger, thirst, or fatigue blocks work before money, behavior, or needs mutate', async () => {
  for (const need of ['hunger', 'thirst', 'fatigue']) {
    const game = await bornGame();
    await setCharacter(game, (character) => { character.needs[need] = 85; });
    const before = game.store.snapshot();

    const work = await dispatch(game.runtime, `critical-${need}`, 'economy.work', { jobId: 'starter-labor' });
    assert.equal(work.code, 'SURVIVAL_CONDITION_TOO_POOR');
    assert.deepEqual(game.store.snapshot(), before);
  }
});

test('critical state hides work but keeps travel routes available for food and water recovery', async () => {
  const game = await bornGame();
  await setCharacter(game, (character) => {
    character.needs.hunger = 90;
    character.needs.thirst = 90;
  });

  const scene = await dispatch(game.runtime, 'critical-scene', 'narrative.scene');
  assert.equal(scene.data.survivalCondition.severity, 'critical');
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'), false);
  const destinations = scene.data.narrative.options
    .filter((entry) => entry.intent.type === 'location.travel')
    .map((entry) => entry.intent.payload.destinationId);
  assert.ok(destinations.includes('starter-well'));
  assert.ok(destinations.includes('starter-grove'));
});

test('food and water consumption can recover from critical state and re-enable work', async () => {
  const game = await bornGame();
  await setCharacter(game, (character) => {
    character.needs.hunger = 90;
    character.needs.thirst = 90;
    character.inventory.food = 1;
    character.inventory.water = 1;
  });

  assert.equal((await dispatch(game.runtime, 'blocked-before-food', 'economy.work', { jobId: 'starter-labor' })).code, 'SURVIVAL_CONDITION_TOO_POOR');
  await dispatch(game.runtime, 'eat', 'survival.consume', { itemId: 'food' });
  assert.equal((await dispatch(game.runtime, 'blocked-before-water', 'economy.work', { jobId: 'starter-labor' })).code, 'SURVIVAL_CONDITION_TOO_POOR');
  await dispatch(game.runtime, 'drink', 'survival.consume', { itemId: 'water' });
  assert.equal((await dispatch(game.runtime, 'work-after-supplies', 'economy.work', { jobId: 'starter-labor' })).code, 'WORK_COMPLETED');
});

test('rest is a deterministic fatigue relief path and request replay cannot rest twice', async () => {
  const game = await bornGame();
  await setCharacter(game, (character) => { character.needs.fatigue = 90; });

  const blocked = await dispatch(game.runtime, 'fatigue-blocked', 'economy.work', { jobId: 'starter-labor' });
  assert.equal(blocked.code, 'SURVIVAL_CONDITION_TOO_POOR');

  const firstRest = await dispatch(game.runtime, 'same-rest', 'survival.rest');
  const replay = await dispatch(game.runtime, 'same-rest', 'survival.rest');
  assert.deepEqual(replay, firstRest);
  assert.equal(game.store.snapshot().characters[actor.sessionId].needs.fatigue, 65);
  assert.equal((await dispatch(game.runtime, 'work-after-rest', 'economy.work', { jobId: 'starter-labor' })).code, 'WORK_COMPLETED');
});

test('critical thirst at the well still allows gathering and critical fatigue exposes rest utility', async () => {
  const game = await bornGame();
  await dispatch(game.runtime, 'to-well', 'location.travel', { destinationId: 'starter-well' });
  await setCharacter(game, (character) => {
    character.needs.thirst = 90;
    character.needs.fatigue = 90;
  });

  const scene = await dispatch(game.runtime, 'well-critical-scene', 'narrative.scene');
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'survival.gather'));
  assert.ok(scene.data.utilities.some((entry) => entry.intent.type === 'survival.rest'));
  assert.equal((await dispatch(game.runtime, 'gather-water', 'survival.gather', { itemId: 'water' })).code, 'RESOURCE_GATHERED');
});

test('disabling Survival Module disables the condition guard instead of leaving stale needs as a hidden dependency', async () => {
  const enabledModules = ['character', 'inventory', 'location', 'npc', 'purpose', 'economy', 'trade', 'crafting', 'progression', 'career', 'estate', 'narrative'];
  const game = await bornGame({ enabledModules });
  await setCharacter(game, (character) => {
    character.needs.hunger = 100;
    character.needs.thirst = 100;
    character.needs.fatigue = 100;
  });

  const scene = await dispatch(game.runtime, 'no-survival-scene', 'narrative.scene');
  assert.equal(scene.data.survivalCondition, null);
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'));
  assert.equal((await dispatch(game.runtime, 'no-survival-work', 'economy.work', { jobId: 'starter-labor' })).code, 'WORK_COMPLETED');
  assert.equal((await dispatch(game.runtime, 'no-survival-rest', 'survival.rest')).code, 'UNKNOWN_ACTION');
});
