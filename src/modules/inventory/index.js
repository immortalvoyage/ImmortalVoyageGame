import { validateGameModuleManifest } from '../../core/module-manifest.js';

const manifest = validateGameModuleManifest({ name: 'inventory', dataVersion: 3, actions: [] });

export function addStack(character, itemId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('invalid quantity');
  character.inventory[itemId] = (character.inventory[itemId] ?? 0) + quantity;
}

export function removeStack(character, itemId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('invalid quantity');
  if ((character.inventory[itemId] ?? 0) < quantity) return false;
  character.inventory[itemId] -= quantity;
  if (character.inventory[itemId] === 0) delete character.inventory[itemId];
  return true;
}

function calculateCarryLoadBigInt(inventory, itemCatalog = {}) {
  let load = 0n;
  for (const [itemId, quantity] of Object.entries(inventory ?? {})) {
    const units = itemCatalog[itemId]?.carryUnits;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(units) || units < 0) continue;
    load += BigInt(quantity) * BigInt(units);
  }
  return load;
}

export function calculateCarryLoad(inventory, itemCatalog = {}) {
  const load = calculateCarryLoadBigInt(inventory, itemCatalog);
  return load > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(load);
}
export function canApplyInventoryDelta(inventory, itemCatalog, carryCapacityUnits, delta = {}) {
  if (!Number.isSafeInteger(carryCapacityUnits) || carryCapacityUnits < 1) return false;
  const projected = { ...(inventory ?? {}) };
  for (const [itemId, change] of Object.entries(delta)) {
    if (!Number.isSafeInteger(change)) return false;
    const next = (projected[itemId] ?? 0) + change;
    if (!Number.isSafeInteger(next) || next < 0) return false;
    if (next === 0) delete projected[itemId]; else projected[itemId] = next;
  }
  const currentLoad = calculateCarryLoadBigInt(inventory, itemCatalog);
  const projectedLoad = calculateCarryLoadBigInt(projected, itemCatalog);
  const limit = currentLoad > BigInt(carryCapacityUnits) ? currentLoad : BigInt(carryCapacityUnits);
  return projectedLoad <= limit;
}
export function buildPublicCarryState(inventory, itemCatalog, carryCapacityUnits) {
  const load = calculateCarryLoad(inventory, itemCatalog);
  return { load, capacity: carryCapacityUnits, overloaded: load > carryCapacityUnits };
}

export function buildPublicInventory(inventory, itemCatalog = {}) {
  return Object.entries(inventory ?? {})
    .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([itemId, quantity]) => ({
      name: itemCatalog[itemId]?.name ?? '未知物品',
      quantity,
    }));
}

export const inventoryModule = { manifest, actions: {} };
