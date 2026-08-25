export const NEED_INTERVAL_SECONDS = Object.freeze({
  hunger: 30 * 60,
  thirst: 20 * 60,
  fatigue: 60 * 60,
});

function shelterCapSeconds(character, contentPack) {
  const cap = contentPack?.locations?.[character?.locationId]?.shelter?.absenceSurvivalCapSeconds;
  return Number.isSafeInteger(cap) && cap > 0 ? cap : null;
}

function applySurvivalExposure(character, effectiveElapsedSeconds) {
  if (!Number.isSafeInteger(effectiveElapsedSeconds) || effectiveElapsedSeconds <= 0) return;
  character.needProgressSeconds ??= { hunger: 0, thirst: 0, fatigue: 0 };
  for (const [need, intervalSeconds] of Object.entries(NEED_INTERVAL_SECONDS)) {
    const accumulated = (character.needProgressSeconds[need] ?? 0) + effectiveElapsedSeconds;
    const increments = Math.floor(accumulated / intervalSeconds);
    character.needProgressSeconds[need] = accumulated % intervalSeconds;
    if (increments > 0) character.needs[need] = Math.min(100, character.needs[need] + increments);
  }
}

// Lower-level one-gap helper retained for isolated rule tests and callers that are not
// resolving shared-world time. Runtime shared-world resolution uses the cumulative
// per-character function below so other players cannot reset an offline shelter cap.
export function survivalElapsedSecondsForCharacter(character, elapsedSeconds, contentPack) {
  if (!Number.isSafeInteger(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  const cap = shelterCapSeconds(character, contentPack);
  return cap === null ? elapsedSeconds : Math.min(elapsedSeconds, cap);
}

export function applyElapsedSurvival(character, elapsedSeconds, contentPack) {
  applySurvivalExposure(character, survivalElapsedSecondsForCharacter(character, elapsedSeconds, contentPack));
}

export function survivalExposureDeltaForCharacter(character, currentLogicalTimeSeconds, contentPack) {
  if (!Number.isSafeInteger(currentLogicalTimeSeconds) || currentLogicalTimeSeconds < 0) return 0;
  const resolvedAt = character?.lastSurvivalResolvedLogicalTimeSeconds;
  const lastActiveAt = character?.lastActiveLogicalTimeSeconds;
  if (!Number.isSafeInteger(resolvedAt) || !Number.isSafeInteger(lastActiveAt)) return 0;

  // A successful player request marks lastActiveAt after the preceding elapsed pass.
  // max() prevents a module-off interval before that activity from being charged later.
  const exposureStart = Math.max(resolvedAt, lastActiveAt);
  if (currentLogicalTimeSeconds <= exposureStart) return 0;

  const cap = shelterCapSeconds(character, contentPack);
  if (cap === null) return currentLogicalTimeSeconds - exposureStart;

  const previousAbsenceSeconds = Math.max(0, exposureStart - lastActiveAt);
  const currentAbsenceSeconds = Math.max(0, currentLogicalTimeSeconds - lastActiveAt);
  return Math.max(
    0,
    Math.min(currentAbsenceSeconds, cap) - Math.min(previousAbsenceSeconds, cap),
  );
}

export function resolveCharacterSurvival(character, currentLogicalTimeSeconds, contentPack) {
  const effectiveElapsedSeconds = survivalExposureDeltaForCharacter(
    character,
    currentLogicalTimeSeconds,
    contentPack,
  );
  applySurvivalExposure(character, effectiveElapsedSeconds);
  character.lastSurvivalResolvedLogicalTimeSeconds = currentLogicalTimeSeconds;
  return effectiveElapsedSeconds;
}
