import { GameRuntime } from './core/game-runtime.js';
import { createInitialWorld } from './core/world-state.js';
import { MemoryGameStore } from './adapters/memory-game-store.js';
import { characterModule } from './modules/character/index.js';
import { inventoryModule } from './modules/inventory/index.js';
import { locationModule } from './modules/location/index.js';
import { npcModule } from './modules/npc/index.js';
import { survivalModule } from './modules/survival/index.js';
import { economyModule } from './modules/economy/index.js';

const allModules = [characterModule, inventoryModule, locationModule, npcModule, survivalModule, economyModule];

export function createDevelopmentGame({ now = () => Date.now(), enabledModules = allModules.map((module) => module.manifest.name) } = {}) {
  const enabled = new Set(enabledModules);
  const modules = allModules.filter((module) => enabled.has(module.manifest.name));
  const store = new MemoryGameStore(createInitialWorld({ nowMs: now() }));
  const runtime = new GameRuntime({ store, modules, now });
  return { runtime, store };
}
