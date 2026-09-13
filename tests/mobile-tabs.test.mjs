import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseMobileTab } from '../public/mobile-tabs.js';

test('mobile tab keeps the current available surface and otherwise prefers immediate actions', () => {
  assert.equal(chooseMobileTab('dialogue', { dialogue: true, actions: true, travel: true, character: true }), 'dialogue');
  assert.equal(chooseMobileTab('dialogue', { dialogue: false, actions: true, travel: true, character: true }), 'actions');
  assert.equal(chooseMobileTab('actions', { actions: false, travel: true, dialogue: false, character: true }), 'travel');
  assert.equal(chooseMobileTab('actions', { actions: false, travel: false, dialogue: false, character: true }), 'character');
});
