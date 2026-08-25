import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeveloperTestSession } from '../src/core/auth-session.js';
import { LOCAL_DEVELOPMENT_ENVIRONMENT } from '../src/core/runtime-environment.js';
import { GAME_EPOCH_ID } from '../src/core/world-calendar.js';
import { createDevelopmentGame, createFileBackedDevelopmentGame } from '../src/game.js';

function actor(accountId, sessionId) {
  return createDeveloperTestSession({
    environment: LOCAL_DEVELOPMENT_ENVIRONMENT,
    accountId,
    sessionId,
  }).actor;
}

async function createPending(runtime, acting, requestId) {
  return runtime.dispatch({
    actor: acting,
    requestId,
    action: { type: 'life.create-pending', payload: {} },
  });
}

test('pending life requires trusted account identity and does not create an active character', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  const rejected = await createPending(runtime, { sessionId: 'session-only' }, 'missing-account');
  assert.equal(rejected.code, 'ACCOUNT_ID_REQUIRED');
  assert.deepEqual(store.snapshot().pendingLives, {});

  const result = await createPending(runtime, actor('account:alice', 'session:a'), 'create-alice');
  assert.equal(result.code, 'PENDING_LIFE_CREATED');
  assert.deepEqual(result.data.pendingLife, {
    status: 'pending',
    birthWorldInstant: { epochId: GAME_EPOCH_ID, offsetSeconds: 0 },
  });
  assert.equal(Object.hasOwn(result.data.pendingLife, 'ownerAccountId'), false);
  assert.deepEqual(store.snapshot().characters, {});

  assert.deepEqual(store.snapshot().pendingLives['account:alice'], {
    ownerAccountId: 'account:alice',
    status: 'pending',
    birthWorldInstant: { epochId: GAME_EPOCH_ID, offsetSeconds: 0 },
    createdLogicalTimeSeconds: 0,
  });
});

test('pending life birth instant is stable across replay, elapsed time, and session rotation', async () => {
  let now = 1000;
  const { runtime, store } = createDevelopmentGame({ now: () => now });
  const firstActor = actor('account:alice', 'session:a');
  const first = await createPending(runtime, firstActor, 'create-1');
  const replay = await createPending(runtime, firstActor, 'create-1');
  assert.deepEqual(replay, first);

  now += 2 * 60 * 60 * 1000;
  const rotated = await createPending(runtime, actor('account:alice', 'session:b'), 'create-2');
  assert.equal(rotated.code, 'PENDING_LIFE_READY');
  assert.deepEqual(rotated.data.pendingLife.birthWorldInstant, first.data.pendingLife.birthWorldInstant);
  assert.equal(store.snapshot().logicalTimeSeconds, 2 * 60 * 60);
  assert.equal(store.snapshot().pendingLives['account:alice'].birthWorldInstant.offsetSeconds, 0);
  assert.equal(store.snapshot().gameEvents.filter((event) => event.type === 'life.pending-created').length, 1);

  const other = await createPending(runtime, actor('account:bob', 'session:c'), 'create-bob');
  assert.equal(other.code, 'PENDING_LIFE_CREATED');
  assert.equal(other.data.pendingLife.birthWorldInstant.offsetSeconds, 2 * 60 * 60);
});

test('file-backed pending life survives runtime restart without rerolling birth time', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'iv-pending-life-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, 'world.json');

  const firstGame = createFileBackedDevelopmentGame({ filePath, now: () => 5000 });
  const first = await createPending(firstGame.runtime, actor('account:persist', 'session:first'), 'pending-first');
  assert.equal(first.code, 'PENDING_LIFE_CREATED');

  const secondGame = createFileBackedDevelopmentGame({ filePath, now: () => 65_000 });
  const afterRestart = await createPending(
    secondGame.runtime,
    actor('account:persist', 'session:second'),
    'pending-after-restart',
  );
  assert.equal(afterRestart.code, 'PENDING_LIFE_READY');
  assert.deepEqual(afterRestart.data.pendingLife.birthWorldInstant, first.data.pendingLife.birthWorldInstant);
  const stored = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(stored.pendingLives['account:persist'].birthWorldInstant.offsetSeconds, 0);
});

test('pending life rejects malformed account actors and feature flag off leaves core usable', async () => {
  const enabled = createDevelopmentGame({ now: () => 1000 });
  const malformed = await createPending(enabled.runtime, { sessionId: 'session:forged', accountId: ' padded ' }, 'malformed-account');
  assert.equal(malformed.code, 'ACCOUNT_ID_REQUIRED');
  assert.deepEqual(enabled.store.snapshot().pendingLives, {});

  const disabled = createDevelopmentGame({ now: () => 1000, enabledModules: ['character', 'inventory', 'location'] });
  const unavailable = await createPending(disabled.runtime, actor('account:disabled', 'session:disabled'), 'disabled-life');
  assert.equal(unavailable.code, 'UNKNOWN_ACTION');
  assert.deepEqual(disabled.store.snapshot().pendingLives, {});
});
