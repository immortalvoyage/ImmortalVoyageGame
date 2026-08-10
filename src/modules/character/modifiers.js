import { getAttributeModifier } from './attributes.js';

function talentModifier(talents = [], key, fallback = 0) {
  let value = fallback;
  for (const talent of talents) {
    const modifier = talent?.modifiers?.[key];
    if (typeof modifier === 'number' && Number.isFinite(modifier)) {
      value += modifier;
    }
  }
  return value;
}

function talentMultiplier(talents = [], key) {
  let value = 1;
  for (const talent of talents) {
    const modifier = talent?.modifiers?.[key];
    if (typeof modifier === 'number' && Number.isFinite(modifier) && modifier >= 0) {
      value *= modifier;
    }
  }
  return value;
}

export function buildCheckModifier({ attributes, talents = [], attribute, talentKey = null, situational = 0 }) {
  const base = getAttributeModifier(attributes[attribute]);
  const talent = talentKey ? talentModifier(talents, talentKey, 0) : 0;
  return base + talent + Number(situational || 0);
}

export function buildSurvivalModifiers({ talents = [], environment = {} } = {}) {
  return Object.freeze({
    hungerModifier: talentMultiplier(talents, 'hungerRate') * Number(environment.hungerModifier ?? 1),
    thirstModifier: talentMultiplier(talents, 'thirstRate') * Number(environment.thirstModifier ?? 1),
  });
}
