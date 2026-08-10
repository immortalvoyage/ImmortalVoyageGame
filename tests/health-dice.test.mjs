import assert from 'node:assert/strict';
import test from 'node:test';
import { HealthState } from '../src/modules/health/index.js';
import { resolveDiceCheck, resolveOpposedCheck } from '../src/modules/rules/index.js';

test('health damage and healing stay within bounds', () => {
  const health = new HealthState({ health: 50, maxHealth: 100 });
  health.applyDamage(80);
  assert.equal(health.health, 0);
  assert.equal(health.isIncapacitated, true);
  health.heal(30);
  assert.equal(health.health, 30);
});

test('conditions are stored separately from raw health', () => {
  const health = new HealthState();
  health.setCondition('dehydrated', 2);
  assert.deepEqual(health.snapshot().conditions, [{ id: 'dehydrated', severity: 2 }]);
});

test('dice check resolves modifier and difficulty', () => {
  const result = resolveDiceCheck({ difficulty: 15, modifier: 4, random: () => 0.5 });
  assert.equal(result.natural, 11);
  assert.equal(result.total, 15);
  assert.equal(result.success, true);
});

test('advantage keeps the higher roll and disadvantage keeps the lower', () => {
  const values = [0.1, 0.9];
  const advantage = resolveDiceCheck({ difficulty: 20, advantage: true, random: () => values.shift() });
  assert.equal(advantage.natural, 19);

  const values2 = [0.1, 0.9];
  const disadvantage = resolveDiceCheck({ difficulty: 20, disadvantage: true, random: () => values2.shift() });
  assert.equal(disadvantage.natural, 3);
});

test('opposed checks return a winner without changing world state', () => {
  const result = resolveOpposedCheck({ attackerModifier: 3, defenderModifier: 1, attackerRandom: () => 0.5, defenderRandom: () => 0.4 });
  assert.equal(result.winner, 'attacker');
});
