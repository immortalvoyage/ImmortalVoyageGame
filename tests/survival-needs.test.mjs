import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../src/modules/inventory/index.js';
import { SurvivalNeeds, resolveConsume } from '../src/modules/survival/index.js';

test('eating gathered food consumes one item and restores hunger', () => {
  const inventory = new Inventory();
  const needs = new SurvivalNeeds({ hunger: 40, thirst: 50 });
  inventory.add('wild-berry', 2);

  const result = resolveConsume({ inventory, needs, item: { itemId: 'wild-berry', hunger: 15 } });

  assert.equal(result.allowed, true);
  assert.equal(inventory.get('wild-berry'), 1);
  assert.equal(needs.hunger, 55);
  assert.equal(needs.thirst, 50);
});

test('drinking water consumes one item and restores thirst', () => {
  const inventory = new Inventory();
  const needs = new SurvivalNeeds({ hunger: 70, thirst: 20 });
  inventory.add('fresh-water', 1);

  const result = resolveConsume({ inventory, needs, item: { itemId: 'fresh-water', thirst: 30 } });

  assert.equal(result.allowed, true);
  assert.equal(inventory.get('fresh-water'), 0);
  assert.equal(needs.thirst, 50);
});

test('needs are capped at 100 and missing inventory cannot be consumed', () => {
  const inventory = new Inventory();
  const needs = new SurvivalNeeds({ hunger: 95, thirst: 95 });
  inventory.add('wild-berry', 1);

  assert.equal(resolveConsume({ inventory, needs, item: { itemId: 'wild-berry', hunger: 20 } }).allowed, true);
  assert.equal(needs.hunger, 100);
  assert.equal(resolveConsume({ inventory, needs, item: { itemId: 'wild-berry', hunger: 20 } }).reason, 'not_in_inventory');
});

test('survival needs can decay without going below zero', () => {
  const needs = new SurvivalNeeds({ hunger: 10, thirst: 5 });
  needs.decay({ hunger: 20, thirst: 10 });
  assert.deepEqual(needs.snapshot(), { hunger: 0, thirst: 0 });
});
