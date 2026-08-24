import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { publicCharacter } from '../character/index.js';

const manifest = validateGameModuleManifest({ name: 'location', dataVersion: 2, actions: ['location.travel', 'location.observe'] });

function travel({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const destinationId = action.payload?.destinationId;
  if (!applyTravelStep(character, destinationId, context.contentPack)) return { ok: false, code: 'ROUTE_NOT_AVAILABLE' };
  return {
    ok: true,
    code: 'TRAVEL_COMPLETED',
    data: { location: publicLocation(destinationId, context.contentPack), needs: structuredClone(character.needs) },
    events: [{ type: 'character.travelled', data: { characterId: character.id, destinationId, reason: 'direct' } }],
  };
}

export function applyTravelStep(character, destinationId, contentPack) {
  const current = contentPack.locations[character.locationId];
  if (!current?.routes.includes(destinationId) || !contentPack.locations[destinationId]) return false;
  character.locationId = destinationId;
  character.needs.hunger = Math.min(100, character.needs.hunger + 1);
  character.needs.thirst = Math.min(100, character.needs.thirst + 1);
  return true;
}

export function findNextRouteStep(fromLocationId, targetLocationId, contentPack) {
  if (fromLocationId === targetLocationId) return null;
  if (!contentPack.locations[fromLocationId] || !contentPack.locations[targetLocationId]) return null;

  const visited = new Set([fromLocationId]);
  const queue = contentPack.locations[fromLocationId].routes.map((id) => ({ id, firstStep: id }));
  for (const entry of queue) visited.add(entry.id);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.id === targetLocationId) return current.firstStep;
    for (const nextId of contentPack.locations[current.id]?.routes ?? []) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push({ id: nextId, firstStep: current.firstStep });
    }
  }
  return null;
}

export function buildLocationView(world, actor, contentPack) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return null;
  return {
    character: publicCharacter(character),
    location: publicLocation(character.locationId, contentPack),
    routes: contentPack.locations[character.locationId].routes.map((id) => publicLocation(id, contentPack)),
    visibleNpcs: Object.entries(contentPack.npcs)
      .filter(([, npc]) => npc.locationId === character.locationId)
      .map(([id, npc]) => ({ id, name: npc.name })),
  };
}

function observe({ world, actor, context }) {
  const view = buildLocationView(world, actor, context.contentPack);
  if (!view) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  return { ok: true, code: 'OBSERVED', data: view };
}

export function publicLocation(id, contentPack) {
  const location = contentPack.locations[id];
  return { id, name: location.name, description: location.description };
}

export const locationModule = { manifest, actions: { 'location.travel': travel, 'location.observe': observe } };
