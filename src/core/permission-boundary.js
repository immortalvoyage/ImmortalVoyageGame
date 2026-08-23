export function getOwnedActiveCharacter(world, actor) {
  if (!actor?.sessionId) return null;
  const character = world.characters[actor.sessionId];
  if (!character) return null;
  if (character.ownerSessionId !== actor.sessionId) return null;
  if (character.status !== 'alive') return null;
  return character;
}
