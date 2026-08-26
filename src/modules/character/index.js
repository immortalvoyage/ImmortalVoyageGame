import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { validatePlayerDisplayName } from './player-name.js';
import { createCharacterState, publicCharacter } from './character-state.js';

const manifest = validateGameModuleManifest({ name: 'character', dataVersion: 9, actions: ['character.birth'] });

function birth({ world, actor, action, context }) {
  if (context.lifeBirthPolicy === 'pending-required') return { ok: false, code: 'FORMAL_BIRTH_REQUIRED' };
  if (world.characters[actor.sessionId]) return { ok: false, code: 'CHARACTER_EXISTS' };
  const validatedName = validatePlayerDisplayName(action.payload?.name);
  if (!validatedName.ok) return { ok: false, code: 'INVALID_NAME' };
  const character = createCharacterState({
    world,
    actor,
    name: validatedName.name,
    locationId: context.contentPack.startingLocationId,
  });
  return {
    ok: true,
    code: 'CHARACTER_BORN',
    data: { character: publicCharacter(character) },
    events: [{ type: 'character.born', data: { characterId: character.id } }],
  };
}

export { publicCharacter };
export const characterModule = { manifest, actions: { 'character.birth': birth } };
