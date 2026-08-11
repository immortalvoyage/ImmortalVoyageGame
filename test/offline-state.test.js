import assert from 'node:assert/strict';
import test from 'node:test';
import { createOfflineState, normalizeOccupationDuty, offlineProvisionSummary } from '../src/core/offline-state.js';

test('military camp can provide shelter meals and water while offline', () => {
  const state = createOfflineState({
    locationId: 'camp-1',
    shelter: 'barracks',
    foodSupply: 'provided',
    waterSupply: 'provided',
    dangerLevel: 'safe',
    occupationDuty: {
      occupationId: 'soldier',
      employerId: 'army-1',
      housingPolicy: 'provided',
      mealPolicy: 'provided',
      absencePolicy: 'strict',
      dutyScheduleId: 'watch-a',
    },
  });
  const summary = offlineProvisionSummary(state);
  assert.equal(summary.hasShelter, true);
  assert.equal(summary.foodCovered, true);
  assert.equal(summary.waterCovered, true);
  assert.equal(summary.dutyCanApply, true);
});

test('private workplace occupation does not magically provide meals', () => {
  const duty = normalizeOccupationDuty({ occupationId: 'blacksmith', housingPolicy: 'conditional', mealPolicy: 'none', absencePolicy: 'standard' });
  assert.equal(duty.mealPolicy, 'none');
});

test('unsafe field logout remains dangerous even with no active input', () => {
  const summary = offlineProvisionSummary(createOfflineState({ locationId: 'wild-1', dangerLevel: 'high' }));
  assert.equal(summary.dangerLevel, 'high');
  assert.equal(summary.foodCovered, false);
  assert.equal(summary.hasShelter, false);
});

test('unsupported policies are rejected', () => {
  assert.throws(() => createOfflineState({ locationId: 'x', foodSupply: 'infinite' }), /unsupported foodSupply/);
});
