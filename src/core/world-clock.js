export class WorldClock {
  constructor({ epochMs = Date.UTC(2026, 7, 10), realMsPerWorldDay = 8 * 60 * 60 * 1000 } = {}) {
    if (!Number.isFinite(epochMs) || !Number.isFinite(realMsPerWorldDay) || realMsPerWorldDay <= 0) {
      throw new TypeError("Invalid world clock configuration");
    }
    this.epochMs = epochMs;
    this.realMsPerWorldDay = realMsPerWorldDay;
  }

  getWorldDay(nowMs = Date.now()) {
    return Math.max(0, Math.floor((nowMs - this.epochMs) / this.realMsPerWorldDay));
  }

  getProgress(nowMs = Date.now()) {
    const elapsed = Math.max(0, nowMs - this.epochMs);
    return (elapsed % this.realMsPerWorldDay) / this.realMsPerWorldDay;
  }

  snapshot(nowMs = Date.now()) {
    return {
      worldDay: this.getWorldDay(nowMs),
      dayProgress: this.getProgress(nowMs),
      realMsPerWorldDay: this.realMsPerWorldDay,
      epochMs: this.epochMs
    };
  }
}
