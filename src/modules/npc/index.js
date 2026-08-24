import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { recordBehavior } from '../character/behavior.js';
import { findHighestFamiliarityLevel, findUnlockedFamiliarityTopics } from '../relationship/familiarity.js';

const manifest = validateGameModuleManifest({ name: 'npc', dataVersion: 4, actions: ['npc.interact', 'npc.ask'] });

function interact({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const npcId = action.payload?.npcId;
  const npc = context.contentPack.npcs[npcId];
  if (!npc || npc.locationId !== character.locationId) return { ok: false, code: 'NPC_NOT_AVAILABLE' };

  const relationshipActive = context?.isActionAvailable?.('relationship.observe') ?? false;
  const familiarity = relationshipActive ? findHighestFamiliarityLevel(character, npc) : null;
  const responseText = familiarity?.responseText ?? npc.greeting;

  const events = [];
  const behaviorId = npc.relationship?.behaviorId;
  if (behaviorId) {
    const count = recordBehavior(character, behaviorId);
    events.push({
      type: 'character.behavior-recorded',
      data: { characterId: character.id, behaviorId, count },
    });
  }

  return {
    ok: true,
    code: 'NPC_INTERACTION',
    data: { npc: { id: npcId, name: npc.name }, text: responseText },
    events,
  };
}

function ask({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const npcId = action.payload?.npcId;
  const topicId = action.payload?.topicId;
  const npc = context.contentPack.npcs[npcId];
  if (!npc || npc.locationId !== character.locationId) return { ok: false, code: 'NPC_NOT_AVAILABLE' };
  if (!(context?.isActionAvailable?.('relationship.observe') ?? false)) {
    return { ok: false, code: 'NPC_TOPIC_NOT_AVAILABLE' };
  }

  const topic = findUnlockedFamiliarityTopics(character, npc).find((entry) => entry.id === topicId);
  if (!topic) return { ok: false, code: 'NPC_TOPIC_NOT_AVAILABLE' };
  return {
    ok: true,
    code: 'NPC_TOPIC_RESPONSE',
    data: {
      npc: { id: npcId, name: npc.name },
      topic: { id: topic.id, label: topic.label },
      text: topic.responseText,
    },
  };
}

export const npcModule = { manifest, actions: { 'npc.interact': interact, 'npc.ask': ask } };
