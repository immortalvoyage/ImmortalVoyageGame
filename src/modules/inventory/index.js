import { validateGameModuleManifest } from '../../core/module-manifest.js';

const manifest = validateGameModuleManifest({ name: 'inventory', dataVersion: 1, actions: [] });

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

export const inventoryModule = { manifest, actions: {} };
