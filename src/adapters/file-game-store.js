import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cloneWorld } from '../core/world-state.js';

export class FileGameStore {
  constructor({ filePath, createInitialWorld }) {
    if (!filePath) throw new TypeError('filePath is required');
    if (typeof createInitialWorld !== 'function') throw new TypeError('createInitialWorld is required');
    this.filePath = filePath;
    this.createInitialWorld = createInitialWorld;
    this.world = null;
    this.lock = Promise.resolve();
  }

  async transact(fn) {
    let release;
    const previous = this.lock;
    this.lock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      await this.#ensureLoaded();
      return await fn(cloneWorld(this.world));
    } finally {
      release();
    }
  }

  async replace(nextWorld) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    const serialized = `${JSON.stringify(nextWorld, null, 2)}\n`;
    await writeFile(tempPath, serialized, { encoding: 'utf8', mode: 0o600 });
    await rename(tempPath, this.filePath);
    this.world = cloneWorld(nextWorld);
  }

  async #ensureLoaded() {
    if (this.world) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.world = JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const initial = this.createInitialWorld();
      await this.replace(initial);
    }
  }
}
