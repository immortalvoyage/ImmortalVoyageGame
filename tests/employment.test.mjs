import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';
import { devStarterPack } from '../src/content/dev-starter.js';

const actor = { sessionId: 'employment-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function bornGame(options = {}) {
  const game = createDevelopmentGame({ now: () => 1000, ...options });
  const born = await dispatch(game.runtime, 'birth', 'character.birth', { name: '受雇旅人' });
  assert.equal(born.data.character.currentEmployment, undefined);
  return game;
}

function twoJobPack() {
  const pack = structuredClone(devStarterPack);
  pack.npcs.steward = {
    name: '倉務管事',
    locationId: 'starter-square',
    greeting: '倉裡也缺人手。',
  };
  pack.locations['starter-square'].jobs.push({
    id: 'starter-warehouse',
    title: '倉務雜役',
    label: '整理一輪倉務',
    employerNpcId: 'steward',
    behaviorId: 'work:starter-warehouse',
    rewardMoney: 3,
    needCosts: { hunger: 4, thirst: 4 },
  });
  return pack;
}

test('work requires an authoritative employer contract when Employment is enabled', async () => {
  const game = await bornGame();
  const before = game.store.snapshot();

  const forged = await dispatch(game.runtime, 'work-before-employment', 'economy.work', { jobId: 'starter-labor' });
  assert.equal(forged.code, 'EMPLOYMENT_REQUIRED');
  assert.deepEqual(game.store.snapshot(), before);

  const scene = await dispatch(game.runtime, 'scene-before-employment', 'narrative.scene');
  assert.deepEqual(scene.data.employment, { current: null });
  assert.ok(scene.data.narrative.options.some(
    (entry) => entry.intent.type === 'employment.accept' && entry.intent.payload.jobId === 'starter-labor',
  ));
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'), false);
});

test('accepting employment persists one current job and exposes only bounded public contract data', async () => {
  const game = await bornGame();
  const accepted = await dispatch(game.runtime, 'accept', 'employment.accept', { jobId: 'starter-labor' });

  assert.equal(accepted.code, 'EMPLOYMENT_STARTED');
  assert.deepEqual(accepted.data.employment, {
    job: { title: '聚落雜役', workLabel: '做一輪雜役工作' },
    employer: { id: 'foreman', name: '聚落雜役領班' },
    workplace: { id: 'starter-square', name: '開發聚落廣場' },
    wagePerWork: 2,
  });
  assert.equal(JSON.stringify(accepted.data).includes('behaviorId'), false);
  assert.equal(JSON.stringify(accepted.data).includes('needCosts'), false);
  assert.equal(JSON.stringify(accepted.data).includes('jobId'), false);

  const stored = game.store.snapshot().characters[actor.sessionId].currentEmployment;
  assert.deepEqual(stored, {
    jobId: 'starter-labor',
    employerNpcId: 'foreman',
    workLocationId: 'starter-square',
  });
  const scene = await dispatch(game.runtime, 'scene-employed', 'narrative.scene');
  assert.equal(scene.data.employment.current.job.title, '聚落雜役');
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'));
  assert.ok(scene.data.utilities.some((entry) => entry.intent.type === 'employment.resign'));
});

test('employment acceptance and work are request-idempotent and do not duplicate evidence or pay', async () => {
  const game = await bornGame();
  const accepted = await dispatch(game.runtime, 'same-accept', 'employment.accept', { jobId: 'starter-labor' });
  const replayAccept = await dispatch(game.runtime, 'same-accept', 'employment.accept', { jobId: 'missing-job' });
  assert.deepEqual(replayAccept, accepted);

  const firstWork = await dispatch(game.runtime, 'same-work', 'economy.work', { jobId: 'starter-labor' });
  const replayWork = await dispatch(game.runtime, 'same-work', 'economy.work', { jobId: 'starter-labor' });
  assert.deepEqual(replayWork, firstWork);
  assert.equal(game.store.snapshot().characters[actor.sessionId].money, 2);
  assert.equal(game.store.snapshot().gameEvents.filter((event) => event.type === 'employment.started').length, 1);
  assert.equal(game.store.snapshot().gameEvents.filter((event) => event.type === 'economy.money-created').length, 1);
});

test('one current employment prevents silently switching employers until resignation', async () => {
  const game = await bornGame({ contentPack: twoJobPack() });
  await dispatch(game.runtime, 'accept-first', 'employment.accept', { jobId: 'starter-labor' });

  const before = game.store.snapshot();
  const second = await dispatch(game.runtime, 'accept-second', 'employment.accept', { jobId: 'starter-warehouse' });
  assert.equal(second.code, 'EMPLOYMENT_ALREADY_ACTIVE');
  assert.deepEqual(game.store.snapshot(), before);

  const resigned = await dispatch(game.runtime, 'resign', 'employment.resign');
  assert.equal(resigned.code, 'EMPLOYMENT_ENDED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].currentEmployment, null);
  assert.equal((await dispatch(game.runtime, 'work-after-resign', 'economy.work', { jobId: 'starter-labor' })).code, 'EMPLOYMENT_REQUIRED');

  const acceptedSecond = await dispatch(game.runtime, 'accept-second-after-resign', 'employment.accept', { jobId: 'starter-warehouse' });
  assert.equal(acceptedSecond.code, 'EMPLOYMENT_STARTED');
  assert.equal(acceptedSecond.data.employment.job.title, '倉務雜役');
});

test('guessed or remote employment offers fail before mutation', async () => {
  const game = await bornGame();
  const beforeGuess = game.store.snapshot();
  assert.equal((await dispatch(game.runtime, 'guess', 'employment.accept', { jobId: 'missing-job' })).code, 'EMPLOYMENT_OFFER_NOT_AVAILABLE');
  assert.deepEqual(game.store.snapshot(), beforeGuess);

  await dispatch(game.runtime, 'travel', 'location.travel', { destinationId: 'starter-well' });
  const beforeRemote = game.store.snapshot();
  assert.equal((await dispatch(game.runtime, 'remote', 'employment.accept', { jobId: 'starter-labor' })).code, 'EMPLOYMENT_OFFER_NOT_AVAILABLE');
  assert.deepEqual(game.store.snapshot(), beforeRemote);
});

test('Employment Module off removes contract state from presentation and does not leave a hidden work dependency', async () => {
  const enabledModules = [
    'character', 'inventory', 'location', 'npc', 'purpose', 'survival', 'economy', 'trade', 'crafting',
    'progression', 'career', 'relationship', 'knowledge', 'estate', 'situation', 'narrative',
  ];
  const game = await bornGame({ enabledModules });

  assert.equal((await dispatch(game.runtime, 'accept-disabled', 'employment.accept', { jobId: 'starter-labor' })).code, 'UNKNOWN_ACTION');
  const scene = await dispatch(game.runtime, 'scene-disabled', 'narrative.scene');
  assert.equal(scene.data.employment, null);
  assert.ok(scene.data.narrative.options.some((entry) => entry.intent.type === 'economy.work'));
  assert.equal((await dispatch(game.runtime, 'work-disabled', 'economy.work', { jobId: 'starter-labor' })).code, 'WORK_COMPLETED');
});
