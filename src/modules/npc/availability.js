export function isNpcAvailableAt(npc, logicalTimeSeconds) {
  const availability = npc?.availability;
  if (!availability) return true;
  if (!Number.isSafeInteger(logicalTimeSeconds) || logicalTimeSeconds < 0) return false;

  const offset = logicalTimeSeconds % availability.periodSeconds;
  return offset >= availability.startOffsetSeconds
    && offset < availability.startOffsetSeconds + availability.durationSeconds;
}
