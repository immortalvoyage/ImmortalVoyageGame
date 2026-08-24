import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertWorldState,
  createInitialWorld,
  MAX_GAME_EVENTS,
  MAX_REQUEST_RESULTS,
} from '../src/core/world-state.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'invariant-session' };

function character(overrides = {}) {
  return {
    id: 'char:1',
    ownerSessionId: actor.sessionId,
    name: '完整性旅人',
    status: 'alive',
    locationId: 'starter-square',
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    behaviorCounts: {},
    inventory: {},
    money: 0,
    ...overrides,
  };
}

function validWorld(characterOverrides = {}) {
  const world = createInitialWorld({ nowMs: 1000 });
  world.characters[actor.sessionId] = character(characterOverrides);
  world.nextCharacterSequence = 2;
  return world;
}

function expectInvalid(mutator, pattern) {
  const world = validWorld();
  mutator(world);
  assert.throws(() => assertWorldState(world), pattern);
}

test('valid authoritative world and normal gameplay output satisfy invariants', async () => {
  const world = validWorld({ inventory: { food: 2 }, money: 3, behaviorCounts: { 'work:starter-labor': 1 } });
  assert.equal(assertWorldState(world), world);

  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await runtime.dispatch({ actor, requestId: 'birth', action: { type: 'character.birth', payload: { name: '正常旅人' } } });
  await runtime.dispatch({ actor, requestId: 'work', action: { type: 'economy.work', payload: { jobId: 'starter-labor' } } });
  await runtime.dispatch({ actor, requestId: 'scene', action: { type: 'narrative.scene', payload: {} } });
  assert.equal(assertWorldState(store.snapshot()).schemaVersion, 3);
});

test('identity, ownership, and world clock corruption fail closed', () => {
  expectInvalid((world) => { world.worldId = ''; }, /invalid world identity/);
  expectInvalid((world) => { world.logicalTimeSeconds = -1; }, /invalid logical world time/);
  expectInvalid((world) => { world.lastResolvedAtMs = Number.NaN; }, /invalid world timestamp/);
  expectInvalid((world) => { world.characters[actor.sessionId].ownerSessionId = 'other-session'; }, /invalid character ownership/);
  expectInvalid((world) => { world.characters[actor.sessionId].name = ''; }, /invalid character identity/);
});

test('survival, money, and inventory corruption fail closed', () => {
  expectInvalid((world) => { world.characters[actor.sessionId].needs.hunger = 101; }, /invalid survival needs/);
  expectInvalid((world) => { world.characters[actor.sessionId].needs.thirst = 0.5; }, /invalid survival needs/);
  expectInvalid((world) => { world.characters[actor.sessionId].needProgressSeconds.fatigue = -1; }, /invalid survival progress/);
  expectInvalid((world) => { world.characters[actor.sessionId].money = -1; }, /invalid money state/);
  expectInvalid((world) => { world.characters[actor.sessionId].inventory = []; }, /invalid inventory state/);
  expectInvalid((world) => { world.characters[actor.sessionId].inventory.food = 0; }, /invalid inventory state/);
});

test('behavior counters remain bounded integer aggregates', () => {
  expectInvalid((world) => { world.characters[actor.sessionId].behaviorCounts.bad = -1; }, /invalid behavior counts/);
  expectInvalid((world) => { world.characters[actor.sessionId].behaviorCounts.bad = 1.5; }, /invalid behavior counts/);
});

test('request result ledger must stay bounded and internally consistent', () => {
  expectInvalid((world) => {
    world.requestResults.orphan = { sessionId: actor.sessionId, result: { ok: true, code: 'OK', data: null } };
  }, /invalid request result ledger/);

  expectInvalid((world) => {
    world.requestOrder.push('missing');
  }, /invalid request result ledger/);

  const oversized = validWorld();
  for (let index = 0; index <= MAX_REQUEST_RESULTS; index += 1) {
    const requestId = `request-${index}`;
    oversized.requestOrder.push(requestId);
    oversized.requestResults[requestId] = { sessionId: actor.sessionId, result: { ok: true, code: 'OK', data: null } };
  }
  assert.throws(() => assertWorldState(oversized), /request result ledger exceeds limit/);
});

test('game event ledger must stay bounded and cannot contain future or malformed events', () => {
  expectInvalid((world) => {
    world.gameEvents.push({ type: 'future', logicalTimeSeconds: 1, data: null });
  }, /invalid game event time/);

  expectInvalid((world) => {
    world.gameEvents.push({ type: '', logicalTimeSeconds: 0, data: null });
  }, /invalid game event/);

  const oversized = validWorld();
  oversized.gameEvents = Array.from({ length: MAX_GAME_EVENTS + 1 }, (_, index) => ({
    type: `event.${index}`,
    logicalTimeSeconds: 0,
    data: null,
  }));
  assert.throws(() => assertWorldState(oversized), /game event ledger exceeds limit/);
});
