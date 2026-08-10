export class EventBus {
  #listeners = new Map();

  on(eventName, handler) {
    if (typeof handler !== "function") throw new TypeError("Event handler must be a function");
    const handlers = this.#listeners.get(eventName) ?? new Set();
    handlers.add(handler);
    this.#listeners.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const handlers = this.#listeners.get(eventName);
    if (!handlers) return false;
    const removed = handlers.delete(handler);
    if (handlers.size === 0) this.#listeners.delete(eventName);
    return removed;
  }

  async emit(eventName, payload = {}) {
    const handlers = [...(this.#listeners.get(eventName) ?? [])];
    const results = [];
    for (const handler of handlers) results.push(await handler(payload));
    return results;
  }
}
