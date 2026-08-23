import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { getOwnedActiveCharacter } from '../../core/permission-boundary.js';
import { addStack, removeStack } from '../inventory/index.js';

const manifest = validateGameModuleManifest({ name: 'survival', dataVersion: 2, actions: ['survival.gather', 'survival.consume'] });

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

const NEED_INTERVAL_SECONDS = Object.freeze({
  hunger: 30 * 60,
  thirst: 20 * 60,
  fatigue: 60 * 60,
});

function resolveElapsed({ world, elapsedSeconds }) {
  if (!Number.isInteger(elapsedSeconds) || elapsedSeconds <= 0) return;
  for (const character of Object.values(world.characters)) {
    if (character.status !== 'alive') continue;
    character.needProgressSeconds ??= { hunger: 0, thirst: 0, fatigue: 0 };
    for (const [need, intervalSeconds] of Object.entries(NEED_INTERVAL_SECONDS)) {
      const accumulated = (character.needProgressSeconds[need] ?? 0) + elapsedSeconds;
      const increments = Math.floor(accumulated / intervalSeconds);
      character.needProgressSeconds[need] = accumulated % intervalSeconds;
      if (increments > 0) character.needs[need] = Math.min(100, character.needs[need] + increments);
    }
  }
}

export const survivalModule = { manifest, actions: { 'survival.gather': gather, 'survival.consume': consume }, resolveElapsed };
