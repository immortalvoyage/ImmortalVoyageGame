import assert from 'node:assert/strict';
import test from 'node:test';
import { applyActionSurvivalCost, getActionWorldDays } from '../src/core/action-survival-cost.js';
import { performStarterGather } from '../src/core/starter-gather.js';

test('starter gathering has one hour of world-time cost', () => {
  assert.equal(getActionWorldDays('starter-gather'), 1 / 24);
  assert.equal(getActionWorldDays('view-inventory'), 0);
});

test('action survival cost reuses the existing survival resolver', () => {
  const character = { characterId: 'char-1', survivalNeeds: { hunger: 100, thirst: 100 } };
  const applied = applyActionSurvivalCost(character, 'starter-gather');

  assert.equal(applied.elapsedWorldDays, 1 / 24);
  assert.equal(applied.character.elapsedWorldDays, 1 / 24);
  assert.equal(applied.character.survivalNeeds.hunger, 99.25);
  assert.ok(Math.abs(applied.character.survivalNeeds.thirst - 98.58333333333333) < 1e-9);
  assert.equal(applied.survival.crisis.starving, false);
  assert.equal(applied.survival.crisis.dehydrated, false);
});

test('starter gather adds the item and applies survival time in one game-domain action', () => {
  const original = {
    characterId: 'char-1',
    playerId: 'player-1',
    birthRegionId: 'starter-grassland',
    birthRegionTags: ['grassland'],
    status: 'alive',
  };
  const gathered = performStarterGather(original, { occurredAt: '2026-08-12T01:30:00.000Z' });

  assert.equal(gathered.character.inventory.items[0].itemId, 'wild-herb');
  assert.equal(gathered.character.starterGatheredAt, '2026-08-12T01:30:00.000Z');
  assert.equal(gathered.character.elapsedWorldDays, 1 / 24);
  assert.equal(gathered.character.survivalNeeds.hunger, 99.25);
  assert.equal(gathered.outcome.elapsedWorldDays, 1 / 24);
  assert.equal(gathered.outcome.survival.state.hunger, 99.25);
});
