import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../src/modules/inventory/index.js';
import { GatherableResourceRegistry, resolveGather } from '../src/modules/resources/index.js';

test('player can gather fruit at current location into inventory', () => {
  const inventory = new Inventory();
  const resources = new GatherableResourceRegistry();
  resources.register({ id: 'berry-bush-1', locationId: 'forest-edge', itemId: 'wild-berry', quantity: 3 });

  const result = resolveGather({
    playerLocationId: 'forest-edge',
    resourceRegistry: resources,
    resourceId: 'berry-bush-1',
    inventory,
    quantity: 2,
  });

  assert.equal(result.allowed, true);
  assert.equal(inventory.get('wild-berry'), 2);
  assert.equal(resources.get('berry-bush-1').quantity, 1);
});

test('player cannot gather a resource from another location', () => {
  const inventory = new Inventory();
  const resources = new GatherableResourceRegistry();
  resources.register({ id: 'spring-1', locationId: 'mountain', itemId: 'fresh-water', quantity: 5 });

  const result = resolveGather({
    playerLocationId: 'village',
    resourceRegistry: resources,
    resourceId: 'spring-1',
    inventory,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'wrong_location');
  assert.equal(inventory.get('fresh-water'), 0);
  assert.equal(resources.get('spring-1').quantity, 5);
});

test('gathering is capped by remaining resource quantity', () => {
  const inventory = new Inventory();
  const resources = new GatherableResourceRegistry();
  resources.register({ id: 'fallen-branch-1', locationId: 'forest-edge', itemId: 'wood', quantity: 1 });

  const result = resolveGather({
    playerLocationId: 'forest-edge',
    resourceRegistry: resources,
    resourceId: 'fallen-branch-1',
    inventory,
    quantity: 5,
  });

  assert.equal(result.quantity, 1);
  assert.equal(resources.get('fallen-branch-1').quantity, 0);
  assert.equal(resources.listAt('forest-edge').length, 0);
});
