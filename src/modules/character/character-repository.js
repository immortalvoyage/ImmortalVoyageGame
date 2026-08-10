function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function clone(value) {
  return structuredClone(value);
}

export function createMemoryCharacterRepository() {
  const records = new Map();

  return Object.freeze({
    async save(character) {
      if (!character || typeof character !== 'object') throw new TypeError('character is required');
      const characterId = requireText(character.characterId, 'character.characterId');
      const playerId = requireText(character.playerId, 'character.playerId');
      const existing = records.get(characterId);
      if (existing && existing.playerId !== playerId) throw new Error('character ownership mismatch');

      const saved = clone(character);
      records.set(characterId, saved);
      return clone(saved);
    },

    async getById(characterId) {
      const record = records.get(requireText(characterId, 'characterId'));
      return record ? clone(record) : null;
    },

    async getByPlayerId(playerId) {
      const id = requireText(playerId, 'playerId');
      return [...records.values()].filter((record) => record.playerId === id).map(clone);
    },
  });
}
