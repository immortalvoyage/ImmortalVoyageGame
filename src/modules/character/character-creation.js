import { ATTRIBUTE_KEYS, createAttributes } from './attributes.js';
import { rollBirthTalents } from './talents.js';
import { assertCharacterName } from './character-name.js';

const ORIGIN_PREFERENCES = Object.freeze([
  'random',
  'coast',
  'island',
  'desert',
  'grassland',
  'mountain',
  'forest',
  'cold',
  'urban',
]);

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function rollDie(sides, random) {
  return Math.floor(random() * sides) + 1;
}

function rollAttributeScore(random) {
  return rollDie(6, random) + rollDie(6, random) + rollDie(6, random);
}

function rollAttributes(random) {
  return createAttributes(Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, rollAttributeScore(random)])));
}

function selectBirthRegion({ regions, preference = 'random', random = Math.random }) {
  if (!ORIGIN_PREFERENCES.includes(preference)) throw new TypeError('unsupported origin preference');
  const available = regions.filter((region) => region && region.birthAllowed !== false && region.active !== false);
  if (!available.length) throw new RangeError('no birth region available');

  const weighted = available.map((region) => {
    const tags = Array.isArray(region.tags) ? region.tags : [];
    const baseWeight = Math.max(0.01, Number(region.weight) || 1);
    const preferenceBoost = preference !== 'random' && tags.includes(preference) ? 4 : 1;
    return { region, weight: baseWeight * preferenceBoost };
  });

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.region;
  }
  return weighted.at(-1).region;
}

export function createCharacterFromBirth({
  characterId,
  playerId,
  characterName,
  regions,
  originPreference = 'random',
  talentCount = 1,
  random = Math.random,
}) {
  if (!Array.isArray(regions)) throw new TypeError('regions must be an array');
  const birthRegion = selectBirthRegion({ regions, preference: originPreference, random });
  const birthRegionTags = Object.freeze([...(birthRegion.tags ?? [])]);
  const attributes = rollAttributes(random);
  const talents = rollBirthTalents({ regionTags: birthRegionTags, count: talentCount, random });

  return Object.freeze({
    characterId: requireText(characterId, 'characterId'),
    playerId: requireText(playerId, 'playerId'),
    name: assertCharacterName(characterName),
    creationVersion: 1,
    originPreference,
    birthRegionId: requireText(birthRegion.id, 'birthRegion.id'),
    birthRegionTags,
    attributes,
    talents,
    status: 'alive',
  });
}

export { ORIGIN_PREFERENCES, selectBirthRegion };
