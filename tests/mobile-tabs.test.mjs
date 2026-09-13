import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseMobileTab } from '../public/mobile-tabs.js';

test('workspace keeps the current available view and falls back to actionable surfaces first', () => {
  const all = { scene: true, dialogue: true, actions: true, travel: true, trade: true, character: true };
  assert.equal(chooseMobileTab('dialogue', all), 'dialogue');
  assert.equal(chooseMobileTab('dialogue', { ...all, dialogue: false }), 'actions');
  assert.equal(chooseMobileTab('actions', { scene: true, actions: false, travel: true, dialogue: false, trade: false, character: true }), 'travel');
  assert.equal(chooseMobileTab('actions', { scene: true, actions: false, travel: false, dialogue: false, trade: false, character: true }), 'scene');
});
