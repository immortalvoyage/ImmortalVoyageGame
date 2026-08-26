import { validateGameModuleManifest } from '../../core/module-manifest.js';
import { validatePlayerDisplayName } from './player-name.js';

const manifest = validateGameModuleManifest({ name: 'character', dataVersion: 8, actions: ['character.birth'] });

function birth({ world, actor, action, context }) {
  if (world.characters[actor.sessionId]) return { ok: false, code: 'CHARACTER_EXISTS' };
  const validatedName = validatePlayerDisplayName(action.payload?.name);
  if (!validatedName.ok) return { ok: false, code: 'INVALID_NAME' };
  const name = validatedName.name;

  const character = {
    id: `char:${world.nextCharacterSequence++}`,
    ownerSessionId: actor.sessionId,
    name,
    status: 'alive',
    locationId: context.contentPack.startingLocationId,
    needs: { hunger: 0, thirst: 0, fatigue: 0 },
    needProgressSeconds: { hunger: 0, thirst: 0, fatigue: 0 },
    lastActiveLogicalTimeSeconds: world.logicalTimeSeconds,
    lastSurvivalResolvedLogicalTimeSeconds: world.logicalTimeSeconds,
    behaviorCounts: {},
    knowledgeIds: [],
    currentEmployment: null,
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
    lastActiveLogicalTimeSeconds: _lastActiveLogicalTimeSeconds,
    lastSurvivalResolvedLogicalTimeSeconds: _lastSurvivalResolvedLogicalTimeSeconds,
    behaviorCounts: _behaviorCounts,
    knowledgeIds: _knowledgeIds,
    currentEmployment: _currentEmployment,
    ...publicFields
  } = character;
  return structuredClone(publicFields);
}

export const characterModule = { manifest, actions: { 'character.birth': birth } };
