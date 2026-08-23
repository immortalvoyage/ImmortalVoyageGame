import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { devStarterPack } from '../../content/dev-starter.js';
import { applyTravelStep, findNextRouteStep, publicLocation } from '../location/index.js';

const manifest = validateGameModuleManifest({ name: 'purpose', dataVersion: 1, actions: ['purpose.find-npc'] });

function findNpc({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };

  const npcId = action.payload?.npcId;
  const npc = devStarterPack.npcs[npcId];
  if (!npc?.searchLabel) return { ok: false, code: 'PURPOSE_TARGET_UNKNOWN' };

  if (npc.locationId === character.locationId) {
    return {
      ok: true,
      code: 'PURPOSE_TARGET_FOUND',
      data: { npc: { id: npcId, name: npc.name } },
      events: [{ type: 'purpose.target-found', data: { characterId: character.id, npcId } }],
    };
  }

  const nextLocationId = findNextRouteStep(character.locationId, npc.locationId);
  if (!nextLocationId || !applyTravelStep(character, nextLocationId)) {
    return { ok: false, code: 'PURPOSE_ROUTE_UNAVAILABLE' };
  }

  return {
    ok: true,
    code: 'PURPOSE_SEARCH_PROGRESS',
    data: {
      location: publicLocation(nextLocationId),
      needs: structuredClone(character.needs),
      target: { id: npcId, name: npc.name },
    },
    events: [
      { type: 'character.travelled', data: { characterId: character.id, destinationId: nextLocationId, reason: 'purpose.find-npc' } },
      { type: 'purpose.search-progress', data: { characterId: character.id, npcId, destinationId: nextLocationId } },
    ],
  };
}

export const purposeModule = { manifest, actions: { 'purpose.find-npc': findNpc } };
