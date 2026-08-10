export class FeatureFlags {
  #flags;

  constructor(initialFlags = {}) {
    this.#flags = new Map(Object.entries(initialFlags).map(([key, value]) => [key, Boolean(value)]));
  }

  isEnabled(flagName) {
    return this.#flags.get(flagName) === true;
  }

  set(flagName, enabled) {
    this.#flags.set(flagName, Boolean(enabled));
    return this.isEnabled(flagName);
  }

  snapshot() {
    return Object.fromEntries(this.#flags.entries());
  }
}
