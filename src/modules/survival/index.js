import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { addStack, removeStack } from '../inventory/index.js';

const manifest = validateGameModuleManifest({ name: 'survival', dataVersion: 1, actions: ['survival.gather', 'survival.consume'] });

function gather({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const kind = action.payload?.kind;
  const allowed = character.locationId === 'starter-well' ? ['water'] : character.locationId === 'starter-grove' ? ['food'] : [];
  if (!allowed.includes(kind)) return { ok: false, code: 'RESOURCE_NOT_AVAILABLE' };
  addStack(character, kind, 1);
  return { ok: true, code: 'RESOURCE_GATHERED', data: { inventory: structuredClone(character.inventory) } };
}

function consume({ world, actor, action }) {
  const character = getOwnedActiveCharacter(world, actor);
  if (!character) return { ok: false, code: 'NO_ACTIVE_CHARACTER' };
  const kind = action.payload?.kind;
  if (!['water', 'food'].includes(kind) || !removeStack(character, kind, 1)) return { ok: false, code: 'ITEM_NOT_AVAILABLE' };
  if (kind === 'water') character.needs.thirst = Math.max(0, character.needs.thirst - 25);
  if (kind === 'food') character.needs.hunger = Math.max(0, character.needs.hunger - 25);
  return { ok: true, code: 'ITEM_CONSUMED', data: { needs: structuredClone(character.needs), inventory: structuredClone(character.inventory) } };
}

function resolveElapsed({ world, elapsedSeconds }) {
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 1) return;
  for (const character of Object.values(world.characters)) {
    if (character.status !== 'alive') continue;
    character.needs.hunger = Math.min(100, character.needs.hunger + Math.floor(elapsedMinutes / 30));
    character.needs.thirst = Math.min(100, character.needs.thirst + Math.floor(elapsedMinutes / 20));
    character.needs.fatigue = Math.min(100, character.needs.fatigue + Math.floor(elapsedMinutes / 60));
  }
}

export const survivalModule = { manifest, actions: { 'survival.gather': gather, 'survival.consume': consume }, resolveElapsed };
