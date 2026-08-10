const ACTION_TYPES = Object.freeze({
  TRAVEL: 'travel',
  FIND_NPC: 'find_npc',
  INTERACT: 'interact',
});

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} is required`);
  }
  return value.trim();
}

export function createPurposeAction({ playerId, type, target, purpose = null }) {
  if (!Object.values(ACTION_TYPES).includes(type)) {
    throw new TypeError('unsupported action type');
  }

  return Object.freeze({
    playerId: requireText(playerId, 'playerId'),
    type,
    target: requireText(target, 'target'),
    purpose: typeof purpose === 'string' && purpose.trim() ? purpose.trim() : null,
  });
}

export function toWorldIntent(action) {
  return Object.freeze({
    actorId: action.playerId,
    intentType: action.type,
    target: action.target,
    purpose: action.purpose,
    requiresAdjudication: true,
  });
}

export { ACTION_TYPES };
