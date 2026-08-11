const DANGER_LEVELS = new Set(['safe','low','moderate','high','critical']);
const SUPPLY_POLICIES = new Set(['none','self','provided','prepaid','conditional']);
const ABSENCE_POLICIES = new Set(['none','lenient','standard','strict']);

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function assertEnum(value, allowed, field) {
  if (!allowed.has(value)) throw new TypeError(`unsupported ${field}`);
  return value;
}

export function createOfflineState({
  locationId,
  shelter = 'none',
  foodSupply = 'none',
  waterSupply = 'none',
  dangerLevel = 'moderate',
  occupationDuty = null,
  lastActiveAt = new Date().toISOString(),
} = {}) {
  return Object.freeze({
    locationId: requireText(locationId, 'locationId'),
    shelter: requireText(shelter, 'shelter'),
    foodSupply: assertEnum(foodSupply, SUPPLY_POLICIES, 'foodSupply'),
    waterSupply: assertEnum(waterSupply, SUPPLY_POLICIES, 'waterSupply'),
    dangerLevel: assertEnum(dangerLevel, DANGER_LEVELS, 'dangerLevel'),
    occupationDuty: occupationDuty ? normalizeOccupationDuty(occupationDuty) : null,
    lastActiveAt: requireText(lastActiveAt, 'lastActiveAt'),
  });
}

export function normalizeOccupationDuty({
  occupationId,
  employerId = null,
  housingPolicy = 'none',
  mealPolicy = 'none',
  absencePolicy = 'standard',
  dutyScheduleId = null,
} = {}) {
  return Object.freeze({
    occupationId: requireText(occupationId, 'occupationId'),
    employerId: employerId ? requireText(employerId, 'employerId') : null,
    housingPolicy: assertEnum(housingPolicy, SUPPLY_POLICIES, 'housingPolicy'),
    mealPolicy: assertEnum(mealPolicy, SUPPLY_POLICIES, 'mealPolicy'),
    absencePolicy: assertEnum(absencePolicy, ABSENCE_POLICIES, 'absencePolicy'),
    dutyScheduleId: dutyScheduleId ? requireText(dutyScheduleId, 'dutyScheduleId') : null,
  });
}

export function offlineProvisionSummary(offlineState) {
  const state = createOfflineState(offlineState);
  return Object.freeze({
    hasShelter: state.shelter !== 'none',
    foodCovered: state.foodSupply === 'provided' || state.foodSupply === 'prepaid',
    waterCovered: state.waterSupply === 'provided' || state.waterSupply === 'prepaid',
    dutyCanApply: Boolean(state.occupationDuty && state.occupationDuty.absencePolicy !== 'none'),
    dangerLevel: state.dangerLevel,
  });
}

export { DANGER_LEVELS, SUPPLY_POLICIES, ABSENCE_POLICIES };
