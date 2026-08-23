import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { addStack } from '../inventory/index.js';

const manifest = validateGameModuleManifest({ name: 'economy', dataVersion: 1, actions: ['economy.work', 'economy.buy'] });

function work({ world, actor }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  if (character.locationId !== 'starter-square') return { ok: false, code: 'WORK_NOT_AVAILABLE' };
  character.money += 2;
  character.needs.hunger = Math.min(100, character.needs.hunger + 5);
  character.needs.thirst = Math.min(100, character.needs.thirst + 5);
  return {
    ok: true,
    code: 'WORK_COMPLETED',
    data: { money: character.money, needs: structuredClone(character.needs) },
    events: [{ type: 'economy.money-created', data: { characterId: character.id, amount: 2, source: 'starter-work' } }],
  };
}

function buy({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  if (character.locationId !== 'starter-square') return { ok: false, code: 'MARKET_NOT_AVAILABLE' };
  const itemId = action.payload?.itemId;
  const price = itemId === 'food' ? 1 : itemId === 'water' ? 1 : null;
  if (price === null) return { ok: false, code: 'ITEM_NOT_SOLD' };
  if (character.money < price) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
  character.money -= price;
  addStack(character, itemId, 1);
  return {
    ok: true,
    code: 'PURCHASE_COMPLETED',
    data: { money: character.money, inventory: structuredClone(character.inventory) },
    events: [{ type: 'economy.money-sunk', data: { characterId: character.id, amount: price, sink: 'starter-market' } }],
  };
}

export const economyModule = { manifest, actions: { 'economy.work': work, 'economy.buy': buy } };
