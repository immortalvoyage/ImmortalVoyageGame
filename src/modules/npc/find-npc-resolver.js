function normalizeKnownLocations(knownLocations = []) {
  return new Set(knownLocations.filter((value) => typeof value === 'string' && value.trim()));
}

export function resolveFindNpc({ npcRegistry, npcName, knownLocations = [], currentLocationId = null }) {
  if (!npcRegistry) throw new TypeError('npcRegistry is required');
  if (typeof npcName !== 'string' || !npcName.trim()) throw new TypeError('npcName is required');

  const npc = npcRegistry.findNpcByName(npcName);
  if (!npc) {
    return Object.freeze({ status: 'unknown_npc', found: false, requiresNarrative: true });
  }

  if (npc.status === 'dead') {
    return Object.freeze({ status: 'dead', found: false, npcId: npc.id, requiresNarrative: true });
  }

  if (!npc.locationId) {
    return Object.freeze({ status: 'location_unknown', found: false, npcId: npc.id, requiresNarrative: true });
  }

  if (currentLocationId && npc.locationId === currentLocationId) {
    return Object.freeze({ status: 'same_location', found: true, npcId: npc.id, locationId: npc.locationId, requiresNarrative: false });
  }

  const known = normalizeKnownLocations(knownLocations);
  if (known.has(npc.locationId)) {
    return Object.freeze({ status: 'known_location', found: false, npcId: npc.id, locationId: npc.locationId, requiresNarrative: false });
  }

  return Object.freeze({ status: 'needs_information', found: false, npcId: npc.id, requiresNarrative: true });
}
