function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRate(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < 0) throw new TypeError('invalid survival rate');
  return number;
}

export function resolveSurvivalTime({
  needs,
  elapsedWorldDays,
  online = true,
  safeOffline = false,
  hungerPerDay = 18,
  thirstPerDay = 34,
  hungerModifier = 1,
  thirstModifier = 1,
  maxUnsafeOfflineDays = 0.5,
}) {
  const days = Math.max(0, Number(elapsedWorldDays) || 0);
  const hungerRate = normalizeRate(hungerPerDay, 18) * Math.max(0, Number(hungerModifier) || 0);
  const thirstRate = normalizeRate(thirstPerDay, 34) * Math.max(0, Number(thirstModifier) || 0);

  let effectiveDays = days;
  let protection = 'none';

  if (!online) {
    if (safeOffline) {
      effectiveDays = 0;
      protection = 'safe_offline';
    } else {
      effectiveDays = Math.min(days, Math.max(0, Number(maxUnsafeOfflineDays) || 0));
      protection = 'unsafe_offline_capped';
    }
  }

  needs.decay({ hunger: hungerRate * effectiveDays, thirst: thirstRate * effectiveDays });

  const hunger = needs.hunger;
  const thirst = needs.thirst;
  const starvationPressure = hunger === 0 ? clamp(effectiveDays * 0.35, 0, 1) : 0;
  const dehydrationPressure = thirst === 0 ? clamp(effectiveDays * 0.75, 0, 1) : 0;

  return Object.freeze({
    state: needs.snapshot(),
    effectiveDays,
    protection,
    crisis: Object.freeze({
      starving: hunger === 0,
      dehydrated: thirst === 0,
      starvationPressure,
      dehydrationPressure,
      fatal: false,
    }),
  });
}
