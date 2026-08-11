import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttributes, buildCheckModifier, buildSurvivalModifiers } from '../src/modules/character/index.js';

test('attribute modifier and talent bonus combine for a check', () => {
  const attributes = createAttributes({ perception: 14 });
  const talents = [{ modifiers: { perceptionChecks: 1 } }];
  const modifier = buildCheckModifier({ attributes, talents, attribute: 'perception', talentKey: 'perceptionChecks' });
  assert.equal(modifier, 3);
});

test('drought talent lowers thirst rate without removing water need', () => {
  const talents = [{ modifiers: { thirstRate: 0.8 } }];
  const modifiers = buildSurvivalModifiers({ talents });
  assert.equal(modifiers.thirstModifier, 0.8);
  assert.ok(modifiers.thirstModifier > 0);
});

test('environment and talent multiply instead of overwriting each other', () => {
  const talents = [{ modifiers: { thirstRate: 0.8 } }];
  const modifiers = buildSurvivalModifiers({ talents, environment: { thirstModifier: 1.5 } });
  assert.ok(Math.abs(modifiers.thirstModifier - 1.2) < Number.EPSILON * 2);
});
