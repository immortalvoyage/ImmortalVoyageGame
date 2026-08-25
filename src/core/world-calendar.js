export const GAME_EPOCH_ID = 'GAME_EPOCH_001';
export const GAME_EPOCH_LABEL = 'WE 1000-01-01 00:00:00';
export const WORLD_CALENDAR_VERSION = 1;
export const DEFAULT_CALENDAR_ZONE_ID = 'world-zone:origin';

function assertNonNegativeSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer`);
  }
}

export function createWorldInstant(offsetSeconds) {
  assertNonNegativeSafeInteger(offsetSeconds, 'world instant offsetSeconds');
  return Object.freeze({
    epochId: GAME_EPOCH_ID,
    offsetSeconds,
  });
}

export function worldInstantFromWorld(world) {
  if (!world || typeof world !== 'object') throw new TypeError('world is required');
  return createWorldInstant(world.logicalTimeSeconds);
}

export function assertWorldInstant(instant) {
  if (!instant || typeof instant !== 'object' || Array.isArray(instant)) {
    throw new TypeError('invalid world instant');
  }
  if (instant.epochId !== GAME_EPOCH_ID) throw new Error('unsupported world epoch');
  assertNonNegativeSafeInteger(instant.offsetSeconds, 'world instant offsetSeconds');
  return instant;
}

export function createCalendarProjectionContext({
  instant,
  calendarVersion = WORLD_CALENDAR_VERSION,
  calendarZoneId,
} = {}) {
  assertWorldInstant(instant);
  if (!Number.isSafeInteger(calendarVersion) || calendarVersion < 1) {
    throw new TypeError('calendarVersion must be a positive safe integer');
  }
  if (typeof calendarZoneId !== 'string' || calendarZoneId.length === 0) {
    throw new TypeError('calendarZoneId must be non-empty text');
  }

  return Object.freeze({
    instant: Object.freeze({ ...instant }),
    calendarVersion,
    calendarZoneId,
  });
}

