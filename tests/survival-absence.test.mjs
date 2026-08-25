import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyElapsedSurvival,
  survivalElapsedSecondsForCharacter,
} from '../src/modules/survival/elapsed.js';

function character(locationId = 'shelter') {
  return {
    locationId,
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
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

test('shelter cap is per uninterrupted gap and does not erase normal active elapsed time', () => {
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
