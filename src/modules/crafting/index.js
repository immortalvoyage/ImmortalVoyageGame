import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { recordBehavior } from '../character/behavior.js';
import { addStack, canApplyInventoryDelta, removeStack } from '../inventory/index.js';

const manifest = validateGameModuleManifest({ name: 'crafting', dataVersion: 3, actions: ['crafting.craft'] });

function craft({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };

  const contentPack = context.contentPack;
  const location = contentPack.locations[character.locationId];
  const recipeId = action.payload?.recipeId;
  const recipe = location?.recipes?.find((entry) => entry.id === recipeId);
  if (!recipe) return { ok: false, code: 'CRAFT_NOT_AVAILABLE' };

  for (const input of recipe.inputs) {
    if ((character.inventory[input.itemId] ?? 0) < input.quantity) {
      return { ok: false, code: 'CRAFT_MATERIALS_MISSING' };
    }
  }

  const delta = { [recipe.output.itemId]: recipe.output.quantity };
  for (const input of recipe.inputs) delta[input.itemId] = (delta[input.itemId] ?? 0) - input.quantity;
  if (!canApplyInventoryDelta(character.inventory, contentPack.items, contentPack.inventory.carryCapacityUnits, delta)) {
    return { ok: false, code: 'CARRY_CAPACITY_EXCEEDED' };
  }

  for (const input of recipe.inputs) removeStack(character, input.itemId, input.quantity);
  addStack(character, recipe.output.itemId, recipe.output.quantity);
  const behaviorCount = recordBehavior(character, recipe.behaviorId);

  const outputItem = contentPack.items[recipe.output.itemId];
  return {
    ok: true,
    code: 'CRAFT_COMPLETED',
    data: {
      crafted: { name: outputItem.name, quantity: recipe.output.quantity },
    },
    events: [
      {
        type: 'crafting.completed',
        data: {
          characterId: character.id,
          recipeId: recipe.id,
          outputItemId: recipe.output.itemId,
          outputQuantity: recipe.output.quantity,
        },
      },
      {
        type: 'character.behavior-recorded',
        data: { characterId: character.id, behaviorId: recipe.behaviorId, count: behaviorCount },
      },
    ],
  };
}

export const craftingModule = { manifest, actions: { 'crafting.craft': craft } };
