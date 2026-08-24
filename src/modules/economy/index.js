import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { addStack } from '../inventory/index.js';

const manifest = validateGameModuleManifest({ name: 'economy', dataVersion: 3, actions: ['economy.work', 'economy.buy'] });

function work({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const location = context.contentPack.locations[character.locationId];
  const jobId = action.payload?.jobId;
  const job = location?.jobs?.find((entry) => entry.id === jobId);
  if (!job) return { ok: false, code: 'WORK_NOT_AVAILABLE' };

  character.money += job.rewardMoney;
  for (const [need, cost] of Object.entries(job.needCosts ?? {})) {
    if (!(need in character.needs)) continue;
    character.needs[need] = Math.min(100, character.needs[need] + cost);
  }
  const behaviorCount = (character.behaviorCounts[job.behaviorId] ?? 0) + 1;
  character.behaviorCounts[job.behaviorId] = behaviorCount;

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

function buy({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const location = context.contentPack.locations[character.locationId];
  const itemId = action.payload?.itemId;
  const offer = location?.market?.find((entry) => entry.itemId === itemId);
  if (!offer) return { ok: false, code: 'ITEM_NOT_SOLD' };
  if (character.money < offer.price) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
  character.money -= offer.price;
  addStack(character, itemId, 1);
  return {
    ok: true,
    code: 'PURCHASE_COMPLETED',
    data: { money: character.money, inventory: structuredClone(character.inventory) },
    events: [{ type: 'economy.money-sunk', data: { characterId: character.id, amount: offer.price, sink: `market:${character.locationId}` } }],
  };
}

export const economyModule = { manifest, actions: { 'economy.work': work, 'economy.buy': buy } };
