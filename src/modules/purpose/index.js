import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { applyTravelStep, findNextRouteStep, publicLocation } from '../location/index.js';

const manifest = validateGameModuleManifest({ name: 'purpose', dataVersion: 2, actions: ['purpose.find-npc'] });

function foundResult(character, npcId, npc, extra = {}) {
  return {
    ok: true,
    code: 'PURPOSE_TARGET_FOUND',
    data: {
      npc: { id: npcId, name: npc.name },
      ...extra,
    },
    events: [{ type: 'purpose.target-found', data: { characterId: character.id, npcId } }],
  };
}

function findNpc({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const contentPack = context.contentPack;

  const npcId = action.payload?.npcId;
  const npc = contentPack.npcs[npcId];
  if (!npc?.searchLabel) return { ok: false, code: 'PURPOSE_TARGET_UNKNOWN' };

  if (npc.locationId === character.locationId) return foundResult(character, npcId, npc);

  const nextLocationId = findNextRouteStep(character.locationId, npc.locationId, contentPack);
  if (!nextLocationId || !applyTravelStep(character, nextLocationId, contentPack)) {
    return { ok: false, code: 'PURPOSE_ROUTE_UNAVAILABLE' };
  }

  const travelEvent = {
    type: 'character.travelled',
    data: { characterId: character.id, destinationId: nextLocationId, reason: 'purpose.find-npc' },
  };
  if (nextLocationId === npc.locationId) {
    const found = foundResult(character, npcId, npc, {
      location: publicLocation(nextLocationId, contentPack),
      needs: structuredClone(character.needs),
    });
    found.events.unshift(travelEvent);
    return found;
  }

  return {
    ok: true,
    code: 'PURPOSE_SEARCH_PROGRESS',
    data: {
      location: publicLocation(nextLocationId, contentPack),
      needs: structuredClone(character.needs),
      target: { id: npcId, name: npc.name },
    },
    events: [
      travelEvent,
      { type: 'purpose.search-progress', data: { characterId: character.id, npcId, destinationId: nextLocationId } },
    ],
  };
}

export const purposeModule = { manifest, actions: { 'purpose.find-npc': findNpc } };
