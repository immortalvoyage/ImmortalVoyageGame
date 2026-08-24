import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { publicCharacter } from '../character/index.js';

const manifest = validateGameModuleManifest({ name: 'location', dataVersion: 3, actions: ['location.travel', 'location.observe'] });

function survivalIsActive(context) {
  const available = context?.isActionAvailable;
  if (typeof available !== 'function') return true;
  return available('survival.gather') || available('survival.consume') || available('survival.rest');
}

function findRoute(location, destinationId) {
  return location?.routes?.find((route) => route.destinationId === destinationId) ?? null;
}

function applyRouteNeedCosts(character, needCosts = {}) {
  for (const [need, amount] of Object.entries(needCosts)) {
    if (!(need in character.needs)) continue;
    character.needs[need] = Math.min(100, character.needs[need] + amount);
  }
}

function travel({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const destinationId = action.payload?.destinationId;
  const route = applyTravelStep(character, destinationId, context.contentPack, {
    applyNeedCosts: survivalIsActive(context),
  });
  if (!route) return { ok: false, code: 'ROUTE_NOT_AVAILABLE' };
  return {
    ok: true,
    code: 'TRAVEL_COMPLETED',
    data: {
      location: publicLocation(destinationId, context.contentPack),
      needs: structuredClone(character.needs),
      travelSeconds: route.travelSeconds,
    },
    events: [{
      type: 'character.travelled',
      data: {
        characterId: character.id,
        destinationId,
        reason: 'direct',
        travelSeconds: route.travelSeconds,
      },
    }],
  };
}

export function applyTravelStep(character, destinationId, contentPack, { applyNeedCosts = true } = {}) {
  const current = contentPack.locations[character.locationId];
  const route = findRoute(current, destinationId);
  if (!route || !contentPack.locations[destinationId]) return null;
  character.locationId = destinationId;
  if (applyNeedCosts) applyRouteNeedCosts(character, route.needCosts);
  return route;
}

export function findNextRouteStep(fromLocationId, targetLocationId, contentPack) {
  if (fromLocationId === targetLocationId) return null;
  if (!contentPack.locations[fromLocationId] || !contentPack.locations[targetLocationId]) return null;

  const best = new Map([[fromLocationId, { totalSeconds: 0, firstStep: null }]]);
  const frontier = [{ id: fromLocationId, totalSeconds: 0, firstStep: null }];

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.totalSeconds - right.totalSeconds);
    const current = frontier.shift();
    const known = best.get(current.id);
    if (!known || current.totalSeconds !== known.totalSeconds || current.firstStep !== known.firstStep) continue;
    if (current.id === targetLocationId) return current.firstStep;

    for (const route of contentPack.locations[current.id]?.routes ?? []) {
      const nextId = route.destinationId;
      if (!contentPack.locations[nextId]) continue;
      const totalSeconds = current.totalSeconds + route.travelSeconds;
      const firstStep = current.firstStep ?? nextId;
      const previous = best.get(nextId);
      if (previous && previous.totalSeconds <= totalSeconds) continue;
      best.set(nextId, { totalSeconds, firstStep });
      frontier.push({ id: nextId, totalSeconds, firstStep });
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
    routes: contentPack.locations[character.locationId].routes.map((route) => publicRoute(route, contentPack)),
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

export function publicRoute(route, contentPack) {
  return {
    ...publicLocation(route.destinationId, contentPack),
    travelSeconds: route.travelSeconds,
  };
}

export function formatTravelDuration(travelSeconds) {
  const minutes = Math.max(1, Math.ceil(travelSeconds / 60));
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} 小時 ${remainingMinutes} 分鐘` : `${hours} 小時`;
}

export const locationModule = { manifest, actions: { 'location.travel': travel, 'location.observe': observe } };
