const MUTATING_ACTIONS = new Set([
  'character_mutation',
  'inventory_mutation',
  'currency_mutation',
  'trade_mutation',
  'npc_mutation',
  'world_mutation',
]);

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function reject(reason) {
  return Object.freeze({ allowed: false, reason });
}

export function evaluateAiExecutionContract({ contract, proposal, currentWorldVersion, seenActionIds = new Set() }) {
  if (!contract || typeof contract !== 'object') return reject('execution_contract_required');
  if (!proposal || typeof proposal !== 'object') return reject('proposal_required');

  const role = requireText(contract.role, 'contract.role');
  const actionId = requireText(proposal.actionId, 'proposal.actionId');
  const actionType = requireText(proposal.actionType, 'proposal.actionType');

  if (!Array.isArray(contract.allowedActionTypes) || !contract.allowedActionTypes.includes(actionType)) {
    return reject('action_type_not_allowed');
  }

  if (seenActionIds.has(actionId)) return reject('duplicate_action_id');

  if (proposal.expectedWorldVersion !== currentWorldVersion) {
    return reject('stale_world_version');
  }

  if (proposal.role && proposal.role !== role) return reject('role_drift_detected');

  if (MUTATING_ACTIONS.has(actionType)) {
    if (contract.mode !== 'proposal_only') return reject('mutating_ai_must_be_proposal_only');
    if (!proposal.preconditions || typeof proposal.preconditions !== 'object') return reject('mutation_preconditions_required');
    if (!proposal.impact || typeof proposal.impact !== 'string') return reject('mutation_impact_required');
  }

  if (proposal.claimsCommittedResult === true) return reject('ai_cannot_claim_commit_result');

  return Object.freeze({
    allowed: true,
    reason: 'ai_proposal_contract_valid',
    normalized: Object.freeze({
      actionId,
      actionType,
      role,
      expectedWorldVersion: proposal.expectedWorldVersion,
      impact: proposal.impact ?? 'none',
    }),
  });
}

export function assertAiExecutionContract(input) {
  const result = evaluateAiExecutionContract(input);
  if (!result.allowed) {
    const error = new Error(`AI execution blocked: ${result.reason}`);
    error.code = result.reason;
    throw error;
  }
  return result;
}

export const AI_MUTATING_ACTION_TYPES = Object.freeze([...MUTATING_ACTIONS]);
