import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { devStarterPack } from '../../content/dev-starter.js';

const manifest = validateGameModuleManifest({ name: 'location', dataVersion: 1, actions: ['location.travel', 'location.observe'] });

function travel({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const current = devStarterPack.locations[character.locationId];
  const destinationId = action.payload?.destinationId;
  if (!current?.routes.includes(destinationId) || !devStarterPack.locations[destinationId]) return { ok: false, code: 'ROUTE_NOT_AVAILABLE' };
  character.locationId = destinationId;
  character.needs.hunger = Math.min(100, character.needs.hunger + 1);
  character.needs.thirst = Math.min(100, character.needs.thirst + 1);
  return {
    ok: true,
    code: 'TRAVEL_COMPLETED',
    data: { location: publicLocation(destinationId), needs: structuredClone(character.needs) },
    events: [{ type: 'character.travelled', data: { characterId: character.id, destinationId } }],
  };
}

function observe({ world, actor }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return {
    ok: true,
    code: 'OBSERVED',
    data: {
      character: structuredClone(character),
      location: publicLocation(character.locationId),
      routes: devStarterPack.locations[character.locationId].routes.map(publicLocation),
      visibleNpcs: Object.entries(devStarterPack.npcs)
        .filter(([, npc]) => npc.locationId === character.locationId)
        .map(([id, npc]) => ({ id, name: npc.name })),
    },
  };
}

function publicLocation(id) {
  const location = devStarterPack.locations[id];
  return { id, name: location.name, description: location.description };
}

export const locationModule = { manifest, actions: { 'location.travel': travel, 'location.observe': observe } };
