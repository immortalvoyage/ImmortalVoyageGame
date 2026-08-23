import { cloneWorld } from './world-state.js';

export class ActionResolver {
  #handlers = new Map();

  registerModule(module) {
    for (const actionType of module.manifest.actions) {
      if (this.#handlers.has(actionType)) throw new Error(`duplicate action handler: ${actionType}`);
      const handler = module.actions[actionType];
      if (typeof handler !== 'function') throw new Error(`missing handler: ${actionType}`);
      this.#handlers.set(actionType, { moduleName: module.manifest.name, handler });
    }
  }

  resolve({ world, actor, action, context }) {
    if (!action || typeof action.type !== 'string') return { ok: false, code: 'INVALID_ACTION' };
    const entry = this.#handlers.get(action.type);
    if (!entry) return { ok: false, code: 'UNKNOWN_ACTION' };
    const draft = cloneWorld(world);
    const outcome = entry.handler({ world: draft, actor, action, context });
    if (!outcome?.ok) return outcome ?? { ok: false, code: 'ACTION_REJECTED' };
    return { ...outcome, world: draft, module: entry.moduleName };
  }
}
