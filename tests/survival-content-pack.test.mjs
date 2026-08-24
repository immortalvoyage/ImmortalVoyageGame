import test from 'node:test';
import assert from 'node:assert/strict';
import { devStarterPack } from '../src/content/dev-starter.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(devStarterPack);
}

test('survival warning, critical, and rest tuning validate in the development Content Pack', () => {
  assert.equal(validateContentPack(devStarterPack), devStarterPack);
});

test('survival condition thresholds must be ordered and bounded', () => {
  const reversed = clonePack();
  reversed.survival.warningThreshold = 90;
  reversed.survival.criticalThreshold = 85;
  assert.throws(() => validateContentPack(reversed), /warningThreshold must be lower than criticalThreshold/);

  const invalidWarning = clonePack();
  invalidWarning.survival.warningThreshold = 0;
  assert.throws(() => validateContentPack(invalidWarning), /warningThreshold must be an integer/);

  const invalidCritical = clonePack();
  invalidCritical.survival.criticalThreshold = 101;
  assert.throws(() => validateContentPack(invalidCritical), /criticalThreshold must be an integer/);
});

test('basic rest relief must be a positive bounded integer', () => {
  const zero = clonePack();
  zero.survival.restFatigueRelief = 0;
  assert.throws(() => validateContentPack(zero), /restFatigueRelief must be an integer/);

  const tooLarge = clonePack();
  tooLarge.survival.restFatigueRelief = 101;
  assert.throws(() => validateContentPack(tooLarge), /restFatigueRelief must be an integer/);
});
