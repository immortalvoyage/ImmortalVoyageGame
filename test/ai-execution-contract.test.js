import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAiExecutionContract } from '../src/core/ai-execution-contract.js';

const contract = Object.freeze({
  role: 'game_ai',
  mode: 'proposal_only',
  allowedActionTypes: ['narrative', 'world_mutation'],
});

function proposal(overrides = {}) {
  return {
    actionId: 'action-1',
    actionType: 'world_mutation',
    expectedWorldVersion: 7,
    preconditions: { playerCanAttempt: true },
    impact: 'world',
    ...overrides,
  };
}

test('blocks stale world context', () => {
  const result = evaluateAiExecutionContract({ contract, proposal: proposal(), currentWorldVersion: 8 });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'stale_world_version');
});

test('blocks duplicate action replay', () => {
  const result = evaluateAiExecutionContract({ contract, proposal: proposal(), currentWorldVersion: 7, seenActionIds: new Set(['action-1']) });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'duplicate_action_id');
});

test('blocks role drift', () => {
  const result = evaluateAiExecutionContract({ contract, proposal: proposal({ role: 'gm_engine' }), currentWorldVersion: 7 });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'role_drift_detected');
});

test('blocks AI claiming a committed result before commit', () => {
  const result = evaluateAiExecutionContract({ contract, proposal: proposal({ claimsCommittedResult: true }), currentWorldVersion: 7 });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'ai_cannot_claim_commit_result');
});

test('blocks action outside the per-turn allowlist', () => {
  const result = evaluateAiExecutionContract({ contract, proposal: proposal({ actionType: 'currency_mutation' }), currentWorldVersion: 7 });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'action_type_not_allowed');
});

test('accepts a fresh proposal within the execution contract', () => {
  const result = evaluateAiExecutionContract({ contract, proposal: proposal(), currentWorldVersion: 7 });
  assert.equal(result.allowed, true);
  assert.equal(result.normalized.role, 'game_ai');
  assert.equal(result.normalized.expectedWorldVersion, 7);
});
