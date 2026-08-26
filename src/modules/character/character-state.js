export function createCharacterState({
  world,
  actor,
  name,
  locationId,
  ownerAccountId = null,
  birthWorldInstant = null,
}) {
  const character = {
    id: `char:${world.nextCharacterSequence++}`,
    ownerSessionId: actor.sessionId,
    ownerAccountId,
    birthWorldInstant: birthWorldInstant === null ? null : structuredClone(birthWorldInstant),
    name,
    status: 'alive',
    locationId,
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
  return character;
}

export function publicCharacter(character) {
  const {
    ownerSessionId: _ownerSessionId,
    ownerAccountId: _ownerAccountId,
    birthWorldInstant: _birthWorldInstant,
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
