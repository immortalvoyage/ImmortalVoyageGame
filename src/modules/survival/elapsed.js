export const NEED_INTERVAL_SECONDS = Object.freeze({
  hunger: 30 * 60,
  thirst: 20 * 60,
  fatigue: 60 * 60,
});

export function elapsedSinceCharacterActivity(character, currentLogicalTimeSeconds) {
  const lastActive = character?.lastActiveLogicalTimeSeconds;
  if (!Number.isSafeInteger(currentLogicalTimeSeconds) || currentLogicalTimeSeconds < 0) {
    throw new Error('invalid logical world time for survival');
  }
  if (!Number.isSafeInteger(lastActive) || lastActive < 0 || lastActive > currentLogicalTimeSeconds) {
    throw new Error('invalid character activity clock');
  }
  return currentLogicalTimeSeconds - lastActive;
}

export function survivalElapsedSecondsForCharacter(character, currentLogicalTimeSeconds, contentPack) {
  const elapsedSeconds = elapsedSinceCharacterActivity(character, currentLogicalTimeSeconds);
  if (elapsedSeconds <= 0) return 0;
  const cap = contentPack?.locations?.[character?.locationId]?.shelter?.absenceSurvivalCapSeconds;
  if (!Number.isSafeInteger(cap) || cap < 1) return elapsedSeconds;
  return Math.min(elapsedSeconds, cap);
}

export function applyElapsedSurvival(character, currentLogicalTimeSeconds, contentPack) {
  const effectiveElapsedSeconds = survivalElapsedSecondsForCharacter(character, currentLogicalTimeSeconds, contentPack);
  if (effectiveElapsedSeconds <= 0) return;

  character.needProgressSeconds ??= { hunger: 0, thirst: 0, fatigue: 0 };
  for (const [need, intervalSeconds] of Object.entries(NEED_INTERVAL_SECONDS)) {
    const accumulated = (character.needProgressSeconds[need] ?? 0) + effectiveElapsedSeconds;
    const increments = Math.floor(accumulated / intervalSeconds);
    character.needProgressSeconds[need] = accumulated % intervalSeconds;
    if (increments > 0) character.needs[need] = Math.min(100, character.needs[need] + increments);
  }
}
