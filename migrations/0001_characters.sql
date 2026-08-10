CREATE TABLE IF NOT EXISTS characters (
  character_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'alive',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_characters_player_id
  ON characters(player_id);
