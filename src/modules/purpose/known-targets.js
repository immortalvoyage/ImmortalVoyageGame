import { characterKnowsNpcThroughKnowledge } from '../knowledge/index.js';

function hasRecordedInteraction(character, npc) {
  const behaviorId = npc?.relationship?.behaviorId;
  const count = behaviorId ? character?.behaviorCounts?.[behaviorId] ?? 0 : 0;
  return Number.isSafeInteger(count) && count > 0;
}

export function isKnownNpcTarget(character, npcId, contentPack, { knowledgeActive = false } = {}) {
  const npc = contentPack?.npcs?.[npcId];
  if (!character || !npc) return false;
  if (npc.locationId === character.locationId) return true;
  if (npc.knownAtStart === true) return true;
  if (hasRecordedInteraction(character, npc)) return true;
  return knowledgeActive && characterKnowsNpcThroughKnowledge(character, npcId, contentPack.knowledge);
}

export function buildKnownPurposeTargets(character, contentPack, options = {}) {
  const targets = [];
  for (const [npcId, npc] of Object.entries(contentPack?.npcs ?? {})) {
    if (!npc.searchLabel || !isKnownNpcTarget(character, npcId, contentPack, options)) continue;
    targets.push({ id: npcId, name: npc.name, searchLabel: npc.searchLabel });
  }
  return targets;
}
