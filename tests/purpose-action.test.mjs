import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTION_TYPES, createPurposeAction, toWorldIntent } from '../src/modules/actions/index.js';

test('travel action preserves destination and purpose', () => {
  const action = createPurposeAction({
    playerId: 'player-1',
    type: ACTION_TYPES.TRAVEL,
    target: '錢莊',
    purpose: '換錢',
  });

  assert.equal(action.target, '錢莊');
  assert.equal(action.purpose, '換錢');
  assert.equal(toWorldIntent(action).requiresAdjudication, true);
});

test('find NPC action identifies the requested person without declaring success', () => {
  const action = createPurposeAction({
    playerId: 'player-1',
    type: ACTION_TYPES.FIND_NPC,
    target: '柳青',
  });

  const intent = toWorldIntent(action);
  assert.equal(intent.intentType, 'find_npc');
  assert.equal(intent.target, '柳青');
  assert.equal(intent.requiresAdjudication, true);
  assert.equal('outcome' in intent, false);
});
