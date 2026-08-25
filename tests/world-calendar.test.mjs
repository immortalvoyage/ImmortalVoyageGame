import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CALENDAR_ZONE_ID,
  GAME_EPOCH_ID,
  GAME_EPOCH_LABEL,
  WORLD_CALENDAR_VERSION,
  assertWorldInstant,
  createCalendarProjectionContext,
  createWorldInstant,
  worldInstantFromWorld,
} from '../src/core/world-calendar.js';

test('world instant uses the canonical game epoch and logical-second offset', () => {
  assert.deepEqual(createWorldInstant(0), {
    epochId: GAME_EPOCH_ID,
    offsetSeconds: 0,
  });
  assert.equal(GAME_EPOCH_LABEL, 'WE 1000-01-01 00:00:00');
  assert.deepEqual(worldInstantFromWorld({ logicalTimeSeconds: 42 }), {
    epochId: GAME_EPOCH_ID,
    offsetSeconds: 42,
  });
});

test('world instant remains deterministic far beyond ten thousand years without JavaScript Date', () => {
  const secondsBeyondTenThousandYears = 12_000 * 366 * 24 * 60 * 60;
  const instant = createWorldInstant(secondsBeyondTenThousandYears);

  assert.equal(Number.isSafeInteger(instant.offsetSeconds), true);
  assert.equal(instant.offsetSeconds, secondsBeyondTenThousandYears);
  assert.equal(instant.epochId, GAME_EPOCH_ID);
});

test('world instant rejects malformed, negative, fractional, and unsafe offsets', () => {
  for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
    assert.throws(() => createWorldInstant(value), /nonnegative safe integer/);
  }
  assert.throws(() => assertWorldInstant({ epochId: 'OTHER_EPOCH', offsetSeconds: 0 }), /unsupported world epoch/);
});

test('calendar projection metadata cannot redefine the authoritative instant', () => {
  const instant = createWorldInstant(123456789);
  const a = createCalendarProjectionContext({ instant, calendarZoneId: 'calendar-zone:origin' });
  const b = createCalendarProjectionContext({
    instant,
    calendarVersion: WORLD_CALENDAR_VERSION + 1,
    calendarZoneId: 'world-zone:future-east',
  });

  assert.deepEqual(a.instant, instant);
  assert.deepEqual(b.instant, instant);
  assert.equal(a.calendarVersion, WORLD_CALENDAR_VERSION);
  assert.equal(a.calendarZoneId, 'calendar-zone:origin');
  assert.notEqual(a.calendarVersion, b.calendarVersion);
  assert.notEqual(a.calendarZoneId, b.calendarZoneId);
});

test('calendar projection context fails closed on invalid version or zone', () => {
  const instant = createWorldInstant(0);
  assert.throws(() => createCalendarProjectionContext({ instant, calendarVersion: 0 }), /calendarVersion/);
  assert.throws(() => createCalendarProjectionContext({ instant, calendarZoneId: '' }), /calendarZoneId/);
});

