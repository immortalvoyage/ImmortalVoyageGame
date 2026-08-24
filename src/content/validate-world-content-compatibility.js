function fail(message) {
  throw new Error(`world/content mismatch: ${message}`);
}

function characterLabel(character, sessionId) {
  return typeof character?.id === 'string' && character.id ? character.id : `session:${sessionId}`;
}

function validateInventoryItems(inventory, items, label) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) fail(`${label} has invalid inventory state`);
  for (const [itemId, quantity] of Object.entries(inventory)) {
    if (!Object.hasOwn(items, itemId)) fail(`${label} references unknown item: ${itemId}`);
    if (!Number.isSafeInteger(quantity) || quantity < 1) fail(`${label} has invalid quantity for item: ${itemId}`);
  }
}

function validateKnowledgeIds(knowledgeIds, knowledge, label) {
  if (!Array.isArray(knowledgeIds)) fail(`${label} has invalid knowledge state`);
  for (const knowledgeId of knowledgeIds) {
    if (!Object.hasOwn(knowledge, knowledgeId)) fail(`${label} references unknown knowledge: ${String(knowledgeId)}`);
  }
}

export function validateWorldContentCompatibility(world, contentPack) {
  const locations = contentPack?.locations;
  const items = contentPack?.items;
  const knowledge = contentPack?.knowledge;
  if (!locations || typeof locations !== 'object'
    || !items || typeof items !== 'object'
    || !knowledge || typeof knowledge !== 'object') {
    fail('Content Pack catalogs are unavailable');
  }

  for (const [sessionId, character] of Object.entries(world.characters ?? {})) {
    const label = characterLabel(character, sessionId);
    if (!Object.hasOwn(locations, character.locationId)) {
      fail(`${label} references unknown location: ${String(character.locationId)}`);
    }
    validateInventoryItems(character.inventory, items, `${label} inventory`);
    validateKnowledgeIds(character.knowledgeIds, knowledge, label);
  }

  for (const [listingId, listing] of Object.entries(world.tradeListings ?? {})) {
    if (!Object.hasOwn(items, listing.itemId)) {
      fail(`${listingId} trade escrow references unknown item: ${String(listing.itemId)}`);
    }
  }

  for (const [estateId, estate] of Object.entries(world.estates ?? {})) {
    validateInventoryItems(estate.inventory, items, `${estateId} estate inventory`);
  }

  return world;
}
