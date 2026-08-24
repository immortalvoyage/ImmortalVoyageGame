import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { recordBehavior } from '../character/behavior.js';

const manifest = validateGameModuleManifest({ name: 'npc', dataVersion: 2, actions: ['npc.interact'] });

function interact({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const npcId = action.payload?.npcId;
  const npc = context.contentPack.npcs[npcId];
  if (!npc || npc.locationId !== character.locationId) return { ok: false, code: 'NPC_NOT_AVAILABLE' };

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
    data: { npc: { id: npcId, name: npc.name }, text: npc.greeting },
    events,
  };
}

export const npcModule = { manifest, actions: { 'npc.interact': interact } };
