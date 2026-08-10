import { isOwner } from "./player.js";

export const TESTER_ACCESS_STATUS = Object.freeze({ ACTIVE: "active", REVOKED: "revoked" });
export const TESTER_ACCESS_SOURCES = Object.freeze({
  INVITE: "invite",
  SPONSOR: "sponsor",
  CONTRIBUTOR: "contributor",
  OWNER: "owner"
});

export function createTesterAccess({ userId, source = TESTER_ACCESS_SOURCES.INVITE, status = TESTER_ACCESS_STATUS.ACTIVE, expiresAt = null } = {}) {
  if (!userId) throw new Error("userId is required");
  if (!Object.values(TESTER_ACCESS_SOURCES).includes(source)) throw new Error("invalid tester access source");
  if (!Object.values(TESTER_ACCESS_STATUS).includes(status)) throw new Error("invalid tester access status");
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= 0)) throw new Error("invalid tester access expiry");
  return Object.freeze({ userId: String(userId), source, status, expiresAt });
}

export function hasTesterAccess(player, testerAccess = null, nowMs = Date.now()) {
  if (isOwner(player)) return true;
  if (!player || !testerAccess) return false;
  if (String(player.userId) !== String(testerAccess.userId)) return false;
  if (testerAccess.status !== TESTER_ACCESS_STATUS.ACTIVE) return false;
  if (testerAccess.expiresAt !== null && testerAccess.expiresAt <= nowMs) return false;
  return true;
}
