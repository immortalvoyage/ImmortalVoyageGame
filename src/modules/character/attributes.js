const ATTRIBUTE_KEYS = Object.freeze([
  'constitution',
  'strength',
  'agility',
  'perception',
  'mind',
  'willpower',
  'charisma',
]);

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 20) {
    throw new RangeError('attribute score must be an integer between 1 and 20');
  }
  return score;
}

export function createAttributes(values = {}) {
  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = normalizeScore(values[key] ?? 10);
  }
  return Object.freeze(attributes);
}

export function getAttributeModifier(score) {
  return Math.floor((normalizeScore(score) - 10) / 2);
}

export { ATTRIBUTE_KEYS };
