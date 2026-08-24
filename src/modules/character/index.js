import { validateGameModuleManifest } from '../../core/module-manifest.js';

const manifest = validateGameModuleManifest({ name: 'character', dataVersion: 4, actions: ['character.birth'] });

function birth({ world, actor, action, context }) {
  if (world.characters[actor.sessionId]) return { ok: false, code: 'CHARACTER_EXISTS' };
  const name = String(action.payload?.name ?? '').trim();
  if (name.length < 1 || name.length > 24) return { ok: false, code: 'INVALID_NAME' };

  const character = {
    id: `char:${world.nextCharacterSequence++}`,
    ownerSessionId: actor.sessionId,
    name,
    status: 'alive',
    locationId: context.contentPack.startingLocationId,
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    behaviorCounts: {},
    inventory: {},
    money: 0,
  };
  world.characters[actor.sessionId] = character;
  return {
    ok: true,
    code: 'CHARACTER_BORN',
    data: { character: publicCharacter(character) },
    events: [{ type: 'character.born', data: { characterId: character.id } }],
  };
}

export function publicCharacter(character) {
  const {
    ownerSessionId: _ownerSessionId,
    needProgressSeconds: _needProgressSeconds,
    behaviorCounts: _behaviorCounts,
    ...publicFields
  } = character;
  return structuredClone(publicFields);
}

export const characterModule = { manifest, actions: { 'character.birth': birth } };
