import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'activity-session' };
const HOUR_MS = 60 * 60 * 1000;

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('successful actor requests mark private logical activity while replay and failed actions do not', async () => {
  let nowMs = 1000;
  const game = createDevelopmentGame({ now: () => nowMs });

  const born = await dispatch(game.runtime, 'birth', 'character.birth', { name: '活動旅人' });
  assert.equal(born.ok, true);
  assert.equal(born.data.character.lastActiveLogicalTimeSeconds, undefined);
  assert.equal(born.data.character.lastSurvivalResolvedLogicalTimeSeconds, undefined);

  let character = game.store.snapshot().characters[actor.sessionId];
  assert.equal(character.lastActiveLogicalTimeSeconds, 0);
  assert.equal(character.lastSurvivalResolvedLogicalTimeSeconds, 0);

  nowMs += HOUR_MS;
  const firstScene = await dispatch(game.runtime, 'scene-once', 'narrative.scene');
  assert.equal(firstScene.ok, true);
  character = game.store.snapshot().characters[actor.sessionId];
  assert.equal(game.store.snapshot().logicalTimeSeconds, 60 * 60);
  assert.equal(character.lastActiveLogicalTimeSeconds, 60 * 60);
  assert.equal(character.lastSurvivalResolvedLogicalTimeSeconds, 60 * 60);

  nowMs += HOUR_MS;
  const beforeReplay = game.store.snapshot();
  const replay = await dispatch(game.runtime, 'scene-once', 'narrative.scene');
  assert.deepEqual(replay, firstScene);
  assert.deepEqual(game.store.snapshot(), beforeReplay);

  const beforeFailure = game.store.snapshot();
  const failed = await dispatch(game.runtime, 'unknown-action', 'test.not-registered');
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'UNKNOWN_ACTION');
  assert.deepEqual(game.store.snapshot(), beforeFailure);

  const secondScene = await dispatch(game.runtime, 'scene-two', 'narrative.scene');
  assert.equal(secondScene.ok, true);
  character = game.store.snapshot().characters[actor.sessionId];
  assert.equal(game.store.snapshot().logicalTimeSeconds, 2 * 60 * 60);
  assert.equal(character.lastActiveLogicalTimeSeconds, 2 * 60 * 60);
  assert.equal(character.lastSurvivalResolvedLogicalTimeSeconds, 2 * 60 * 60);
});
