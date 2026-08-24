import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { GameRuntime } from '../src/core/game-runtime.js';
import { createInitialWorld } from '../src/core/world-state.js';

const actor = { sessionId: 'guard-session' };

function validCharacter() {
  return {
    id: 'char:1',
    ownerSessionId: actor.sessionId,
    name: '守門旅人',
    status: 'alive',
    locationId: 'starter-square',
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    behaviorCounts: {},
    inventory: {},
    money: 0,
  };
}

function worldWithCharacter() {
  const world = createInitialWorld({ nowMs: 1000 });
  world.characters[actor.sessionId] = validCharacter();
  world.nextCharacterSequence = 2;
  return world;
}

function moduleFor(actionType, handler) {
  return {
    manifest: { name: `test-${actionType}`, dataVersion: 1, actions: [actionType] },
    actions: { [actionType]: handler },
  };
}

test('successful handler cannot persist structurally invalid authoritative state', async () => {
  const initial = worldWithCharacter();
  const store = new MemoryGameStore(initial);
  const runtime = new GameRuntime({
    store,
    modules: [moduleFor('test.break-money', ({ world }) => {
      world.characters[actor.sessionId].money = -1;
      return { ok: true, code: 'BROKEN' };
    })],
    now: () => 1000,
  });

  await assert.rejects(
    () => runtime.dispatch({ actor, requestId: 'break-money', action: { type: 'test.break-money', payload: {} } }),
    /invalid money state/,
  );
  assert.deepEqual(store.snapshot(), initial);
});

test('post-mutation domain validator can veto an otherwise structurally valid mutation', async () => {
  const initial = worldWithCharacter();
  const store = new MemoryGameStore(initial);
  let validations = 0;
  const runtime = new GameRuntime({
    store,
    modules: [moduleFor('test.add-item', ({ world }) => {
      world.characters[actor.sessionId].inventory.forbidden = 1;
      return { ok: true, code: 'ITEM_ADDED' };
    })],
    validateLoadedWorld: (world) => {
      validations += 1;
      if (world.characters[actor.sessionId]?.inventory?.forbidden) throw new Error('domain mutation rejected');
    },
    now: () => 1000,
  });

  await assert.rejects(
    () => runtime.dispatch({ actor, requestId: 'add-item', action: { type: 'test.add-item', payload: {} } }),
    /domain mutation rejected/,
  );
  assert.equal(validations, 2);
  assert.deepEqual(store.snapshot(), initial);
});
