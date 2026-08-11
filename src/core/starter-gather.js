import { gatherIntoCharacter } from './character-gather.js';
import { GatherableResourceRegistry } from '../modules/resources/index.js';

const STARTER_RESOURCE_BY_REGION = Object.freeze({
  coast: Object.freeze({ resourceId: 'starter-shellfish', itemId: 'shellfish', label: '拾取潮間貝類' }),
  forest: Object.freeze({ resourceId: 'starter-berries', itemId: 'wild-berry', label: '採些野莓' }),
  grassland: Object.freeze({ resourceId: 'starter-herbs', itemId: 'wild-herb', label: '採些可用野草' }),
});

function regionKey(character) {
  const tags = Array.isArray(character?.birthRegionTags) ? character.birthRegionTags : [];
  if (tags.includes('coast') || tags.includes('island') || tags.includes('urban')) return 'coast';
  if (tags.includes('forest') || tags.includes('mountain')) return 'forest';
  return 'grassland';
}

export function getStarterGatherOption(character) {
  if (character?.starterGatheredAt) return null;
  return STARTER_RESOURCE_BY_REGION[regionKey(character)];
}

export function performStarterGather(character, { occurredAt = new Date().toISOString() } = {}) {
  const option = getStarterGatherOption(character);
  if (!option) {
    const error = new Error('starter gather already completed');
    error.code = 'starter_gather_complete';
    throw error;
  }
  const locationId = character?.birthRegionId;
  const registry = new GatherableResourceRegistry();
  registry.register({ id: option.resourceId, locationId, itemId: option.itemId, quantity: 1 });
  const gathered = gatherIntoCharacter(character, { playerLocationId: locationId, resourceRegistry: registry, resourceId: option.resourceId, quantity: 1 });
  if (!gathered.outcome.allowed) return gathered;
  return Object.freeze({
    character: Object.freeze({ ...gathered.character, starterGatheredAt: occurredAt }),
    outcome: Object.freeze({ ...gathered.outcome, label: option.label }),
  });
}
