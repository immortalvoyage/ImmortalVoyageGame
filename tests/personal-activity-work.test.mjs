import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'activity-session' };
const dispatch = (runtime, requestId, type, payload = {}) => runtime.dispatch({ actor, requestId, action: { type, payload } });

test('formal work uses authoritative personal activity time and cannot be click-spammed', async () => {
  let now = 1000;
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => now });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '行旅者' });
  await dispatch(game.runtime, 'accept', 'employment.accept', { jobId: 'first-carrying-work' });

  const started = await dispatch(game.runtime, 'work-1', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal(started.code, 'WORK_STARTED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 0);
  assert.equal(game.store.snapshot().characters[actor.sessionId].behaviorCounts['work:first-carrying'] ?? 0, 0);
  assert.equal((await dispatch(game.runtime, 'work-2', 'economy.work', { jobId: 'first-carrying-work' })).code, 'ACTIVITY_ALREADY_ACTIVE');

  for (let index = 0; index < 20; index += 1) {
    assert.equal((await dispatch(game.runtime, `spam-${index}`, 'economy.work', { jobId: 'first-carrying-work' })).code, 'ACTIVITY_ALREADY_ACTIVE');
  }
  assert.equal(game.store.snapshot().logicalTimeSeconds, 0);
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 0);

  now += 5 * 60 * 1000;
  await dispatch(game.runtime, 'scene-after-time', 'narrative.scene');
  const character = game.store.snapshot().characters[actor.sessionId];
  assert.equal(character.activeActivity, null);
  assert.equal(character.money, 2);
  assert.equal(character.behaviorCounts['work:first-carrying'], 1);
  assert.equal(game.store.snapshot().gameEvents.filter((event) => event.type === 'economy.money-created').length, 1);
});

test('work completion is lazy and cannot settle twice across later requests', async () => {
  let now = 1000;
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => now });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '守時者' });
  await dispatch(game.runtime, 'accept', 'employment.accept', { jobId: 'first-carrying-work' });
  const first = await dispatch(game.runtime, 'work', 'economy.work', { jobId: 'first-carrying-work' });
  assert.equal((await dispatch(game.runtime, 'work', 'economy.work', { jobId: 'first-carrying-work' })).code, first.code);
  now += 10 * 60 * 1000;
  await dispatch(game.runtime, 'scene-1', 'narrative.scene');
  await dispatch(game.runtime, 'scene-2', 'narrative.scene');
  const character = game.store.snapshot().characters[actor.sessionId];
  assert.equal(character.money, 2);
  assert.equal(character.behaviorCounts['work:first-carrying'], 1);
});


test('active formal work is projected without exposing authoritative activity internals', async () => {
  let now = 1000;
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => now });
  await dispatch(game.runtime, 'birth-presentation', 'character.birth', { name: '\u5de5\u4f5c\u65c5\u4eba' });
  await dispatch(game.runtime, 'accept-presentation', 'employment.accept', { jobId: 'first-carrying-work' });
  await dispatch(game.runtime, 'start-presentation', 'economy.work', { jobId: 'first-carrying-work' });
  const scene = await dispatch(game.runtime, 'scene-presentation', 'narrative.scene');
  assert.equal(scene.data.activity.kind, 'work');
  assert.equal(scene.data.activity.remainingSeconds, 300);
  assert.equal(typeof scene.data.activity.label, 'string');
  assert.equal(JSON.stringify(scene.data.activity).includes('jobId'), false);
  assert.equal(JSON.stringify(scene.data.activity).includes('behaviorId'), false);
  assert.equal(JSON.stringify(scene.data.activity).includes('rewardMoney'), false);
  assert.equal(JSON.stringify(scene.data.activity).includes('needCosts'), false);
});
