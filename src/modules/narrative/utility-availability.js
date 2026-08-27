import { canApplyInventoryDelta } from '../inventory/index.js';

export function canCraftRecipe(character, recipe, contentPack = null) {
  if (!character || !Array.isArray(recipe?.inputs)) return false;
  const hasInputs = recipe.inputs.every((input) => Number.isSafeInteger(input?.quantity) && input.quantity > 0 && (character.inventory?.[input.itemId] ?? 0) >= input.quantity);
  if (!hasInputs || !contentPack) return hasInputs;
  const delta = { [recipe.output.itemId]: recipe.output.quantity };
  for (const input of recipe.inputs) delta[input.itemId] = (delta[input.itemId] ?? 0) - input.quantity;
  return canApplyInventoryDelta(character.inventory, contentPack.items, contentPack.inventory.carryCapacityUnits, delta);
}

export function canBuyOffer(character, offer, contentPack = null) {
  const affordable = Boolean(character && Number.isSafeInteger(character.money) && Number.isSafeInteger(offer?.price) && offer.price > 0 && character.money >= offer.price);
  if (!affordable || !contentPack) return affordable;
  return canApplyInventoryDelta(character.inventory, contentPack.items, contentPack.inventory.carryCapacityUnits, { [offer.itemId]: 1 });
}
