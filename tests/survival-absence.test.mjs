import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyElapsedSurvival,
  resolveCharacterSurvival,
  survivalElapsedSecondsForCharacter,
  survivalExposureDeltaForCharacter,
} from '../src/modules/survival/elapsed.js';

function character(locationId = 'shelter') {
  return {
    locationId,
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    lastActiveLogicalTimeSeconds: 0,
    lastSurvivalResolvedLogicalTimeSeconds: 0,
  };
}

const contentPack = {
  locations: {
    shelter: { shelter: { absenceSurvivalCapSeconds: 6 * 60 * 60 } },
    street: {},
  },
};

test('safe shelter caps survival exposure for one uninterrupted long request gap', () => {
  const current = character('shelter');
  assert.equal(survivalElapsedSecondsForCharacter(current, 72 * 60 * 60, contentPack), 6 * 60 * 60);
  applyElapsedSurvival(current, 72 * 60 * 60, contentPack);
  assert.deepEqual(current.needs, { hunger: 12, thirst: 18, fatigue: 6 });
});

test('ordinary locations keep full lazy elapsed survival pressure', () => {
  const current = character('street');
  assert.equal(survivalElapsedSecondsForCharacter(current, 72 * 60 * 60, contentPack), 72 * 60 * 60);
  applyElapsedSurvival(current, 72 * 60 * 60, contentPack);
  assert.deepEqual(current.needs, { hunger: 100, thirst: 100, fatigue: 72 });
});

test('lower-level gap helper preserves ordinary short elapsed behavior', () => {
  const current = character('shelter');
  applyElapsedSurvival(current, 2 * 60 * 60, contentPack);
  applyElapsedSurvival(current, 2 * 60 * 60, contentPack);
  assert.deepEqual(current.needs, { hunger: 8, thirst: 12, fatigue: 4 });
});

test('fractional need progress remains exact under shelter protection', () => {
  const current = character('shelter');
  applyElapsedSurvival(current, 1799, contentPack);
  assert.deepEqual(current.needs, { hunger: 0, thirst: 1, fatigue: 0 });
  assert.deepEqual(current.needProgressSeconds, { hunger: 1799, thirst: 599, fatigue: 1799 });
  applyElapsedSurvival(current, 1, contentPack);
  assert.deepEqual(current.needs, { hunger: 1, thirst: 1, fatigue: 0 });
  assert.deepEqual(current.needProgressSeconds, { hunger: 0, thirst: 600, fatigue: 1800 });
});

test('shared-world hourly resolutions cannot reset one offline character shelter cap', () => {
  const current = character('shelter');
  let chargedSeconds = 0;
  for (let hour = 1; hour <= 72; hour += 1) {
    const logicalTimeSeconds = hour * 60 * 60;
    const delta = survivalExposureDeltaForCharacter(current, logicalTimeSeconds, contentPack);
    chargedSeconds += delta;
    resolveCharacterSurvival(current, logicalTimeSeconds, contentPack);
  }

  assert.equal(chargedSeconds, 6 * 60 * 60);
  assert.deepEqual(current.needs, { hunger: 12, thirst: 18, fatigue: 6 });
  assert.equal(current.lastActiveLogicalTimeSeconds, 0);
  assert.equal(current.lastSurvivalResolvedLogicalTimeSeconds, 72 * 60 * 60);
});

test('the character own later activity starts a new shelter absence episode', () => {
  const current = character('shelter');
  for (let hour = 1; hour <= 72; hour += 1) {
    resolveCharacterSurvival(current, hour * 60 * 60, contentPack);
  }
  assert.deepEqual(current.needs, { hunger: 12, thirst: 18, fatigue: 6 });

  current.lastActiveLogicalTimeSeconds = 72 * 60 * 60;
  const charged = resolveCharacterSurvival(current, 73 * 60 * 60, contentPack);
  assert.equal(charged, 60 * 60);
  assert.deepEqual(current.needs, { hunger: 14, thirst: 21, fatigue: 7 });
});
