import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { devStarterPack } from '../../content/dev-starter.js';

const manifest = validateGameModuleManifest({ name: 'npc', dataVersion: 1, actions: ['npc.interact'] });

function interact({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const npcId = action.payload?.npcId;
  const npc = devStarterPack.npcs[npcId];
  if (!npc || npc.locationId !== character.locationId) return { ok: false, code: 'NPC_NOT_AVAILABLE' };
  return {
    ok: true,
    code: 'NPC_INTERACTION',
    data: { npc: { id: npcId, name: npc.name }, text: npc.greeting },
  };
}

export const npcModule = { manifest, actions: { 'npc.interact': interact } };
