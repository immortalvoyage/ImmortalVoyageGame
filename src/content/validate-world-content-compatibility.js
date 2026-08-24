function fail(message) {
  throw new Error(`world/content mismatch: ${message}`);
}

function characterLabel(character, sessionId) {
  return typeof character?.id === 'string' && character.id ? character.id : `session:${sessionId}`;
}

export function validateWorldContentCompatibility(world, contentPack) {
  const locations = contentPack?.locations;
  const items = contentPack?.items;
  if (!locations || typeof locations !== 'object' || !items || typeof items !== 'object') {
    fail('Content Pack catalogs are unavailable');
  }

  for (const [sessionId, character] of Object.entries(world.characters ?? {})) {
    const label = characterLabel(character, sessionId);
    if (!Object.hasOwn(locations, character.locationId)) {
      fail(`${label} references unknown location: ${String(character.locationId)}`);
    }

    if (!character.inventory || typeof character.inventory !== 'object' || Array.isArray(character.inventory)) {
      fail(`${label} has invalid inventory state`);
    }
    for (const [itemId, quantity] of Object.entries(character.inventory)) {
      if (!Object.hasOwn(items, itemId)) {
        fail(`${label} inventory references unknown item: ${itemId}`);
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        fail(`${label} inventory has invalid quantity for item: ${itemId}`);
      }
    }
  }

  for (const [listingId, listing] of Object.entries(world.tradeListings ?? {})) {
    if (!Object.hasOwn(items, listing.itemId)) {
      fail(`${listingId} trade escrow references unknown item: ${String(listing.itemId)}`);
    }
  }

  return world;
}
