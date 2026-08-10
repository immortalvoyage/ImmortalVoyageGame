function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function requireNeed(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${field} must be a number`);
  return clamp(number, 0, 100);
}

export class SurvivalNeeds {
  #hunger;
  #thirst;

  constructor({ hunger = 100, thirst = 100 } = {}) {
    this.#hunger = requireNeed(hunger, 'hunger');
    this.#thirst = requireNeed(thirst, 'thirst');
  }

  get hunger() { return this.#hunger; }
  get thirst() { return this.#thirst; }

  consume({ hunger = 0, thirst = 0 } = {}) {
    this.#hunger = requireNeed(this.#hunger + Number(hunger || 0), 'hunger');
    this.#thirst = requireNeed(this.#thirst + Number(thirst || 0), 'thirst');
    return this.snapshot();
  }

  decay({ hunger = 0, thirst = 0 } = {}) {
    this.#hunger = requireNeed(this.#hunger - Math.max(0, Number(hunger || 0)), 'hunger');
    this.#thirst = requireNeed(this.#thirst - Math.max(0, Number(thirst || 0)), 'thirst');
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({ hunger: this.#hunger, thirst: this.#thirst });
  }
}
