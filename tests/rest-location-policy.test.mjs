import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'rest-policy-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

async function setFatigue(game, fatigue) {
  const world = game.store.snapshot();
  world.characters[actor.sessionId].needs.fatigue = fatigue;
  await game.store.replace(world);
}

test('rest config is optional but must have a non-empty public label when present', () => {
  const valid = structuredClone(devStarterPack);
  valid.locations['starter-grove'].rest = { label: '在樹下休息' };
  assert.equal(validateContentPack(valid), valid);

  const malformed = structuredClone(devStarterPack);
  malformed.locations['starter-square'].rest = { label: '' };
  assert.throws(() => validateContentPack(malformed), /rest\.label must be non-empty text/);

  const wrongShape = structuredClone(devStarterPack);
  wrongShape.locations['starter-square'].rest = true;
  assert.throws(() => validateContentPack(wrongShape), /rest must be an object/);
});

test('rest fails with zero mutation outside a declared legal rest location', async () => {
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '疲憊旅人' });
  await setFatigue(game, 70);
  const before = game.store.snapshot();

  const result = await dispatch(game.runtime, 'rest-square', 'survival.rest');
  assert.equal(result.code, 'REST_NOT_AVAILABLE');
  assert.deepEqual(game.store.snapshot(), before);

  const scene = await dispatch(game.runtime, 'scene-square', 'narrative.scene');
  assert.equal(scene.data.utilities.some((entry) => entry.intent.type === 'survival.rest'), false);
});

test('declared rest place exposes its Content-Pack label and deterministic fatigue relief', async () => {
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  await dispatch(game.runtime, 'birth-lodging', 'character.birth', { name: '投宿旅人' });
  await setFatigue(game, 70);
  await dispatch(game.runtime, 'to-lodging', 'location.travel', { destinationId: 'first-lodging' });

  const scene = await dispatch(game.runtime, 'scene-lodging', 'narrative.scene');
  const rest = scene.data.utilities.find((entry) => entry.intent.type === 'survival.rest');
  assert.deepEqual(rest, { label: '在公共通鋪休息', intent: { type: 'survival.rest', payload: {} } });

  const before = game.store.snapshot().characters[actor.sessionId].needs.fatigue;
  const result = await dispatch(game.runtime, 'rest-lodging', 'survival.rest');
  assert.equal(result.code, 'REST_COMPLETED');
  assert.equal(game.store.snapshot().characters[actor.sessionId].needs.fatigue, Math.max(0, before - 25));
});

test('dev starter keeps existing rest recovery paths where regression tests depend on them', async () => {
  const game = createDevelopmentGame({ contentPack: devStarterPack, now: () => 1000 });
  await dispatch(game.runtime, 'birth-dev', 'character.birth', { name: '開發旅人' });
  await setFatigue(game, 90);
  assert.equal((await dispatch(game.runtime, 'rest-square-dev', 'survival.rest')).code, 'REST_COMPLETED');
  await dispatch(game.runtime, 'to-well-dev', 'location.travel', { destinationId: 'starter-well' });
  await setFatigue(game, 90);
  assert.equal((await dispatch(game.runtime, 'rest-well-dev', 'survival.rest')).code, 'REST_COMPLETED');
});
