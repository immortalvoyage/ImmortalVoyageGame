import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { recordBehavior } from '../character/behavior.js';
import { hasEmploymentForJob } from '../employment/index.js';
import { addStack, canApplyInventoryDelta } from '../inventory/index.js';
import { canPerformSurvivalLimitedWork } from '../survival/condition.js';
import { findEligibleRecoveryWork } from './recovery-work.js';

const manifest = validateGameModuleManifest({ name: 'economy', dataVersion: 8, actions: ['economy.work', 'economy.buy', 'economy.recovery-work'] });

function survivalGuardEnabled(context) {
  const isActionAvailable = context?.isActionAvailable;
  if (typeof isActionAvailable !== 'function') return true;
  return isActionAvailable('survival.gather') || isActionAvailable('survival.consume');
}

function employmentGuardEnabled(context) {
  return context?.isActionAvailable?.('employment.observe') ?? false;
}

function work({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const locationId = character.locationId;
  const location = context.contentPack.locations[locationId];
  const jobId = action.payload?.jobId;
  const job = location?.jobs?.find((entry) => entry.id === jobId);
  if (!job) return { ok: false, code: 'WORK_NOT_AVAILABLE' };
  if (employmentGuardEnabled(context) && !hasEmploymentForJob(character, job, locationId)) {
    return { ok: false, code: 'EMPLOYMENT_REQUIRED' };
  }
  if (survivalGuardEnabled(context) && !canPerformSurvivalLimitedWork(character, context.contentPack.survival)) {
    return { ok: false, code: 'SURVIVAL_CONDITION_TOO_POOR' };
  }

  if (character.activeActivity) return { ok: false, code: 'ACTIVITY_ALREADY_ACTIVE' };
  if (job.durationSeconds === undefined) return completeWork(character, job);

  character.activeActivity = {
    type: 'work',
    jobId: job.id,
    workLocationId: character.locationId,
    behaviorId: job.behaviorId,
    rewardMoney: job.rewardMoney,
    needCosts: structuredClone(job.needCosts ?? {}),
    startedLogicalTimeSeconds: world.logicalTimeSeconds,
    completesLogicalTimeSeconds: world.logicalTimeSeconds + job.durationSeconds,
  };
  return {
    ok: true,
    code: 'WORK_STARTED',
    data: { completesLogicalTimeSeconds: character.activeActivity.completesLogicalTimeSeconds },
    events: [{ type: 'economy.work-started', data: { characterId: character.id, jobId: job.id } }],
  };
}


function completeWork(character, job) {
  character.money += job.rewardMoney;
  for (const [need, cost] of Object.entries(job.needCosts ?? {})) {
    if (!(need in character.needs)) continue;
    character.needs[need] = Math.min(100, character.needs[need] + cost);
  }
  const behaviorCount = recordBehavior(character, job.behaviorId);
  return {
    ok: true,
    code: 'WORK_COMPLETED',
    data: { money: character.money, needs: structuredClone(character.needs) },
    events: [
      { type: 'economy.money-created', data: { characterId: character.id, amount: job.rewardMoney, source: job.id } },
      { type: 'character.behavior-recorded', data: { characterId: character.id, behaviorId: job.behaviorId, count: behaviorCount } },
    ],
  };
}

function resolveElapsed({ world }) {
  const events = [];
  for (const character of Object.values(world.characters)) {
    const activity = character.activeActivity;
    if (character.status !== 'alive' || !activity || activity.type !== 'work') continue;
    if (activity.completesLogicalTimeSeconds > world.logicalTimeSeconds) continue;
    const outcome = completeWork(character, {
      id: activity.jobId,
      behaviorId: activity.behaviorId,
      rewardMoney: activity.rewardMoney,
      needCosts: activity.needCosts,
    });
    character.activeActivity = null;
    events.push(...outcome.events);
  }
  return events;
}

function recoveryWork({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  if (!(context?.isActionAvailable?.('survival.consume') ?? false)) {
    return { ok: false, code: 'RECOVERY_WORK_NOT_AVAILABLE' };
  }
  const entry = findEligibleRecoveryWork(character, context.contentPack, action.payload?.recoveryWorkId);
  if (!entry) return { ok: false, code: 'RECOVERY_WORK_NOT_AVAILABLE' };

  addStack(character, entry.reward.itemId, entry.reward.quantity);
  const behaviorCount = recordBehavior(character, entry.behaviorId);
  const item = context.contentPack.items[entry.reward.itemId];
  return {
    ok: true,
    code: 'RECOVERY_WORK_COMPLETED',
    data: {
      reward: { name: item.name, quantity: entry.reward.quantity },
      inventory: structuredClone(character.inventory),
    },
    events: [
      { type: 'economy.recovery-supply-earned', data: { characterId: character.id, itemId: entry.reward.itemId, quantity: entry.reward.quantity, source: entry.id } },
      { type: 'character.behavior-recorded', data: { characterId: character.id, behaviorId: entry.behaviorId, count: behaviorCount } },
    ],
  };
}

function buy({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const location = context.contentPack.locations[character.locationId];
  const itemId = action.payload?.itemId;
  const offer = location?.market?.find((entry) => entry.itemId === itemId);
  if (!offer) return { ok: false, code: 'ITEM_NOT_SOLD' };
  if (character.money < offer.price) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
  if (!canApplyInventoryDelta(character.inventory, context.contentPack.items, context.contentPack.inventory.carryCapacityUnits, { [itemId]: 1 })) {
    return { ok: false, code: 'CARRY_CAPACITY_EXCEEDED' };
  }
  character.money -= offer.price;
  addStack(character, itemId, 1);
  return {
    ok: true,
    code: 'PURCHASE_COMPLETED',
    data: { money: character.money, inventory: structuredClone(character.inventory) },
    events: [{ type: 'economy.money-sunk', data: { characterId: character.id, amount: offer.price, sink: `market:${character.locationId}` } }],
  };
}

export const economyModule = { manifest, actions: { 'economy.work': work, 'economy.buy': buy, 'economy.recovery-work': recoveryWork }, resolveElapsed };
