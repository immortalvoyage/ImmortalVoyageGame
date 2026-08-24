export function recordBehavior(character, behaviorId) {
  if (!character?.behaviorCounts || typeof behaviorId !== 'string' || behaviorId.length === 0) {
    throw new TypeError('valid character behavior state is required');
  }
  const current = character.behaviorCounts[behaviorId] ?? 0;
  if (!Number.isSafeInteger(current) || current < 0) throw new Error('invalid behavior count');
  const next = current >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : current + 1;
  character.behaviorCounts[behaviorId] = next;
  return next;
}
