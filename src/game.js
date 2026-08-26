import { GameRuntime } from './core/game-runtime.js';
import { createInitialWorld } from './core/world-state.js';
import { assertWorldNamespace, LOCAL_DEVELOPMENT_ENVIRONMENT, LOCAL_TUTORIAL_ENVIRONMENT } from './core/runtime-environment.js';
import { MemoryGameStore } from './adapters/memory-game-store.js';
import { FileGameStore } from './adapters/file-game-store.js';
import { devStarterPack } from './content/dev-starter.js';
import { tutorialVillagePack } from './content/tutorial-village.js';
import { validateContentPack } from './content/validate-content-pack.js';
import { validateWorldContentCompatibility } from './content/validate-world-content-compatibility.js';
import { characterModule } from './modules/character/index.js';
import { lifeModule } from './modules/life/index.js';
import { inventoryModule } from './modules/inventory/index.js';
import { locationModule } from './modules/location/index.js';
import { npcModule } from './modules/npc/index.js';
import { purposeModule } from './modules/purpose/index.js';
import { survivalModule } from './modules/survival/index.js';
import { employmentModule } from './modules/employment/index.js';
import { economyModule } from './modules/economy/index.js';
import { tradeModule } from './modules/trade/index.js';
import { craftingModule } from './modules/crafting/index.js';
import { progressionModule } from './modules/progression/index.js';
import { careerModule } from './modules/career/index.js';
import { relationshipModule } from './modules/relationship/index.js';
import { knowledgeModule } from './modules/knowledge/index.js';
import { estateModule } from './modules/estate/index.js';
import { situationModule } from './modules/situation/index.js';
import { narrativeModule } from './modules/narrative/index.js';

const allModules = [
  lifeModule,
  characterModule,
  inventoryModule,
  locationModule,
  npcModule,
  purposeModule,
  survivalModule,
  employmentModule,
  economyModule,
  tradeModule,
  craftingModule,
  progressionModule,
  careerModule,
  relationshipModule,
  knowledgeModule,
  estateModule,
  situationModule,
  narrativeModule,
];

const tutorialModuleNames = Object.freeze([
  'character',
  'inventory',
  'location',
  'npc',
  'survival',
  'employment',
  'economy',
  'relationship',
  'situation',
  'narrative',
]);

export function createGame({
  store,
  contentPack = devStarterPack,
  now = () => Date.now(),
  enabledModules = allModules.map((module) => module.manifest.name),
  runtimeEnvironment = null,
  lifeBirthPolicy = 'direct',
}) {
  if (!store) throw new TypeError('store is required');
  if (!['direct', 'pending-required'].includes(lifeBirthPolicy)) throw new TypeError('invalid life birth policy');
  validateContentPack(contentPack);
  const enabled = new Set(enabledModules);
  const modules = allModules.filter((module) => enabled.has(module.manifest.name));
  const runtime = new GameRuntime({
    store,
    modules,
    runtimeContext: { contentPack, runtimeEnvironment, lifeBirthPolicy },
    validateLoadedWorld: (world) => {
      if (runtimeEnvironment) assertWorldNamespace(world, runtimeEnvironment);
      validateWorldContentCompatibility(world, contentPack);
    },
    now,
  });
  return { runtime, store };
}

export function createDevelopmentGame({
  now = () => Date.now(),
  enabledModules,
  contentPack = devStarterPack,
  lifeBirthPolicy = 'direct',
} = {}) {
  const runtimeEnvironment = LOCAL_DEVELOPMENT_ENVIRONMENT;
  const store = new MemoryGameStore(createInitialWorld({
    nowMs: now(),
    worldId: runtimeEnvironment.worldNamespace,
  }));
  return createGame({ store, contentPack, now, enabledModules, runtimeEnvironment, lifeBirthPolicy });
}

export function createFileBackedDevelopmentGame({
  filePath,
  now = () => Date.now(),
  enabledModules,
  contentPack = devStarterPack,
  lifeBirthPolicy = 'direct',
  runtimeEnvironment = LOCAL_DEVELOPMENT_ENVIRONMENT,
} = {}) {
  const store = new FileGameStore({
    filePath,
    createInitialWorld: () => createInitialWorld({ nowMs: now(), worldId: runtimeEnvironment.worldNamespace }),
  });
  return createGame({ store, contentPack, now, enabledModules, runtimeEnvironment, lifeBirthPolicy });
}

export function createTutorialDevelopmentGame({ now = () => Date.now() } = {}) {
  const runtimeEnvironment = LOCAL_TUTORIAL_ENVIRONMENT;
  const store = new MemoryGameStore(createInitialWorld({
    nowMs: now(),
    worldId: runtimeEnvironment.worldNamespace,
  }));
  return createGame({
    store,
    contentPack: tutorialVillagePack,
    now,
    enabledModules: tutorialModuleNames,
    runtimeEnvironment,
  });
}
