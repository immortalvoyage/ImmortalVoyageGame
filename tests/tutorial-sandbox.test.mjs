import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorialVillagePack } from '../src/content/tutorial-village.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { LOCAL_DEVELOPMENT_ENVIRONMENT, LOCAL_TUTORIAL_ENVIRONMENT, RUNTIME_STAGE } from '../src/core/runtime-environment.js';
import { createDevelopmentGame, createTutorialDevelopmentGame } from '../src/game.js';

const actor = { accountId: 'account:tutorial', sessionId: 'session:tutorial' };

async function dispatch(runtime, requestId, type, payload = {}, acting = actor) {
  return runtime.dispatch({ actor: acting, requestId, action: { type, payload } });
}

test('tutorial Content Pack is valid and uses its isolated development namespace', () => {
  assert.equal(validateContentPack(tutorialVillagePack), tutorialVillagePack);
  const tutorial = createTutorialDevelopmentGame({ now: () => 1000 });
  const world = tutorial.store.snapshot();
  assert.equal(world.worldId, LOCAL_TUTORIAL_ENVIRONMENT.worldNamespace);
  assert.equal(world.worldId, 'v2-tutorial-world');
  assert.notEqual(world.worldId, LOCAL_DEVELOPMENT_ENVIRONMENT.worldNamespace);
  assert.equal(LOCAL_TUTORIAL_ENVIRONMENT.stage, RUNTIME_STAGE.DEVELOPMENT_TEST);
  assert.equal(LOCAL_TUTORIAL_ENVIRONMENT.disposableGameplay, true);
  assert.deepEqual(world.pendingLives, {});
  assert.deepEqual(world.characters, {});
});

test('tutorial activity cannot mutate the canonical Pending Life world', async () => {
  const canonical = createDevelopmentGame({ now: () => 1000 });
  const pending = await dispatch(canonical.runtime, 'pending', 'life.create-pending');
  assert.equal(pending.code, 'PENDING_LIFE_CREATED');
  const canonicalBefore = canonical.store.snapshot();

  const tutorial = createTutorialDevelopmentGame({ now: () => 1000 });
  assert.equal((await dispatch(tutorial.runtime, 'birth', 'character.birth', { name: '教學旅人' })).ok, true);
  assert.equal((await dispatch(tutorial.runtime, 'work-start', 'employment.accept', { jobId: 'tutorial-odd-job' })).ok, true);
  assert.equal((await dispatch(tutorial.runtime, 'work', 'economy.work', { jobId: 'tutorial-odd-job' })).ok, true);
  assert.equal((await dispatch(tutorial.runtime, 'buy', 'economy.buy', { itemId: 'tutorial-bread' })).ok, true);
  assert.equal((await dispatch(tutorial.runtime, 'eat', 'survival.consume', { itemId: 'tutorial-bread' })).ok, true);

  assert.deepEqual(canonical.store.snapshot(), canonicalBefore);
  assert.equal(tutorial.store.snapshot().characters[actor.sessionId].money, 1);
  assert.deepEqual(tutorial.store.snapshot().pendingLives, {});
});

test('discarding tutorial runtime drops tutorial assets without rerolling canonical birth instant', async () => {
  const canonical = createDevelopmentGame({ now: () => 1000 });
  const pending = await dispatch(canonical.runtime, 'pending-reset', 'life.create-pending');
  const birthWorldInstant = pending.data.pendingLife.birthWorldInstant;

  const firstTutorial = createTutorialDevelopmentGame({ now: () => 1000 });
  await dispatch(firstTutorial.runtime, 'birth-a', 'character.birth', { name: '第一輪教學' });
  await dispatch(firstTutorial.runtime, 'accept-a', 'employment.accept', { jobId: 'tutorial-odd-job' });
  await dispatch(firstTutorial.runtime, 'work-a', 'economy.work', { jobId: 'tutorial-odd-job' });
  assert.equal(firstTutorial.store.snapshot().characters[actor.sessionId].money, 2);

  const secondTutorial = createTutorialDevelopmentGame({ now: () => 60_000 });
  assert.deepEqual(secondTutorial.store.snapshot().characters, {});
  const stillPending = await dispatch(canonical.runtime, 'pending-again', 'life.create-pending');
  assert.deepEqual(stillPending.data.pendingLife.birthWorldInstant, birthWorldInstant);
});

test('tutorial runtime excludes formal life mutations and keeps deterministic fallback playable', async () => {
  const tutorial = createTutorialDevelopmentGame({ now: () => 1000 });
  assert.equal((await dispatch(tutorial.runtime, 'formal-life', 'life.create-pending')).code, 'UNKNOWN_ACTION');
  assert.deepEqual(tutorial.store.snapshot().pendingLives, {});

  await dispatch(tutorial.runtime, 'birth-scene', 'character.birth', { name: '教學場景者' });
  const scene = await dispatch(tutorial.runtime, 'scene', 'narrative.scene');
  assert.equal(scene.ok, true);
  assert.equal(scene.data.location.name, '新手村廣場');
  assert.equal(scene.data.narrative.mode, 'deterministic-fallback');
  assert.equal(JSON.stringify(scene.data).includes('ziwei'), false);
  assert.equal(JSON.stringify(scene.data).includes('命盤'), false);
});

test('invalid tutorial action fails without mutating the disposable sandbox', async () => {
  const tutorial = createTutorialDevelopmentGame({ now: () => 1000 });
  await dispatch(tutorial.runtime, 'birth-fail', 'character.birth', { name: '邊界測試者' });
  const before = tutorial.store.snapshot();
  const bad = await dispatch(tutorial.runtime, 'bad-route', 'location.travel', { destinationId: 'formal-world' });
  assert.equal(bad.code, 'ROUTE_NOT_AVAILABLE');
  assert.deepEqual(tutorial.store.snapshot(), before);
});
