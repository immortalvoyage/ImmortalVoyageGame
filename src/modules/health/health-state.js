function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function requireNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${field} must be a number`);
  return number;
}

export class HealthState {
  #health;
  #maxHealth;
  #conditions = new Map();

  constructor({ health = 100, maxHealth = 100 } = {}) {
    this.#maxHealth = Math.max(1, requireNumber(maxHealth, 'maxHealth'));
    this.#health = clamp(requireNumber(health, 'health'), 0, this.#maxHealth);
  }

  get health() { return this.#health; }
  get maxHealth() { return this.#maxHealth; }
  get isIncapacitated() { return this.#health <= 0; }

  applyDamage(amount) {
    const damage = Math.max(0, requireNumber(amount, 'amount'));
    this.#health = clamp(this.#health - damage, 0, this.#maxHealth);
    return this.snapshot();
  }

  heal(amount) {
    const healing = Math.max(0, requireNumber(amount, 'amount'));
    this.#health = clamp(this.#health + healing, 0, this.#maxHealth);
    return this.snapshot();
  }

  setCondition(id, severity = 1) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('condition id is required');
    const level = Math.max(1, Math.floor(requireNumber(severity, 'severity')));
    this.#conditions.set(id.trim(), level);
    return this.snapshot();
  }

  removeCondition(id) {
    this.#conditions.delete(id);
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({
      health: this.#health,
      maxHealth: this.#maxHealth,
      incapacitated: this.isIncapacitated,
      conditions: Object.freeze([...this.#conditions.entries()].map(([id, severity]) => Object.freeze({ id, severity }))),
    });
  }
}
