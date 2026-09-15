import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { createDevelopmentGame } from '../src/game.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

const actor = { sessionId: 'qualified-work-player' };
const dispatch = (runtime, requestId, type, payload = {}) => runtime.dispatch({ actor, requestId, action: { type, payload } });

function qualifiedWorkPack() {
  const pack = structuredClone(devStarterPack);
  const baseJob = pack.locations['starter-square'].jobs[0];
  pack.locations['starter-square'].jobs.push({
    id: 'starter-qualified-work', title: '熟手整理', label: '承接熟手整理',
    employerNpcId: baseJob.employerNpcId, behaviorId: 'work:starter-qualified', rewardMoney: 3,
    needCosts: { hunger: 2, thirst: 2, fatigue: 2 },
    requirements: [{ behaviorId: baseJob.behaviorId, minCount: 2 }],
  });
  return pack;
}

test('earned behavior unlocks a better livelihood offer without exposing hidden thresholds', async () => {
  const pack = qualifiedWorkPack();
  validateContentPack(pack);
  const { runtime } = createDevelopmentGame({ contentPack: pack, now: () => 1000 });
  await dispatch(runtime, 'birth', 'character.birth', { name: '熟手旅人' });

  let scene = await dispatch(runtime, 'before', 'narrative.scene');
  assert.equal(scene.data.narrative.options.some((entry) => entry.intent.payload?.jobId === 'starter-qualified-work'), false);
  assert.equal((await dispatch(runtime, 'forged', 'employment.accept', { jobId: 'starter-qualified-work' })).code, 'EMPLOYMENT_REQUIREMENTS_NOT_MET');

  assert.equal((await dispatch(runtime, 'base-job', 'employment.accept', { jobId: baseJobId(pack) })).code, 'EMPLOYMENT_STARTED');
  await dispatch(runtime, 'work-1', 'economy.work', { jobId: baseJobId(pack) });
  await dispatch(runtime, 'work-2', 'economy.work', { jobId: baseJobId(pack) });
  await dispatch(runtime, 'resign', 'employment.resign');

  scene = await dispatch(runtime, 'after', 'narrative.scene');
  const offer = scene.data.narrative.options.find((entry) => entry.intent.payload?.jobId === 'starter-qualified-work');
  assert.ok(offer);
  assert.equal(JSON.stringify(offer).includes('requirements'), false);
  assert.equal(JSON.stringify(offer).includes('behaviorId'), false);
  assert.equal((await dispatch(runtime, 'qualified', 'employment.accept', { jobId: 'starter-qualified-work' })).code, 'EMPLOYMENT_STARTED');
  assert.equal((await dispatch(runtime, 'qualified-work', 'economy.work', { jobId: 'starter-qualified-work' })).data.money, 7);
});

function baseJobId(pack) { return pack.locations['starter-square'].jobs[0].id; }

test('Content Pack rejects livelihood requirements that reference undeclared behavior', () => {
  const pack = qualifiedWorkPack();
  pack.locations['starter-square'].jobs[1].requirements[0].behaviorId = 'work:missing';
  assert.throws(() => validateContentPack(pack), /references unknown behavior/);
});
