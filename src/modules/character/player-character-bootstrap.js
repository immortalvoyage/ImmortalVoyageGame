function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

export function createPlayerCharacterBootstrap({ repository, createCharacter }) {
  if (!repository || typeof repository.getByPlayerId !== 'function' || typeof repository.save !== 'function') {
    throw new TypeError('repository is required');
  }
  if (typeof createCharacter !== 'function') throw new TypeError('createCharacter is required');

  return Object.freeze({
    async resolve({ playerId, createInput = null }) {
      const id = requireText(playerId, 'playerId');
      const characters = await repository.getByPlayerId(id);
      const active = characters.find((character) => character?.status === 'alive') ?? null;

      if (active) {
        return Object.freeze({
          state: 'existing_character',
          character: active,
          created: false,
        });
      }

      if (!createInput) {
        return Object.freeze({
          state: 'character_creation_required',
          character: null,
          created: false,
        });
      }

      const character = await createCharacter({ ...createInput, playerId: id });
      if (!character || String(character.playerId) !== id) throw new Error('created character ownership mismatch');
      const saved = await repository.save(character);

      return Object.freeze({
        state: 'character_created',
        character: saved,
        created: true,
      });
    },
  });
}
