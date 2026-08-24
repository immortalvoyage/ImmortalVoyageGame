import { findUnlockedFamiliarityTopics } from '../relationship/familiarity.js';

function hasRecordedInteraction(character, npc) {
  const behaviorId = npc?.relationship?.behaviorId;
  const count = behaviorId ? character?.behaviorCounts?.[behaviorId] ?? 0 : 0;
  return Number.isSafeInteger(count) && count > 0;
}

function isRevealedByUnlockedTopic(character, npcId, npcs) {
  for (const sourceNpc of Object.values(npcs ?? {})) {
    for (const topic of findUnlockedFamiliarityTopics(character, sourceNpc)) {
      if ((topic.revealsNpcIds ?? []).includes(npcId)) return true;
    }
  }
  return false;
}

export function isKnownNpcTarget(character, npcId, contentPack) {
  const npcs = contentPack?.npcs;
  const npc = npcs?.[npcId];
  if (!character || !npc) return false;
  if (npc.locationId === character.locationId) return true;
  if (npc.knownAtStart === true) return true;
  if (hasRecordedInteraction(character, npc)) return true;
  return isRevealedByUnlockedTopic(character, npcId, npcs);
}

export function buildKnownPurposeTargets(character, contentPack) {
  const targets = [];
  for (const [npcId, npc] of Object.entries(contentPack?.npcs ?? {})) {
    if (!npc.searchLabel || !isKnownNpcTarget(character, npcId, contentPack)) continue;
    targets.push({ id: npcId, name: npc.name, searchLabel: npc.searchLabel });
  }
  return targets;
}
