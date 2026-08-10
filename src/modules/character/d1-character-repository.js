function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function parseRow(row) {
  if (!row) return null;
  return JSON.parse(row.payload_json);
}

export function createD1CharacterRepository(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('D1 database binding is required');

  return Object.freeze({
    async save(character) {
      if (!character || typeof character !== 'object') throw new TypeError('character is required');
      const characterId = requireText(character.characterId, 'character.characterId');
      const playerId = requireText(character.playerId, 'character.playerId');
      const existing = await db.prepare(
        'SELECT player_id FROM characters WHERE character_id = ?1 LIMIT 1'
      ).bind(characterId).first();

      if (existing && existing.player_id !== playerId) throw new Error('character ownership mismatch');

      const payload = JSON.stringify(character);
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO characters (character_id, player_id, status, payload_json, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?5)
        ON CONFLICT(character_id) DO UPDATE SET
          status = excluded.status,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).bind(characterId, playerId, character.status ?? 'alive', payload, now).run();

      return JSON.parse(payload);
    },

    async getById(characterId) {
      const row = await db.prepare(
        'SELECT payload_json FROM characters WHERE character_id = ?1 LIMIT 1'
      ).bind(requireText(characterId, 'characterId')).first();
      return parseRow(row);
    },

    async getByPlayerId(playerId) {
      const result = await db.prepare(
        'SELECT payload_json FROM characters WHERE player_id = ?1 ORDER BY created_at ASC'
      ).bind(requireText(playerId, 'playerId')).all();
      return (result.results ?? []).map(parseRow);
    },
  });
}
