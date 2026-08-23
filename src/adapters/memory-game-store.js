import { cloneWorld } from '../core/world-state.js';

export class MemoryGameStore {
  constructor(initialWorld) {
    this.world = cloneWorld(initialWorld);
    this.lock = Promise.resolve();
  }

  async transact(fn) {
    let release;
    const previous = this.lock;
    this.lock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await fn(cloneWorld(this.world));
    } finally {
      release();
    }
  }

  async replace(nextWorld) {
    this.world = cloneWorld(nextWorld);
  }

  snapshot() {
    return cloneWorld(this.world);
  }
}
