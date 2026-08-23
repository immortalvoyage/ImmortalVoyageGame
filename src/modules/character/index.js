import { validateGameModuleManifest } from '../../core/module-manifest.js';

const manifest = validateGameModuleManifest({ name: 'character', dataVersion: 1, actions: ['character.birth'] });

function birth({ world, actor, action }) {
  if (world.characters[actor.sessionId]) return { ok: false, code: 'CHARACTER_EXISTS' };
  const name = String(action.payload?.name ?? '').trim();
  if (name.length < 1 || name.length > 24) return { ok: false, code: 'INVALID_NAME' };

  const character = {
    id: `char:${actor.sessionId}`,
    ownerSessionId: actor.sessionId,
    name,
    status: 'alive',
    locationId: 'starter-square',
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    inventory: {},
    money: 0,
  };
  world.characters[actor.sessionId] = character;
  return {
    ok: true,
    code: 'CHARACTER_BORN',
    data: { character: structuredClone(character) },
    events: [{ type: 'character.born', data: { characterId: character.id } }],
  };
}

export const characterModule = { manifest, actions: { 'character.birth': birth } };
