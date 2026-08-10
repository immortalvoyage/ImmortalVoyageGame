export const PLAYER_ROLES = Object.freeze({ PLAYER: "player", OWNER: "owner" });

export function createPlayer({ userId, characterId = null, role = PLAYER_ROLES.PLAYER } = {}) {
  if (!userId) throw new Error("userId is required");
  if (!Object.values(PLAYER_ROLES).includes(role)) throw new Error("invalid player role");
  return Object.freeze({ userId: String(userId), characterId, role });
}

export function isOwner(player) {
  return player?.role === PLAYER_ROLES.OWNER;
}
