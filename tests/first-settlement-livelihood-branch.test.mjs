import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'livelihood-branch-player' };
const dispatch = (runtime, requestId, type, payload = {}) => runtime.dispatch({ actor, requestId, action: { type, payload } });

test('formal player can leave one livelihood, take another, and retain both earned identities', async () => {
  const { runtime, store } = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  assert.equal((await dispatch(runtime, 'birth', 'character.birth', { name: '轉業旅人' })).ok, true);
  assert.equal((await dispatch(runtime, 'carry-job', 'employment.accept', { jobId: 'first-carrying-work' })).code, 'EMPLOYMENT_STARTED');
  for (let i = 1; i <= 3; i += 1) {
    assert.equal((await dispatch(runtime, `carry-${i}`, 'economy.work', { jobId: 'first-carrying-work' })).code, 'WORK_COMPLETED');
  }
  assert.equal((await dispatch(runtime, 'resign-carry', 'employment.resign')).code, 'EMPLOYMENT_ENDED');
  assert.equal((await dispatch(runtime, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' })).code, 'TRAVEL_COMPLETED');

  const lodgingScene = await dispatch(runtime, 'lodging-scene', 'narrative.scene');
  assert.ok(lodgingScene.data.narrative.options.some(
    (entry) => entry.intent.type === 'employment.accept' && entry.intent.payload.jobId === 'first-lodging-work',
  ));
  assert.equal((await dispatch(runtime, 'lodging-job', 'employment.accept', { jobId: 'first-lodging-work' })).code, 'EMPLOYMENT_STARTED');
  for (let i = 1; i <= 3; i += 1) {
    assert.equal((await dispatch(runtime, `lodging-${i}`, 'economy.work', { jobId: 'first-lodging-work' })).code, 'WORK_COMPLETED');
  }

  const scene = await dispatch(runtime, 'formed-life', 'narrative.scene');
  assert.deepEqual(scene.data.careers.map((career) => career.name).sort(), ['宿所雜役熟手', '聚落短工熟手'].sort());
  assert.deepEqual(scene.data.progression.socialTags.map((tag) => tag.name).sort(), ['宿所熟面孔', '搬運熟手'].sort());
  assert.equal(scene.data.employment.current.job.title, '宿所雜役');
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['work:first-carrying'], 3);
  assert.equal(store.snapshot().characters[actor.sessionId].behaviorCounts['work:first-lodging'], 3);
  assert.equal(JSON.stringify(scene.data.careers).includes('requirements'), false);
  assert.equal(JSON.stringify(scene.data.progression).includes('behaviorId'), false);
});


