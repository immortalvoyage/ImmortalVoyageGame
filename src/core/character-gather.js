import { attachInventoryToCharacter, inventoryFromCharacter } from '../modules/inventory/index.js';
import { resolveGather } from '../modules/resources/index.js';

export function gatherIntoCharacter(character, { playerLocationId, resourceRegistry, resourceId, quantity = 1 }) {
  if (!character || typeof character !== 'object') throw new TypeError('character is required');
  const inventory = inventoryFromCharacter(character);
  const outcome = resolveGather({ playerLocationId, resourceRegistry, resourceId, inventory, quantity });
  if (!outcome.allowed) return Object.freeze({ character, outcome });
  return Object.freeze({ character: attachInventoryToCharacter(character, inventory), outcome });
}
