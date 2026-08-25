import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { recordBehavior } from '../character/behavior.js';
import { addStack, removeStack } from '../inventory/index.js';
import { applyElapsedSurvival } from './elapsed.js';

const manifest = validateGameModuleManifest({
  name: 'survival',
  dataVersion: 7,
  actions: ['survival.gather', 'survival.consume', 'survival.rest'],
});

function gather({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const itemId = action.payload?.itemId;
  const location = context.contentPack.locations[character.locationId];
  const gatherable = location?.gatherables?.find((entry) => entry.itemId === itemId);
  if (!gatherable) return { ok: false, code: 'RESOURCE_NOT_AVAILABLE' };
  addStack(character, itemId, gatherable.quantity);
  const behaviorCount = recordBehavior(character, gatherable.behaviorId);
  return {
    ok: true,
    code: 'RESOURCE_GATHERED',
    data: { inventory: structuredClone(character.inventory) },
    events: [{
      type: 'character.behavior-recorded',
      data: { characterId: character.id, behaviorId: gatherable.behaviorId, count: behaviorCount },
    }],
  };
}

function consume({ world, actor, action, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const itemId = action.payload?.itemId;
  const item = context.contentPack.items[itemId];
  if (!item?.consumeEffect || !removeStack(character, itemId, 1)) return { ok: false, code: 'ITEM_NOT_AVAILABLE' };
  for (const [need, delta] of Object.entries(item.consumeEffect)) {
    if (!(need in character.needs)) continue;
    character.needs[need] = Math.max(0, Math.min(100, character.needs[need] + delta));
  }
  return { ok: true, code: 'ITEM_CONSUMED', data: { needs: structuredClone(character.needs), inventory: structuredClone(character.inventory) } };
}

function rest({ world, actor, context }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const location = context.contentPack.locations[character.locationId];
  if (!location?.rest) return { ok: false, code: 'REST_NOT_AVAILABLE' };
  const relief = context.contentPack.survival.restFatigueRelief;
  character.needs.fatigue = Math.max(0, character.needs.fatigue - relief);
  return {
    ok: true,
    code: 'REST_COMPLETED',
    data: { needs: structuredClone(character.needs) },
  };
}

function resolveElapsed({ world, elapsedSeconds, context }) {
  if (!Number.isSafeInteger(elapsedSeconds) || elapsedSeconds <= 0) return;
  for (const character of Object.values(world.characters)) {
    if (character.status !== 'alive') continue;
    applyElapsedSurvival(character, elapsedSeconds, context?.contentPack);
  }
}

export const survivalModule = {
  manifest,
  actions: {
    'survival.gather': gather,
    'survival.consume': consume,
    'survival.rest': rest,
  },
  resolveElapsed,
};
