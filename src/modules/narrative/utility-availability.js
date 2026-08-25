export function canCraftRecipe(character, recipe) {
  if (!character || !Array.isArray(recipe?.inputs)) return false;
  return recipe.inputs.every((input) => (
    Number.isSafeInteger(input?.quantity)
    && input.quantity > 0
    && (character.inventory?.[input.itemId] ?? 0) >= input.quantity
  ));
}

export function canBuyOffer(character, offer) {
  return Boolean(
    character
    && Number.isSafeInteger(character.money)
    && Number.isSafeInteger(offer?.price)
    && offer.price > 0
    && character.money >= offer.price,
  );
}
