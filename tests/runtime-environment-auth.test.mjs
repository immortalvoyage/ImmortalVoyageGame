import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGameStore } from '../src/adapters/memory-game-store.js';
import { createDeveloperTestSession } from '../src/core/auth-session.js';
import {
  RUNTIME_STAGE,
  LOCAL_DEVELOPMENT_ENVIRONMENT,
  assertDeveloperTestIdentityAllowed,
  assertResetAllowed,
  assertWorldNamespace,
  createRuntimeEnvironment,
} from '../src/core/runtime-environment.js';
import { createInitialWorld } from '../src/core/world-state.js';
import { createDevelopmentGame, createGame } from '../src/game.js';

function environment(stage, worldNamespace = `${stage}:test-world`) {
  return createRuntimeEnvironment({ stage, worldNamespace });
}

test('runtime stages encode disposable and durable gameplay boundaries', () => {
  const development = environment(RUNTIME_STAGE.DEVELOPMENT_TEST);
  const wipe = environment(RUNTIME_STAGE.CLOSED_BETA_WIPE);
  const persistent = environment(RUNTIME_STAGE.CLOSED_BETA_PERSISTENT);
  const production = environment(RUNTIME_STAGE.PRODUCTION);

  assert.deepEqual(
    [development.disposableGameplay, wipe.disposableGameplay, persistent.disposableGameplay, production.disposableGameplay],
    [true, true, false, false],
  );  assert.deepEqual(
    [development.durableGameplay, wipe.durableGameplay, persistent.durableGameplay, production.durableGameplay],
    [false, false, true, true],
  );
  assert.equal(assertResetAllowed(development), development);
  assert.equal(assertResetAllowed(wipe), wipe);
  assert.throws(() => assertResetAllowed(persistent), /reset is forbidden/);
  assert.throws(() => assertResetAllowed(production), /reset is forbidden/);
});

test('developer test identity is hard-gated to Development Test', () => {
  const development = environment(RUNTIME_STAGE.DEVELOPMENT_TEST);
  assert.equal(assertDeveloperTestIdentityAllowed(development), development);

  for (const stage of [
    RUNTIME_STAGE.CLOSED_BETA_WIPE,
    RUNTIME_STAGE.CLOSED_BETA_PERSISTENT,
    RUNTIME_STAGE.PRODUCTION,
  ]) {
    assert.throws(() => assertDeveloperTestIdentityAllowed(environment(stage)), /developer test identity is forbidden/);
    assert.throws(
      () => createDeveloperTestSession({ environment: environment(stage), accountId: 'account:1', sessionId: 'session:1' }),
      /developer test identity is forbidden/,
    );
  }
});
test('developer session keeps account identity distinct from runtime session identity', () => {
  const auth = createDeveloperTestSession({
    environment: LOCAL_DEVELOPMENT_ENVIRONMENT,
    accountId: 'dev-account:alice',
    sessionId: 'dev-session:browser-a',
  });

  assert.deepEqual(auth.identity, { accountId: 'dev-account:alice', authProvider: 'developer-test' });
  assert.deepEqual(auth.session, {
    sessionId: 'dev-session:browser-a',
    accountId: 'dev-account:alice',
    authProvider: 'developer-test',
  });
  assert.deepEqual(auth.actor, { sessionId: 'dev-session:browser-a' });
  assert.equal(Object.hasOwn(auth.actor, 'accountId'), false);
});

test('authoritative world namespace must match the runtime environment', async () => {
  const validWorld = createInitialWorld({
    nowMs: 1000,
    worldId: LOCAL_DEVELOPMENT_ENVIRONMENT.worldNamespace,
  });
  assert.equal(assertWorldNamespace(validWorld, LOCAL_DEVELOPMENT_ENVIRONMENT), validWorld);

  const wrongStore = new MemoryGameStore(createInitialWorld({ nowMs: 1000, worldId: 'closed-beta-wipe:other-world' }));  const { runtime } = createGame({
    store: wrongStore,
    now: () => 1000,
    runtimeEnvironment: LOCAL_DEVELOPMENT_ENVIRONMENT,
  });
  await assert.rejects(
    runtime.dispatch({
      actor: { sessionId: 'dev-session:1' },
      requestId: 'birth',
      action: { type: 'character.birth', payload: { name: '隔離測試者' } },
    }),
    /world namespace does not match runtime environment/,
  );
});

test('development game factory binds the existing dev world id as its namespace', () => {
  const { store } = createDevelopmentGame({ now: () => 1000 });
  const world = store.snapshot();
  assert.equal(world.worldId, LOCAL_DEVELOPMENT_ENVIRONMENT.worldNamespace);
  assert.equal(world.worldId, 'v2-dev-world');
});

test('runtime environment rejects malformed stages and namespaces', () => {
  assert.throws(() => createRuntimeEnvironment({ stage: 'unknown', worldNamespace: 'test' }), /unsupported runtime stage/);
  assert.throws(() => createRuntimeEnvironment({ stage: RUNTIME_STAGE.DEVELOPMENT_TEST, worldNamespace: '' }), /worldNamespace/);
  assert.throws(() => createRuntimeEnvironment({ stage: RUNTIME_STAGE.DEVELOPMENT_TEST, worldNamespace: ' padded ' }), /worldNamespace/);
});
