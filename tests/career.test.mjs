import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'career-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('career identity emerges from repeated behavior instead of character creation choice', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  const born = await dispatch(runtime, 'birth', 'character.birth', { name: '無職旅人' });
  assert.equal(born.data.character.behaviorCounts, undefined);

  let scene = await dispatch(runtime, 'scene-0', 'narrative.scene');
  assert.deepEqual(scene.data.careers, []);

  for (let i = 1; i <= 2; i += 1) {
    await dispatch(runtime, `work-${i}`, 'economy.work', { jobId: 'starter-labor' });
  }
  scene = await dispatch(runtime, 'scene-2', 'narrative.scene');
  assert.deepEqual(scene.data.careers, []);

  await dispatch(runtime, 'work-3', 'economy.work', { jobId: 'starter-labor' });
  scene = await dispatch(runtime, 'scene-3', 'narrative.scene');
  assert.deepEqual(scene.data.careers, [{ name: '聚落雜役熟手' }]);
  assert.equal(store.snapshot().characters['career-session'].behaviorCounts['work:starter-labor'], 3);
});

test('work request idempotency cannot accelerate career progress', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-idempotent', 'character.birth', { name: '重試旅人' });
  const first = await dispatch(runtime, 'same-work', 'economy.work', { jobId: 'starter-labor' });
  const replay = await dispatch(runtime, 'same-work', 'economy.work', { jobId: 'starter-labor' });
  assert.deepEqual(replay, first);
  assert.equal(store.snapshot().characters['career-session'].behaviorCounts['work:starter-labor'], 1);
  assert.equal(
    store.snapshot().gameEvents.filter((event) => event.type === 'character.behavior-recorded').length,
    1,
  );
});

test('invalid work does not record behavior', async () => {
  const { runtime, store } = createDevelopmentGame({ now: () => 1000 });
  await dispatch(runtime, 'birth-invalid', 'character.birth', { name: '謹慎旅人' });
  const before = store.snapshot();
  const result = await dispatch(runtime, 'bad-work', 'economy.work', { jobId: 'missing-job' });
  assert.equal(result.code, 'WORK_NOT_AVAILABLE');
  assert.deepEqual(store.snapshot(), before);
});

test('disabling Career Module hides identities without breaking work progression', async () => {
  const { runtime, store } = createDevelopmentGame({
    now: () => 1000,
    enabledModules: ['character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'crafting', 'narrative'],
  });
  await dispatch(runtime, 'birth-disabled', 'character.birth', { name: '匿名旅人' });
  for (let i = 1; i <= 3; i += 1) {
    await dispatch(runtime, `disabled-work-${i}`, 'economy.work', { jobId: 'starter-labor' });
  }
  assert.equal(store.snapshot().characters['career-session'].behaviorCounts['work:starter-labor'], 3);
  const scene = await dispatch(runtime, 'disabled-scene', 'narrative.scene');
  assert.deepEqual(scene.data.careers, []);
  assert.equal((await dispatch(runtime, 'career-disabled', 'career.observe')).code, 'UNKNOWN_ACTION');
});
