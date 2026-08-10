import assert from 'node:assert/strict';
import test from 'node:test';
import { SurvivalNeeds } from '../src/modules/survival/index.js';
import { resolveSurvivalTime } from '../src/modules/survival/time-resolver.js';

test('safe offline time does not decay survival needs', () => {
  const needs = new SurvivalNeeds({ hunger: 60, thirst: 60 });
  const result = resolveSurvivalTime({ needs, elapsedWorldDays: 10, online: false, safeOffline: true });
  assert.deepEqual(result.state, { hunger: 60, thirst: 60 });
  assert.equal(result.protection, 'safe_offline');
});

test('unsafe offline survival pressure is capped instead of killing player', () => {
  const needs = new SurvivalNeeds({ hunger: 10, thirst: 10 });
  const result = resolveSurvivalTime({ needs, elapsedWorldDays: 10, online: false, safeOffline: false });
  assert.equal(result.effectiveDays, 0.5);
  assert.equal(result.crisis.fatal, false);
});

test('dehydration becomes more severe than starvation at zero', () => {
  const needs = new SurvivalNeeds({ hunger: 0, thirst: 0 });
  const result = resolveSurvivalTime({ needs, elapsedWorldDays: 1, online: true });
  assert.equal(result.crisis.starving, true);
  assert.equal(result.crisis.dehydrated, true);
  assert.ok(result.crisis.dehydrationPressure > result.crisis.starvationPressure);
});

test('regional traits can modify survival consumption rates', () => {
  const needs = new SurvivalNeeds({ hunger: 100, thirst: 100 });
  resolveSurvivalTime({ needs, elapsedWorldDays: 1, thirstModifier: 0.75 });
  assert.equal(needs.thirst, 74.5);
});
