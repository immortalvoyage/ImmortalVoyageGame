import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { devStarterPack } from '../../content/dev-starter.js';
import { publicCharacter } from '../character/index.js';

const manifest = validateGameModuleManifest({ name: 'location', dataVersion: 2, actions: ['location.travel', 'location.observe'] });

function travel({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const destinationId = action.payload?.destinationId;
  if (!applyTravelStep(character, destinationId)) return { ok: false, code: 'ROUTE_NOT_AVAILABLE' };
  return {
    ok: true,
    code: 'TRAVEL_COMPLETED',
    data: { location: publicLocation(destinationId), needs: structuredClone(character.needs) },
    events: [{ type: 'character.travelled', data: { characterId: character.id, destinationId, reason: 'direct' } }],
  };
}

export function applyTravelStep(character, destinationId) {
  const current = devStarterPack.locations[character.locationId];
  if (!current?.routes.includes(destinationId) || !devStarterPack.locations[destinationId]) return false;
  character.locationId = destinationId;
  character.needs.hunger = Math.min(100, character.needs.hunger + 1);
  character.needs.thirst = Math.min(100, character.needs.thirst + 1);
  return true;
}

export function findNextRouteStep(fromLocationId, targetLocationId) {
  if (fromLocationId === targetLocationId) return null;
  if (!devStarterPack.locations[fromLocationId] || !devStarterPack.locations[targetLocationId]) return null;

  const visited = new Set([fromLocationId]);
  const queue = devStarterPack.locations[fromLocationId].routes.map((id) => ({ id, firstStep: id }));
  for (const entry of queue) visited.add(entry.id);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.id === targetLocationId) return current.firstStep;
    for (const nextId of devStarterPack.locations[current.id]?.routes ?? []) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push({ id: nextId, firstStep: current.firstStep });
    }
  }
  return null;
}

export function buildLocationView(world, actor) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return null;
  return {
    character: publicCharacter(character),
    location: publicLocation(character.locationId),
    routes: devStarterPack.locations[character.locationId].routes.map(publicLocation),
    visibleNpcs: Object.entries(devStarterPack.npcs)
      .filter(([, npc]) => npc.locationId === character.locationId)
      .map(([id, npc]) => ({ id, name: npc.name })),
  };
}

function observe({ world, actor }) {
  const view = buildLocationView(world, actor);
  if (!view) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'OBSERVED', data: view };
}

export function publicLocation(id) {
  const location = devStarterPack.locations[id];
  return { id, name: location.name, description: location.description };
}

export const locationModule = { manifest, actions: { 'location.travel': travel, 'location.observe': observe } };
