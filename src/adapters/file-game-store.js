import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cloneWorld } from '../core/world-state.js';

const defaultFileOps = Object.freeze({ mkdir, readFile, rename, rm, writeFile });

export class FileGameStore {
  constructor({ filePath, createInitialWorld, fileOps = {} }) {
    if (!filePath) throw new TypeError('filePath is required');
    if (typeof createInitialWorld !== 'function') throw new TypeError('createInitialWorld is required');
    this.filePath = filePath;
    this.createInitialWorld = createInitialWorld;
    this.fileOps = { ...defaultFileOps, ...fileOps };
    for (const operation of Object.keys(defaultFileOps)) {
      if (typeof this.fileOps[operation] !== 'function') throw new TypeError(`fileOps.${operation} must be a function`);
    }
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
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    const serialized = `${JSON.stringify(nextWorld, null, 2)}\n`;
    try {
      await this.fileOps.mkdir(dirname(this.filePath), { recursive: true });
      await this.fileOps.writeFile(tempPath, serialized, { encoding: 'utf8', mode: 0o600 });
      await this.fileOps.rename(tempPath, this.filePath);
      this.world = cloneWorld(nextWorld);
    } catch (error) {
      // A storage error can be ambiguous: rename may have committed the file before
      // the adapter observed an error. Drop the cache so the next transaction reloads
      // the authoritative file and lets request idempotency decide whether to replay.
      this.world = null;
      try {
        await this.fileOps.rm(tempPath, { force: true });
      } catch {
        // Cleanup is best-effort; never replace the original persistence error.
      }
      throw error;
    }
  }

  async #ensureLoaded() {
    if (this.world) return;
    try {
      const raw = await this.fileOps.readFile(this.filePath, 'utf8');
      this.world = JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const initial = this.createInitialWorld();
      await this.replace(initial);
    }
  }
}
