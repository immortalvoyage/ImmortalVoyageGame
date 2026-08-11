import { attachInventoryToCharacter, inventoryFromCharacter } from '../modules/inventory/index.js';
import { GatherableResourceRegistry, resolveGather } from '../modules/resources/index.js';

const STARTER_RESOURCES_BY_REGION = Object.freeze({
  coast: Object.freeze([
    Object.freeze({ id: 'starter-shellfish', itemId: 'shellfish', label: '潮間貝', quantity: 2 }),
    Object.freeze({ id: 'starter-driftwood', itemId: 'driftwood', label: '漂流木', quantity: 2 }),
  ]),
  forest: Object.freeze([
    Object.freeze({ id: 'starter-wild-berry', itemId: 'wild-berry', label: '野莓', quantity: 2 }),
    Object.freeze({ id: 'starter-fallen-branch', itemId: 'wood', label: '落枝', quantity: 2 }),
  ]),
  grassland: Object.freeze([
    Object.freeze({ id: 'starter-edible-root', itemId: 'edible-root', label: '可食根莖', quantity: 2 }),
    Object.freeze({ id: 'starter-dry-grass', itemId: 'dry-grass', label: '乾草束', quantity: 2 }),
  ]),
});

function regionKey(character) {
  const tags = Array.isArray(character?.birthRegionTags) ? character.birthRegionTags : [];
  if (tags.includes('coast') || tags.includes('island') || tags.includes('urban')) return 'coast';
  if (tags.includes('forest') || tags.includes('mountain')) return 'forest';
  return 'grassland';
}

function starterLocationId(character) {
  return character?.offlineState?.locationId || character?.birthRegionId || `birth-${regionKey(character)}`;
}

function resourceState(character) {
  return character?.starterGathering && typeof character.starterGathering === 'object'
    ? character.starterGathering
    : { depleted: [] };
}

export function getStarterGatherOptions(character) {
  const state = resourceState(character);
  const depleted = new Set(Array.isArray(state.depleted) ? state.depleted : []);
  return Object.freeze(STARTER_RESOURCES_BY_REGION[regionKey(character)]
    .filter((resource) => !depleted.has(resource.id))
    .map((resource) => Object.freeze({ id: resource.id, itemId: resource.itemId, label: resource.label })));
}

export function gatherStarterResource(character, resourceId) {
  if (!character || typeof character !== 'object') throw new TypeError('character is required');

  const locationId = starterLocationId(character);
  const state = resourceState(character);
  const depleted = new Set(Array.isArray(state.depleted) ? state.depleted : []);
  const registry = new GatherableResourceRegistry();

  for (const resource of STARTER_RESOURCES_BY_REGION[regionKey(character)]) {
    registry.register({
      id: resource.id,
      locationId,
      itemId: resource.itemId,
      quantity: depleted.has(resource.id) ? 0 : resource.quantity,
      tags: ['starter'],
    });
  }

  const inventory = inventoryFromCharacter(character);
  const result = resolveGather({
    playerLocationId: locationId,
    resourceRegistry: registry,
    resourceId: String(resourceId || ''),
    inventory,
    quantity: 1,
  });

  if (!result.allowed) {
    const error = new Error('starter resource unavailable');
    error.code = result.reason || 'starter_resource_unavailable';
    throw error;
  }

  const updatedDepleted = new Set(depleted);
  if ((registry.get(result.resourceId)?.quantity ?? 0) <= 0) updatedDepleted.add(result.resourceId);

  const withInventory = attachInventoryToCharacter(character, inventory);
  return Object.freeze({
    character: Object.freeze({
      ...withInventory,
      starterGathering: Object.freeze({ depleted: Object.freeze([...updatedDepleted]) }),
    }),
    result: Object.freeze({ ...result, locationId }),
  });
}
