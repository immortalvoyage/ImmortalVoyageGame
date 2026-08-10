import assert from 'node:assert/strict';
import test from 'node:test';
import { LocationRegistry, resolveTravel } from '../src/modules/location/index.js';

function createWorld() {
  const registry = new LocationRegistry();
  registry.registerLocation({ id: 'city-east', name: '東城' });
  registry.registerLocation({ id: 'bank', name: '四海錢莊' });
  registry.registerLocation({ id: 'north-gate', name: '北關' });
  registry.registerRoute({ from: 'city-east', to: 'bank', travelCost: 1 });
  registry.registerRoute({ from: 'city-east', to: 'north-gate', travelCost: 2, status: 'war_locked', tags: ['war'] });
  return registry;
}

test('open route can be resolved without declaring arrival', () => {
  const result = resolveTravel({
    registry: createWorld(),
    fromLocationId: 'city-east',
    targetName: '四海錢莊',
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'route_available');
  assert.equal(result.target.id, 'bank');
  assert.equal('arrived' in result, false);
});

test('war locked route is blocked and requires narrative handling', () => {
  const result = resolveTravel({
    registry: createWorld(),
    fromLocationId: 'city-east',
    targetName: '北關',
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'war_locked');
  assert.equal(result.requiresNarrative, true);
});
