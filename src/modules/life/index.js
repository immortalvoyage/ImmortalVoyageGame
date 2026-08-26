import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { worldInstantFromWorld } from '../../core/world-calendar.js';
import { createCharacterState, publicCharacter } from '../character/character-state.js';
import { validatePlayerDisplayName } from '../character/player-name.js';

const manifest = validateGameModuleManifest({
  name: 'life',
  dataVersion: 2,
  actions: ['life.create-pending', 'life.observe-birth-options', 'life.formal-birth'],
});

function isAccountId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value;
}

function publicPendingLife(pendingLife) {
  return {
    status: pendingLife.status,
    birthWorldInstant: structuredClone(pendingLife.birthWorldInstant),
  };
}

function activeCharacterForAccount(world, accountId) {
  return Object.values(world.characters).find((character) => character.ownerAccountId === accountId) ?? null;
}

function birthOptions(contentPack) {
  if (!Array.isArray(contentPack.birthLocations) || contentPack.birthLocations.length === 0) return null;
  return contentPack.birthLocations.map((locationId) => {
    const location = contentPack.locations[locationId];
    return { id: locationId, name: location.name, description: location.description };
  });
}

function createPendingLife({ world, actor }) {
  if (!isAccountId(actor?.accountId)) return { ok: false, code: 'ACCOUNT_ID_REQUIRED' };
  if (activeCharacterForAccount(world, actor.accountId)) return { ok: false, code: 'ACTIVE_LIFE_EXISTS' };
  const existing = world.pendingLives[actor.accountId];
  if (existing) return { ok: true, code: 'PENDING_LIFE_READY', data: { pendingLife: publicPendingLife(existing) } };

  const birthWorldInstant = worldInstantFromWorld(world);
  const pendingLife = {
    ownerAccountId: actor.accountId,
    status: 'pending',
    birthWorldInstant,
    createdLogicalTimeSeconds: world.logicalTimeSeconds,
  };
  world.pendingLives[actor.accountId] = pendingLife;
  return {
    ok: true,
    code: 'PENDING_LIFE_CREATED',
    data: { pendingLife: publicPendingLife(pendingLife) },
    events: [{ type: 'life.pending-created', data: { accountId: actor.accountId } }],
  };
}

function observeBirthOptions({ world, actor, context }) {
  if (!isAccountId(actor?.accountId)) return { ok: false, code: 'ACCOUNT_ID_REQUIRED' };
  if (activeCharacterForAccount(world, actor.accountId)) return { ok: false, code: 'ACTIVE_LIFE_EXISTS' };
  if (!world.pendingLives[actor.accountId]) return { ok: false, code: 'PENDING_LIFE_REQUIRED' };
  const options = birthOptions(context.contentPack);
  if (!options) return { ok: false, code: 'BIRTH_LOCATIONS_UNAVAILABLE' };
  return { ok: true, code: 'BIRTH_OPTIONS_READY', data: { options } };
}

function formalBirth({ world, actor, action, context }) {
  if (!isAccountId(actor?.accountId)) return { ok: false, code: 'ACCOUNT_ID_REQUIRED' };
  if (world.characters[actor.sessionId] || activeCharacterForAccount(world, actor.accountId)) {
    return { ok: false, code: 'ACTIVE_LIFE_EXISTS' };
  }
  const pendingLife = world.pendingLives[actor.accountId];
  if (!pendingLife) return { ok: false, code: 'PENDING_LIFE_REQUIRED' };

  const options = birthOptions(context.contentPack);
  if (!options) return { ok: false, code: 'BIRTH_LOCATIONS_UNAVAILABLE' };
  const locationId = action.payload?.birthLocationId;
  if (typeof locationId !== 'string' || !options.some((option) => option.id === locationId)) {
    return { ok: false, code: 'BIRTH_LOCATION_NOT_AVAILABLE' };
  }
  const validatedName = validatePlayerDisplayName(action.payload?.name);
  if (!validatedName.ok) return { ok: false, code: 'INVALID_NAME' };

  const character = createCharacterState({
    world,
    actor,
    name: validatedName.name,
    locationId,
    ownerAccountId: actor.accountId,
    birthWorldInstant: pendingLife.birthWorldInstant,
  });
  delete world.pendingLives[actor.accountId];
  return {
    ok: true,
    code: 'FORMAL_LIFE_BORN',
    data: { character: publicCharacter(character) },
    events: [
      { type: 'character.born', data: { characterId: character.id, locationId } },
      {
        type: 'life.formal-born',
        data: {
          characterId: character.id,
          accountId: actor.accountId,
          birthWorldInstant: structuredClone(character.birthWorldInstant),
        },
      },
    ],
  };
}

export const lifeModule = {
  manifest,
  actions: {
    'life.create-pending': createPendingLife,
    'life.observe-birth-options': observeBirthOptions,
    'life.formal-birth': formalBirth,
  },
};
