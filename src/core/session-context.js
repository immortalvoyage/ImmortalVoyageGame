import { createPlayer, PLAYER_ROLES } from "./player.js";

export function createSessionContext({ userId, characterId = null, ownerUserId = null } = {}) {
  if (!userId) throw new Error("userId is required");
  const role = ownerUserId && String(userId) === String(ownerUserId)
    ? PLAYER_ROLES.OWNER
    : PLAYER_ROLES.PLAYER;

  return Object.freeze({
    player: createPlayer({ userId, characterId, role }),
    authenticated: true
  });
}
