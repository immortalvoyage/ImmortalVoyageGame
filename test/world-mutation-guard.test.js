import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWorldMutationCommit } from '../src/core/world-mutation-guard.js';

const base = {
  proposal: { id: 'proposal-1', impact: 'personal' },
  validation: { approved: true },
  resolution: { resolved: true },
  actor: { type: 'world_engine' },
};

test('AI cannot commit world state directly', () => {
  const result = evaluateWorldMutationCommit({ ...base, actor: { type: 'game_ai' } });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'commit_actor_not_authorized');
});

test('player intent cannot commit world state directly', () => {
  const result = evaluateWorldMutationCommit({ ...base, actor: { type: 'player' } });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'commit_actor_not_authorized');
});

test('world engine requires validation and resolution', () => {
  assert.equal(evaluateWorldMutationCommit({ ...base, validation: { approved: false } }).allowed, false);
  assert.equal(evaluateWorldMutationCommit({ ...base, resolution: { resolved: false } }).allowed, false);
});

test('world-scale destruction requires deterministic policy gate', () => {
  const result = evaluateWorldMutationCommit({
    ...base,
    proposal: { id: 'destroy-world', impact: 'world' },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'high_impact_policy_gate_required');
});

test('validated world engine mutation may commit', () => {
  const result = evaluateWorldMutationCommit({
    ...base,
    proposal: { id: 'regional-result', impact: 'world' },
    validation: { approved: true, policyGatePassed: true },
  });
  assert.equal(result.allowed, true);
});

test('high-impact GM mutation requires authorization, preview and audit', () => {
  const proposal = { id: 'gm-world-change', impact: 'world' };
  const actor = { type: 'gm_engine' };
  let result = evaluateWorldMutationCommit({
    ...base,
    proposal,
    actor,
    validation: { approved: true, policyGatePassed: true, gmAuthorized: true },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'gm_preview_and_audit_required');

  result = evaluateWorldMutationCommit({
    ...base,
    proposal,
    actor,
    validation: {
      approved: true,
      policyGatePassed: true,
      gmAuthorized: true,
      previewToken: 'preview-1',
      auditId: 'audit-1',
    },
  });
  assert.equal(result.allowed, true);
});
