import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentGame } from '../src/game.js';

const first = { sessionId: 'parallel-player-a' };
const second = { sessionId: 'parallel-player-b' };

function dispatch(runtime, actor, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('concurrent independent player actions preserve both authoritative mutations', async () => {
  const game = createDevelopmentGame({ now: () => 1000 });
  await dispatch(game.runtime, first, 'birth-a', 'character.birth', { name: '並行甲' });
  await dispatch(game.runtime, second, 'birth-b', 'character.birth', { name: '並行乙' });
  await dispatch(game.runtime, first, 'job-a', 'employment.accept', { jobId: 'starter-labor' });
  await dispatch(game.runtime, second, 'job-b', 'employment.accept', { jobId: 'starter-labor' });

  const [workedA, workedB] = await Promise.all([
    dispatch(game.runtime, first, 'work-a', 'economy.work', { jobId: 'starter-labor' }),
    dispatch(game.runtime, second, 'work-b', 'economy.work', { jobId: 'starter-labor' }),
  ]);

  assert.equal(workedA.code, 'WORK_COMPLETED');
  assert.equal(workedB.code, 'WORK_COMPLETED');
  const world = game.store.snapshot();
  assert.equal(world.characters[first.sessionId].money, 2);
  assert.equal(world.characters[second.sessionId].money, 2);
  assert.equal(world.requestOrder.filter((id) => id === 'work-a').length, 1);
  assert.equal(world.requestOrder.filter((id) => id === 'work-b').length, 1);
  assert.equal(world.gameEvents.filter((event) => event.type === 'economy.money-created').length, 2);
});
