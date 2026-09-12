import { canApplyInventoryDelta } from '../inventory/index.js';
import { evaluateSurvivalCondition } from '../survival/condition.js';

function relievesNeed(item, need) {
  return Number.isInteger(item?.consumeEffect?.[need]) && item.consumeEffect[need] < 0;
}

function heldReliefForNeeds(character, items, needs) {
  return Object.entries(character.inventory ?? {}).some(([itemId, quantity]) => {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return false;
    const item = items[itemId];
    return needs.some((need) => relievesNeed(item, need));
  });
}

export function eligibleRecoveryWork(character, contentPack, location) {
  const condition = evaluateSurvivalCondition(character, contentPack.survival);
  if (condition.severity !== 'critical') return [];
  const criticalNeeds = condition.criticalNeeds.map((entry) => entry.need);
  return (location?.recoveryWork ?? []).filter((entry) => {
    const rewardItem = contentPack.items[entry.reward.itemId];
    const relievedCriticalNeeds = criticalNeeds.filter((need) => relievesNeed(rewardItem, need));
    if (relievedCriticalNeeds.length === 0) return false;
    if (heldReliefForNeeds(character, contentPack.items, relievedCriticalNeeds)) return false;
    return canApplyInventoryDelta(
      character.inventory,
      contentPack.items,
      contentPack.inventory.carryCapacityUnits,
      { [entry.reward.itemId]: entry.reward.quantity },
    );
  });
}

export function findEligibleRecoveryWork(character, contentPack, recoveryWorkId) {
  const location = contentPack.locations[character.locationId];
  return eligibleRecoveryWork(character, contentPack, location)
    .find((entry) => entry.id === recoveryWorkId) ?? null;
}
