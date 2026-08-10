export const TURN_SOURCES = Object.freeze({
  FREE_DAILY: "free_daily",
  GRANTED: "granted",
  REWARDED_AD: "rewarded_ad",
  PURCHASED: "purchased"
});

const DEFAULT_CONSUME_ORDER = Object.freeze([
  TURN_SOURCES.FREE_DAILY,
  TURN_SOURCES.GRANTED,
  TURN_SOURCES.REWARDED_AD,
  TURN_SOURCES.PURCHASED
]);

export class TurnLedger {
  #balances = new Map();
  #entries = [];

  constructor({ userId, balances = {} } = {}) {
    if (!userId) throw new Error("userId is required");
    this.userId = String(userId);
    for (const source of Object.values(TURN_SOURCES)) this.#balances.set(source, 0);
    for (const [source, amount] of Object.entries(balances)) this.grant(source, amount, { reason: "initial" });
  }

  grant(source, amount, { reason = null, at = Date.now() } = {}) {
    validateSource(source);
    validateAmount(amount);
    this.#balances.set(source, this.balance(source) + amount);
    this.#entries.push(Object.freeze({ type: "grant", source, amount, reason, at }));
    return this.balance(source);
  }

  setDailyFree(amount, { at = Date.now() } = {}) {
    validateAmount(amount, true);
    const previous = this.balance(TURN_SOURCES.FREE_DAILY);
    this.#balances.set(TURN_SOURCES.FREE_DAILY, amount);
    this.#entries.push(Object.freeze({ type: "daily_reset", source: TURN_SOURCES.FREE_DAILY, amount, previous, at }));
    return amount;
  }

  consume(amount = 1, { order = DEFAULT_CONSUME_ORDER, reason = "game_turn", at = Date.now() } = {}) {
    validateAmount(amount);
    if (this.total() < amount) return Object.freeze({ ok: false, consumed: 0, remaining: this.total(), breakdown: {} });

    let pending = amount;
    const breakdown = {};
    for (const source of order) {
      validateSource(source);
      if (pending <= 0) break;
      const available = this.balance(source);
      const used = Math.min(available, pending);
      if (used <= 0) continue;
      this.#balances.set(source, available - used);
      breakdown[source] = used;
      pending -= used;
    }

    if (pending > 0) throw new Error("consume order cannot satisfy requested amount");
    this.#entries.push(Object.freeze({ type: "consume", amount, reason, breakdown: Object.freeze({ ...breakdown }), at }));
    return Object.freeze({ ok: true, consumed: amount, remaining: this.total(), breakdown: Object.freeze({ ...breakdown }) });
  }

  balance(source) {
    validateSource(source);
    return this.#balances.get(source) ?? 0;
  }

  total() {
    let total = 0;
    for (const amount of this.#balances.values()) total += amount;
    return total;
  }

  snapshot() {
    return Object.freeze({
      userId: this.userId,
      balances: Object.freeze(Object.fromEntries(this.#balances)),
      total: this.total()
    });
  }

  entries() {
    return [...this.#entries];
  }
}

function validateSource(source) {
  if (!Object.values(TURN_SOURCES).includes(source)) throw new Error("invalid turn source");
}

function validateAmount(amount, allowZero = false) {
  if (!Number.isInteger(amount) || amount < (allowZero ? 0 : 1)) throw new Error("turn amount must be a valid integer");
}
