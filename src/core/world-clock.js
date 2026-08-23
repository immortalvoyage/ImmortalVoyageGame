export function resolveElapsedSeconds({ nowMs, lastResolvedAtMs }) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastResolvedAtMs)) {
    throw new TypeError('world clock timestamps must be finite numbers');
  }
  if (nowMs < lastResolvedAtMs) return 0;
  return Math.floor((nowMs - lastResolvedAtMs) / 1000);
}

export function resolveWorldTime(world, nowMs) {
  const elapsedSeconds = resolveElapsedSeconds({ nowMs, lastResolvedAtMs: world.lastResolvedAtMs });
  return {
    elapsedSeconds,
    world: {
      ...world,
      logicalTimeSeconds: world.logicalTimeSeconds + elapsedSeconds,
      lastResolvedAtMs: nowMs,
    },
  };
}
