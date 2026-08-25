import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSettlementPack } from '../src/content/first-settlement.js';
import { validateContentPack } from '../src/content/validate-content-pack.js';

function clonePack() {
  return structuredClone(firstSettlementPack);
}

test('first settlement declares a valid bounded shelter absence cap', () => {
  assert.equal(validateContentPack(firstSettlementPack), firstSettlementPack);
  assert.equal(firstSettlementPack.locations['first-lodging'].shelter.absenceSurvivalCapSeconds, 6 * 60 * 60);
});

test('shelter requires a legal rest location', () => {
  const pack = clonePack();
  delete pack.locations['first-lodging'].rest;
  assert.throws(() => validateContentPack(pack), /shelter requires a legal rest location/);
});

test('shelter absence cap must be positive and bounded', () => {
  const zero = clonePack();
  zero.locations['first-lodging'].shelter.absenceSurvivalCapSeconds = 0;
  assert.throws(() => validateContentPack(zero), /absenceSurvivalCapSeconds/);

  const tooLarge = clonePack();
  tooLarge.locations['first-lodging'].shelter.absenceSurvivalCapSeconds = 30 * 24 * 60 * 60 + 1;
  assert.throws(() => validateContentPack(tooLarge), /absenceSurvivalCapSeconds/);

  const fractional = clonePack();
  fractional.locations['first-lodging'].shelter.absenceSurvivalCapSeconds = 1.5;
  assert.throws(() => validateContentPack(fractional), /absenceSurvivalCapSeconds/);
});
