import { ActionResolver } from './action-resolver.js';
import { migrateWorldState } from './schema-migration.js';
import { assertWorldState, recordGameEvents, rememberRequest } from './world-state.js';
import { resolveWorldTime } from './world-clock.js';

export class GameRuntime {
  constructor({ store, modules, runtimeContext = {}, validateLoadedWorld = () => {}, now = () => Date.now() }) {
    if (typeof validateLoadedWorld !== 'function') throw new TypeError('validateLoadedWorld must be a function');
    this.store = store;
    this.now = now;
    this.modules = modules;
    this.runtimeContext = runtimeContext;
    this.validateLoadedWorld = validateLoadedWorld;
    this.resolver = new ActionResolver();
    for (const module of modules) this.resolver.registerModule(module);
  }

  async dispatch({ actor, requestId, action }) {
    if (!actor?.sessionId) return { ok: false, code: 'UNAUTHENTICATED' };
    if (!requestId || typeof requestId !== 'string' || requestId.length > 128) return { ok: false, code: 'INVALID_REQUEST_ID' };

    return this.store.transact(async (loaded) => {
      let world = assertWorldState(migrateWorldState(loaded));
      this.validateLoadedWorld(world);
      const prior = world.requestResults[requestId];
      if (prior) {
        if (prior.sessionId !== actor.sessionId) return { ok: false, code: 'REQUEST_ID_COLLISION' };
        return structuredClone(prior.result);
      }

      const resolvedTime = resolveWorldTime(world, this.now());
      world = resolvedTime.world;
      const context = {
        ...this.runtimeContext,
        nowMs: world.lastResolvedAtMs,
        isActionAvailable: (actionType) => this.resolver.hasAction(actionType),
      };
      for (const module of this.modules) {
        if (typeof module.resolveElapsed === 'function') {
          module.resolveElapsed({
            world,
            actor,
            elapsedSeconds: resolvedTime.elapsedSeconds,
            context,
          });
        }
      }

      const result = this.resolver.resolve({ world, actor, action, context });
      if (!result.ok) return result;

      const committed = result.world;
      const activeCharacter = committed.characters?.[actor.sessionId];
      if (activeCharacter?.ownerSessionId === actor.sessionId && activeCharacter.status === 'alive') {
        activeCharacter.lastActiveLogicalTimeSeconds = committed.logicalTimeSeconds;
      }
      recordGameEvents(committed, result.events);
      const publicResult = { ok: true, code: result.code ?? 'OK', data: result.data ?? null };
      rememberRequest(committed, { requestId, sessionId: actor.sessionId, result: publicResult });
      assertWorldState(committed);
      this.validateLoadedWorld(committed);
      await this.store.replace(committed);
      return publicResult;
    });
  }
}
