import { validateGameModuleManifest } from '../../core/module-manifest.js';

const CAUSE_RE = /^[a-z][a-z0-9._:-]{0,63}$/;
const manifest = validateGameModuleManifest({ name: 'estate', dataVersion: 1, actions: [] });

function failure(code) {
  return { ok: false, code };
}

function mergeStack(inventory, itemId, quantity) {
  const current = inventory[itemId] ?? 0;
  const next = current + quantity;
  if (!Number.isSafeInteger(next) || next < 1) return false;
  inventory[itemId] = next;
  return true;
}

function estateIdFor(characterId) {
  return `estate:${characterId}`;
}

export function settleCharacterDeath({ world, sessionId, characterId, causeCode }) {
  if (!world || typeof world !== 'object') return failure('INVALID_WORLD');
  if (typeof sessionId !== 'string' || !sessionId || typeof characterId !== 'string' || !characterId) {
    return failure('DEATH_CHARACTER_NOT_ACTIVE');
  }
  if (typeof causeCode !== 'string' || !CAUSE_RE.test(causeCode)) return failure('INVALID_DEATH_CAUSE');

  const character = world.characters?.[sessionId];
  if (!character || character.id !== characterId || character.ownerSessionId !== sessionId || character.status !== 'alive') {
    return failure('DEATH_CHARACTER_NOT_ACTIVE');
  }

  const estateId = estateIdFor(character.id);
  if (world.archivedCharacters?.[character.id] || world.estates?.[estateId]) return failure('ESTATE_ALREADY_EXISTS');

  const estateInventory = structuredClone(character.inventory ?? {});
  const settledTradeListingIds = [];
  for (const [listingId, listing] of Object.entries(world.tradeListings ?? {})) {
    if (listing.sellerSessionId !== sessionId || listing.sellerCharacterId !== character.id) continue;
    if (!mergeStack(estateInventory, listing.itemId, listing.quantity)) return failure('ESTATE_ASSET_LIMIT');
    settledTradeListingIds.push(listingId);
  }

  const archivedCharacter = {
    id: character.id,
    ownerSessionId: character.ownerSessionId,
    name: character.name,
    status: 'dead',
    locationId: character.locationId,
    needs: structuredClone(character.needs),
    needProgressSeconds: structuredClone(character.needProgressSeconds),
    behaviorCounts: structuredClone(character.behaviorCounts),
    estateId,
    diedLogicalTimeSeconds: world.logicalTimeSeconds,
    deathCauseCode: causeCode,
  };
  const estate = {
    id: estateId,
    deceasedCharacterId: character.id,
    status: 'pending',
    openedLogicalTimeSeconds: world.logicalTimeSeconds,
    money: character.money,
    inventory: estateInventory,
  };

  for (const listingId of settledTradeListingIds) delete world.tradeListings[listingId];
  delete world.characters[sessionId];
  world.archivedCharacters[character.id] = archivedCharacter;
  world.estates[estateId] = estate;

  return {
    ok: true,
    code: 'ESTATE_OPENED',
    data: {
      deceased: { id: character.id, name: character.name },
      estateId,
      status: estate.status,
    },
    events: [
      {
        type: 'character.died',
        data: {
          characterId: character.id,
          causeCode,
          locationId: character.locationId,
          estateId,
        },
      },
      {
        type: 'estate.opened',
        data: {
          estateId,
          deceasedCharacterId: character.id,
          money: estate.money,
          itemStackCount: Object.keys(estate.inventory).length,
          settledTradeListingIds,
        },
      },
    ],
  };
}

export const estateModule = { manifest, actions: {} };
