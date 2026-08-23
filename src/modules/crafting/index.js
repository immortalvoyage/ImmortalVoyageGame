import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { devStarterPack } from '../../content/dev-starter.js';
import { addStack, removeStack } from '../inventory/index.js';

const manifest = validateGameModuleManifest({ name: 'crafting', dataVersion: 1, actions: ['crafting.craft'] });

function craft({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };

  const location = devStarterPack.locations[character.locationId];
  const recipeId = action.payload?.recipeId;
  const recipe = location?.recipes?.find((entry) => entry.id === recipeId);
  if (!recipe) return { ok: false, code: 'CRAFT_NOT_AVAILABLE' };

  for (const input of recipe.inputs) {
    if ((character.inventory[input.itemId] ?? 0) < input.quantity) {
      return { ok: false, code: 'CRAFT_MATERIALS_MISSING' };
    }
  }

  for (const input of recipe.inputs) removeStack(character, input.itemId, input.quantity);
  addStack(character, recipe.output.itemId, recipe.output.quantity);

  const outputItem = devStarterPack.items[recipe.output.itemId];
  return {
    ok: true,
    code: 'CRAFT_COMPLETED',
    data: {
      crafted: { name: outputItem.name, quantity: recipe.output.quantity },
    },
    events: [{
      type: 'crafting.completed',
      data: {
        characterId: character.id,
        recipeId: recipe.id,
        outputItemId: recipe.output.itemId,
        outputQuantity: recipe.output.quantity,
      },
    }],
  };
}

export const craftingModule = { manifest, actions: { 'crafting.craft': craft } };
