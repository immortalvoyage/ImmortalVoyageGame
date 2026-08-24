import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'movement-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function bornGame(options = {}) {
  const game = createDevelopmentGame({ now: () => 1000, ...options });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '行路旅人' });
  return game;
}

async function setCharacter(game, mutator) {
  const world = game.store.snapshot();
  mutator(world.characters[actor.sessionId]);
  await game.store.replace(world);
}

test('location observation exposes bounded route duration without route need-cost tuning', async () => {
  const game = await bornGame();
  const observed = await dispatch(game.runtime, 'observe', 'location.observe');

  const well = observed.data.routes.find((route) => route.id === 'starter-well');
  const grove = observed.data.routes.find((route) => route.id === 'starter-grove');
  assert.equal(well.travelSeconds, 5 * 60);
  assert.equal(grove.travelSeconds, 15 * 60);
  assert.equal(well.needCosts, undefined);

  const scene = await dispatch(game.runtime, 'scene', 'narrative.scene');
  const wellChoice = scene.data.narrative.options.find(
    (entry) => entry.intent.type === 'location.travel' && entry.intent.payload.destinationId === 'starter-well',
  );
  assert.ok(wellChoice.label.includes('約5 分鐘'));
});

test('direct travel applies Content-Pack movement costs atomically without fast-forwarding shared world time', async () => {
  const game = await bornGame();
  const before = game.store.snapshot();
  const travelled = await dispatch(game.runtime, 'travel-well', 'location.travel', { destinationId: 'starter-well' });

  assert.equal(travelled.code, 'TRAVEL_COMPLETED');
  assert.equal(travelled.data.location.id, 'starter-well');
  assert.equal(travelled.data.travelSeconds, 5 * 60);
  assert.deepEqual(travelled.data.needs, { hunger: 0, thirst: 1, fatigue: 0 });

  const after = game.store.snapshot();
  assert.equal(after.logicalTimeSeconds, before.logicalTimeSeconds);
  assert.equal(after.characters[actor.sessionId].locationId, 'starter-well');
  assert.deepEqual(after.characters[actor.sessionId].needs, { hunger: 0, thirst: 1, fatigue: 0 });
  assert.equal(after.gameEvents.at(-1).data.travelSeconds, 5 * 60);

  const replay = await dispatch(game.runtime, 'travel-well', 'location.travel', { destinationId: 'starter-grove' });
  assert.deepEqual(replay, travelled);
  assert.deepEqual(game.store.snapshot(), after);
});

test('different routes can carry different duration and deterministic survival costs', async () => {
  const game = await bornGame();
  const travelled = await dispatch(game.runtime, 'travel-grove', 'location.travel', { destinationId: 'starter-grove' });

  assert.equal(travelled.data.travelSeconds, 15 * 60);
  assert.deepEqual(travelled.data.needs, { hunger: 1, thirst: 1, fatigue: 0 });
});

test('route movement costs saturate at need bounds', async () => {
  const game = await bornGame();
  await setCharacter(game, (character) => {
    character.needs.hunger = 100;
    character.needs.thirst = 100;
  });

  const travelled = await dispatch(game.runtime, 'bounded-travel', 'location.travel', { destinationId: 'starter-grove' });
  assert.deepEqual(travelled.data.needs, { hunger: 100, thirst: 100, fatigue: 0 });
});

test('disabling Survival removes travel need costs without disabling movement', async () => {
  const enabledModules = ['character', 'inventory', 'location', 'situation', 'narrative'];
  const game = await bornGame({ enabledModules });
  const travelled = await dispatch(game.runtime, 'travel-no-survival', 'location.travel', { destinationId: 'starter-grove' });

  assert.equal(travelled.code, 'TRAVEL_COMPLETED');
  assert.equal(travelled.data.travelSeconds, 15 * 60);
  assert.deepEqual(travelled.data.needs, { hunger: 0, thirst: 0, fatigue: 0 });
});

test('Purpose movement uses the same route duration and cost contract without exposing target coordinates', async () => {
  const game = await bornGame();
  await dispatch(game.runtime, 'leave', 'location.travel', { destinationId: 'starter-well' });
  const beforeSearch = game.store.snapshot().characters[actor.sessionId];

  const found = await dispatch(game.runtime, 'find-foreman', 'purpose.find-npc', { npcId: 'foreman' });
  assert.equal(found.code, 'PURPOSE_TARGET_FOUND');
  assert.equal(found.data.travelSeconds, 5 * 60);
  assert.equal(found.data.location.id, 'starter-square');
  assert.deepEqual(found.data.npc, { id: 'foreman', name: '聚落雜役領班' });
  assert.equal(found.data.npc.locationId, undefined);
  assert.equal(found.data.needs.thirst, beforeSearch.needs.thirst + 1);

  const travelEvent = game.store.snapshot().gameEvents.slice(-2)[0];
  assert.equal(travelEvent.type, 'character.travelled');
  assert.equal(travelEvent.data.travelSeconds, 5 * 60);
});
