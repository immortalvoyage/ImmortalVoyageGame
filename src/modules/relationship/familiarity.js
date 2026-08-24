export function findHighestFamiliarityLevel(character, npc) {
  const behaviorId = npc?.relationship?.behaviorId;
  const levels = npc?.relationship?.levels;
  if (!behaviorId || !Array.isArray(levels)) return null;
  const count = character?.behaviorCounts?.[behaviorId] ?? 0;
  if (!Number.isSafeInteger(count) || count < 1) return null;

  let highest = null;
  for (const level of levels) {
    if (count < level.minCount) break;
    highest = level;
  }
  return highest;
}
