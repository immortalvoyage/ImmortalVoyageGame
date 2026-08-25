import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyElapsedSurvival,
  elapsedSinceCharacterActivity,
  survivalElapsedSecondsForCharacter,
} from '../src/modules/survival/elapsed.js';

function character(locationId = 'shelter') {
  return {
    locationId,
    lastActiveLogicalTimeSeconds: 0,
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

test('safe shelter caps survival exposure for one uninterrupted personal absence', () => {
  const current = character('shelter');
  const logicalTime = 72 * 60 * 60;
  assert.equal(elapsedSinceCharacterActivity(current, logicalTime), logicalTime);
  assert.equal(survivalElapsedSecondsForCharacter(current, logicalTime, contentPack), 6 * 60 * 60);
  applyElapsedSurvival(current, logicalTime, contentPack);
  assert.deepEqual(current.needs, { hunger: 12, thirst: 18, fatigue: 6 });
});

test('ordinary locations keep full personal absence survival pressure', () => {
  const current = character('street');
  const logicalTime = 72 * 60 * 60;
  assert.equal(survivalElapsedSecondsForCharacter(current, logicalTime, contentPack), logicalTime);
  applyElapsedSurvival(current, logicalTime, contentPack);
  assert.deepEqual(current.needs, { hunger: 100, thirst: 100, fatigue: 72 });
});

test('successful active requests reset the personal activity boundary between short shelter gaps', () => {
  const current = character('shelter');
  const twoHours = 2 * 60 * 60;
  applyElapsedSurvival(current, twoHours, contentPack);
  current.lastActiveLogicalTimeSeconds = twoHours;
  applyElapsedSurvival(current, 2 * twoHours, contentPack);
  current.lastActiveLogicalTimeSeconds = 2 * twoHours;
  assert.deepEqual(current.needs, { hunger: 8, thirst: 12, fatigue: 4 });
});

test('fractional need progress remains exact across personal activity boundaries', () => {
  const current = character('shelter');
  applyElapsedSurvival(current, 1799, contentPack);
  assert.deepEqual(current.needs, { hunger: 0, thirst: 1, fatigue: 0 });
  assert.deepEqual(current.needProgressSeconds, { hunger: 1799, thirst: 599, fatigue: 1799 });
  current.lastActiveLogicalTimeSeconds = 1799;
  applyElapsedSurvival(current, 1800, contentPack);
  assert.deepEqual(current.needs, { hunger: 1, thirst: 1, fatigue: 0 });
  assert.deepEqual(current.needProgressSeconds, { hunger: 0, thirst: 600, fatigue: 1800 });
});

test('invalid personal activity clocks fail closed', () => {
  const current = character();
  current.lastActiveLogicalTimeSeconds = 10;
  assert.throws(() => elapsedSinceCharacterActivity(current, 9), /invalid character activity clock/);
  current.lastActiveLogicalTimeSeconds = -1;
  assert.throws(() => elapsedSinceCharacterActivity(current, 10), /invalid character activity clock/);
});
