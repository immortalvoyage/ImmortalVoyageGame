import { SurvivalNeeds, resolveSurvivalTime } from '../modules/survival/index.js';

const ACTION_WORLD_DAYS = Object.freeze({
  'starter-gather': 1 / 24,
});

export function getActionWorldDays(actionId) {
  return Number(ACTION_WORLD_DAYS[String(actionId || '')] || 0);
}

export function applyActionSurvivalCost(character, actionId) {
  const elapsedWorldDays = getActionWorldDays(actionId);
  if (elapsedWorldDays <= 0) {
    return Object.freeze({ character, elapsedWorldDays: 0, survival: null });
  }

  const current = character?.survivalNeeds && typeof character.survivalNeeds === 'object'
    ? character.survivalNeeds
    : {};
  const needs = new SurvivalNeeds({ hunger: current.hunger ?? 100, thirst: current.thirst ?? 100 });
  const resolved = resolveSurvivalTime({ needs, elapsedWorldDays, online: true });
  const previousElapsed = Number(character?.elapsedWorldDays || 0);
  const survivalNeeds = Object.freeze({ ...resolved.state });
  const nextCharacter = Object.freeze({
    ...character,
    survivalNeeds,
    elapsedWorldDays: previousElapsed + elapsedWorldDays,
  });

  return Object.freeze({ character: nextCharacter, elapsedWorldDays, survival: resolved });
}
