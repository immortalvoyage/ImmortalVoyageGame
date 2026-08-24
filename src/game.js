import { GameRuntime } from './core/game-runtime.js';
import { createInitialWorld } from './core/world-state.js';
import { MemoryGameStore } from './adapters/memory-game-store.js';
import { FileGameStore } from './adapters/file-game-store.js';
import { devStarterPack } from './content/dev-starter.js';
import { validateContentPack } from './content/validate-content-pack.js';
import { validateWorldContentCompatibility } from './content/validate-world-content-compatibility.js';
import { characterModule } from './modules/character/index.js';
import { inventoryModule } from './modules/inventory/index.js';
import { locationModule } from './modules/location/index.js';
import { npcModule } from './modules/npc/index.js';
import { purposeModule } from './modules/purpose/index.js';
import { survivalModule } from './modules/survival/index.js';
import { economyModule } from './modules/economy/index.js';
import { craftingModule } from './modules/crafting/index.js';
import { progressionModule } from './modules/progression/index.js';
import { careerModule } from './modules/career/index.js';
import { narrativeModule } from './modules/narrative/index.js';

const allModules = [
  characterModule,
  inventoryModule,
  locationModule,
  npcModule,
  purposeModule,
  survivalModule,
  economyModule,
  craftingModule,
  progressionModule,
  careerModule,
  narrativeModule,
];

export function createGame({
  store,
  contentPack = devStarterPack,
  now = () => Date.now(),
  enabledModules = allModules.map((module) => module.manifest.name),
}) {
  if (!store) throw new TypeError('store is required');
  validateContentPack(contentPack);
  const enabled = new Set(enabledModules);
  const modules = allModules.filter((module) => enabled.has(module.manifest.name));
  const runtime = new GameRuntime({
    store,
    modules,
    runtimeContext: { contentPack },
    validateLoadedWorld: (world) => validateWorldContentCompatibility(world, contentPack),
    now,
  });
  return { runtime, store };
}

export function createDevelopmentGame({ now = () => Date.now(), enabledModules, contentPack = devStarterPack } = {}) {
  const store = new MemoryGameStore(createInitialWorld({ nowMs: now() }));
  return createGame({ store, contentPack, now, enabledModules });
}

export function createFileBackedDevelopmentGame({ filePath, now = () => Date.now(), enabledModules, contentPack = devStarterPack } = {}) {
  const store = new FileGameStore({
    filePath,
    createInitialWorld: () => createInitialWorld({ nowMs: now() }),
  });
  return createGame({ store, contentPack, now, enabledModules });
}
