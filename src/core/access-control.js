import { isOwner } from "./player.js";

export const PERMISSIONS = Object.freeze({
  PLAY: "play",
  OWNER_CONSOLE: "owner:console",
  MANAGE_TESTERS: "owner:manage-testers"
});

export function can(player, permission) {
  if (!player) return false;
  if (permission === PERMISSIONS.PLAY) return true;
  if (permission === PERMISSIONS.OWNER_CONSOLE || permission === PERMISSIONS.MANAGE_TESTERS) return isOwner(player);
  return false;
}

export function requirePermission(player, permission) {
  if (!can(player, permission)) throw new Error(`permission denied: ${permission}`);
  return true;
}
