import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';
import { createDevelopmentGame } from '../src/game.js';

const actor = { sessionId: 'external-route-staging-session' };

async function dispatch(runtime, requestId, type, payload = {}) {
  return runtime.dispatch({ actor, requestId, action: { type, payload } });
}

test('external route staging is an optional backend-only Content Pack marker', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
  assert.equal(firstSettlementPack.locations['first-outskirts'].externalRouteStaging, true);
  assert.equal(
    Object.values(firstSettlementPack.locations).filter((location) => location.externalRouteStaging === true).length,
    1,
  );

  const malformed = structuredClone(firstSettlementPack);
  malformed.locations['first-outskirts'].externalRouteStaging = false;
  assert.throws(() => validateContentPack(malformed), /externalRouteStaging must be true when declared/);
});

test('staging marker does not invent a public destination or authorize travel outside the active pack', async () => {
  const game = createDevelopmentGame({ contentPack: firstSettlementPack, now: () => 1000 });
  await dispatch(game.runtime, 'birth', 'character.birth', { name: '出城旅人' });
  await dispatch(game.runtime, 'to-outskirts', 'location.travel', { destinationId: 'first-outskirts' });

  const observed = await dispatch(game.runtime, 'observe-outskirts', 'location.observe');
  assert.equal(observed.code, 'OBSERVED');
  assert.equal(observed.data.location.id, 'first-outskirts');
  assert.equal('externalRouteStaging' in observed.data.location, false);
  assert.deepEqual(observed.data.routes.map((route) => route.id), ['first-square']);

  const before = game.store.snapshot();
  const forged = await dispatch(game.runtime, 'forged-external-travel', 'location.travel', {
    destinationId: 'unknown-external-destination',
  });
  assert.equal(forged.code, 'ROUTE_NOT_AVAILABLE');
  assert.deepEqual(game.store.snapshot(), before);
});