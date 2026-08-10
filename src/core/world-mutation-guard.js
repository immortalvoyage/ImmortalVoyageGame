const COMMIT_ACTORS = new Set(['world_engine', 'gm_engine']);
const HIGH_IMPACT = new Set(['country', 'world']);

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

export function evaluateWorldMutationCommit({ proposal, validation, resolution, actor }) {
  const actorType = requireText(actor?.type, 'actor.type');
  if (!COMMIT_ACTORS.has(actorType)) {
    return Object.freeze({ allowed: false, reason: 'commit_actor_not_authorized' });
  }

  if (!proposal || typeof proposal !== 'object') {
    return Object.freeze({ allowed: false, reason: 'proposal_required' });
  }
  if (!validation || validation.approved !== true) {
    return Object.freeze({ allowed: false, reason: 'validation_required' });
  }
  if (!resolution || resolution.resolved !== true) {
    return Object.freeze({ allowed: false, reason: 'resolution_required' });
  }

  const impact = requireText(proposal.impact ?? 'personal', 'proposal.impact');
  if (HIGH_IMPACT.has(impact) && validation.policyGatePassed !== true) {
    return Object.freeze({ allowed: false, reason: 'high_impact_policy_gate_required' });
  }

  if (actorType === 'gm_engine' && HIGH_IMPACT.has(impact)) {
    if (validation.gmAuthorized !== true) {
      return Object.freeze({ allowed: false, reason: 'gm_authorization_required' });
    }
    if (!validation.previewToken || !validation.auditId) {
      return Object.freeze({ allowed: false, reason: 'gm_preview_and_audit_required' });
    }
  }

  return Object.freeze({ allowed: true, reason: 'validated_world_mutation' });
}

export function assertWorldMutationCommit(input) {
  const result = evaluateWorldMutationCommit(input);
  if (!result.allowed) {
    const error = new Error(`world mutation blocked: ${result.reason}`);
    error.code = result.reason;
    throw error;
  }
  return result;
}

export const WORLD_MUTATION_COMMIT_ACTORS = Object.freeze([...COMMIT_ACTORS]);
